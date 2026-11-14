// Bundled and run by precompute.js: grades every finished game of each
// league's season with the app's own code.
import './shim';
import { GRADES_KEYS, gradeGame, seasonLoaderFor } from '../../src/pages/NFLData/NFLDataApi/modelGrading';
import { runWithConcurrency } from '../../src/pages/NFLData/NFLDataApi/http';

const summarize = (grades) => {
  const rec = {};
  Object.values(grades).forEach((g) =>
    (g.bets || []).forEach((b) => {
      const k = `${b.key}${b.bet ? ':bet' : ''}`;
      rec[k] = rec[k] || { W: 0, L: 0, P: 0 };
      rec[k][b.result] = (rec[k][b.result] || 0) + 1;
    }),
  );
  return rec;
};

// lg -> { key, builtAt, grades: { [gameId]: grade } }
export const precompute = async (lg, { deadline, log = () => {} }) => {
  const games = await seasonLoaderFor(lg)();
  log(`${lg}: ${games.length} finished games`);
  const grades = {};
  let skipped = 0;
  await runWithConcurrency(
    games.map((game) => async () => {
      if (Date.now() > deadline) {
        skipped += 1;
        return;
      }
      const g = await gradeGame(lg, game).catch(() => null);
      if (g) grades[game.id] = g;
    }),
    6,
  );
  log(`${lg}: graded ${Object.keys(grades).length}, skipped ${skipped} (out of time)`);
  return {
    file: { key: GRADES_KEYS[lg], builtAt: new Date().toISOString(), grades },
    summary: summarize(grades),
  };
};

export const stats = () => globalThis.__precomputeStats;
