import React, { useEffect, useRef, useState, useCallback } from 'react';
import './MLBData.scss';
import { format, subDays } from 'date-fns';
import Cookies from 'js-cookie';
import MatchupCard from '../../components/MLBDataComponents/MatchupCard/MatchupCard';
import { throttleAsyncTasks } from '../../utils/concurrency';


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

    // ✅ Batch season stats
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

    await throttleAsyncTasks(tasks, 10); // 🧵 Still throttle log fetches
  } catch (err) {
    console.error(`Error loading batter logs for ${teamName}:`, err);
  }

  return { logs, roster: filteredRoster };
};

function MLBData() {
  const [todayGames, setTodayGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [teamLogos, setTeamLogos] = useState({});
  const [mlbTeams, setMlbTeams] = useState([]);
  const [teamRecords, setTeamRecords] = useState({});
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isTeamsMenuOpen, setIsTeamsMenuOpen] = useState(false);
  const [selectedTeams, setSelectedTeams] = useState([]);
  const [visibleGames, setVisibleGames] = useState([]);
  const [liveGameData, setLiveGameData] = useState({});
  const [gameBackgroundColors, setGameBackgroundColors] = useState({});
  const [numGamesToShow, setNumGamesToShow] = useState({});
  const teamsMenuRef = useRef();
  const [userPicks, setUserPicks] = useState({});
  const [batterGameLogs, setBatterGameLogs] = useState({});
  const [playerStatsSortConfig, setPlayerStatsSortConfig] = useState({
    key: 'fullName',
    direction: 'asc',
  });


  const getTeamAbbreviation = useCallback((teamId) => {
    const team = mlbTeams.find((team) => team.id === teamId);
    return team ? team.abbreviation : '';
  }, [mlbTeams]); // Only depends on mlbTeams

  useEffect(() => {
    const savedPicks = Cookies.get('userPicks');
    if (savedPicks) {
      try {
        setUserPicks(JSON.parse(savedPicks));
      } catch {
        setUserPicks({});
      }
    }
  }, []);


  useEffect(() => {
    const updateViewportHeight = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };

    window.addEventListener('resize', updateViewportHeight);
    updateViewportHeight();

    return () => {
      window.removeEventListener('resize', updateViewportHeight);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (teamsMenuRef.current && !teamsMenuRef.current.contains(event.target)) {
        setIsTeamsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
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

        setTeamLogos(logos);
        setMlbTeams(teams);
        setTeamRecords(records);

        const savedSelectedTeams = Cookies.get('selectedTeams');
        if (savedSelectedTeams) {
          setSelectedTeams(JSON.parse(savedSelectedTeams));
        } else {
          setSelectedTeams(teams.map(team => team.id));
        }
      } catch (error) {
        console.error('Error fetching initial data:', error);
      }
    };

    fetchInitialData();
  }, []);

  useEffect(() => {
    const fetchGameData = async (selectedDate) => {
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

        const fetchLastTwentyGames = async (teamId, selectedDate) => {
          const formatDate = (date) => format(date, 'yyyy-MM-dd');
          const startDate = formatDate(subDays(new Date(selectedDate), 30));
          const endDate = formatDate(subDays(new Date(selectedDate), 1));
          const response = await fetch(`https://statsapi.mlb.com/api/v1/schedule?hydrate=team,lineups&sportId=1&startDate=${startDate}&endDate=${endDate}&teamId=${teamId}`);
          const data = await response.json();
          const games = data.dates?.flatMap(date => date.games) || [];
          return games.filter(game => {
            const gameStatus = game.status.detailedState;
            return gameStatus === 'Final' || gameStatus === 'Completed Early';
          }).slice(-20);
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
                    probablePitcher: {
                      ...game.teams.away.probablePitcher,
                      ...awayPitcherStats
                    },
                    lastTwentyGames: awayLastTwentyGames.slice(-20)
                  },
                  home: {
                    ...game.teams.home,
                    probablePitcher: {
                      ...game.teams.home.probablePitcher,
                      ...homePitcherStats
                    },
                    lastTwentyGames: homeLastTwentyGames.slice(-20)
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
              if (!statusCode || statusCode !== 'F') return 'rgba(85, 85, 85, 1)';

              const homeTeam = gameData.liveData.boxscore.teams.home;
              const awayTeam = gameData.liveData.boxscore.teams.away;

              const homeScore = gameData.liveData.linescore.teams.home.runs;
              const awayScore = gameData.liveData.linescore.teams.away.runs;

              if (homeTeam.team.id === teamId) {
                return homeScore > awayScore ? 'rgba(0, 155, 0, 0.3)' : 'rgba(255, 0, 0, 0.3)';
              }
              if (awayTeam.team.id === teamId) {
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

        games.forEach((gameDay) => {
          gameDay.games.sort((a, b) => new Date(a.gameDate) - new Date(b.gameDate));
        });

        const sortedGames = games
          .flatMap(date => date.games)
          .sort((a, b) => {
            const getEffectiveDate = (game) => {
              const detailedState = game.liveData?.gameData?.status?.detailedState;
              const originalDate = game.liveData?.gameData?.datetime?.originalDate;

              // Convert to YYYY-MM-DD for safe comparison
              const selected = format(new Date(selectedDate), 'yyyy-MM-dd');
              const original = originalDate ? format(new Date(originalDate), 'yyyy-MM-dd') : null;

              if (detailedState?.includes('Postponed') && selected === original) {
                return new Date(originalDate); // Show original time *only if user is viewing original date*
              }
              return new Date(game.gameDate); // Otherwise, use actual scheduled/rescheduled time
            };

            return getEffectiveDate(a) - getEffectiveDate(b);
          });

        setGameBackgroundColors(backgroundColors);
        setTodayGames(games); // Save full list for filtering later
        setVisibleGames(sortedGames); // Initial unfiltered list

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
        setLoading(false); // ✅ Only happens after batter logs finish
              } catch (error) {
                console.error('Error fetching game data:', error);
                setLoading(false); // ✅ Still fallback in error case
              }
    };

    const initializeData = async () => {
      await fetchGameData(selectedDate);
    };

    initializeData();
  }, [selectedDate, getTeamAbbreviation]);


  useEffect(() => {
    setVisibleGames(prev =>
      prev.filter(game =>
        selectedTeams.includes(game.teams.away.team.id) ||
        selectedTeams.includes(game.teams.home.team.id)
      )
    );
  }, [selectedTeams]);

  useEffect(() => {
    const fetchLiveData = async () => {
      const liveData = await Promise.all(todayGames.flatMap(date =>
        date.games.map(async (game) => {
          const liveGameUrl = `https://statsapi.mlb.com/api/v1.1/game/${game.gamePk}/feed/live`;
          const response = await fetch(liveGameUrl);
          const data = await response.json();
          return { gamePk: game.gamePk, liveData: data };
        })
      ));

      const liveGameDataMap = {};
      liveData.forEach(game => {
        liveGameDataMap[game.gamePk] = game.liveData;
      });

      setLiveGameData(liveGameDataMap);
    };

    const intervalId = setInterval(fetchLiveData, 10000);
    fetchLiveData();

    return () => clearInterval(intervalId);
  }, [todayGames]);

  const formatTime = (dateTime) => {
    const date = new Date(dateTime);
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const getTeamLogo = (mlbTeamName) => {
    return teamLogos[mlbTeamName] || '';
  };

  const getTeamRecord = (teamId) => {
    return teamRecords[teamId] || '0-0';
  };

  const handleTeamChange = (teamId) => {
    setSelectedTeams((prevSelectedTeams) => {
      const updatedSelectedTeams = prevSelectedTeams.includes(teamId)
        ? prevSelectedTeams.filter((id) => id !== teamId)
        : [...prevSelectedTeams, teamId];

      Cookies.set('selectedTeams', JSON.stringify(updatedSelectedTeams), { expires: 399 });
      return updatedSelectedTeams;
    });
  };

  const handleSelectAll = () => {
    const allTeamIds = mlbTeams.map(team => team.id);
    setSelectedTeams(allTeamIds);
    Cookies.set('selectedTeams', JSON.stringify(allTeamIds), { expires: 399 });
  };

  const handleDeselectAll = () => {
    setSelectedTeams([]);
    Cookies.set('selectedTeams', JSON.stringify([]), { expires: 399 });
  };



  return (
    <div className={`mlb-data-container ${loading ? 'loading-background' : ''}`}>
      {loading ? (
        <div className="loading">
          <img src={`${process.env.PUBLIC_URL}/baseball.gif`} alt="Loading..." />
          <p>loading...</p>
        </div>
      ) : (
        <MatchupCard
          loading={loading}
          visibleGames={visibleGames}
          selectedTeams={selectedTeams}
          getTeamLogo={getTeamLogo}
          getTeamRecord={getTeamRecord}
          formatTime={formatTime}
          getTeamAbbreviation={getTeamAbbreviation}
          liveGameData={liveGameData}
          userPicks={userPicks}
          setUserPicks={setUserPicks}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          isCalendarOpen={isCalendarOpen}
          setIsCalendarOpen={setIsCalendarOpen}
          isTeamsMenuOpen={isTeamsMenuOpen}
          setIsTeamsMenuOpen={setIsTeamsMenuOpen}
          mlbTeams={mlbTeams}
          handleTeamChange={handleTeamChange}
          handleSelectAll={handleSelectAll}
          handleDeselectAll={handleDeselectAll}
          teamsMenuRef={teamsMenuRef}
          todayGames={todayGames}
          gameBackgroundColors={gameBackgroundColors}
          numGamesToShow={numGamesToShow}
          setNumGamesToShow={setNumGamesToShow}
          batterGameLogs={batterGameLogs}
          playerStatsSortConfig={playerStatsSortConfig}
          setPlayerStatsSortConfig={setPlayerStatsSortConfig}
        />
      )}
    </div>
  );
}

export default MLBData;
