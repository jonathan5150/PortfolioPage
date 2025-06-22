import React, { useEffect, useRef, useState, useCallback } from 'react';
import './MLBData.scss';
import { format } from 'date-fns';
import Cookies from 'js-cookie';
import MatchupCard from '../../components/MLBDataComponents/MatchupCard/MatchupCard';
import { fetchGameData } from './MLBDataHelpers/MLBGameDataFetcher';

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
  }, [mlbTeams]);

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
    const initializeData = async () => {
      await fetchGameData({
        selectedDate,
        getTeamAbbreviation,
        setGameBackgroundColors,
        setTodayGames,
        setVisibleGames,
        setBatterGameLogs,
        setLiveGameData, // ✅ pass this
        setLoading,
      });

      // NOTE: fetchGameData will call setLoading(false) early to render faster
    };

    initializeData();
  }, [selectedDate, getTeamAbbreviation]);

  useEffect(() => {
    const selectedDateStr = format(new Date(selectedDate), 'yyyy-MM-dd');

    const getEffectiveDate = (game) => {
      const detailedState = game.liveData?.gameData?.status?.detailedState;
      const originalDate = game.liveData?.gameData?.datetime?.originalDate;
      const originalDateStr = originalDate ? format(new Date(originalDate), 'yyyy-MM-dd') : null;

      if (detailedState?.includes('Postponed') && selectedDateStr === originalDateStr) {
        return new Date(originalDate);
      }
      return new Date(game.gameDate);
    };

    const filtered = todayGames.flatMap(date =>
      date.games.filter(game =>
        selectedTeams.includes(game.teams.away.team.id) ||
        selectedTeams.includes(game.teams.home.team.id)
      )
    );

    const sorted = filtered.sort((a, b) => getEffectiveDate(a) - getEffectiveDate(b));
    setVisibleGames(sorted);
  }, [selectedTeams, todayGames, selectedDate]);

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

  useEffect(() => {
    Cookies.set('userPicks', JSON.stringify(userPicks), { expires: 30 });
  }, [userPicks]);

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
