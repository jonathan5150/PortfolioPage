import React, { useEffect, useMemo, useState } from 'react';
import useAsyncData from '../shared/useAsyncData';
import { readPreference, writePreference } from '../shared/usePersistentState';
import SlideOpen from '../shared/SlideOpen';
import { getGradedLinePicks } from '../../../pages/NFLData/NFLDataApi/bettingService';
import { runWithConcurrency } from '../../../pages/NFLData/NFLDataApi/http';
import { betReturn } from '../../../pages/NFLData/NFLDataApi/picks';
import { fmtOdds } from '../../../pages/NFLData/NFLDataApi/betting';
import { getScoreboard } from '../../../pages/NFLData/NFLDataApi/espnService';

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
// v2 had no bets; v3 was graded with the old bet-every-game engine).
const GRADES_KEY = 'gradedPicks:v4';
try {
  window.localStorage.removeItem('nflStatsWizard:gradedPicks:v1');
  window.localStorage.removeItem('nflStatsWizard:gradedPicks:v2');
  window.localStorage.removeItem('nflStatsWizard:gradedPicks:v3');
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

// Every pick is a flat bet (the chosen stake) at its pregame price.
const STAKES = [10, 25, 100];
const BET_FILTERS = [
  { key: 'all', label: 'TOTAL' },
  { key: 'winner', label: 'MONEYLINE' },
  { key: 'spread', label: 'SPREAD' },
  { key: 'total', label: 'O/U' },
];

const money = (n) => `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const signedMoney = (n) => `${n > 0.004 ? '+' : n < -0.004 ? '-' : ''}${money(n)}`;
const tone = (n) => (n > 0.004 ? 'up' : n < -0.004 ? 'down' : 'even');
const dayKey = (date) => new Date(date).toDateString();
const dayLabel = (date) =>
  new Date(date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();

// Finished games' bets, oldest kickoff first, grouped by the day they were played.
const betDays = (finished, gradedById, filter, stake) => {
  const days = [];
  [...finished]
    .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0))
    .forEach((game) => {
      const bets = (gradedById[game.id]?.bets || [])
        .filter((b) => filter === 'all' || b.key === filter)
        .map((b) => {
          const back = betReturn(stake, b.price, b.result);
          return { ...b, back, profit: back - stake };
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

const pct = ({ W, L }) => (W + L ? `${Math.round((W / (W + L)) * 100)}%` : '—');

// ---------- season to date ----------

const REGULAR_SEASON_WEEKS = 18;

// Every finished game of the current season so far (regular season, plus the
// playoffs once they've started), graded like this week's. Grades are cached,
// so only the first visit fetches the older weeks. Reports progress as it goes.
const useSeasonGrades = () => {
  const [state, setState] = useState({ grades: null, done: 0, total: 0, error: null });
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const current = await getScoreboard();
        const { season, seasonType, week } = current;
        const weeks = [];
        const regularThrough = seasonType === 3 ? REGULAR_SEASON_WEEKS : seasonType === 2 ? week : 0;
        for (let w = 1; w <= regularThrough; w += 1) weeks.push({ season, seasonType: 2, week: w });
        if (seasonType === 3) for (let w = 1; w <= week; w += 1) weeks.push({ season, seasonType: 3, week: w });
        const boards = await runWithConcurrency(
          weeks.map((params) => () => getScoreboard(params)),
          3,
        );
        const seen = new Set();
        const finished = boards
          .flatMap((b) => (b.ok ? b.value.events : []))
          .filter((g) => g.status?.state === 'post' && !seen.has(g.id) && seen.add(g.id));
        if (!active) return;
        setState({ grades: null, done: 0, total: finished.length, error: null });
        let done = 0;
        const results = await runWithConcurrency(
          finished.map((g) => async () => {
            const grade = await gradeOf(g);
            done += 1;
            if (active && done % 4 === 0) setState((prev) => ({ ...prev, done }));
            return grade;
          }),
          3,
        );
        if (active) {
          const grades = results.map((r) => (r.ok ? r.value : null)).filter(Boolean);
          setState({ grades, done: finished.length, total: finished.length, error: null });
        }
      } catch (error) {
        if (active) setState((prev) => ({ ...prev, error }));
      }
    })();
    return () => {
      active = false;
    };
  }, []);
  return state;
};

// The model's season record and flat-bet profit for each market, at `stake`.
const SeasonTotals = ({ stake }) => {
  const { grades, done, total, error } = useSeasonGrades();
  if (error && !grades) return <div className="prediction-record-loading">Couldn't load the season's games.</div>;
  if (!grades) {
    return (
      <div className="prediction-record-loading">
        {total ? `Grading the season's picks… ${done} of ${total} games` : "Loading the season's games…"}
      </div>
    );
  }
  const rows = MARKETS.map(({ key, label }) => {
    const rec = { W: 0, L: 0, profit: 0 };
    grades.forEach((g) => {
      if (g[key] === 'W' || g[key] === 'L') rec[g[key]] += 1;
      const bet = (g.bets || []).find((b) => b.key === key);
      if (bet) rec.profit += betReturn(stake, bet.price, bet.result) - stake;
    });
    return { key, label, ...rec };
  });
  const all = rows.reduce((acc, r) => ({ W: acc.W + r.W, L: acc.L + r.L, profit: acc.profit + r.profit }), {
    W: 0,
    L: 0,
    profit: 0,
  });
  return (
    <div className="season-totals">
      <div className="prediction-record-title">SEASON TO DATE · {grades.length} GAMES</div>
      {[...rows, { key: 'all', label: 'Total', ...all }].map((r) => (
        <div key={r.key} className={`season-row ${r.key === 'all' ? 'total' : ''}`}>
          <span>{r.label}</span>
          <span className="prediction-record-wl">
            {r.W}-{r.L}
          </span>
          <span className="prediction-record-pct">{pct(r)}</span>
          <span className={`bet-return ${tone(r.profit)}`}>{signedMoney(r.profit)}</span>
        </div>
      ))}
    </div>
  );
};

const matchup = (g) => `${g.away?.team?.abbreviation || 'AWAY'} @ ${g.home?.team?.abbreviation || 'HOME'}`;

const BetResults = ({ finished, gradedById }) => {
  const [filter, setFilter] = useState('all');
  const [stake, setStake] = useState(STAKES[0]);
  const days = betDays(finished, gradedById, filter, stake);
  const week = days.reduce((sum, d) => sum + d.profit, 0);
  // Just each day's profit and the week's until EACH BET is opened.
  const [showBets, setShowBets] = useState(false);
  return (
    <div className="bet-results">
      <div className="prediction-record-title">BETTING RESULTS · ${stake} PER BET</div>
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
      <div className="bet-filter bet-stakes">
        {STAKES.map((amount) => (
          <button
            key={amount}
            type="button"
            className={`bet-filter-btn ${stake === amount ? 'active' : ''}`}
            onClick={() => setStake(amount)}
          >
            ${amount} / BET
          </button>
        ))}
      </div>
      {!days.length ? (
        <div className="prediction-record-loading">No graded bets yet.</div>
      ) : (
        <>
          <button
            type="button"
            className={`bet-each-toggle ${showBets ? 'open' : ''}`}
            aria-expanded={showBets}
            onClick={() => setShowBets((v) => !v)}
          >
            {showBets ? 'HIDE EACH BET' : 'SHOW EACH BET'}
            <span className="bet-results-caret" aria-hidden="true" />
          </button>
          {!showBets &&
            days.map((day) => (
              <div key={day.key} className="bet-row bet-day-summary">
                <span>{day.label}</span>
                <span className={`bet-return ${tone(day.profit)}`}>{signedMoney(day.profit)}</span>
              </div>
            ))}
          {showBets && (
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
                          <span>{money(stake)}</span>
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
            </>
          )}
          <div className="bet-row bet-total bet-week">
            <span>WEEK PROFIT</span>
            <span className={`bet-return ${tone(week)}`}>{signedMoney(week)}</span>
          </div>
        </>
      )}
      <SeasonTotals stake={stake} />
    </div>
  );
};

const PredictionRecord = ({ games }) => {
  const finished = useMemo(() => (games || []).filter((g) => g.status?.state === 'post'), [games]);
  const ids = finished.map((g) => g.id).join(',');
  // Everything here stays closed until the button is pressed, and nothing is
  // graded until then, so it never competes with a game being opened.
  const [open, setOpen] = useState(false);

  const graded = useAsyncData(
    async () => {
      const results = await runWithConcurrency(
        finished.map((g) => () => gradeOf(g)),
        2,
      );
      return results.map((r, i) => (r.ok && r.value ? { ...r.value, id: finished[i].id } : null)).filter(Boolean);
    },
    [ids],
    { enabled: finished.length > 0 && open },
  );

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
    <div className="gold-box prediction-record-outer">
      <div className="prediction-record">
        <button
          type="button"
          className={`bet-results-toggle gold-box-text ${open ? 'open' : ''}`}
          onClick={() => setOpen((o) => !o)}
        >
          <span className="game-section-name">
            {open ? 'HIDE MODEL RESULTS' : 'SHOW MODEL RESULTS'}
            <span className="gold-caret" aria-hidden="true" />
          </span>
        </button>
        <SlideOpen open={open} className="model-results-body">
          <div className="model-results-content">
            <div className="prediction-record-title">PREDICTION RECORD · FINISHED GAMES</div>
            {!finished.length ? (
              <div className="prediction-record-loading">No finished games this week yet.</div>
            ) : !graded.data ? (
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
            {(graded.data || !finished.length) && <BetResults finished={finished} gradedById={gradedById} />}
          </div>
        </SlideOpen>
      </div>
    </div>
  );
};

export default PredictionRecord;
