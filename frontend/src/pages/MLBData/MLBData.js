import React, { useEffect, useRef, useState } from 'react';
import './MLBData.scss';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { format, subDays } from 'date-fns';
import Scoreboard from '../../components/MLBData/Scoreboard';
import Cookies from 'js-cookie';

const CustomInput = React.forwardRef(({ value, onClick, isCalendarOpen, setIsCalendarOpen, setIsTeamsMenuOpen }, ref) => {
  return (
    <button className="custom-datepicker-input" onClick={() => {
      onClick();
      setIsCalendarOpen(!isCalendarOpen);
      setIsTeamsMenuOpen(false);
    }} ref={ref}>
      {value} <span className={`arrow ${isCalendarOpen ? 'open' : 'closed'}`}>▼</span>
    </button>
  );
});

const TeamsButton = ({ onClick, isOpen, setIsCalendarOpen }) => {
  return (
    <button className="teams-button custom-datepicker-input" onClick={() => {
      onClick();
      setIsCalendarOpen(false);
    }}>
      TEAMS <span className={`arrow ${isOpen ? 'open' : 'closed'}`}>▼</span>
    </button>
  );
};

const TeamsMenu = ({ teams, selectedTeams, onTeamChange, onSelectAll, onDeselectAll }) => {
  return (
    <div className="teams-menu">
      <div className="menu-buttons">
        <button className="select-button" onClick={onSelectAll}>ALL</button>
        <button className="select-button" onClick={onDeselectAll}>NONE</button>
      </div>
      <ul>
        {teams.map((team) => (
          <li key={team.id}>
            <label>
              <input
                type="checkbox"
                checked={selectedTeams.includes(team.id)}
                onChange={() => onTeamChange(team.id)}
              />
              {team.abbreviation} {team.name}
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
};

const LastFiveGames = ({ games, teamId }) => {
  return (
    <div className="last-five">
      {games.map((game, index) => {
        const awayScore = game.teams.away.score;
        const homeScore = game.teams.home.score;
        const isWinner = (game.teams.away.team.id === teamId && awayScore > homeScore) || (game.teams.home.team.id === teamId && homeScore > awayScore);
        const backgroundColor = isWinner ? 'rgba(0, 255, 0, 0.1)' : 'rgba(255, 0, 0, 0.1)';

        return (
          <div key={index} className="last-five-column">
            <div className="last-five-row date">{format(new Date(game.gameDate), 'M/d')}</div>
            <div className="team-and-score-group" style={{ backgroundColor }}>
              <div className="last-five-row">
                <div className="team-cell">{game.teams.away.team.abbreviation}</div>
                <div className="score-cell">{game.teams.away.score}</div>
              </div>
              <div className="last-five-row">
                <div className="team-cell">{game.teams.home.team.abbreviation}</div>
                <div className="score-cell">{game.teams.home.score}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
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
    const formatDate = (date) => format(date, 'yyyy-MM-dd');
    const todayFormatted = formatDate(selectedDate);
    const thirtyDaysAgo = formatDate(subDays(new Date(), 30));
    const yesterday = formatDate(subDays(new Date(), 1));

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
          name: team.teamName === 'D-backs' ? 'Diamondbacks' : team.teamName,  // Correcting the name
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

        // Load selected teams from cookies
        const savedSelectedTeams = Cookies.get('selectedTeams');
        if (savedSelectedTeams) {
          setSelectedTeams(JSON.parse(savedSelectedTeams));
        } else {
          setSelectedTeams(teams.map(team => team.id)); // Select all teams by default
        }
      } catch (error) {
        console.error('Error fetching initial data:', error);
      }
    };

    const fetchGameData = async () => {
      try {
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

        const fetchLastTenGames = async (teamId) => {
          const response = await fetch(`https://statsapi.mlb.com/api/v1/schedule?hydrate=team,lineups&sportId=1&startDate=${thirtyDaysAgo}&endDate=${yesterday}&teamId=${teamId}`);
          const data = await response.json();
          const games = data.dates?.flatMap(date => date.games) || [];
          return games.filter(game => game.teams.away.score !== undefined && game.teams.home.score !== undefined).slice(-10);
        };

        const games = await Promise.all((data.dates || []).map(async (gameDay) => {
          return {
            ...gameDay,
            games: await Promise.all(gameDay.games.map(async (game) => {
              const liveGameUrl = `https://statsapi.mlb.com/api/v1.1/game/${game.gamePk}/feed/live`;
              const gameData = await fetch(liveGameUrl).then(res => res.json());

              const awayPitcherStats = await fetchPitcherData(game.teams.away.probablePitcher?.id);
              const homePitcherStats = await fetchPitcherData(game.teams.home.probablePitcher?.id);

              const awayLastFiveGames = (await fetchLastTenGames(game.teams.away.team.id)).slice(-5);
              const homeLastFiveGames = (await fetchLastTenGames(game.teams.home.team.id)).slice(-5);

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
      await fetchInitialData();
      await fetchGameData();
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

  const getTeamScore = (team) => {
    return team.score !== undefined ? team.score : 0;
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
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: -1,
          overflowY: 'hidden',
          transform: 'scale(1.0)',
          backgroundImage: `url(${process.env.PUBLIC_URL + '/bg4.jpg'})`,
          backgroundPosition: 'center',
          backgroundSize: 'cover',
          backgroundRepeat: 'no-repeat',
        }}
      />
      <div className="mlbDataNavbar">
        <h2>MLB DATA PROJECT</h2>
        <div className="controls">
          <TeamsButton onClick={() => setIsTeamsMenuOpen(!isTeamsMenuOpen)} isOpen={isTeamsMenuOpen} setIsCalendarOpen={setIsCalendarOpen} />
          {isTeamsMenuOpen && (
            <div ref={teamsMenuRef}>
              <TeamsMenu
                teams={mlbTeams}
                selectedTeams={selectedTeams}
                onTeamChange={handleTeamChange}
                onSelectAll={handleSelectAll}
                onDeselectAll={handleDeselectAll}
              />
            </div>
          )}
          <div className="custom-datepicker-input">
            <DatePicker
                selected={selectedDate}
                onChange={(date) => {
                setSelectedDate(date);
                setLoading(true);
                setIsCalendarOpen(false);
                }}
                dateFormat="M/dd/yyyy"
                customInput={<CustomInput isCalendarOpen={isCalendarOpen} setIsCalendarOpen={setIsCalendarOpen} setIsTeamsMenuOpen={setIsTeamsMenuOpen} />}
                onCalendarOpen={() => setIsCalendarOpen(true)}
                onCalendarClose={() => setIsCalendarOpen(false)}
                preventOpenOnFocus
            />
          </div>
        </div>
      </div>
      {loading ? (
        <div className="loading">
          <img src={`${process.env.PUBLIC_URL}/baseball.gif`} alt="Loading..." />
          <p>loading...</p>
        </div>
      ) : (
        <div className={`pitchingLineups fade-in`}>
          <div className="lineups-container">
            {visibleGames.length === 0 ? (
              <p className="noGames">No games scheduled for this date.</p>
            ) : (
              visibleGames.map((game) => (
                <div className={`game-container ${selectedTeams.includes(game.teams.away.team.id) || selectedTeams.includes(game.teams.home.team.id) ? 'fade-in' : 'fade-out'}`} key={game.gamePk}>
                  <p className="gameTime">{game.gameDate ? formatTime(game.gameDate) : 'Time not available'}</p>
                  <div className="lineupGroup">
                    <div className="column1">
                      <div className="row1">
                        <img src={getTeamLogo(game.teams.away.team.name)} alt={`${game.teams.away.team.name} logo`} />
                      </div>
                      <div className="row2">
                        <img src={getTeamLogo(game.teams.home.team.name)} alt={`${game.teams.home.team.name} logo`} />
                      </div>
                    </div>
                    <div className="column2">
                      <div className="pitcher-info-top">
                        <span style={{ fontWeight: 'bold' }}>
                          {game.teams.away.team.name} ({getTeamRecord(game.teams.away.team.id)})
                        </span>
                        <div className="pitcher-details">
                          {game.teams.away.probablePitcher?.fullName === '?' ? 'P: TBD' : (
                            <>
                              P: {game.teams.away.probablePitcher?.fullName} <br />
                              ERA: {game.teams.away.probablePitcher?.era}, Games: {game.teams.away.probablePitcher?.gamesPlayed}
                            </>
                          )}
                        </div>
                      </div>
                      <p className="vs">@</p>
                      <div className="pitcher-info-bottom">
                        <span style={{ fontWeight: 'bold' }}>
                          {game.teams.home.team.name} ({getTeamRecord(game.teams.home.team.id)})
                        </span>
                        <div className="pitcher-details">
                          {game.teams.home.probablePitcher?.fullName === '?' ? 'P: TBD' : (
                            <>
                              P: {game.teams.home.probablePitcher?.fullName} <br />
                              ERA: {game.teams.home.probablePitcher?.era}, Games: {game.teams.home.probablePitcher?.gamesPlayed}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="column3"></div>
                  </div>
                  <div className="game-data">
                    <Scoreboard game={game} getTeamAbbreviation={getTeamAbbreviation} getTeamScore={getTeamScore} />
                    <div className="last-five game-data-container">
                      <p className="game-data-title">LAST 5</p>
                      <div className="last-five-wrapper">
                        <LastFiveGames games={game.teams.away.lastFiveGames} teamId={game.teams.away.team.id} />
                        <LastFiveGames games={game.teams.home.lastFiveGames} teamId={game.teams.home.team.id} />
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default MLBData;
