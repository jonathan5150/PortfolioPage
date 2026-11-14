// Precomputes the MODEL RESULTS: grades every finished game of the NFL and
// NBA seasons so far with the app's own pick engine and writes
// build/model-results/<league>.json. The page reads that file the first time
// someone opens SHOW MODEL RESULTS and only grades games newer than it.
//
// Runs after `react-scripts build` (npm's postbuild). It never fails the
// build: without network, a Node without fetch, or anything else going wrong,
// it writes nothing and the page grades everything itself, as before.
//
//   node scripts/model-results/precompute.js [outDir] [--leagues=nfl,nba] [--minutes=6]
const fs = require('fs');
const os = require('os');
const path = require('path');

const args = process.argv.slice(2);
const outDir = path.resolve(args.find((a) => !a.startsWith('--')) || path.join(__dirname, '..', '..', 'build'));
const opt = (name, fallback) => (args.find((a) => a.startsWith(`--${name}=`)) || '').split('=')[1] || fallback;
const leagues = opt('leagues', 'nfl,nba').split(',');
const minutes = Number(opt('minutes', process.env.MODEL_RESULTS_MINUTES || '6'));
const log = (...m) => console.log('[model-results]', ...m);

const bundle = () =>
  new Promise((resolve, reject) => {
    // webpack comes with react-scripts; it understands the app's ES modules
    // (no JSX or styles are imported by the grading code)
    // eslint-disable-next-line global-require, import/no-extraneous-dependencies
    const webpack = require('webpack');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'model-results-'));
    webpack(
      {
        mode: 'none',
        target: 'node',
        entry: path.join(__dirname, 'entry.js'),
        output: { path: dir, filename: 'precompute.cjs', library: { type: 'commonjs2' } },
        resolve: { extensions: ['.js', '.json'] },
        module: { rules: [{ test: /\.m?js$/, resolve: { fullySpecified: false } }] },
        devtool: false,
        performance: { hints: false },
        optimization: { minimize: false },
        plugins: [new webpack.DefinePlugin({ 'process.env.NODE_ENV': JSON.stringify('production') })],
      },
      (err, result) => {
        if (err) return reject(err);
        if (result.hasErrors()) return reject(new Error(result.toString({ all: false, errors: true })));
        return resolve(path.join(dir, 'precompute.cjs'));
      },
    );
  });

const main = async () => {
  if (typeof fetch !== 'function') {
    log(`skipped: Node ${process.version} has no fetch`);
    return;
  }
  const started = Date.now();
  process.env.MODEL_RESULTS_PUBLIC = path.join(__dirname, '..', '..', 'public');
  const file = process.env.MODEL_RESULTS_BUNDLE || (await bundle());
  // eslint-disable-next-line global-require, import/no-dynamic-require
  const app = require(file);
  const deadline = started + minutes * 60 * 1000;
  fs.mkdirSync(path.join(outDir, 'model-results'), { recursive: true });
  for (const lg of leagues) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const { file: data, summary } = await app.precompute(lg, { deadline, log });
      if (Object.keys(data.grades).length) {
        fs.writeFileSync(path.join(outDir, 'model-results', `${lg}.json`), JSON.stringify(data));
        log(`${lg}: wrote ${Object.keys(data.grades).length} games`, JSON.stringify(summary));
      }
    } catch (error) {
      log(`${lg}: failed (${error.message})`);
    }
  }
  log(`done in ${Math.round((Date.now() - started) / 1000)}s`, JSON.stringify(app.stats()));
};

main()
  .catch((error) => log(`skipped: ${error.message}`))
  .finally(() => {
    // open sockets / timers in the app code mustn't hold the build open
    setTimeout(() => process.exit(0), 100);
  });
