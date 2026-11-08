// Network side of the Betting panel. Pure math lives in ./betting.js.
import { fetchJson, runWithConcurrency } from './http';
import { espnUrls } from './endpoints';
import {
  getTeamSchedule,
  getPlayerGameLog,
  getRoster,
  getTeamLeaders,
  getCoreAthlete,
  getStartingQbId,
  isUnavailable,
} from './espnService';
import { parseEventOdds, parsePredictor, gradeGame, computeTeamTrends } from './betting';
import { buildLinePicks, gradeLinePicks } from './picks';
import { frozenOdds } from './oddsSnapshots';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

// Closing lines for finished games never change, so cache those for hours.
export const getEventOdds = async (eventId, { final = false } = {}) =>
  parseEventOdds(await fetchJson(espnUrls.eventOdds(eventId), { ttlMs: final ? 6 * HOUR : MINUTE }));

export const getEventPredictor = async (eventId) =>
  parsePredictor(await fetchJson(espnUrls.eventPredictor(eventId), { ttlMs: 10 * MINUTE }));

const beforeGame = (game) => {
  const cutoff = game.date ? new Date(game.date).getTime() : Infinity;
  return (g) => g.id !== game.id && new Date(g.date).getTime() < cutoff;
};

// Every completed game this season before `game`, graded against its closing line.
export const getTeamBettingTrends = async (teamId, game) => {
  const requests = [getTeamSchedule(teamId, game.season, 2)];
  if (game.seasonType === 3) requests.push(getTeamSchedule(teamId, game.season, 3));
  const schedule = (await Promise.all(requests))
    .flat()
    .filter((g) => g.status.state === 'post')
    .filter(beforeGame(game))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const results = await runWithConcurrency(
    schedule.map((g) => async () => gradeGame(teamId, g, await getEventOdds(g.id, { final: true }))),
    4,
  );

  // A game without a line still counts toward scoring and straight-up records.
  const graded = schedule.map((g, i) => (results[i].ok ? results[i].value : gradeGame(teamId, g, null)));
  return computeTeamTrends(graded);
};

// The engine's winner / spread / total picks for a finished game, made from
// what was known before kickoff, and how each one did.
export const getGradedLinePicks = async (game) => {
  const quiet = (p) => p.catch(() => null);
  const [odds, predictor, awayTrends, homeTrends] = await Promise.all([
    quiet(getEventOdds(game.id, { final: true })),
    quiet(getEventPredictor(game.id)),
    quiet(getTeamBettingTrends(game.away?.teamId, game)),
    quiet(getTeamBettingTrends(game.home?.teamId, game)),
  ]);
  const lines = frozenOdds(game, 'lines') || odds;
  if (!lines) return null;
  const picks = buildLinePicks({ game, odds: lines, predictor, awayTrends, homeTrends });
  return gradeLinePicks(picks, game, lines);
};

// ---------- key players (QB / RB / WR) ----------

// Walks a team's leaders (most yards first) and returns up to `count` healthy
// players at `positions`, fetching athlete records only as far as needed.
const healthyLeaders = async (leaders, positions, season, count, maxChecks = 8) => {
  const found = [];
  for (const leader of leaders.slice(0, maxChecks)) {
    if (found.length >= count) break;
    // eslint-disable-next-line no-await-in-loop
    const athlete = await getCoreAthlete(leader.athleteId, season).catch(() => null);
    if (athlete && positions.includes(athlete.position) && !isUnavailable(athlete.injuryStatus)) found.push(athlete);
  }
  return found;
};

const SEASONS_BACK = 2;

// This season and last season's game logs, limited to games before `game`.
export const getRecentGames = async (athleteId, game) => {
  const seasons = Array.from({ length: SEASONS_BACK }, (_, i) => game.season - i);
  const logs = await Promise.all(
    seasons.map((season) =>
      getPlayerGameLog(athleteId, season)
        .then((log) => log.games.map((g) => ({ ...g, season })))
        .catch(() => []),
    ),
  );
  const cutoff = game.date ? new Date(game.date).getTime() : Infinity;
  const seen = new Set();
  return logs
    .flat()
    .filter((g) => g.eventId !== game.id && (!g.date || new Date(g.date).getTime() < cutoff))
    .filter((g) => (seen.has(g.eventId) ? false : seen.add(g.eventId)))
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
};

// Starting QB (depth chart), the top two healthy RBs and top three healthy
// WR/TEs by yards, each with this and last season's game logs.
export const RB_COUNT = 2;
export const WR_COUNT = 3;

export const getTeamPlayers = async (teamId, game) => {
  const season = game.season;
  const [leaders, starterId] = await Promise.all([
    getTeamLeaders(teamId, season).catch(() => ({ passing: [], rushing: [], receiving: [] })),
    getStartingQbId(teamId, season).catch(() => null),
  ]);

  const qbId = starterId || leaders.passing[0]?.athleteId || null;
  // The depth chart's starter, unless he's out: then the healthy QB with the most yards.
  const startingQb = async () => {
    const starter = qbId ? await getCoreAthlete(qbId, season).catch(() => null) : null;
    if (starter && !isUnavailable(starter.injuryStatus)) return starter;
    const [backup] = await healthyLeaders(
      leaders.passing.filter((l) => l.athleteId !== qbId),
      ['QB'],
      season,
      1,
    );
    return backup || null;
  };
  const [qb, rbs, wrs] = await Promise.all([
    startingQb(),
    healthyLeaders(leaders.rushing, ['RB', 'FB'], season, RB_COUNT),
    healthyLeaders(leaders.receiving, ['WR', 'TE'], season, WR_COUNT),
  ]);

  const withGames = (list) =>
    Promise.all(list.filter(Boolean).map(async (p) => ({ ...p, games: await getRecentGames(p.id, game) })));
  const [qbFull, rbFull, wrFull] = await Promise.all([withGames([qb]), withGames(rbs), withGames(wrs)]);
  return { qb: qbFull, rb: rbFull, wr: wrFull };
};

// Every QB / RB / WR / TE on both rosters, for the SEARCH tab.
const SEARCH_POSITIONS = ['QB', 'RB', 'FB', 'WR', 'TE'];

export const getGameSkillPlayers = async (game) => {
  const load = (side) =>
    getRoster(game[side]?.teamId)
      .then((roster) =>
        roster
          // injured-list / ruled-out players aren't listed
          .filter((p) => SEARCH_POSITIONS.includes(p.position) && !isUnavailable(p.injuryStatus))
          .map((p) => ({ ...p, teamSide: side, teamAbbr: game[side]?.team?.abbreviation })),
      )
      .catch(() => []);
  const [away, home] = await Promise.all([load('away'), load('home')]);
  return [...away, ...home];
};
