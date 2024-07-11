import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

function SportsDataProject() {
  const [todayGames, setTodayGames] = useState([]);
  const [tomorrowGames, setTomorrowGames] = useState([]);
  const [loading, setLoading] = useState(true); // Loading state
  const [expanded, setExpanded] = useState(false); // State to manage expanded/collapsed state

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
          const era = currentSeasonStats[0]?.stat?.era || "N/A";
          const gamesPlayed = currentSeasonStats[0]?.stat?.gamesPlayed || "N/A";
          return { era, gamesPlayed };
        }
      }
      return { era: "N/A", gamesPlayed: "N/A" };
    };

    const fetchData = async () => {
      const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&hydrate=probablePitcher&startDate=${todayFormatted}&endDate=${tomorrowFormatted}`;
      const response = await fetch(url);
      const data = await response.json();
      const games = data.dates;

      const filteredTodayGames = games.filter(game => game.date === todayFormatted);
      const filteredTomorrowGames = games.filter(game => game.date === tomorrowFormatted);

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

      for (const gameDay of filteredTomorrowGames) {
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
      setTomorrowGames(filteredTomorrowGames);

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

  const toggleExpanded = () => {
    setExpanded(!expanded);
  };

  return (
    <div className="SportsDataProject">
      <p className="otherParagraph">
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
        <>
          <div className="MLBLink">
            <Link to="/mlb-data-project">
              <button className="mlbLinkButton">
                LINK TO MLB DATA PROJECT
              </button>
            </Link>
          </div>

          <div className="pitchingLineups">
            <h2 className="expand-button" onClick={toggleExpanded}>
              PROBABLE PITCHERS{' '}
              <span className="arrow-icon" style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                &#x25BC; {/* Down arrow */}
              </span>
            </h2>
            <div className={`lineups-container ${expanded ? 'fade-in' : ''}`}>
              {expanded && (
                <>
                  <div className="lineup">
                    {todayGames.length === 0 && <p>No games scheduled for today.</p>}
                    {todayGames.map(date => (
                      <div key={date.date}>
                        <h3>{new Date(date.date + 'T00:00:00Z').toLocaleDateString('en-US', {
                        timeZone: 'UTC', weekday: 'short', year: 'numeric', month: 'long', day:
                        'numeric' })}</h3>
                        {date.games.map(game => (
                          <div key={game.gamePk}>
                            <p style={{ fontWeight: 'bold' }}>{game.gameDate ? formatTime(game.gameDate) : 'Time not available'}</p>
                            <div className="lineupGroup">
                              <p>
                                <span style={{ fontWeight: 'bold' }}>{game.teams.away.team.name}</span>
                              </p>
                              <p>
                                {game.teams.away.probablePitcher?.fullName === "?"
                                  ? 'TBD'
                                  : (
                                    <>
                                      {game.teams.away.probablePitcher?.fullName} <br />
                                      (ERA: {game.teams.away.probablePitcher?.era}, Games: {game.teams.away.probablePitcher?.gamesPlayed})
                                    </>
                                  )}
                              </p>
                              <p className="vs">
                                  @
                              </p>
                              <p>
                                <span style={{ fontWeight: 'bold' }}>{game.teams.home.team.name}</span>
                              </p>
                              <p>
                                {game.teams.home.probablePitcher?.fullName === "?"
                                  ? 'TBD'
                                  : (
                                    <>
                                      {game.teams.home.probablePitcher?.fullName} <br />
                                      (ERA: {game.teams.home.probablePitcher?.era}, Games: {game.teams.home.probablePitcher?.gamesPlayed})
                                    </>
                                  )}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>

                  <div className="lineup">
                    {tomorrowGames.length === 0 && <p>No games scheduled for tomorrow.</p>}
                    {tomorrowGames.map(date => (
                      <div key={date.date}>
                        <h3>{new Date(date.date + 'T00:00:00Z').toLocaleDateString('en-US', {
                        timeZone: 'UTC', weekday: 'short', year: 'numeric', month: 'long', day:
                        'numeric' })}</h3>
                        {date.games.map(game => (
                          <div key={game.gamePk}>
                            <p style={{ fontWeight: 'bold' }}>{game.gameDate ? formatTime(game.gameDate) : 'Time not available'}</p>
                              <div className="lineupGroup">
                              <p>
                                <span style={{ fontWeight: 'bold' }}>{game.teams.away.team.name}</span>
                              </p>
                              <p>
                                {game.teams.away.probablePitcher?.fullName === "?"
                                  ? 'TBD'
                                  : (
                                    <>
                                      {game.teams.away.probablePitcher?.fullName} <br />
                                      (ERA: {game.teams.away.probablePitcher?.era}, Games: {game.teams.away.probablePitcher?.gamesPlayed})
                                    </>
                                  )}
                              </p>
                              <p className="vs">
                                  @
                              </p>
                              <p>
                                <span style={{ fontWeight: 'bold' }}>{game.teams.home.team.name}</span>
                              </p>
                              <p>
                                {game.teams.home.probablePitcher?.fullName === "?"
                                  ? 'TBD'
                                  : (
                                    <>
                                      {game.teams.home.probablePitcher?.fullName} <br />
                                      (ERA: {game.teams.home.probablePitcher?.era}, Games: {game.teams.home.probablePitcher?.gamesPlayed})
                                    </>
                                  )}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default SportsDataProject;
