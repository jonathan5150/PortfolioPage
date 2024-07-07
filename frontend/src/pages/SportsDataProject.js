import React, { useEffect, useState } from 'react';

function SportsDataProject() {
  const [todayGames, setTodayGames] = useState([]);
  const [tomorrowGames, setTomorrowGames] = useState([]);
  const [loading, setLoading] = useState(true); // Loading state

  useEffect(() => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const formatDate = (date) => date.toISOString().split('T')[0];
    const todayFormatted = formatDate(today);
    const tomorrowFormatted = formatDate(tomorrow);

    const fetchPitcherData = async (pitcherId) => {
      const url = `https://statsapi.mlb.com/api/v1/people/${pitcherId}?hydrate=stats(group=[pitching],type=[season])`;
      const response = await fetch(url);
      const data = await response.json();

      const stats = data.people[0]?.stats;
      if (stats && stats.length > 0) {
        const currentSeasonStats = stats[0]?.splits;
        if (currentSeasonStats && currentSeasonStats.length > 0) {
          return currentSeasonStats[0]?.stat?.era || "N/A";
        }
      }
      return "N/A";
    };

    const fetchData = async () => {
      const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&hydrate=probablePitcher&startDate=${todayFormatted}&endDate=${tomorrowFormatted}`;
      const response = await fetch(url);
      const data = await response.json();
      const games = data.dates;

      const filteredTodayGames = games.filter(game => game.date === todayFormatted);
      const filteredTomorrowGames = games.filter(game => game.date === tomorrowFormatted);

      // Fetch ERA for each probable pitcher
      for (const gameDay of filteredTodayGames) {
        for (const game of gameDay.games) {
          if (game.teams.away.probablePitcher) {
            game.teams.away.probablePitcher.era = await fetchPitcherData(game.teams.away.probablePitcher.id);
          }
          if (game.teams.home.probablePitcher) {
            game.teams.home.probablePitcher.era = await fetchPitcherData(game.teams.home.probablePitcher.id);
          }
        }
      }

      for (const gameDay of filteredTomorrowGames) {
        for (const game of gameDay.games) {
          if (game.teams.away.probablePitcher) {
            game.teams.away.probablePitcher.era = await fetchPitcherData(game.teams.away.probablePitcher.id);
          }
          if (game.teams.home.probablePitcher) {
            game.teams.home.probablePitcher.era = await fetchPitcherData(game.teams.home.probablePitcher.id);
          }
        }
      }

      setTodayGames(filteredTodayGames);
      setTomorrowGames(filteredTomorrowGames);

      // Ensure loading is displayed for at least 3 seconds
      const minLoadingTime = 3000;
      const loadingEndTime = Date.now() + minLoadingTime;

      const delay = Math.max(0, loadingEndTime - Date.now());
      setTimeout(() => {
        setLoading(false);
      }, delay);
    };

    fetchData();
  }, []); // Empty dependency array means this effect runs once when the component mounts

  const formatTime = (dateTime) => {
    const date = new Date(dateTime);
    return date.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

  };

  return (
    <div className="SportsDataProject">
      <p className="intro-p">
        This is where my current project is being built. I have a
        lot of friends interested in sports data and they've mentioned to me how difficult it is to
        find a webpage that has all the statistics they want to see in one place. So I figured I'd try to
        tackle the project so that I can work on my backend skills via connecting to a public API,
        storing that information in a database, and manipulating it.
      </p>

      {loading ? (
        <div className="loading">
          <img src="/baseball.gif" alt="Loading..." />
          <p>Loading...</p>
        </div>
      ) : (

        <div className="pitchingLineups">
          <div className="lineup">
            <h2>TODAY</h2>
            {todayGames.length === 0 && <p>No games scheduled for today.</p>}
            {todayGames.map(date => (
              <div key={date.date}>
                <h3>{new Date(date.date + 'T00:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h3>
                {date.games.map(game => (
                  <div key={game.gamePk}>
                    <p style={{ fontWeight: 'bold' }}>{game.gameDate ? formatTime(game.gameDate) : 'Time not available'}</p>
                    <p>{game.teams.away.team.name} at {game.teams.home.team.name}</p>
                    <p>Probable Pitcher: {game.teams.away.probablePitcher?.fullName} (ERA: {game.teams.away.probablePitcher?.era}) vs {game.teams.home.probablePitcher?.fullName} (ERA: {game.teams.home.probablePitcher?.era})</p>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="lineup">
            <h2>TOMORROW</h2>
            {tomorrowGames.length === 0 && <p>No games scheduled for tomorrow.</p>}
            {tomorrowGames.map(date => (
              <div key={date.date}>
                <h3>{new Date(date.date + 'T00:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h3>
                {date.games.map(game => (
                  <div key={game.gamePk}>
                    <p style={{ fontWeight: 'bold' }}>{game.gameDate ? formatTime(game.gameDate) : 'Time not available'}</p>
                    <p>{game.teams.away.team.name} at {game.teams.home.team.name}</p>
                    <p>Probable Pitcher: {game.teams.away.probablePitcher?.fullName} (ERA: {game.teams.away.probablePitcher?.era}) vs {game.teams.home.probablePitcher?.fullName} (ERA: {game.teams.home.probablePitcher?.era})</p>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default SportsDataProject;
