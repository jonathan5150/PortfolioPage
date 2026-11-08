// Small fetch layer shared by the NFL data services.
// - in-memory TTL cache so repeated renders don't refetch
// - in-flight de-duplication so two cards asking for the same URL share one request
// - timeout so a hung request doesn't block the UI forever

const cache = new Map();
const inFlight = new Map();

const DEFAULT_TIMEOUT_MS = 12000;

export class HttpError extends Error {
  constructor(message, status, url) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.url = url;
  }
}

// Global cap on simultaneous network requests, so opening every card at once
// (the BET button) queues requests instead of firing hundreds together.
const MAX_CONCURRENT = 8;
let active = 0;
const waiting = [];

const acquire = () =>
  new Promise((resolve) => {
    if (active < MAX_CONCURRENT) {
      active += 1;
      resolve();
    } else {
      waiting.push(resolve);
    }
  });

const release = () => {
  const next = waiting.shift();
  if (next) next();
  else active -= 1;
};

const fetchWithTimeout = async (url, timeoutMs) => {
  await acquire();
  try {
    return await fetchOnce(url, timeoutMs);
  } finally {
    release();
  }
};

const fetchOnce = async (url, timeoutMs) => {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  try {
    const response = await fetch(url, controller ? { signal: controller.signal } : undefined);
    if (!response.ok) {
      throw new HttpError(`Request failed (${response.status})`, response.status, url);
    }
    return response;
  } finally {
    if (timer) clearTimeout(timer);
  }
};

// External hosts are reached through same-origin proxies (Cloudflare Pages Functions
// in production, src/setupProxy.js in dev) because some ESPN endpoints and GitHub's
// release downloads don't allow cross-origin browser requests.
const PROXY_RULES = [
  { origin: 'https://site.api.espn.com/', prefix: '/espn/site/' },
  { origin: 'https://site.web.api.espn.com/', prefix: '/espn/web/' },
  { origin: 'https://sports.core.api.espn.com/', prefix: '/espn/core/' },
  { origin: 'https://github.com/nflverse/nflverse-data/releases/download/', prefix: '/nflverse/' },
];

export const toProxyUrl = (url) => {
  const rule = PROXY_RULES.find((r) => url.startsWith(r.origin));
  return rule ? `${rule.prefix}${url.slice(rule.origin.length)}` : null;
};

// Once a proxy answers with something that isn't data (e.g. the SPA's index.html
// because the function isn't deployed), skip it for the rest of the session.
const unavailableProxies = new Set();
const proxyPrefixOf = (proxyUrl) => PROXY_RULES.find((r) => proxyUrl.startsWith(r.prefix))?.prefix;

const readBody = async (response, as) => {
  const text = await response.text();
  if (/^\s*</.test(text)) {
    const error = new Error('Expected data but received an HTML page');
    error.isHtml = true;
    throw error;
  }
  return as === 'text' ? text : JSON.parse(text);
};

const requestOnce = async (url, as, timeoutMs) => readBody(await fetchWithTimeout(url, timeoutMs), as);

const requestWithProxy = async (url, as, timeoutMs) => {
  const proxyUrl = toProxyUrl(url);
  const prefix = proxyUrl && proxyPrefixOf(proxyUrl);

  if (proxyUrl && !unavailableProxies.has(prefix)) {
    try {
      return await requestOnce(proxyUrl, as, timeoutMs);
    } catch (proxyError) {
      if (proxyError.isHtml || proxyError.status === 404) unavailableProxies.add(prefix);
      try {
        return await requestOnce(url, as, timeoutMs);
      } catch {
        throw proxyError;
      }
    }
  }

  return requestOnce(url, as, timeoutMs);
};

const cachedRequest = async (url, { ttlMs = 0, timeoutMs = DEFAULT_TIMEOUT_MS, as = 'json' } = {}) => {
  const key = `${as}:${url}`;
  const now = Date.now();

  if (ttlMs > 0) {
    const hit = cache.get(key);
    if (hit && hit.expires > now) return hit.value;
  }

  if (inFlight.has(key)) return inFlight.get(key);

  const promise = (async () => {
    const value = await requestWithProxy(url, as, timeoutMs);
    if (ttlMs > 0) cache.set(key, { value, expires: Date.now() + ttlMs });
    return value;
  })();

  inFlight.set(key, promise);

  try {
    return await promise;
  } finally {
    inFlight.delete(key);
  }
};

export const fetchJson = (url, options) => cachedRequest(url, { ...options, as: 'json' });
export const fetchText = (url, options) => cachedRequest(url, { ...options, as: 'text' });

export const clearHttpCache = (predicate) => {
  for (const key of cache.keys()) {
    if (!predicate || predicate(key)) cache.delete(key);
  }
};

// Run async task factories with a concurrency cap (keeps ESPN from rate limiting us
// when we load game logs for a whole roster).
export const runWithConcurrency = async (taskFactories, limit = 6) => {
  const results = new Array(taskFactories.length);
  let cursor = 0;

  const worker = async () => {
    while (cursor < taskFactories.length) {
      const index = cursor;
      cursor += 1;
      try {
        results[index] = { ok: true, value: await taskFactories[index]() };
      } catch (error) {
        results[index] = { ok: false, error };
      }
    }
  };

  const workers = Array.from({ length: Math.min(limit, taskFactories.length) }, worker);
  await Promise.all(workers);
  return results;
};
