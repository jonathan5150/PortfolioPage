// Dev-server version of the Cloudflare Pages proxy functions in /frontend/functions,
// so `npm start` serves the same /espn and /nflverse paths as production.
// Create React App loads this file automatically; it is not part of the app bundle.
const https = require('https');

const RULES = {
  '/espn/site': 'https://site.api.espn.com',
  '/espn/web': 'https://site.web.api.espn.com',
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

module.exports = function setupProxy(app) {
  Object.entries(RULES).forEach(([prefix, target]) => {
    // Express strips the mount prefix, so req.url is the remainder (path + query).
    app.use(prefix, (req, res) => forward(`${target}${req.url}`, res));
  });
};
