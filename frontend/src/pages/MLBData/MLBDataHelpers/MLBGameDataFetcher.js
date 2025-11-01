import { format, subDays } from 'date-fns';
import { throttleAsyncTasks } from '../../../utils/concurrency';

/** Normalize MLB gameType (default to regular) */
const getGameType = (game) => (game?.gameType ? String(game.gameType) : 'R');

/** Merge two hitting stat lines (regular & postseason) into one */
const mergeHittingStats = (a = {}, b = {}) => {
  const sum = (k) => (Number(a[k] || 0) + Number(b[k] || 0));
  const merged = {
    gamesPlayed: sum('gamesPlayed'),
    hits: sum('hits'),
    rbi: sum('rbi'),
    baseOnBalls: sum('baseOnBalls'),
    strikeOuts: sum('strikeOuts'),
    homeRuns: sum('homeRuns'),
    stolenBases: sum('stolenBases'),
    atBats: sum('atBats'),
    runs: sum('runs'),
  };
  if (merged.atBats > 0) {
    const avg = merged.hits / merged.atBats;
    merged.avg = avg.toFixed(3).replace(/^0(?=\.)/, '');
  } else {
    merged.avg = '';
  }
  return merged;
};

/** Fetch a single hitter season stat line for a specific gameType (R or P) */
const fetchHitterSeason = async (playerId, gameType) => {
  const url =
    `https://statsapi.mlb.com/api/v1/people/${playerId}` +
    `?hydrate=stats(group=[hitting],type=[season],season=2025,gameType=[${gameType}])`;
  const res = await fetch(url);
  const data = await res.json();
  return data.people?.[0]?.stats?.[0]?.splits?.[0]?.stat || {};
};

/** Public: combined regular+postseason hitter stats */
const fetchHitterStatsCombined = async (playerId) => {
  try {
    const [reg, post] = await Promise.all([
      fetchHitterSeason(playerId, 'R'),
      fetchHitterSeason(playerId, 'P'),
    ]);
    return mergeHittingStats(reg, post);
  } catch {
    return {};
  }
};

/** Pitcher season stats scoped by gameType (kept separate for per-gameType display) */
const fetchPitcherData = async (pitcherId, gameType = 'R') => {
  if (!pitcherId)
    return { era: 'N/A', inningsPitched: 'N/A', gamesPlayed: 'N/A', pitchHand: 'N/A' };
  const url = `https://statsapi.mlb.com/api/v1/people/${pitcherId}` +
              `?hydrate=stats(group=[pitching],type=[season],season=2025,gameType=[${gameType}])`;
  const response = await fetch(url);
  const data = await response.json();
  const stats = data.people?.[0]?.stats?.[0]?.splits?.[0]?.stat;
  const pitchHand = data.people?.[0]?.pitchHand?.code;
  return stats
    ? { ...stats, pitchHand }
    : { era: 'N/A', inningsPitched: 'N/A', gamesPlayed: 'N/A', pitchHand: 'N/A' };
};

/** Pitcher "last five" starts across Regular + ALL postseason rounds (F,D,L,W), with fallbacks */
const fetchPitcherLastFiveStarts = async (pitcherId, gameDate, getTeamAbbreviation) => {
  if (!pitcherId) return [];
  const beforeDay = new Date(gameDate).toISOString().split('T')[0];

  const fetchLogs = async (gameTypeParam) => {
    const url =
      `https://statsapi.mlb.com/api/v1/people/${pitcherId}/stats` +
      `?stats=gameLog&group=pitching&season=2025&gameType=${gameTypeParam}`;
    const res = await fetch(url);
    const data = await res.json();
    return data?.stats?.[0]?.splits || [];
  };

  try {
    // Primary: explicit round codes to capture all postseason logs
    let splits = await fetchLogs('R,F,D,L,W');

    // Fallbacks: some environments accept P; last resort R only
    if (!Array.isArray(splits) || splits.length === 0) splits = await fetchLogs('R,P');
    if (!Array.isArray(splits) || splits.length === 0) splits = await fetchLogs('R');

    // strictly BEFORE current game to avoid including the same-day start
    const prior = (splits || [])
      .filter(g => g.date < beforeDay)
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    const starts = prior.filter(g => (g.stat?.gamesStarted ?? 0) > 0);
    const rows = (starts.length >= 5 ? starts : prior).slice(0, 10);

    return rows.map((g) => {
      // Robust team result resolution:
      // 1) Explicit flags if present
      // 2) Pitcher decision as fallback
      // 3) If we still can't tell, infer from scores when available
      let teamRes = '';

      if (g.isWin === true) teamRes = 'W';
      else if (g.isLoss === true) teamRes = 'L';
      else if (g.stat?.decision === 'W' || g.stat?.decision === 'L') teamRes = g.stat.decision;
      else if (typeof g.isWin === 'boolean') teamRes = g.isWin ? 'W' : 'L';
      else if (g.team?.score != null && g.opponent?.score != null) {
        teamRes = g.team.score > g.opponent.score ? 'W' : 'L';
      }

      const isPostseason = ['F', 'D', 'L', 'W', 'P'].includes(g.gameType);

      return {
        date: g.date,
        opponent: getTeamAbbreviation?.(g.opponent?.id) || 'N/A',
        inningsPitched: g.stat?.inningsPitched ?? 'N/A',
        hits: g.stat?.hits ?? 'N/A',
        earnedRuns: g.stat?.earnedRuns ?? 'N/A',
        walks: g.stat?.baseOnBalls ?? 'N/A',
        strikeouts: g.stat?.strikeOuts ?? 'N/A',
        result: teamRes,   // ← now reliably "W" or "L"
        isPostseason,
      };
    });
  } catch (e) {
    console.warn('fetchPitcherLastFiveStarts failed', e);
    return [];
  }
};

export const fetchGameData = async ({
  selectedDate,
  getTeamAbbreviation,
  setGameBackgroundColors,
  setTodayGames,
  setVisibleGames,
  setBatterGameLogs,
  setLiveGameData,
  setLoading,
}) => {
  setLoading(true);
  try {
    const formatDate = (date) => format(date, 'yyyy-MM-dd');
    const todayFormatted = formatDate(selectedDate);

    // Broad hydrate; we'll overwrite hitter seasonStats with combined R+P anyway
    const url =
      `https://statsapi.mlb.com/api/v1/schedule` +
      `?sportId=1` +
      `&hydrate=probablePitcher,lineups,person,` +
      `stats(group=[hitting],type=[season],season=2025,gameType=[R,P])` +
      `&startDate=${todayFormatted}&endDate=${todayFormatted}`;

    const response = await fetch(url);
    const data = await response.json();

    /** Last 20 (kept from your code) */
    const fetchLastTwentyGames = async (teamId, selectedDate) => {
      const startDate = format(subDays(new Date(selectedDate), 30), 'yyyy-MM-dd');
      const endDate = format(subDays(new Date(selectedDate), 1), 'yyyy-MM-dd');
      const response = await fetch(
        `https://statsapi.mlb.com/api/v1/schedule?hydrate=team,lineups&sportId=1&startDate=${startDate}&endDate=${endDate}&teamId=${teamId}`
      );
      const data = await response.json();
      const games = data.dates?.flatMap((date) => date.games) || [];
      return games
        .filter((game) => ['Final', 'Completed Early'].includes(game.status.detailedState))
        .slice(-14);
    };

    /**
     * Team-level: preload combined season stats and logs (R+P) for every batter.
     */
    const fetchBatterLogsForTeam = async (
      teamId,
      teamName,
      gameDate,
      getTeamAbbreviation
    ) => {
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

        // Pull both seasons in bulk for hitters
        const [seasonResR, seasonResP] = await Promise.all([
          fetch(
            `https://statsapi.mlb.com/api/v1/people?personIds=${idString}&hydrate=stats(group=[hitting],type=[season],season=2025,gameType=[R])`
          ),
          fetch(
            `https://statsapi.mlb.com/api/v1/people?personIds=${idString}&hydrate=stats(group=[hitting],type=[season],season=2025,gameType=[P])`
          ),
        ]);

        const [seasonDataR, seasonDataP] = await Promise.all([
          seasonResR.json(),
          seasonResP.json(),
        ]);

        const mapFrom = (people) => {
          const m = {};
          for (const person of people?.people || []) {
            m[person.id] = person.stats?.[0]?.splits?.[0]?.stat || {};
          }
          return m;
        };
        const mapR = mapFrom(seasonDataR);
        const mapP = mapFrom(seasonDataP);

        const seasonStatsMap = {};
        for (const pid of playerIds) {
          seasonStatsMap[pid] = mergeHittingStats(mapR[pid], mapP[pid]);
        }

        const beforeDay = new Date(gameDate).toISOString().split('T')[0];

        const tasks = batters.map((batter) => async () => {
          const fullName = batter.person.fullName;
          const playerId = batter.person.id;

          // Logs across regular + postseason
          const logUrl =
            `https://statsapi.mlb.com/api/v1/people/${playerId}/stats` +
            `?stats=gameLog&group=hitting&season=2025&gameType=R,P`;

          try {
            const logRes = await fetch(logUrl);
            const logData = await logRes.json();
            const splits = logData.stats?.[0]?.splits || [];

            const filtered = splits
              .filter((game) => game.date < beforeDay)
              .sort((a, b) => new Date(b.date) - new Date(a.date));

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
          } catch (err) {
            console.warn(`Failed to load logs for ${fullName}:`, err);
            filteredRoster.push({
              ...batter,
              seasonStats: seasonStatsMap[playerId] || {},
            });
          }
        });

        await throttleAsyncTasks(tasks, 4);
      } catch (err) {
        console.error(`Error loading batter logs for ${teamName}:`, err);
      }

      return { logs, roster: filteredRoster };
    };

    // Build enriched games (hitters combined R+P; pitchers augmented with lastFiveStarts R+P)
    const games = await Promise.all(
      (data.dates || []).map(async (gameDay) => {
        return {
          ...gameDay,
          games: await Promise.all(
            gameDay.games.map(async (game) => {
              const liveGameUrl = `https://statsapi.mlb.com/api/v1.1/game/${game.gamePk}/feed/live`;
              const gameData = await fetch(liveGameUrl).then((res) => res.json());
              const gameType = getGameType(game);

              const awayPitcherId = game.teams.away.probablePitcher?.id;
              const homePitcherId = game.teams.home.probablePitcher?.id;

              const awayPitcherStats = await fetchPitcherData(awayPitcherId, gameType);
              const homePitcherStats = await fetchPitcherData(homePitcherId, gameType);

              // Attach last 5 starts (R + all postseason rounds)
              const awayLastFiveStarts = await fetchPitcherLastFiveStarts(
                awayPitcherId,
                game.gameDate,
                getTeamAbbreviation
              );
              const homeLastFiveStarts = await fetchPitcherLastFiveStarts(
                homePitcherId,
                game.gameDate,
                getTeamAbbreviation
              );

              const awayLastTwentyGames = await fetchLastTwentyGames(
                game.teams.away.team.id,
                selectedDate
              );
              const homeLastTwentyGames = await fetchLastTwentyGames(
                game.teams.home.team.id,
                selectedDate
              );

              // Overwrite lineup players' seasonStats with combined R+P
              if (game.lineups?.awayPlayers) {
                game.lineups.awayPlayers = await Promise.all(
                  game.lineups.awayPlayers.map(async (player) => {
                    const stats = await fetchHitterStatsCombined(player.id);
                    return { ...player, seasonStats: stats };
                  })
                );
              }
              if (game.lineups?.homePlayers) {
                game.lineups.homePlayers = await Promise.all(
                  game.lineups.homePlayers.map(async (player) => {
                    const stats = await fetchHitterStatsCombined(player.id);
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
                    probablePitcher: {
                      ...game.teams.away.probablePitcher,
                      ...awayPitcherStats,
                      lastFiveStarts: awayLastFiveStarts,
                    },
                    lastTwentyGames: awayLastTwentyGames,
                  },
                  home: {
                    ...game.teams.home,
                    probablePitcher: {
                      ...game.teams.home.probablePitcher,
                      ...homePitcherStats,
                      lastFiveStarts: homeLastFiveStarts,
                    },
                    lastTwentyGames: homeLastTwentyGames,
                  },
                },
              };
            })
          ),
        };
      })
    );

    // Background colors
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
          home: getTeamBackgroundColor(game.teams.home.team.id),
        };
      });
    });

    // Sorts
    games.forEach((gameDay) => {
      gameDay.games.sort((a, b) => new Date(a.gameDate) - new Date(b.gameDate));
    });

    const sortedGames = games
      .flatMap((date) => date.games)
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

    // liveGameData map
    const liveGameDataMap = {};
    for (const gameDay of games) {
      for (const game of gameDay.games) {
        liveGameDataMap[game.gamePk] = game.liveData;
      }
    }
    setLiveGameData(liveGameDataMap);

    setLoading(false);

    // 🔄 Combined-season batter logs preload (R+P)
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
