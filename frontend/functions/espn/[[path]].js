// Cloudflare Pages Function: same-origin proxy for ESPN's API.
// ESPN doesn't send CORS headers on every endpoint, so browsers on
// jonathanrainey.dev can't call it directly. The page requests
//   /espn/site/apis/...  -> https://site.api.espn.com/apis/...
//   /espn/web/apis/...   -> https://site.web.api.espn.com/apis/...
// and this function fetches it server-side.

const HOSTS = {
  site: 'https://site.api.espn.com',
  web: 'https://site.web.api.espn.com',
};

// Live endpoints get a short edge cache; everything else can be cached longer.
const ttlFor = (path) => (/\/(scoreboard|summary)\b/.test(path) ? 10 : 300);

export async function onRequestGet({ request, params }) {
  const parts = Array.isArray(params.path) ? params.path : [params.path];
  const [hostKey, ...rest] = parts;
  const base = HOSTS[hostKey];
  const path = rest.join('/');

  // Only proxy ESPN's API paths; this is not an open proxy.
  if (!base || !/^apis\/[\w\-/.]+$/.test(path)) {
    return new Response('Not found', { status: 404 });
  }

  const search = new URL(request.url).search;
  const ttl = ttlFor(path);

  try {
    const upstream = await fetch(`${base}/${path}${search}`, {
      headers: { accept: 'application/json' },
      cf: { cacheTtl: ttl, cacheEverything: true },
    });

    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        'content-type': upstream.headers.get('content-type') || 'application/json',
        'cache-control': `public, max-age=${ttl}`,
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'ESPN request failed' }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    });
  }
}
