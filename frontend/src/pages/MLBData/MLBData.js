import React, { useEffect, useState } from 'react';
import './MLBData.scss';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { format } from 'date-fns';

const CustomInput = React.forwardRef(({ value, onClick, isCalendarOpen, setIsCalendarOpen }, ref) => {
  return (
    <button className="custom-datepicker-input" onClick={() => {
      onClick();
      if (!isCalendarOpen) {
        setIsCalendarOpen(false);
      }
    }} ref={ref}>
      {value} <span className={`arrow ${isCalendarOpen ? 'open' : 'closed'}`}>▼</span>
    </button>
  );
});

function MLBData() {
  const [todayGames, setTodayGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [teamLogos, setTeamLogos] = useState({});
  const [mlbTeams, setMlbTeams] = useState([]);
  const [teamRecords, setTeamRecords] = useState({});
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

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
    const formatDate = (date) => {
      return format(date, 'yyyy-MM-dd');
    };
    const todayFormatted = formatDate(selectedDate);

    const fetchTeamLogos = async () => {
      const response = await fetch('https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/teams');
      const data = await response.json();
      const logos = {};

      data.sports[0].leagues[0].teams.forEach((team) => {
        logos[team.team.displayName] = team.team.logos[0].href;
      });

      setTeamLogos(logos);
    };

    const fetchMlbTeams = async () => {
      const response = await fetch('https://statsapi.mlb.com/api/v1/teams?sportId=1');
      const data = await response.json();
      setMlbTeams(data.teams);
    };

    const fetchTeamRecords = async () => {
      const response = await fetch('https://statsapi.mlb.com/api/v1/standings?leagueId=103,104');
      const data = await response.json();
      const records = {};

      data.records.forEach((league) => {
        league.teamRecords.forEach((teamRecord) => {
          const teamId = teamRecord.team.id;
          const wins = teamRecord.wins;
          const losses = teamRecord.losses;
          records[teamId] = `${wins}-${losses}`;
        });
      });

      setTeamRecords(records);
    };

    const fetchPitcherData = async (pitcherId) => {
      const url = `https://statsapi.mlb.com/api/v1/people/${pitcherId}?hydrate=stats(group=[pitching],type=[season])`;
      const response = await fetch(url);
      const data = await response.json();

      const stats = data.people[0]?.stats;
      if (stats && stats.length > 0) {
        const currentSeasonStats = stats[0]?.splits;
        if (currentSeasonStats && currentSeasonStats.length > 0) {
          const era = currentSeasonStats[0]?.stat?.era || 'N/A';
          const gamesPlayed = currentSeasonStats[0]?.stat?.gamesPlayed || 'N/A';
          return { era, gamesPlayed };
        }
      }
      return { era: 'N/A', gamesPlayed: 'N/A' };
    };

    const fetchData = async () => {
      const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&hydrate=probablePitcher&startDate=${todayFormatted}&endDate=${todayFormatted}`;
      const response = await fetch(url);
      const data = await response.json();
      const games = data.dates;

      const filteredTodayGames = games.filter((game) => game.date === todayFormatted);

      for (const gameDay of filteredTodayGames) {
        for (const game of gameDay.games) {
          const liveGameUrl = `https://statsapi.mlb.com/api/v1.1/game/${game.gamePk}/feed/live`;
          const gameResponse = await fetch(liveGameUrl);
          const gameData = await gameResponse.json();
          game.liveData = gameData.liveData;

          if (game.teams.away.probablePitcher) {
            const stats = await fetchPitcherData(game.teams.away.probablePitcher.id);
            game.teams.away.probablePitcher.era = stats.era;
            game.teams.away.probablePitcher.gamesPlayed = stats.gamesPlayed;
          } else {
            game.teams.away.probablePitcher = { fullName: '?', era: '?', gamesPlayed: '?' };
          }
          if (game.teams.home.probablePitcher) {
            const stats = await fetchPitcherData(game.teams.home.probablePitcher.id);
            game.teams.home.probablePitcher.era = stats.era;
            game.teams.home.probablePitcher.gamesPlayed = stats.gamesPlayed;
          } else {
            game.teams.home.probablePitcher = { fullName: '?', era: '?', gamesPlayed: '?' };
          }
        }
      }

      // Sort the games by time
      filteredTodayGames.forEach((gameDay) => {
        gameDay.games.sort((a, b) => new Date(a.gameDate) - new Date(b.gameDate));
      });

      setTodayGames(filteredTodayGames);
    };

    const initializeData = async () => {
      await Promise.all([fetchTeamLogos(), fetchMlbTeams(), fetchTeamRecords(), fetchData()]);
      setLoading(false);
    };

    initializeData();
  }, [selectedDate]);

  const formatTime = (dateTime) => {
    const date = new Date(dateTime);
    return date.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getTeamLogo = (mlbTeamName) => {
    for (const mlbTeam of mlbTeams) {
      if (mlbTeam.name === mlbTeamName) {
        return teamLogos[mlbTeam.name] || '';
      }
    }
    console.error(`Logo not found for team: ${mlbTeamName}`);
    return '';
  };

  const getTeamRecord = (mlbTeamName) => {
    for (const mlbTeam of mlbTeams) {
      if (mlbTeam.name === mlbTeamName) {
        return teamRecords[mlbTeam.id] || '0-0';
      }
    }
    return '0-0';
  };

  const getTeamAbbreviation = (teamId) => {
    const team = mlbTeams.find((team) => team.id === teamId);
    return team ? team.abbreviation : '';
  };

  const getTeamScore = (team) => {
    return team.score !== undefined ? team.score : 0;
  };

  return (
    <div className={`mlb-data-container ${loading ? 'loading-background' : ''}`}>
      <div
        className={`fade-in-background ${!loading ? 'loaded' : ''}`}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: -1,
          overflowY: 'hidden',
          transform: 'scale(1.0)',
        }}
      >
        <div
          style={{
            content: '""',
            display: 'block',
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: loading ? '#dbdbdb' : 'transparent',
            backgroundImage: loading ? 'none' : `url(${process.env.PUBLIC_URL + '/bg4.jpg'})`,
            backgroundPosition: 'center',
            backgroundSize: 'cover',
            backgroundRepeat: 'no-repeat',
          }}
        />
      </div>
      <div className="mlbDataNavbar">
        <h2>MLB DATA PROJECT</h2>
        <DatePicker
          selected={selectedDate}
          onChange={(date) => {
            setSelectedDate(date);
            setLoading(true);
            setIsCalendarOpen(false);
          }}
          dateFormat="M/dd/yyyy"
          customInput={<CustomInput isCalendarOpen={isCalendarOpen} setIsCalendarOpen={setIsCalendarOpen} />}
          onCalendarOpen={() => setIsCalendarOpen(true)}
          onCalendarClose={() => setIsCalendarOpen(false)}
          preventOpenOnFocus
        />
      </div>
      {loading ? (
        <div className="loading">
          <img src={`${process.env.PUBLIC_URL}/baseball.gif`} alt="Loading..." />
          <p>loading...</p>
        </div>
      ) : (
        <div className={`pitchingLineups fade-in`}>
          <div className="lineups-container">
            {todayGames.length === 0 ? (
              <p className="noGames">No games scheduled for this date.</p>
            ) : (
              todayGames.map((date) => (
                <div className="pitchingColumn" key={date.date}>
                  {date.games.map((game) => (
                    <div className="game-container" key={game.gamePk}>
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
                              {game.teams.away.team.name} ({getTeamRecord(game.teams.away.team.name)})
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
                              {game.teams.home.team.name} ({getTeamRecord(game.teams.home.team.name)})
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
                        <p className="game-data-title">SCOREBOARD</p>
                        <div className="scoreboard">
                          <div className="scoreboard-row">
                            <div className="scoreboard-cell team-abbr"></div>
                            {[...Array(9)].map((_, inning) => (
                              <div key={inning} className="scoreboard-cell inning">{inning + 1}</div>
                            ))}
                            {game.liveData.linescore?.innings.slice(9).map((_, extraInning) => (
                              <div key={extraInning + 9} className="scoreboard-cell inning">{extraInning + 10}</div>
                            ))}
                            <div className="scoreboard-cell runs">R</div>
                            <div className="scoreboard-cell hits">H</div>
                            <div className="scoreboard-cell errors">E</div>
                          </div>
                          <div className="scoreboard-row">
                            <div className="scoreboard-cell team-abbr">{getTeamAbbreviation(game.teams.away.team.id)}</div>
                            {[...Array(9)].map((_, inning) => {
                              const inningData = game.liveData.linescore?.innings[inning];
                              return (
                                <div key={inning} className="scoreboard-cell inning">
                                  {inningData ? (inningData.away?.runs !== undefined ? inningData.away.runs : '-') : '-'}
                                </div>
                              );
                            })}
                            {game.liveData.linescore?.innings.slice(9).map((inningData, extraInning) => (
                              <div key={extraInning + 9} className="scoreboard-cell inning">
                                {inningData.away?.runs !== undefined ? inningData.away.runs : '-'}
                              </div>
                            ))}
                            <div className="scoreboard-cell runs" style={{ fontWeight: 'bold' }}>{getTeamScore(game.teams.away)}</div>
                            <div className="scoreboard-cell hits">{game.liveData.boxscore.teams.away.teamStats?.batting?.hits || 0}</div>
                            <div className="scoreboard-cell errors">{game.liveData.boxscore.teams.away.teamStats?.fielding?.errors || 0}</div>
                          </div>
                          <div className="scoreboard-row">
                            <div className="scoreboard-cell team-abbr">{getTeamAbbreviation(game.teams.home.team.id)}</div>
                            {[...Array(9)].map((_, inning) => {
                              const inningData = game.liveData.linescore?.innings[inning];
                              return (
                                <div key={inning} className="scoreboard-cell inning">
                                  {inningData ? (inningData.home?.runs !== undefined ? inningData.home.runs : '-') : '-'}
                                </div>
                              );
                            })}
                            {game.liveData.linescore?.innings.slice(9).map((inningData, extraInning) => (
                              <div key={extraInning + 9} className="scoreboard-cell inning">
                                {inningData.home?.runs !== undefined ? inningData.home.runs : '-'}
                              </div>
                            ))}
                            <div className="scoreboard-cell runs" style={{ fontWeight: 'bold' }}>{getTeamScore(game.teams.home)}</div>
                            <div className="scoreboard-cell hits">{game.liveData.boxscore.teams.home.teamStats?.batting?.hits || 0}</div>
                            <div className="scoreboard-cell errors">{game.liveData.boxscore.teams.home.teamStats?.fielding?.errors || 0}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
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
