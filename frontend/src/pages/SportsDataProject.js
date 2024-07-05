import React, { useEffect, useState } from 'react';

function SportsDataProject() {
  const [todayGames, setTodayGames] = useState([]);
  const [tomorrowGames, setTomorrowGames] = useState([]);

  useEffect(() => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const formatDate = (date) => date.toISOString().split('T')[0];
    const todayFormatted = formatDate(today);
    const tomorrowFormatted = formatDate(tomorrow);

    const fetchData = async () => {
      const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&hydrate=probablePitcher&startDate=${todayFormatted}&endDate=${tomorrowFormatted}`;
      const response = await fetch(url);
      const data = await response.json();
      const games = data.dates;

      console.log('Fetched games:', games);
      console.log('Formatted Today:', todayFormatted);
      console.log('Formatted Tomorrow:', tomorrowFormatted);

      const filteredTodayGames = games.filter(game => game.date === todayFormatted);
      const filteredTomorrowGames = games.filter(game => game.date === tomorrowFormatted);

      console.log("Filtered Today's Games:", filteredTodayGames);
      console.log("Filtered Tomorrow's Games:", filteredTomorrowGames);

      setTodayGames(filteredTodayGames);
      setTomorrowGames(filteredTomorrowGames);
    };

    fetchData();
  }, []); // Empty dependency array means this effect runs once when the component mounts

  return (
    <div className="SportsDataProject">
      <p className="intro-p">
        This is where my current project is being built. I have a
        lot of friends interested in sports data and they've mentioned to me how difficult it is to
        find a webpage that has all the statistics they want to see in one place. So I figured I'd try to
        tackle the project so that I can work on my backend skills via connecting to a public API,
        storing that information in a database, and manipulating it.
      </p>

      <div className="pitchingLineups">
        <div className="lineup">
          <h2>Today's Pitching Lineup</h2>
          {todayGames.length === 0 && <p>No games scheduled for today.</p>}
          {todayGames.map(date => (
            <div key={date.date}>
              {date.games.map(game => (
                <div key={game.gamePk}>
                  <p>{game.teams.away.team.name} at {game.teams.home.team.name}</p>
                  <p>Probable Pitcher: {game.teams.away.probablePitcher?.fullName} vs {game.teams.home.probablePitcher?.fullName}</p>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="lineup">
          <h2>Tomorrow's Pitching Lineup</h2>
          {tomorrowGames.length === 0 && <p>No games scheduled for tomorrow.</p>}
          {tomorrowGames.map(date => (
            <div key={date.date}>
              {date.games.map(game => (
                <div key={game.gamePk}>
                  <p>{game.teams.away.team.name} at {game.teams.home.team.name}</p>
                  <p>Probable Pitcher: {game.teams.away.probablePitcher?.fullName} vs {game.teams.home.probablePitcher?.fullName}</p>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default SportsDataProject;
