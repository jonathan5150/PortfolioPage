// src/utils/api.js
import { format, subDays } from 'date-fns';

export const fetchInitialData = async () => {
  const [teamLogosRes, mlbTeamsRes, teamRecordsRes] = await Promise.all([
    fetch('https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/teams'),
    fetch('https://statsapi.mlb.com/api/v1/teams?sportId=1'),
    fetch('https://statsapi.mlb.com/api/v1/standings?leagueId=103,104')
  ]);

  const teamLogosData = await teamLogosRes.json();
  const mlbTeamsData = await mlbTeamsRes.json();
  const teamRecordsData = await teamRecordsRes.json();

  const logos = {};
  teamLogosData.sports[0].leagues[0].teams.forEach((team) => {
    logos[team.team.displayName] = team.team.logos[0].href;
  });

  const teams = mlbTeamsData.teams.map(team => ({
    id: team.id,
    name: team.teamName === 'D-backs' ? 'Diamondbacks' : team.teamName,
    abbreviation: team.abbreviation
  })).sort((a, b) => a.abbreviation.localeCompare(b.abbreviation));

  const records = {};
  teamRecordsData.records.forEach((league) => {
    league.teamRecords.forEach((teamRecord) => {
      const teamId = teamRecord.team.id;
      records[teamId] = `${teamRecord.wins}-${teamRecord.losses}`;
    });
  });

  return { logos, teams, records };
};

export const fetchGameData = async (selectedDate, selectedTeams) => {
  const formatDate = (date) => format(date, 'yyyy-MM-dd');
  const todayFormatted = formatDate(selectedDate);
  const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&hydrate=probablePitcher&startDate=${todayFormatted}&endDate=${todayFormatted}`;
  const response = await fetch(url);
  const data = await response.json();

  const fetchPitcherData = async (pitcherId) => {
    if (!pitcherId) return { era: 'N/A', gamesPlayed: 'N/A' };
    const response = await fetch(`https://statsapi.mlb.com/api/v1/people/${pitcherId}?hydrate=stats(group=[pitching],type=[season])`);
    const data = await response.json();
    const stats = data.people?.[0]?.stats?.[0]?.splits?.[0]?.stat;
    return stats ? { era: stats.era, gamesPlayed: stats.gamesPlayed } : { era: 'N/A', gamesPlayed: 'N/A' };
  };

  const fetchLastTenGames = async (teamId, selectedDate) => {
    const formatDate = (date) => format(date, 'yyyy-MM-dd');
    const startDate = formatDate(subDays(new Date(selectedDate), 30));
    const endDate = formatDate(subDays(new Date(selectedDate), 1));
    const response = await fetch(`https://statsapi.mlb.com/api/v1/schedule?hydrate=team,lineups&sportId=1&startDate=${startDate}&endDate=${endDate}&teamId=${teamId}`);
    const data = await response.json();
    const games = data.dates?.flatMap(date => date.games) || [];
    return games.filter(game => {
      const gameStatus = game.status.detailedState;
      return gameStatus === 'Final' || gameStatus === 'Completed Early';
    }).slice(-10);
  };

  const games = await Promise.all((data.dates || []).map(async (gameDay) => {
    return {
      ...gameDay,
      games: await Promise.all(gameDay.games.map(async (game) => {
        const liveGameUrl = `https://statsapi.mlb.com/api/v1.1/game/${game.gamePk}/feed/live`;
        const gameData = await fetch(liveGameUrl).then(res => res.json());

        const awayPitcherStats = await fetchPitcherData(game.teams.away.probablePitcher?.id);
        const homePitcherStats = await fetchPitcherData(game.teams.home.probablePitcher?.id);

        const awayLastFiveGames = (await fetchLastTenGames(game.teams.away.team.id, selectedDate)).slice(-5);
        const homeLastFiveGames = (await fetchLastTenGames(game.teams.home.team.id, selectedDate)).slice(-5);

        return {
          ...game,
          liveData: gameData.liveData,
          teams: {
            ...game.teams,
            away: {
              ...game.teams.away,
              probablePitcher: {
                ...game.teams.away.probablePitcher,
                ...awayPitcherStats
              },
              lastFiveGames: awayLastFiveGames
            },
            home: {
              ...game.teams.home,
              probablePitcher: {
                ...game.teams.home.probablePitcher,
                ...homePitcherStats
              },
              lastFiveGames: homeLastFiveGames
            }
          }
        };
      }))
    };
  }));

  return games.flatMap(date =>
    date.games.filter(game =>
      selectedTeams.includes(game.teams.away.team.id) || selectedTeams.includes(game.teams.home.team.id)
    )
  );
};
