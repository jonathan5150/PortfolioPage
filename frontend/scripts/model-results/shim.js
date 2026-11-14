// Browser stand-ins for running the app's grading code in Node (see
// precompute.js). Imported first, so it runs before any app module.
/* eslint-disable no-restricted-globals */
const fs = require('fs');
const path = require('path');

// set by precompute.js (the bundle runs from a temp folder)
const PUBLIC = process.env.MODEL_RESULTS_PUBLIC || path.join(process.cwd(), 'public');

if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;
if (!globalThis.localStorage || typeof globalThis.localStorage.getItem !== 'function') {
  const store = new Map();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
      clear: () => store.clear(),
    },
  });
}

// the site's same-origin proxy paths, pointed back at the real hosts
const PROXIES = [
  ['/espn/site/', 'https://site.api.espn.com/'],
  ['/espn/web/', 'https://site.web.api.espn.com/'],
  ['/espn/core/', 'https://sports.core.api.espn.com/'],
  ['/nflverse/', 'https://github.com/nflverse/nflverse-data/releases/download/'],
];
const realFetch = globalThis.fetch;
const stats = { requests: 0, failed: 0 };
globalThis.__precomputeStats = stats;

globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.startsWith('/models/')) {
    const file = path.join(PUBLIC, u.split('?')[0]);
    if (!file.startsWith(path.join(PUBLIC, 'models'))) return new Response('', { status: 404 });
    return new Response(fs.readFileSync(file), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  const proxy = PROXIES.find(([prefix]) => u.startsWith(prefix));
  if (u.startsWith('/') && !proxy) return new Response('', { status: 404 });
  const target = proxy ? proxy[1] + u.slice(proxy[0].length) : u;
  stats.requests += 1;
  try {
    const response = await realFetch(target, init);
    if (!response.ok) stats.failed += 1;
    return response;
  } catch (error) {
    stats.failed += 1;
    throw error;
  }
};
