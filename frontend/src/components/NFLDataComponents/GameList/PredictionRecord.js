import React, { useMemo } from 'react';
import useAsyncData from '../shared/useAsyncData';
import { getGradedLinePicks } from '../../../pages/NFLData/NFLDataApi/bettingService';
import { runWithConcurrency } from '../../../pages/NFLData/NFLDataApi/http';

// How the pick engine did this week: moneyline, spread and over/under records
// for every finished game, plus the combined total. Pushes don't count.
const MARKETS = [
  { key: 'winner', label: 'Moneyline' },
  { key: 'spread', label: 'Spread' },
  { key: 'total', label: 'O/U' },
];

const pct = ({ W, L }) => (W + L ? `${Math.round((W / (W + L)) * 100)}%` : '—');

const PredictionRecord = ({ games }) => {
  const finished = useMemo(() => (games || []).filter((g) => g.status?.state === 'post'), [games]);
  const ids = finished.map((g) => g.id).join(',');

  const graded = useAsyncData(
    async () => {
      const results = await runWithConcurrency(
        finished.map((g) => () => getGradedLinePicks(g)),
        2,
      );
      return results.map((r) => (r.ok ? r.value : null)).filter(Boolean);
    },
    [ids],
    { enabled: finished.length > 0 },
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
    <div className="games-count-outer prediction-record-outer">
      <div className="games-count-inner prediction-record">
        <div className="prediction-record-title">PREDICTION RECORD · FINISHED GAMES</div>
        {graded.loading && !graded.data ? (
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
