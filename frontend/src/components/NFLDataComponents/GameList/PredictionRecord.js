import React, { useMemo, useState } from 'react';
import useAsyncData from '../shared/useAsyncData';
import useInView from '../shared/useInView';
import { readPreference, writePreference } from '../shared/usePersistentState';
import { getGradedLinePicks } from '../../../pages/NFLData/NFLDataApi/bettingService';
import { runWithConcurrency } from '../../../pages/NFLData/NFLDataApi/http';
import { betReturn } from '../../../pages/NFLData/NFLDataApi/picks';
import { fmtOdds } from '../../../pages/NFLData/NFLDataApi/betting';

// How the pick engine did this week: moneyline, spread and over/under records
// for every finished game, plus the combined total. Pushes don't count.
const MARKETS = [
  { key: 'winner', label: 'Moneyline' },
  { key: 'spread', label: 'Spread' },
  { key: 'total', label: 'O/U' },
];

// A finished game's grades never change, so they're kept in localStorage and
// later visits don't refetch anything. Bump the version when the pick rules or
// grading change (v1 could hold grades made against in-game "Live Odds" lines;
// v2 had no bets).
const GRADES_KEY = 'gradedPicks:v3';
try {
  window.localStorage.removeItem('nflStatsWizard:gradedPicks:v1');
  window.localStorage.removeItem('nflStatsWizard:gradedPicks:v2');
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

// Every pick is a flat $10 bet at its pregame price.
const STAKE = 10;
const BET_FILTERS = [
  { key: 'all', label: 'TOTAL' },
  { key: 'winner', label: 'MONEYLINE' },
  { key: 'spread', label: 'SPREAD' },
  { key: 'total', label: 'O/U' },
];

const money = (n) => `$${Math.abs(n).toFixed(2)}`;
const signedMoney = (n) => `${n > 0.004 ? '+' : n < -0.004 ? '-' : ''}${money(n)}`;
const tone = (n) => (n > 0.004 ? 'up' : n < -0.004 ? 'down' : 'even');
const dayKey = (date) => new Date(date).toDateString();
const dayLabel = (date) =>
  new Date(date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();

// Finished games' bets, oldest kickoff first, grouped by the day they were played.
const betDays = (finished, gradedById, filter) => {
  const days = [];
  [...finished]
    .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0))
    .forEach((game) => {
      const bets = (gradedById[game.id]?.bets || [])
        .filter((b) => filter === 'all' || b.key === filter)
        .map((b) => {
          const back = betReturn(STAKE, b.price, b.result);
          return { ...b, back, profit: back - STAKE };
        });
      if (!bets.length) return;
      const key = dayKey(game.date);
      let day = days[days.length - 1];
      if (!day || day.key !== key) {
        day = { key, label: dayLabel(game.date), games: [], profit: 0 };
        days.push(day);
      }
      day.games.push({ game, bets });
      day.profit += bets.reduce((sum, b) => sum + b.profit, 0);
    });
  return days;
};

const matchup = (g) => `${g.away?.team?.abbreviation || 'AWAY'} @ ${g.home?.team?.abbreviation || 'HOME'}`;

const BetResults = ({ finished, gradedById }) => {
  const [filter, setFilter] = useState('all');
  const days = betDays(finished, gradedById, filter);
  const week = days.reduce((sum, d) => sum + d.profit, 0);

  return (
    <div className="bet-results">
      <div className="prediction-record-title">BETTING RESULTS · $10 PER BET</div>
      <div className="bet-filter">
        {BET_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className={`bet-filter-btn ${filter === f.key ? 'active' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>
      {!days.length ? (
        <div className="prediction-record-loading">No graded bets yet.</div>
      ) : (
        <>
          <div className="bet-row bet-head">
            <span>BET</span>
            <span>WAGER</span>
            <span>ODDS</span>
            <span>RETURN</span>
          </div>
          {days.map((day) => (
            <div key={day.key} className="bet-day">
              <div className="bet-day-label">{day.label}</div>
              {day.games.map(({ game, bets }) => (
                <div key={game.id} className="bet-game">
                  <div className="bet-game-label">{matchup(game)}</div>
                  {bets.map((b) => (
                    <div key={b.key} className="bet-row">
                      <span className="bet-label">{b.label}</span>
                      <span>{money(STAKE)}</span>
                      <span>{fmtOdds(b.price)}</span>
                      <span className={`bet-return ${tone(b.profit)}`}>{money(b.back)}</span>
                    </div>
                  ))}
                </div>
              ))}
              <div className="bet-row bet-total">
                <span>{day.label} PROFIT</span>
                <span className={`bet-return ${tone(day.profit)}`}>{signedMoney(day.profit)}</span>
              </div>
            </div>
          ))}
          {days.length > 1 && (
            <div className="bet-row bet-total bet-week">
              <span>WEEK PROFIT</span>
              <span className={`bet-return ${tone(week)}`}>{signedMoney(week)}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
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
      return results.map((r, i) => (r.ok && r.value ? { ...r.value, id: finished[i].id } : null)).filter(Boolean);
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
  const gradedById = Object.fromEntries((graded.data || []).map((g) => [g.id, g]));
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
        {graded.data && <BetResults finished={finished} gradedById={gradedById} />}
      </div>
    </div>
  );
};

export default PredictionRecord;
