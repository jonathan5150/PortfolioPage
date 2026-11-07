// ESPN data access. Components never call fetch() directly; they call these functions.
import { fetchJson, runWithConcurrency } from './http';
import { espnUrls } from './endpoints';
import {
  parseTeamsResponse,
  parseScoreboard,
  parseSummary,
  parseRoster,
  parseGameLog,
  parseTeamStatsByTeam,
  parseStandings,
} from './espnParsers';

const MINUTE = 60 * 1000;

export const SKILL_POSITIONS = ['QB', 'RB', 'FB', 'WR', 'TE'];

export const getTeams = async () => parseTeamsResponse(await fetchJson(espnUrls.teams(), { ttlMs: 60 * MINUTE }));

// live=true skips the cache so polling always sees fresh scores.
export const getScoreboard = async (params = {}, { live = false } = {}) =>
  parseScoreboard(await fetchJson(espnUrls.scoreboard(params), { ttlMs: live ? 0 : 30 * 1000 }));

export const getGameSummary = async (eventId, { live = false } = {}) =>
  parseSummary(await fetchJson(espnUrls.summary(eventId), { ttlMs: live ? 0 : 5 * MINUTE }));

export const getRoster = async (teamId) =>
  parseRoster(await fetchJson(espnUrls.roster(teamId), { ttlMs: 30 * MINUTE }));

export const getPlayerGameLog = async (athleteId, season) =>
  parseGameLog(await fetchJson(espnUrls.athleteGameLog(athleteId, season), { ttlMs: 10 * MINUTE }));

export const getTeamStatsByTeam = async (season, seasonType = 2) =>
  parseTeamStatsByTeam(await fetchJson(espnUrls.teamStatsByTeam({ season, seasonType }), { ttlMs: 30 * MINUTE }));

export const getStandings = async (season) =>
  parseStandings(await fetchJson(espnUrls.standings(season), { ttlMs: 30 * MINUTE }));

// ---------- Player season stats built from ESPN game logs ----------

const sumGames = (games, name) => games.reduce((total, g) => total + (g.stats[name] ?? 0), 0);

// Converts an ESPN game log into the same shape nflverse rows use, so the UI
// doesn't care which source produced the numbers.
export const seasonLineFromGameLog = (player, gameLog) => {
  const regularGames = gameLog.games.filter((g) => !g.isPostseason);
  const t = gameLog.seasonTotals;
  const pick = (name) => (t && t[name] !== null && t[name] !== undefined ? t[name] : sumGames(regularGames, name));

  return {
    id: player.id,
    name: player.name,
    position: player.position,
    team: player.teamAbbr,
    games: regularGames.length,
    passing: {
      completions: pick('completions'),
      attempts: pick('passingAttempts'),
      yards: pick('passingYards'),
      touchdowns: pick('passingTouchdowns'),
      interceptions: pick('interceptions'),
      sacks: pick('sacks'),
    },
    rushing: {
      attempts: pick('rushingAttempts'),
      yards: pick('rushingYards'),
      touchdowns: pick('rushingTouchdowns'),
    },
    receiving: {
      receptions: pick('receptions'),
      targets: pick('receivingTargets'),
      yards: pick('receivingYards'),
      touchdowns: pick('receivingTouchdowns'),
    },
    fumblesLost: pick('fumblesLost'),
  };
};

export const getTeamSkillPlayerSeasonStats = async (team, season) => {
  const roster = await getRoster(team.id);
  const skillPlayers = roster
    .filter((p) => SKILL_POSITIONS.includes(p.position))
    .map((p) => ({ ...p, teamAbbr: team.abbreviation }));

  const results = await runWithConcurrency(
    skillPlayers.map((player) => async () => {
      const log = await getPlayerGameLog(player.id, season);
      return seasonLineFromGameLog(player, log);
    }),
    6
  );

  return results.filter((r) => r.ok && r.value.games > 0).map((r) => r.value);
};
