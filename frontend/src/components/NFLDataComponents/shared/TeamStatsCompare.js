import React, { useMemo } from 'react';
import { fetchJson } from '../../../pages/NFLData/NFLDataApi/http';
import useAsyncData from './useAsyncData';
import { getTeamColor, getTeamTextColor } from './teamColors';
import TeamResultsRows from './TeamResultsRows';
import { getTeamHistories, historyRows } from './teamHistory';

// STATS (an upcoming game's panel, in place of BOX SCORE): the two teams'
// season stats side by side, each with its rank in the league, and the
// better team's side of each row washed in its colour. Like the old MLB team
// comparison page, for every team sport.
//
// One download per league holds every team's season stats: ESPN's "stats by
// team" table. Each team has its own numbers and, for the NFL and NBA, what
// its opponents did against it (its defence). Ranks are worked out here from
// every team's number, so "lower is better" stats (points allowed, ERA,
// turnovers...) rank the right way round.

const PATHS = { nfl: 'football/nfl', nba: 'basketball/nba', mlb: 'baseball/mlb' };
const HOUR = 60 * 60 * 1000;

// Each team's numbers, by category and stat name: { own, opp }. A category
// listed twice for a team is its own numbers first, then its opponents'.
export const parseTeamStatsTable = (json) => {
  const namesOf = {};
  (json?.categories || []).forEach((c) => {
    if (c?.names?.length && !namesOf[c.name]) namesOf[c.name] = c.names;
  });
  const teams = new Map();
  (json?.teams || []).forEach((t) => {
    const id = t?.team?.id;
    if (id === undefined || id === null) return;
    const own = {};
    const opp = {};
    (t.categories || []).forEach((c) => {
      const into = own[c.name] ? opp : own;
      const names = c.names?.length ? c.names : namesOf[c.name] || [];
      const stats = {};
      names.forEach((n, i) => {
        const v = Number(c.values?.[i]);
        if (stats[n] === undefined && Number.isFinite(v)) stats[n] = v;
      });
      into[c.name] = stats;
    });
    teams.set(String(id), { own, opp });
  });
  return teams;
};

export const getTeamStatsTable = async (lg) => {
  const path = PATHS[lg];
  if (!path) return new Map();
  const json = await fetchJson(
    `https://site.web.api.espn.com/apis/common/v3/sports/${path}/statistics/byteam?limit=40&seasontype=2`,
    { ttlMs: 3 * HOUR },
  );
  return parseTeamStatsTable(json);
};

// NFL standings, for STATS' OVERALL rows: each team's place in its division and
// its conference (ESPN's playoff seeding, 1-16), point differential, streak,
// and home and road records. By team id.
export const parseStandings = (json) => {
  const teams = new Map();
  (json?.children || []).forEach((conf) => {
    const confTeams = [];
    (conf.children || []).forEach((div) => {
      const entries = (div.standings?.entries || []).map((e) => {
        const stat = (name) => (e.stats || []).find((st) => st.name === name || st.type === name);
        return {
          id: String(e.team?.id ?? ''),
          division: div.name || '',
          conference: conf.abbreviation || '',
          confSeed: Number(stat('playoffSeed')?.value) || null,
          pointDiff: Number(stat('pointDifferential')?.value ?? stat('differential')?.value),
          streak: stat('streak')?.displayValue || '',
          streakValue: Number(stat('streak')?.value),
          home: stat('home')?.displayValue || '',
          road: stat('road')?.displayValue || '',
        };
      });
      // a division's teams in order of their conference seeding
      entries
        .sort((a, b) => (a.confSeed ?? 99) - (b.confSeed ?? 99))
        .forEach((t, i) => {
          Object.assign(t, { divRank: i + 1, divSize: entries.length });
        });
      confTeams.push(...entries);
    });
    confTeams.forEach((t) => {
      Object.assign(t, { confSize: confTeams.length });
      if (t.id) teams.set(t.id, t);
    });
  });
  return teams;
};

export const getStandings = async (lg) => {
  if (lg !== 'nfl') return null;
  const json = await fetchJson('https://site.web.api.espn.com/apis/v2/sports/football/nfl/standings?level=3', {
    ttlMs: HOUR / 2,
  });
  return parseStandings(json);
};

// ---------- what each sport shows ----------

const fixed = (d) => (v) => v.toFixed(d);
const pct = (v) => `${v.toFixed(1)}%`;
const rate3 = (v) => v.toFixed(3).replace(/^(-?)0\./, '$1.');
const whole = (v) => String(Math.round(v));
const signed = (d) => (v) => `${v > 0 ? '+' : ''}${v.toFixed(d)}`;

const own = (cat, stat) => (t) => t.own[cat]?.[stat];
const opp = (cat, stat) => (t) => t.opp[cat]?.[stat];

// section starts a new heading; lower: smaller is better
export const STAT_ROWS = {
  nfl: [
    { section: 'OFFENSE', label: 'PTS / G', get: own('passing', 'totalPointsPerGame'), fmt: fixed(1) },
    { label: 'YDS / G', get: own('passing', 'yardsPerGame'), fmt: fixed(1) },
    { label: 'PASS / G', get: own('passing', 'netPassingYardsPerGame'), fmt: fixed(1) },
    { label: 'RUSH / G', get: own('rushing', 'rushingYardsPerGame'), fmt: fixed(1) },
    { label: '3RD DOWN', get: own('miscellaneous', 'thirdDownConvPct'), fmt: pct },
    { label: 'GIVEAWAYS', get: own('miscellaneous', 'totalGiveaways'), fmt: whole, lower: true },
    {
      section: 'DEFENSE (ALLOWED)',
      label: 'PTS / G',
      get: opp('passing', 'totalPointsPerGame'),
      fmt: fixed(1),
      lower: true,
    },
    { label: 'YDS / G', get: opp('passing', 'yardsPerGame'), fmt: fixed(1), lower: true },
    { label: 'PASS / G', get: opp('passing', 'netPassingYardsPerGame'), fmt: fixed(1), lower: true },
    { label: 'RUSH / G', get: opp('rushing', 'rushingYardsPerGame'), fmt: fixed(1), lower: true },
    { label: 'SACKS', get: opp('passing', 'sacks'), fmt: whole },
    { label: 'TAKEAWAYS', get: own('miscellaneous', 'totalTakeaways'), fmt: whole },
    { section: 'OVERALL', label: 'RECORD', record: true },
    // where each team stands: its division (1st gold, last red) and its
    // conference (a playoff seed, 1-7, gold; the bottom three red)
    {
      label: 'DIVISION',
      standing: true,
      get: (t) => t.divRank,
      text: (t) => t.division,
      rank: (t) => t.divRank,
      tone: (t) => (t.divRank === 1 ? 'top' : t.divRank === t.divSize ? 'bottom' : ''),
      lower: true,
    },
    {
      label: 'CONFERENCE',
      standing: true,
      get: (t) => t.confSeed,
      text: (t) => t.conference,
      rank: (t) => t.confSeed,
      tone: (t) => (t.confSeed <= 7 ? 'top' : t.confSeed > t.confSize - 3 ? 'bottom' : ''),
      lower: true,
    },
    { label: 'PT DIFF', standing: true, get: (t) => t.pointDiff, fmt: signed(0) },
    { label: 'STREAK', standing: true, get: (t) => t.streakValue, text: (t) => t.streak, rank: () => null },
    // this game's venue: the away team's record on the road, the home team's at home
    { label: 'ROAD · HOME', venue: true },
  ],
  nba: [
    { section: 'OFFENSE', label: 'PTS', get: own('offensive', 'avgPoints'), fmt: fixed(1) },
    { label: 'FG%', get: own('offensive', 'fieldGoalPct'), fmt: pct },
    { label: '3P%', get: own('offensive', 'threePointFieldGoalPct'), fmt: pct },
    { label: 'FT%', get: own('offensive', 'freeThrowPct'), fmt: pct },
    { label: 'REB', get: own('general', 'avgRebounds'), fmt: fixed(1) },
    { label: 'AST', get: own('offensive', 'avgAssists'), fmt: fixed(1) },
    { label: 'TOV', get: own('offensive', 'avgTurnovers'), fmt: fixed(1), lower: true },
    { section: 'DEFENSE', label: 'OPP PTS', get: opp('offensive', 'avgPoints'), fmt: fixed(1), lower: true },
    { label: 'OPP FG%', get: opp('offensive', 'fieldGoalPct'), fmt: pct, lower: true },
    { label: 'OPP 3P%', get: opp('offensive', 'threePointFieldGoalPct'), fmt: pct, lower: true },
    { label: 'STL', get: own('defensive', 'avgSteals'), fmt: fixed(1) },
    { label: 'BLK', get: own('defensive', 'avgBlocks'), fmt: fixed(1) },
    { section: 'OVERALL', label: 'RECORD', record: true },
    { label: 'PT DIFF', get: own('differential', 'avgPointsDifferential'), fmt: signed(1) },
  ],
  mlb: [
    { section: 'HITTING', label: 'RUNS', get: own('batting', 'runs'), fmt: whole },
    { label: 'HR', get: own('batting', 'homeRuns'), fmt: whole },
    { label: 'SB', get: own('batting', 'stolenBases'), fmt: whole },
    { label: 'AVG', get: own('batting', 'avg'), fmt: rate3 },
    { label: 'OBP', get: own('batting', 'onBasePct'), fmt: rate3 },
    { label: 'OPS', get: own('batting', 'OPS'), fmt: rate3 },
    { label: 'SO', get: own('batting', 'strikeouts'), fmt: whole, lower: true },
    { section: 'PITCHING', label: 'ERA', get: own('pitching', 'ERA'), fmt: fixed(2), lower: true },
    { label: 'WHIP', get: own('pitching', 'WHIP'), fmt: fixed(2), lower: true },
    { label: 'K', get: own('pitching', 'strikeouts'), fmt: whole },
    { label: 'OPP AVG', get: own('pitching', 'opponentAvg'), fmt: rate3, lower: true },
    { label: 'HR ALLOWED', get: own('pitching', 'homeRuns'), fmt: whole, lower: true },
    { label: 'WALKS', get: own('pitching', 'walks'), fmt: whole, lower: true },
    { section: 'FIELDING', label: 'ERRORS', get: own('fielding', 'errors'), fmt: whole, lower: true },
    { label: 'FLD%', get: own('fielding', 'fieldingPct'), fmt: rate3 },
    { section: 'OVERALL', label: 'RECORD', record: true },
  ],
};

// "8-3" or "8-3-1" -> share of games won (a tie counts as half)
const winShare = (record) => {
  const [w, l, t = 0] = String(record || '')
    .split('-')
    .map(Number);
  const games = w + l + t;
  return Number.isFinite(games) && games > 0 ? (w + t / 2) / games : null;
};

// rank among every team (1 = best; tied teams share a rank)
const rankOf = (value, all, lower) =>
  value === null || value === undefined ? null : 1 + all.filter((v) => (lower ? v < value : v > value)).length;

const better = (a, b, lower) => {
  if (a === null || a === undefined || b === null || b === undefined || a === b) return null;
  return (lower ? a < b : a > b) ? 'away' : 'home';
};

// top five in gold, bottom five in red
const toneOf = (rank, count) => {
  if (!rank) return '';
  if (rank <= 5) return 'top';
  if (count && rank > count - 5) return 'bottom';
  return '';
};

const recordSide = (record) => ({ value: winShare(record), text: record || '—', rank: null, tone: '' });

// Builds the rows for one game: each side's shown value, rank and rank colour,
// and which side is better. standings (NFL): parseStandings' table; its rows
// are left out without it.
export const buildStatRows = (lg, table, awayId, homeId, records = {}, standings = null) => {
  const ids = [String(awayId), String(homeId)];
  return (STAT_ROWS[lg] || [])
    .filter((row) => !(row.standing || row.venue) || standings)
    .map((row) => {
      if (row.record || row.venue) {
        const [a, h] = row.record
          ? [recordSide(records.away), recordSide(records.home)]
          : [recordSide(standings.get(ids[0])?.road), recordSide(standings.get(ids[1])?.home)];
        return { ...row, away: a, home: h, winner: better(a.value, h.value, false) };
      }
      const source = row.standing ? standings : table;
      const all = [...source.values()].map(row.get).filter((v) => Number.isFinite(v));
      const side = (id) => {
        const t = source.get(id);
        const v = t ? row.get(t) : undefined;
        if (!Number.isFinite(v)) return { value: null, text: '—', rank: null, tone: '' };
        const rank = row.rank ? row.rank(t) : rankOf(v, all, row.lower);
        return {
          value: v,
          text: row.text ? row.text(t) : row.fmt(v),
          rank,
          tone: row.tone ? row.tone(t) : toneOf(rank, source.size),
        };
      };
      const a = side(ids[0]);
      const h = side(ids[1]);
      return { ...row, away: a, home: h, winner: better(a.value, h.value, row.lower) };
    });
};

// ---------- the panel ----------

const ordinalRank = (n) => `#${n}`;

// the better side's half of a row is washed in its team colour
const washStyle = (winner, awayTeam, homeTeam) => {
  const color = getTeamColor(winner === 'away' ? awayTeam : winner === 'home' ? homeTeam : null);
  if (!color) return undefined;
  const solid = (a) => color.replace(/[\d.]+\)$/, `${a})`);
  return {
    background: `linear-gradient(to ${winner === 'away' ? 'right' : 'left'}, ${solid(0.55)} 0%, ${solid(0.22)} 22%, transparent 55%)`,
  };
};

const TeamStatsCompare = ({ lg, game }) => {
  const awayTeam = game.away?.team;
  const homeTeam = game.home?.team;
  // every team's stats, (NFL) the standings, and both teams' win / loss rows,
  // all loaded together so the tab draws in one go (STATS still shows
  // without the standings or the rows)
  const state = useAsyncData(
    () =>
      Promise.all([
        getTeamStatsTable(lg),
        getStandings(lg).catch(() => null),
        getTeamHistories(lg, game).catch(() => null),
      ]),
    [lg, game.id],
  );
  const records = { away: game.away?.record, home: game.home?.record };
  const rows = useMemo(
    () =>
      state.data
        ? buildStatRows(
            lg,
            state.data[0],
            awayTeam?.id ?? game.away?.teamId,
            homeTeam?.id ?? game.home?.teamId,
            records,
            state.data[1],
          )
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.data, lg, awayTeam?.id, homeTeam?.id, records.away, records.home],
  );

  if (state.loading && !state.data) return <div className="bet-message">Loading team stats…</div>;
  const hasStats = rows.some((r) => !r.record && (r.away.rank || r.home.rank));
  // each team's results this season, at the top
  const history = <TeamResultsRows rows={historyRows(game, state.data?.[2])} />;
  if (!hasStats) {
    return (
      <>
        {history}
        <div className="bet-message">Team stats aren't available yet this season.</div>
      </>
    );
  }

  return (
    <>
      {history}
      <div className="team-stats-compare">
        <div className="tsc-row tsc-head">
          <span className="tsc-team away" style={{ color: getTeamTextColor(awayTeam) }}>
            {awayTeam?.abbreviation}
          </span>
          <span className="tsc-rank">RANK</span>
          <span className="tsc-label" />
          <span className="tsc-rank">RANK</span>
          <span className="tsc-team home" style={{ color: getTeamTextColor(homeTeam) }}>
            {homeTeam?.abbreviation}
          </span>
        </div>
        {rows.map((row, i) => (
          // eslint-disable-next-line react/no-array-index-key
          <React.Fragment key={i}>
            {row.section && <div className="tsc-section">{row.section}</div>}
            <div
              className={`tsc-row${i === rows.length - 1 ? ' last' : ''}`}
              style={washStyle(row.winner, awayTeam, homeTeam)}
            >
              <span className={`tsc-value away${row.winner === 'away' ? ' better' : ''}`}>{row.away.text}</span>
              <span className={`tsc-rank ${row.away.tone}`}>{row.away.rank ? ordinalRank(row.away.rank) : ''}</span>
              <span className="tsc-label">{row.label}</span>
              <span className={`tsc-rank ${row.home.tone}`}>{row.home.rank ? ordinalRank(row.home.rank) : ''}</span>
              <span className={`tsc-value home${row.winner === 'home' ? ' better' : ''}`}>{row.home.text}</span>
            </div>
          </React.Fragment>
        ))}
      </div>
    </>
  );
};

export default TeamStatsCompare;
