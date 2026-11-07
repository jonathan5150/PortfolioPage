// Cloudflare Pages Function: same-origin proxy for nflverse season files.
// GitHub release downloads redirect to a host browsers may block via CORS.
//   /nflverse/stats_player/stats_player_reg_2025.csv
//     -> https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_reg_2025.csv

const BASE = 'https://github.com/nflverse/nflverse-data/releases/download';
const ALLOWED = /^(stats_player|stats_team)\/stats_(player|team)_reg_\d{4}\.csv$/;
const TTL = 6 * 60 * 60;

export async function onRequestGet({ params }) {
  const parts = Array.isArray(params.path) ? params.path : [params.path];
  const path = parts.join('/');

  if (!ALLOWED.test(path)) {
    return new Response('Not found', { status: 404 });
  }

  try {
    const upstream = await fetch(`${BASE}/${path}`, {
      redirect: 'follow',
      cf: { cacheTtl: TTL, cacheEverything: true },
    });

    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'cache-control': `public, max-age=${TTL}`,
      },
    });
  } catch (error) {
    return new Response('nflverse request failed', { status: 502 });
  }
}
