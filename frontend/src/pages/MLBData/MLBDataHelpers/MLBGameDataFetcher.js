import { format, subDays } from 'date-fns';
import { throttleAsyncTasks } from '../../../utils/concurrency';

export const fetchGameData = async ({
  selectedDate,
  getTeamAbbreviation,
  setGameBackgroundColors,
  setTodayGames,
  setVisibleGames,
  setBatterGameLogs,
  setLiveGameData, // ✅ added
  setLoading,
}) => {
  setLoading(true);
  try {
    const formatDate = (date) => format(date, 'yyyy-MM-dd');
    const todayFormatted = formatDate(selectedDate);
    const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&hydrate=probablePitcher,lineups,person,stats(group=[hitting],type=[season],season=2025)&startDate=${todayFormatted}&endDate=${todayFormatted}`;
    const response = await fetch(url);
    const data = await response.json();

    const fetchPitcherData = async (pitcherId) => {
      if (!pitcherId) return { era: 'N/A', inningsPitched: 'N/A', gamesPlayed: 'N/A', pitchHand: 'N/A' };
      const url = `https://statsapi.mlb.com/api/v1/people/${pitcherId}?hydrate=stats(group=[pitching],type=[season])`;
      const response = await fetch(url);
      const data = await response.json();
      const stats = data.people?.[0]?.stats?.[0]?.splits?.[0]?.stat;
      const pitchHand = data.people?.[0]?.pitchHand?.code;
      return stats ? { ...stats, pitchHand } : { era: 'N/A', inningsPitched: 'N/A', gamesPlayed: 'N/A', pitchHand: 'N/A' };
    };

    const fetchHitterStats = async (playerId) => {
      try {
        const url = `https://statsapi.mlb.com/api/v1/people/${playerId}?hydrate=stats(group=[hitting],type=[season],season=2025)`;
        const res = await fetch(url);
        const data = await res.json();
        return data.people?.[0]?.stats?.[0]?.splits?.[0]?.stat || {};
      } catch {
        return {};
      }
    };

    const fetchBatterLogsForTeam = async (teamId, teamName, gameDate, getTeamAbbreviation) => {
      const logs = {};
      const filteredRoster = [];

      try {
        const res = await fetch(`https://statsapi.mlb.com/api/v1/teams/${teamId}/roster/40Man`);
        const data = await res.json();
        const batters = data.roster.filter(
          (b) => b.position?.abbreviation !== 'P' && b.person?.id
        );

        const playerIds = batters.map((b) => b.person.id);
        const idString = playerIds.join(',');

        const seasonUrl = `https://statsapi.mlb.com/api/v1/people?personIds=${idString}&hydrate=stats(group=[hitting],type=[season],season=2025)`;
        const seasonRes = await fetch(seasonUrl);
        const seasonData = await seasonRes.json();

        const seasonStatsMap = {};
        for (const person of seasonData.people || []) {
          seasonStatsMap[person.id] = person.stats?.[0]?.splits?.[0]?.stat || {};
        }

        const beforeDay = new Date(gameDate).toISOString().split('T')[0];

        const tasks = batters.map((batter) => async () => {
          const fullName = batter.person.fullName;
          const playerId = batter.person.id;

          const logUrl = `https://statsapi.mlb.com/api/v1/people/${playerId}/stats?stats=gameLog&group=hitting&season=2025`;

          try {
            const logRes = await fetch(logUrl);
            const logData = await logRes.json();
            const splits = logData.stats?.[0]?.splits || [];

            const filtered = splits
              .filter(game => game.date < beforeDay)
              .sort((a, b) => new Date(b.date) - new Date(a.date));

            if (filtered.length > 0) {
              logs[fullName] = filtered.map((game) => ({
                date: game.date,
                opponent: getTeamAbbreviation(game.opponent?.id) || 'N/A',
                avg: game.stat?.avg ?? 'N/A',
                hits: game.stat?.hits ?? 'N/A',
                rbi: game.stat?.rbi ?? 'N/A',
                homeRuns: game.stat?.homeRuns ?? 'N/A',
                stolenBases: game.stat?.stolenBases ?? 'N/A',
                atBats: game.stat?.atBats ?? 'N/A',
                runs: game.stat?.runs ?? 'N/A',
                baseOnBalls: game.stat?.baseOnBalls ?? 'N/A',
                strikeOuts: game.stat?.strikeOuts ?? 'N/A',
              }));

              filteredRoster.push({
                ...batter,
                seasonStats: seasonStatsMap[playerId] || {},
              });
            }
          } catch (err) {
            console.warn(`Failed to load logs for ${fullName}:`, err);
          }
        });

        await throttleAsyncTasks(tasks, 4);
      } catch (err) {
        console.error(`Error loading batter logs for ${teamName}:`, err);
      }

      return { logs, roster: filteredRoster };
    };

    const fetchLastTwentyGames = async (teamId, selectedDate) => {
      const startDate = format(subDays(new Date(selectedDate), 30), 'yyyy-MM-dd');
      const endDate = format(subDays(new Date(selectedDate), 1), 'yyyy-MM-dd');
      const response = await fetch(`https://statsapi.mlb.com/api/v1/schedule?hydrate=team,lineups&sportId=1&startDate=${startDate}&endDate=${endDate}&teamId=${teamId}`);
      const data = await response.json();
      const games = data.dates?.flatMap(date => date.games) || [];
      return games.filter(game => ['Final', 'Completed Early'].includes(game.status.detailedState)).slice(-20);
    };

    const games = await Promise.all((data.dates || []).map(async (gameDay) => {
      return {
        ...gameDay,
        games: await Promise.all(gameDay.games.map(async (game) => {
          const liveGameUrl = `https://statsapi.mlb.com/api/v1.1/game/${game.gamePk}/feed/live`;
          const gameData = await fetch(liveGameUrl).then(res => res.json());

          const awayPitcherStats = await fetchPitcherData(game.teams.away.probablePitcher?.id);
          const homePitcherStats = await fetchPitcherData(game.teams.home.probablePitcher?.id);

          const awayLastTwentyGames = await fetchLastTwentyGames(game.teams.away.team.id, selectedDate);
          const homeLastTwentyGames = await fetchLastTwentyGames(game.teams.home.team.id, selectedDate);

          if (game.lineups?.awayPlayers) {
            game.lineups.awayPlayers = await Promise.all(
              game.lineups.awayPlayers.map(async (player) => {
                const stats = await fetchHitterStats(player.id);
                return { ...player, seasonStats: stats };
              })
            );
          }

          if (game.lineups?.homePlayers) {
            game.lineups.homePlayers = await Promise.all(
              game.lineups.homePlayers.map(async (player) => {
                const stats = await fetchHitterStats(player.id);
                return { ...player, seasonStats: stats };
              })
            );
          }

          return {
            ...game,
            liveData: gameData,
            teams: {
              ...game.teams,
              away: {
                ...game.teams.away,
                probablePitcher: { ...game.teams.away.probablePitcher, ...awayPitcherStats },
                lastTwentyGames: awayLastTwentyGames
              },
              home: {
                ...game.teams.home,
                probablePitcher: { ...game.teams.home.probablePitcher, ...homePitcherStats },
                lastTwentyGames: homeLastTwentyGames
              }
            }
          };
        }))
      };
    }));

    const backgroundColors = {};
    games.forEach((gameDay) => {
      gameDay.games.forEach((game) => {
        const gamePk = game.gamePk;
        const gameData = game.liveData;
        const statusCode = gameData?.gameData?.status?.statusCode;

        const getTeamBackgroundColor = (teamId) => {
          const isFinished = ['F', 'O'].includes(statusCode);
          if (!statusCode || !isFinished) return 'rgba(85, 85, 85, 1)';

          const homeScore = gameData.liveData.linescore.teams.home.runs;
          const awayScore = gameData.liveData.linescore.teams.away.runs;
          const homeId = gameData.liveData.boxscore.teams.home.team.id;
          const awayId = gameData.liveData.boxscore.teams.away.team.id;

          if (teamId === homeId) {
            return homeScore > awayScore ? 'rgba(0, 155, 0, 0.3)' : 'rgba(255, 0, 0, 0.3)';
          }
          if (teamId === awayId) {
            return awayScore > homeScore ? 'rgba(0, 155, 0, 0.3)' : 'rgba(255, 0, 0, 0.3)';
          }
          return 'rgba(50, 50, 50, 0.9)';
        };

        backgroundColors[gamePk] = {
          away: getTeamBackgroundColor(game.teams.away.team.id),
          home: getTeamBackgroundColor(game.teams.home.team.id)
        };
      });
    });

    games.forEach((gameDay) => {
      gameDay.games.sort((a, b) => new Date(a.gameDate) - new Date(b.gameDate));
    });

    const sortedGames = games
      .flatMap(date => date.games)
      .sort((a, b) => {
        const getEffectiveDate = (game) => {
          const detailedState = game.liveData?.gameData?.status?.detailedState;
          const originalDate = game.liveData?.gameData?.datetime?.originalDate;
          const selected = format(new Date(selectedDate), 'yyyy-MM-dd');
          const original = originalDate ? format(new Date(originalDate), 'yyyy-MM-dd') : null;
          if (detailedState?.includes('Postponed') && selected === original) {
            return new Date(originalDate);
          }
          return new Date(game.gameDate);
        };
        return getEffectiveDate(a) - getEffectiveDate(b);
      });

    setGameBackgroundColors(backgroundColors);
    setTodayGames(games);
    setVisibleGames(sortedGames);
    // Extract liveGameData from enriched game objects
    const liveGameDataMap = {};
    for (const gameDay of games) {
      for (const game of gameDay.games) {
        liveGameDataMap[game.gamePk] = game.liveData;
      }
    }
    setLiveGameData(liveGameDataMap); // ✅ now it's in sync with setTodayGames

    setLoading(false); // ✅ Allow UI to render immediately

    // 🔄 Fetch batter logs in background
    (async () => {
      const batterLogs = {};
      const teamFetchTasks = [];

      for (const game of sortedGames) {
        for (const team of [game.teams.away.team, game.teams.home.team]) {
          teamFetchTasks.push(
            (async () => {
              try {
                const { logs, roster } = await fetchBatterLogsForTeam(
                  team.id,
                  team.name,
                  game.gameDate,
                  getTeamAbbreviation
                );
                batterLogs[team.id] = { logs, roster };
              } catch (err) {
                console.warn(`Skipping ${team.name} due to error`, err);
              }
            })()
          );
        }
      }

      await Promise.all(teamFetchTasks);
      setBatterGameLogs(batterLogs);
    })();

  } catch (error) {
    console.error('Error fetching game data:', error);
    setLoading(false);
  }
};
