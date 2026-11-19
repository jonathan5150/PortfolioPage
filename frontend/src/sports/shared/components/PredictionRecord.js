import React, { useEffect, useMemo, useState } from 'react';
import useAsyncData from '../hooks/useAsyncData';
import { ModelSection } from './ModelSection';
import { allowed, inScope } from './modelFilters';
import { graderFor, precomputedInfo, seasonLoaderFor } from '../api/modelGrading';
import { runWithConcurrency } from '../api/http';
import { betReturn } from '../api/picks';
import { fmtOdds } from '../api/betting';

// How the pick engine did: moneyline, spread and over/under records for every
// finished game shown (a week for the NFL, a day for the NBA / MLB), plus the
// combined total. Pushes don't count. The panel is shared by the sports pages:
// each passes how to grade one game and how to find the season's games.
const MARKETS = [
  { key: 'winner', label: 'Moneyline' },
  { key: 'spread', label: 'Spread' },
  { key: 'total', label: 'O/U' },
];
const marketsFor = (spreadLabel) => MARKETS.map((m) => (m.key === 'spread' ? { ...m, label: spreadLabel } : m));

// A finished game's grades never change, so they're kept in localStorage (and
// precomputed at build time, see modelGrading.js) and later visits don't
// refetch anything. Old versions' saved grades are cleared out.
try {
  ['v1', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7', 'v8'].forEach((v) =>
    window.localStorage.removeItem(`nflStatsWizard:gradedPicks:${v}`),
  );
  ['nba', 'mlb'].forEach((lg) => window.localStorage.removeItem(`nflStatsWizard:${lg}GradedPicks:v1`));
  ['v2', 'v3'].forEach((v) => window.localStorage.removeItem(`nflStatsWizard:nbaGradedPicks:${v}`));
} catch {
  // storage blocked
}
const nflGrade = graderFor('nfl');

const money = (n) => `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const signedMoney = (n) => `${n > 0.004 ? '+' : n < -0.004 ? '-' : ''}${money(n)}`;
const tone = (n) => (n > 0.004 ? 'up' : n < -0.004 ? 'down' : 'even');
const dayKey = (date) => new Date(date).toDateString();
const dayLabel = (date) =>
  new Date(date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();

// Finished games' bets, oldest start first, grouped by the day they were played.
const betDays = (finished, gradedById, filter, stake, minOdds, scope) => {
  const days = [];
  [...finished]
    .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0))
    .forEach((game) => {
      const bets = inScope(gradedById[game.id]?.bets, scope)
        .filter((b) => (filter === 'all' || b.key === filter) && allowed(b, minOdds))
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

const nflSeasonGames = seasonLoaderFor('nfl');

// The season's finished games, each graded like the current ones. Grades are
// cached, so only the first visit fetches the older games. Reports progress.
const useSeasonGrades = (loadSeason, gradeGame) => {
  const [state, setState] = useState({ grades: null, done: 0, total: 0, error: null });
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const finished = await loadSeason();
        if (!active) return;
        setState({ grades: null, done: 0, total: finished.length, error: null });
        let done = 0;
        const results = await runWithConcurrency(
          finished.map((g) => async () => {
            const grade = await gradeGame(g);
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
  }, [loadSeason, gradeGame]);
  return state;
};

// The model's season record and flat-bet profit for each market, at `stake`.
const SeasonTotals = ({ stake, minOdds, filter, loadSeason, gradeGame, markets, scope, lg }) => {
  const { grades, done, total, error } = useSeasonGrades(loadSeason, gradeGame);
  // how many games came graded with the site build (shown so it's clear they're precomputed)
  const ready = useAsyncData(() => precomputedInfo(lg), [lg], { enabled: Boolean(lg) }).data;
  if (error && !grades) return <div className="prediction-record-loading">Couldn't load the season's games.</div>;
  if (!grades) {
    return (
      <div className="prediction-record-loading">
        {total ? `Grading the season's picks… ${done} of ${total} games` : "Loading the season's games…"}
      </div>
    );
  }
  const skipped = countSkipped(
    grades.flatMap((g) => inScope(g.bets, scope).filter((b) => filter === 'all' || b.key === filter)),
    minOdds,
  );
  const rows = markets.map(({ key, label }) => {
    const rec = { W: 0, L: 0, profit: 0 };
    // record and profit both come from the simulated bets, so the odds filter applies to both
    grades.forEach((g) => {
      const bet = inScope(g.bets, scope).find((b) => b.key === key);
      if (!bet || !allowed(bet, minOdds)) return;
      if (bet.result === 'W' || bet.result === 'L') rec[bet.result] += 1;
      rec.profit += betReturn(stake, bet.price, bet.result) - stake;
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
      {/* the TOTAL / MONEYLINE / SPREAD / O/U buttons pick which lines show */}
      {(filter === 'all'
        ? [...rows, { key: 'all', label: 'Total', ...all }]
        : rows.filter((r) => r.key === filter)
      ).map((r) => (
        <div key={r.key} className={`season-row ${r.key === 'all' ? 'total' : ''}`}>
          <span>{r.label}</span>
          <span className="prediction-record-wl">
            {r.W}-{r.L}
          </span>
          <span className="prediction-record-pct">{pct(r)}</span>
          <span className={`bet-return ${tone(r.profit)}`}>{signedMoney(r.profit)}</span>
        </div>
      ))}
      <SkippedNote minOdds={minOdds} skipped={skipped} />
      {ready?.games ? (
        <div className="season-precomputed">
          {ready.games} games came pre-graded with the site
          {ready.builtAt
            ? ` (${new Date(ready.builtAt).toLocaleDateString([], { month: 'short', day: 'numeric' })})`
            : ''}
        </div>
      ) : null}
    </div>
  );
};

const matchup = (g) => `${g.away?.team?.abbreviation || 'AWAY'} @ ${g.home?.team?.abbreviation || 'HOME'}`;

// How many moneyline bets the ML limit took out (so it's clear it did something,
// or that there was nothing that short to take out).
const SkippedNote = ({ minOdds, skipped }) =>
  minOdds ? (
    <div className="model-filter-note">
      {skipped
        ? `ML ${minOdds}: skipped ${skipped} moneyline ${skipped === 1 ? 'bet' : 'bets'} priced shorter than ${minOdds}.`
        : `ML ${minOdds}: no moneyline bets here were priced shorter than ${minOdds}.`}
    </div>
  ) : null;
const countSkipped = (bets, minOdds) => (minOdds ? bets.filter((b) => !allowed(b, minOdds)).length : 0);

// The period's profit, with each bet behind SHOW EACH BET.
const PeriodProfit = ({ days, period, stake, minOdds, skipped }) => {
  const [showBets, setShowBets] = useState(false);
  const periodProfit = days.reduce((sum, d) => sum + d.profit, 0);
  if (!days.length) return <div className="prediction-record-loading">No graded bets yet.</div>;
  return (
    <div className="bet-results">
      <div className="bet-row bet-total bet-week">
        <span>{period} PROFIT</span>
        <span className={`bet-return ${tone(periodProfit)}`}>{signedMoney(periodProfit)}</span>
      </div>
      <SkippedNote minOdds={minOdds} skipped={skipped} />
      <button
        type="button"
        className={`bet-each-toggle ${showBets ? 'open' : ''}`}
        aria-expanded={showBets}
        onClick={() => setShowBets((v) => !v)}
      >
        {showBets ? 'HIDE EACH BET' : 'SHOW EACH BET'}
        <span className="bet-results-caret" aria-hidden="true" />
      </button>
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
                      <span className="bet-label">
                        {b.label}
                      </span>
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
    </div>
  );
};

// games: the games on screen (a week / a day). gradeGame(game) -> { winner,
// spread, total, bets } (cached); loadSeason() -> the season's finished games.
// period: 'WEEK' or 'DAY'. note: an optional explanation (ABOUT THE MODEL).
// stake, scope, filter, minOdds: the MODEL dropdown's FILTERS (see ModelPanel).
// These are the dropdown's results sections: the period's results, SEASON TO
// DATE and ABOUT THE MODEL, each collapsible. Mounted only while the dropdown
// is open, so nothing is graded until then.
export const ModelResults = ({
  games,
  stake,
  scope = 'all',
  filter = 'all',
  minOdds = null,
  gradeGame = nflGrade,
  loadSeason = nflSeasonGames,
  period = 'WEEK',
  lg = 'nfl',
  spreadLabel = 'Spread',
  note = null,
}) => {
  const finished = useMemo(() => (games || []).filter((g) => g.status?.state === 'post'), [games]);
  const ids = finished.map((g) => g.id).join(',');
  const markets = useMemo(() => marketsFor(spreadLabel), [spreadLabel]);

  const graded = useAsyncData(
    async () => {
      const results = await runWithConcurrency(
        finished.map((g) => () => gradeGame(g)),
        2,
      );
      return results.map((r, i) => (r.ok && r.value ? { ...r.value, id: finished[i].id } : null)).filter(Boolean);
    },
    [ids, gradeGame],
    { enabled: finished.length > 0 },
  );

  const rows = markets.map(({ key, label }) => {
    const rec = { W: 0, L: 0 };
    (graded.data || []).forEach((g) => {
      const result = scope === 'all' ? g[key] : inScope(g.bets, scope).find((b) => b.key === key)?.result;
      if (result === 'W' || result === 'L') rec[result] += 1;
    });
    return { key, label, ...rec };
  });
  const gradedById = Object.fromEntries((graded.data || []).map((g) => [g.id, g]));
  const total = rows.reduce((acc, r) => ({ W: acc.W + r.W, L: acc.L + r.L }), { W: 0, L: 0 });
  const word = period.toLowerCase();
  const days = betDays(finished, gradedById, filter, stake, minOdds, scope);
  const skipped = countSkipped(
    (graded.data || []).flatMap((g) => inScope(g.bets, scope).filter((b) => filter === 'all' || b.key === filter)),
    minOdds,
  );

  return (
    <>
      <ModelSection title={`THIS ${period}'S RESULTS`}>
        <div className="prediction-record-title">PREDICTION RECORD</div>
        {!finished.length ? (
          <div className="prediction-record-loading">No finished games this {word} yet.</div>
        ) : !graded.data ? (
          <div className="prediction-record-loading">Grading this {word}'s picks…</div>
        ) : (
          <>
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
            <PeriodProfit days={days} period={period} stake={stake} minOdds={minOdds} skipped={skipped} />
          </>
        )}
      </ModelSection>
      <ModelSection title="SEASON TO DATE">
        <SeasonTotals
          stake={stake}
          minOdds={minOdds}
          filter={filter}
          loadSeason={loadSeason}
          gradeGame={gradeGame}
          markets={markets}
          scope={scope}
          lg={lg}
        />
      </ModelSection>
      {note && (
        <ModelSection title="ABOUT THE MODEL">
          <div className="league-model-note">{note}</div>
        </ModelSection>
      )}
    </>
  );
};

export default ModelResults;
