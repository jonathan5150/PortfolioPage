import React, { useEffect, useRef, useState, useCallback } from 'react';
import './MLBData.scss';
import { format } from 'date-fns';
import Cookies from 'js-cookie';
import MatchupCard from '../../components/MLBDataComponents/MatchupCard/MatchupCard';
import { fetchGameData } from './MLBDataHelpers/MLBGameDataFetcher';

function MLBData() {
  const [todayGames, setTodayGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mlbTeams, setMlbTeams] = useState([]);
  const [teamRecords, setTeamRecords] = useState({});
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isTeamsMenuOpen, setIsTeamsMenuOpen] = useState(false);
  const [selectedTeams, setSelectedTeams] = useState(null);
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

  const getTeamAbbreviation = useCallback(
    (teamId) => {
      const team = mlbTeams.find((team) => team.id === teamId);
      return team ? team.abbreviation : '';
    },
    [mlbTeams]
  );

  // ✅ NEW: MLB static logo (no API needed)
  const getTeamLogo = (teamId) => {
    return `https://www.mlbstatic.com/team-logos/team-cap-on-dark/${teamId}.svg`;
  };

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
    return () => window.removeEventListener('resize', updateViewportHeight);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (teamsMenuRef.current && !teamsMenuRef.current.contains(event.target)) {
        setIsTeamsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [mlbTeamsRes, teamRecordsRes] = await Promise.all([
          fetch('https://statsapi.mlb.com/api/v1/teams?sportId=1'),
          fetch('https://statsapi.mlb.com/api/v1/standings?leagueId=103,104'),
        ]);

        const mlbTeamsData = await mlbTeamsRes.json();
        const teamRecordsData = await teamRecordsRes.json();

        const teams = mlbTeamsData.teams
          .map((team) => ({
            id: team.id,
            name: team.teamName === 'D-backs' ? 'Diamondbacks' : team.teamName,
            abbreviation: team.abbreviation,
          }))
          .sort((a, b) => a.abbreviation.localeCompare(b.abbreviation));

        const records = {};
        teamRecordsData.records.forEach((league) => {
          league.teamRecords.forEach((teamRecord) => {
            records[teamRecord.team.id] = `${teamRecord.wins}-${teamRecord.losses}`;
          });
        });

        setMlbTeams(teams);
        setTeamRecords(records);

        const savedSelectedTeams = Cookies.get('selectedTeams');

        if (savedSelectedTeams) {
          try {
            const parsed = JSON.parse(savedSelectedTeams);
            setSelectedTeams(Array.isArray(parsed) ? parsed : teams.map(t => t.id));
          } catch {
            setSelectedTeams(teams.map(t => t.id));
          }
        } else {
          setSelectedTeams(teams.map(t => t.id));
        }

      } catch (error) {
        console.error('Error fetching initial data:', error);
        setSelectedTeams([]);
        setLoading(false);
      }
    };

    fetchInitialData();
  }, []);

  useEffect(() => {
    if (!mlbTeams.length || selectedTeams === null) return;

    const initializeData = async () => {
      await fetchGameData({
        selectedDate,
        getTeamAbbreviation,
        setGameBackgroundColors,
        setTodayGames,
        setVisibleGames,
        setBatterGameLogs,
        setLiveGameData,
        setLoading,
      });
    };

    initializeData();
  }, [selectedDate, getTeamAbbreviation, mlbTeams.length, selectedTeams]);

  useEffect(() => {
    if (!Array.isArray(selectedTeams)) return;

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

    const filtered = todayGames.flatMap((date) =>
      date.games.filter(
        (game) =>
          selectedTeams.includes(game.teams.away.team.id) ||
          selectedTeams.includes(game.teams.home.team.id)
      )
    );

    const sorted = filtered.sort((a, b) => getEffectiveDate(a) - getEffectiveDate(b));
    setVisibleGames(sorted);
  }, [selectedTeams, todayGames, selectedDate]);

  useEffect(() => {
    if (!todayGames.length) return;

    const fetchLiveData = async () => {
      try {
        const liveData = await Promise.all(
          todayGames.flatMap((date) =>
            date.games.map(async (game) => {
              const res = await fetch(
                `https://statsapi.mlb.com/api/v1.1/game/${game.gamePk}/feed/live`
              );
              const data = await res.json();
              return { gamePk: game.gamePk, liveData: data };
            })
          )
        );

        const map = {};
        liveData.forEach((g) => {
          map[g.gamePk] = g.liveData;
        });

        setLiveGameData(map);
      } catch (error) {
        console.warn('Live update failed', error);
      }
    };

    const id = setInterval(fetchLiveData, 10000);
    fetchLiveData();

    return () => clearInterval(id);
  }, [todayGames]);

  useEffect(() => {
    Cookies.set('userPicks', JSON.stringify(userPicks), { expires: 365 });
  }, [userPicks]);

  const formatTime = (dateTime) => {
    return new Date(dateTime).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getTeamRecord = (teamId) => teamRecords[teamId] || '0-0';

  return (
    <div className={`mlb-data-container ${loading ? 'loading-background' : ''}`}>
      {loading || selectedTeams === null ? (
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