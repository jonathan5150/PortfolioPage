import React, { useMemo } from 'react';
import useAsyncData from '../shared/useAsyncData';
import useInView from '../shared/useInView';
import { readPreference, writePreference } from '../shared/usePersistentState';
import { getGradedLinePicks } from '../../../pages/NFLData/NFLDataApi/bettingService';
import { runWithConcurrency } from '../../../pages/NFLData/NFLDataApi/http';

// How the pick engine did this week: moneyline, spread and over/under records
// for every finished game, plus the combined total. Pushes don't count.
const MARKETS = [
  { key: 'winner', label: 'Moneyline' },
  { key: 'spread', label: 'Spread' },
  { key: 'total', label: 'O/U' },
];

// A finished game's grades never change, so they're kept in localStorage and
// later visits don't refetch anything. Bump the version when the pick rules or
// grading change (v1 could hold grades made against in-game "Live Odds" lines).
const GRADES_KEY = 'gradedPicks:v2';
try {
  window.localStorage.removeItem('nflStatsWizard:gradedPicks:v1');
} catch {
  // storage blocked
}
const gradeOf = async (game) => {
  const saved = readPreference(GRADES_KEY, {});
  if (saved[game.id]) return saved[game.id];
  const grades = await getGradedLinePicks(game);
  if (grades) writePreference(GRADES_KEY, { ...readPreference(GRADES_KEY, {}), [game.id]: grades });
  return grades;
};

const pct = ({ W, L }) => (W + L ? `${Math.round((W / (W + L)) * 100)}%` : '—');

const PredictionRecord = ({ games }) => {
  const finished = useMemo(() => (games || []).filter((g) => g.status?.state === 'post'), [games]);
  const ids = finished.map((g) => g.id).join(',');
  // The record sits at the bottom of the list: grading waits until it's near
  // the screen, so it never competes with a game being opened.
  const [ref, inView] = useInView({ rootMargin: '300px' });

  const graded = useAsyncData(
    async () => {
      const results = await runWithConcurrency(
        finished.map((g) => () => gradeOf(g)),
        2,
      );
      return results.map((r) => (r.ok ? r.value : null)).filter(Boolean);
    },
    [ids],
    { enabled: finished.length > 0 && inView },
  );

  if (!finished.length) return null;

  const rows = MARKETS.map(({ key, label }) => {
    const rec = { W: 0, L: 0 };
    (graded.data || []).forEach((g) => {
      if (g[key] === 'W' || g[key] === 'L') rec[g[key]] += 1;
    });
    return { key, label, ...rec };
  });
  const total = rows.reduce((acc, r) => ({ W: acc.W + r.W, L: acc.L + r.L }), { W: 0, L: 0 });

  return (
    <div className="games-count-outer prediction-record-outer" ref={ref}>
      <div className="games-count-inner prediction-record">
        <div className="prediction-record-title">PREDICTION RECORD · FINISHED GAMES</div>
        {!graded.data ? (
          <div className="prediction-record-loading">Grading this week's picks…</div>
        ) : (
          <div className="prediction-record-rows">
            {[...rows, { key: 'all', label: 'Total', ...total }].map((r) => (
              <div key={r.key} className={`prediction-record-row ${r.key === 'all' ? 'total' : ''}`}>
                <span className="prediction-record-label">{r.label}</span>
                <span className="prediction-record-wl">
                  {r.W}-{r.L}
                </span>
                <span className="prediction-record-pct">{pct(r)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PredictionRecord;
