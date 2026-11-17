import { getTeamResultHistory } from '../../../pages/NFLData/NFLDataApi/bettingService';
import { teamResultHistory } from '../../../pages/NFLData/NFLDataApi/picks';
import { getLeagueTeamSchedule } from '../../../sports/team/leagueApi';

// Both teams' results for the win / loss rows (TeamResultsRows): NFL this
// season (and the playoffs), NBA / MLB the last 20 games. A team whose
// schedule can't be loaded just has no row. Loaded in one go with whatever
// it's shown with, so the rows never pop in after the rest of the tab.
export const getTeamHistories = async (lg, game) => {
  const one = async (side) => {
    const teamId = game[side]?.teamId;
    if (!teamId) return [];
    if (lg === 'nfl') return getTeamResultHistory(teamId, game);
    return teamResultHistory(await getLeagueTeamSchedule(lg, teamId, game.season), teamId, game).slice(-20);
  };
  const [away, home] = await Promise.all(['away', 'home'].map((side) => one(side).catch(() => [])));
  return { away, home };
};

export const historyRows = (game, histories) => [
  { team: game.away?.team, games: histories?.away || [] },
  { team: game.home?.team, games: histories?.home || [] },
];
