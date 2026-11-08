// Dev-server version of the Cloudflare Pages proxy functions in /frontend/functions,
// so `npm start` serves the same /espn and /nflverse paths as production.
// Create React App loads this file automatically; it is not part of the app bundle.
const https = require('https');

const RULES = {
  '/espn/site': 'https://site.api.espn.com',
  '/espn/web': 'https://site.web.api.espn.com',
  '/espn/core': 'https://sports.core.api.espn.com',
  '/nflverse': 'https://github.com/nflverse/nflverse-data/releases/download',
};

const forward = (url, res, redirectsLeft = 3) => {
  https
    .get(url, { headers: { accept: '*/*' } }, (upstream) => {
      const { statusCode, headers } = upstream;
      if (statusCode >= 300 && statusCode < 400 && headers.location && redirectsLeft > 0) {
        upstream.resume();
        forward(new URL(headers.location, url).toString(), res, redirectsLeft - 1);
        return;
      }
      res.writeHead(statusCode, { 'content-type': headers['content-type'] || 'application/octet-stream' });
      upstream.pipe(res);
    })
    .on('error', (error) => {
      res.writeHead(502, { 'content-type': 'text/plain' });
      res.end(`Proxy error: ${error.message}`);
    });
};

// SportsGameOdds (DraftKings anytime TD odds). Key from SGO_API_KEY in frontend/.env.local.
const SGO_API = 'https://api.sportsgameodds.com/v2';
const SGO_PARAMS = ['leagueID', 'oddsAvailable', 'bookmakerID', 'startsAfter', 'startsBefore', 'limit', 'cursor', 'includeOpposingOdds', 'oddID'];

const sgoApi = (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.replace(/^\/+/, '') !== 'events') {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('Not found');
    return;
  }
  if (!process.env.SGO_API_KEY) {
    res.writeHead(503, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'SGO_API_KEY is not configured' }));
    return;
  }
  const search = new URLSearchParams();
  SGO_PARAMS.forEach((key) => {
    if (url.searchParams.has(key)) search.set(key, url.searchParams.get(key));
  });
  // SportsGameOdds also accepts the key as the apiKey query parameter.
  search.set('apiKey', process.env.SGO_API_KEY);
  forward(`${SGO_API}/events?${search}`, res);
};

module.exports = function setupProxy(app) {
  app.use('/sgo', sgoApi);
  Object.entries(RULES).forEach(([prefix, target]) => {
    // Express strips the mount prefix, so req.url is the remainder (path + query).
    app.use(prefix, (req, res) => forward(`${target}${req.url}`, res));
  });
};
