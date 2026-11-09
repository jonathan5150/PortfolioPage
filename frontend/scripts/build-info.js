// Writes build-info.json for the NFL page's "last updated" line:
//   builtAt      when this build finished (postbuild) or the dev server started
//   requestedAt  when the push was asked for (frontend/deploy-request.json,
//                stamped and committed with each push), if known
// `node scripts/build-info.js build` writes into build/ after a production
// build; with no argument it writes into public/ for the dev server.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const target = process.argv[2] === 'build' ? 'build' : 'public';
let requestedAt = null;
try {
  requestedAt = JSON.parse(fs.readFileSync(path.join(root, 'deploy-request.json'), 'utf8')).requestedAt || null;
} catch {
  // no stamp: the page just shows the timer
}
const info = { builtAt: new Date().toISOString(), requestedAt };
fs.writeFileSync(path.join(root, target, 'build-info.json'), `${JSON.stringify(info)}\n`);
