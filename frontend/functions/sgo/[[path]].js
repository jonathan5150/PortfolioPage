// Cloudflare Pages Function: same-origin proxy for SportsGameOdds (sportsgameodds.com),
// used for FanDuel game lines and anytime touchdown odds.
//   /sgo/events?leagueID=NFL&...  -> https://api.sportsgameodds.com/v2/events?...
// The key stays server-side: set SGO_API_KEY in the Pages project's environment
// variables (Settings -> Environment variables, as a secret).

const BASE = 'https://api.sportsgameodds.com/v2';
const PARAMS = ['leagueID', 'oddsAvailable', 'bookmakerID', 'startsAfter', 'startsBefore', 'limit', 'cursor', 'includeOpposingOdds', 'oddID'];

export async function onRequestGet({ request, params, env }) {
  const parts = Array.isArray(params.path) ? params.path : [params.path];
  const path = parts.join('/');
  if (path !== 'events') return new Response('Not found', { status: 404 });
  if (!env.SGO_API_KEY) {
    return new Response(JSON.stringify({ error: 'SGO_API_KEY is not configured' }), {
      status: 503,
      headers: { 'content-type': 'application/json' },
    });
  }

  const incoming = new URL(request.url).searchParams;
  const search = new URLSearchParams();
  PARAMS.forEach((key) => {
    if (incoming.has(key)) search.set(key, incoming.get(key));
  });

  // The free plan allows 2,500 event objects a month. The page asks for one
  // slate per 6-hour window (same URL for everyone), so cache it that long.
  const ttl = 6 * 3600;
  try {
    const upstream = await fetch(`${BASE}/events?${search}`, {
      headers: { accept: 'application/json', 'x-api-key': env.SGO_API_KEY },
      // Only successful slates are cached; a rate-limit or quota error must not
      // stick around for an hour.
      cf: { cacheEverything: true, cacheTtlByStatus: { '200-299': ttl, '300-599': 0 } },
    });
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        'content-type': upstream.headers.get('content-type') || 'application/json',
        'cache-control': upstream.ok ? `public, max-age=${ttl}` : 'no-store',
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'SportsGameOdds request failed' }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    });
  }
}
