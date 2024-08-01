// src/containers/MLBData/MLBData.js
import React, { useEffect, useRef, useState } from 'react';
import './MLBData.scss';
import { format, subDays } from 'date-fns';
import Cookies from 'js-cookie';
import MLBDataNavbar from '../../components/MLBData/MLBDataNavbar';
import MatchupCard from '../../components/MLBData/MatchupCard';

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

  const teamsMenuRef = useRef();

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
      try {
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

        const fetchLastTwentyGames = async (teamId, selectedDate) => {
          const formatDate = (date) => format(date, 'yyyy-MM-dd');
          const startDate = formatDate(subDays(new Date(selectedDate), 50)); // Adjusted for 20 games
          const endDate = formatDate(subDays(new Date(selectedDate), 1));
          const response = await fetch(`https://statsapi.mlb.com/api/v1/schedule?hydrate=team,lineups&sportId=1&startDate=${startDate}&endDate=${endDate}&teamId=${teamId}`);
          const data = await response.json();
          const games = data.dates?.flatMap(date => date.games) || [];
          return games.filter(game => {
            const gameStatus = game.status.detailedState;
            return gameStatus === 'Final' || gameStatus === 'Completed Early';
          }).slice(-20); // Fetch last 20 games
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

        setTodayGames(games);
        setVisibleGames(games.flatMap(date =>
          date.games.filter(game =>
            selectedTeams.includes(game.teams.away.team.id) || selectedTeams.includes(game.teams.home.team.id)
          )
        ));
      } catch (error) {
        console.error('Error fetching game data:', error);
      }
    };

    const initializeData = async () => {
      setLoading(true);
      await fetchGameData(selectedDate);
      setLoading(false);
    };

    initializeData();
    // eslint-disable-next-line
  }, [selectedDate]);

  useEffect(() => {
    setVisibleGames(todayGames.flatMap(date =>
      date.games.filter(game =>
        selectedTeams.includes(game.teams.away.team.id) || selectedTeams.includes(game.teams.home.team.id)
      )
    ));
  }, [selectedTeams, todayGames]);

  useEffect(() => {
    const fetchLiveData = async () => {
      const liveData = await Promise.all(todayGames.flatMap(date =>
        date.games.map(async (game) => {
          const liveGameUrl = `https://statsapi.mlb.com/api/v1.1/game/${game.gamePk}/feed/live`;
          const response = await fetch(liveGameUrl);
          const data = await response.json();
          return { gamePk: game.gamePk, liveData: data.liveData };
        })
      ));

      const liveGameDataMap = {};
      liveData.forEach(game => {
        liveGameDataMap[game.gamePk] = game.liveData;
      });

      setLiveGameData(liveGameDataMap);
    };

    const intervalId = setInterval(fetchLiveData, 10000);
    fetchLiveData(); // Initial fetch

    return () => clearInterval(intervalId); // Cleanup interval on component unmount
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

  const getTeamAbbreviation = (teamId) => {
    const team = mlbTeams.find((team) => team.id === teamId);
    return team ? team.abbreviation : '';
  };

  const handleTeamChange = (teamId) => {
    setSelectedTeams((prevSelectedTeams) => {
      const updatedSelectedTeams = prevSelectedTeams.includes(teamId)
        ? prevSelectedTeams.filter((id) => id !== teamId)
        : [...prevSelectedTeams, teamId];

      Cookies.set('selectedTeams', JSON.stringify(updatedSelectedTeams), { expires: 7 });
      return updatedSelectedTeams;
    });
  };

  const handleSelectAll = () => {
    const allTeamIds = mlbTeams.map(team => team.id);
    setSelectedTeams(allTeamIds);
    Cookies.set('selectedTeams', JSON.stringify(allTeamIds), { expires: 7 });
  };

  const handleDeselectAll = () => {
    setSelectedTeams([]);
    Cookies.set('selectedTeams', JSON.stringify([]), { expires: 7 });
  };

  return (
    <div className={`mlb-data-container ${loading ? 'loading-background' : ''}`}>
      <div className="background-image" style={{ backgroundImage: `url(${process.env.PUBLIC_URL + '/bg4.jpg'})` }} />
      <MLBDataNavbar
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        isCalendarOpen={isCalendarOpen}
        setIsCalendarOpen={setIsCalendarOpen}
        isTeamsMenuOpen={isTeamsMenuOpen}
        setIsTeamsMenuOpen={setIsTeamsMenuOpen}
        mlbTeams={mlbTeams}
        selectedTeams={selectedTeams}
        handleTeamChange={handleTeamChange}
        handleSelectAll={handleSelectAll}
        handleDeselectAll={handleDeselectAll}
        teamsMenuRef={teamsMenuRef}
      />
      {loading ? (
        <div className="loading">
          <img src={`${process.env.PUBLIC_URL}/baseball.gif`} alt="Loading..." />
          <p>loading...</p>
        </div>
      ) : (
        <MatchupCard
          visibleGames={visibleGames}
          selectedTeams={selectedTeams}
          getTeamLogo={getTeamLogo}
          getTeamRecord={getTeamRecord}
          formatTime={formatTime}
          getTeamAbbreviation={getTeamAbbreviation}
          liveGameData={liveGameData} // Pass live game data
        />
      )}
    </div>
  );
}

export default MLBData;
