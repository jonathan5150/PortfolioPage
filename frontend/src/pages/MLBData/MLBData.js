import React, { useEffect, useState } from 'react';
import './MLBData.scss';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function MLBData() {
  const [todayGames, setTodayGames] = useState([]);
  const [loading, setLoading] = useState(true); // Loading state
  const [teamLogos, setTeamLogos] = useState({});
  const [mlbTeams, setMlbTeams] = useState([]);
  const [teamRecords, setTeamRecords] = useState({});
  const [viewportHeight, setViewportHeight] = useState(window.innerHeight);

  useEffect(() => {
    const handleResize = () => {
      setViewportHeight(window.innerHeight);
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    const today = new Date();

    const formatDate = (date) => date.toISOString().split('T')[0];
    const todayFormatted = formatDate(today);

    const fetchTeamLogos = async () => {
      const response = await fetch('https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/teams');
      const data = await response.json();
      const logos = {};

      data.sports[0].leagues[0].teams.forEach(team => {
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
      const response = await fetch('https://statsapi.mlb.com/api/v1/standings?leagueId=103,104'); // Fetch records for both leagues
      const data = await response.json();
      const records = {};

      data.records.forEach(league => {
        league.teamRecords.forEach(teamRecord => {
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
          const era = currentSeasonStats[0]?.stat?.era || "N/A";
          const gamesPlayed = currentSeasonStats[0]?.stat?.gamesPlayed || "N/A";
          return { era, gamesPlayed };
        }
      }
      return { era: "N/A", gamesPlayed: "N/A" };
    };

    const fetchData = async () => {
      const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&hydrate=probablePitcher&startDate=${todayFormatted}&endDate=${todayFormatted}`;
      const response = await fetch(url);
      const data = await response.json();
      const games = data.dates;

      const filteredTodayGames = games.filter(game => game.date === todayFormatted);

      for (const gameDay of filteredTodayGames) {
        for (const game of gameDay.games) {
          if (game.teams.away.probablePitcher) {
            const stats = await fetchPitcherData(game.teams.away.probablePitcher.id);
            game.teams.away.probablePitcher.era = stats.era;
            game.teams.away.probablePitcher.gamesPlayed = stats.gamesPlayed;
          } else {
            game.teams.away.probablePitcher = { fullName: "?", era: "?", gamesPlayed: "?" };
          }
          if (game.teams.home.probablePitcher) {
            const stats = await fetchPitcherData(game.teams.home.probablePitcher.id);
            game.teams.home.probablePitcher.era = stats.era;
            game.teams.home.probablePitcher.gamesPlayed = stats.gamesPlayed;
          } else {
            game.teams.home.probablePitcher = { fullName: "?", era: "?", gamesPlayed: "?" };
          }
        }
      }

      setTodayGames(filteredTodayGames);
    };

    const initializeData = async () => {
      await Promise.all([fetchTeamLogos(), fetchMlbTeams(), fetchTeamRecords(), fetchData()]);
      await delay(4000); // Add a 4-second delay
      setLoading(false); // Set loading to false after data fetching and delay
    };

    initializeData();
  }, []); // Empty dependency array means this effect runs once when the component mounts

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

  return (
    <div className="mlb-data-container" style={{ height: viewportHeight }}>
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
      {loading ? (
        <div className="loading">
          <img src={`${process.env.PUBLIC_URL}/baseball.gif`} alt="Loading..." />
          <p>loading...</p>
        </div>
      ) : (
        <div className={`pitchingLineups fade-in`}>
          <div className="lineups-container">
            {todayGames.length === 0 ? (
              <p>No games scheduled for today.</p>
            ) : (
              todayGames.map(date => (
                <div className="pitchingColumn" key={date.date}>
                  <h2>MLB DATA PROJECT</h2>
                  <h3>{new Date(date.date + 'T00:00:00Z').toLocaleDateString('en-US', {
                    timeZone: 'UTC', weekday: 'short', year: 'numeric', month: 'long', day: 'numeric'
                  })}</h3>
                  {date.games.map(game => (
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
                              {game.teams.away.probablePitcher?.fullName === "?" ? 'TBD' : (
                                <>
                                  {game.teams.away.probablePitcher?.fullName} <br />
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
                              {game.teams.home.probablePitcher?.fullName === "?" ? 'TBD' : (
                                <>
                                  {game.teams.home.probablePitcher?.fullName} <br />
                                  ERA: {game.teams.home.probablePitcher?.era}, Games: {game.teams.home.probablePitcher?.gamesPlayed}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="column3"></div>
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
