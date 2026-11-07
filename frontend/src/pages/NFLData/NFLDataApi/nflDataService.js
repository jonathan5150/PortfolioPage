// The one module the UI imports for data. It decides which source to use
// (ESPN for current/live data, nflverse for past seasons) and falls back
// to the other source when one is unavailable.
import * as espn from './espnService';
import { getNflversePlayerSeasonStats, getNflverseTeamSeasonStats } from './nflverseService';
import { buildRankings, ESPN_METRICS, NFLVERSE_METRICS } from './teamRankings';

export {
  getTeams,
  getScoreboard,
  getGameSummary,
  getPlayerGameLog,
  getRoster,
  getStandings,
  SKILL_POSITIONS,
} from './espnService';

export const getTeamRankings = async (season, teams = []) => {
  try {
    const byTeam = await espn.getTeamStatsByTeam(season, 2);
    if (Object.keys(byTeam).length >= 20) {
      return { source: 'ESPN', season, ...buildRankings(byTeam, ESPN_METRICS) };
    }
  } catch (error) {
    console.warn('ESPN team stats unavailable, trying nflverse:', error);
  }

  const rows = await getNflverseTeamSeasonStats(season);
  const idByAbbr = Object.fromEntries(teams.map((t) => [t.abbreviation, t.id]));
  const byTeamId = {};
  rows.forEach((row) => {
    const id = idByAbbr[row.team];
    if (id) byTeamId[id] = row;
  });
  return { source: 'nflverse', season, ...buildRankings(byTeamId, NFLVERSE_METRICS) };
};

// Season stat lines for a team's QBs, RBs, WRs and TEs.
export const getTeamPlayerSeasonStats = async (team, season, currentSeason) => {
  const fromNflverse = async () => {
    const rows = await getNflversePlayerSeasonStats(season);
    return { source: 'nflverse', players: rows.filter((r) => r.team === team.abbreviation) };
  };
  const fromEspn = async () => ({
    source: 'ESPN',
    players: await espn.getTeamSkillPlayerSeasonStats(team, season),
  });

  const [primary, secondary] = season >= currentSeason ? [fromEspn, fromNflverse] : [fromNflverse, fromEspn];

  try {
    const result = await primary();
    if (result.players.length) return result;
  } catch (error) {
    console.warn(`Primary season stats source failed for ${team.abbreviation}:`, error);
  }
  return secondary();
};
