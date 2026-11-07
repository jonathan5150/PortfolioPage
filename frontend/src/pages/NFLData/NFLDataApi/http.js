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

const fetchWithTimeout = async (url, timeoutMs) => {
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

const cachedRequest = async (url, { ttlMs = 0, timeoutMs = DEFAULT_TIMEOUT_MS, as = 'json' } = {}) => {
  const key = `${as}:${url}`;
  const now = Date.now();

  if (ttlMs > 0) {
    const hit = cache.get(key);
    if (hit && hit.expires > now) return hit.value;
  }

  if (inFlight.has(key)) return inFlight.get(key);

  const promise = (async () => {
    const response = await fetchWithTimeout(url, timeoutMs);
    const value = as === 'text' ? await response.text() : await response.json();
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
