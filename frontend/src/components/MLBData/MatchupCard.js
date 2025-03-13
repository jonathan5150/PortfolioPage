import React, { useState, useEffect } from 'react';
import Scoreboard from './Scoreboard';
import LastTwentyGames from './LastTwentyGames';
import MLBDataNavbar from './MLBDataNavbar';

const MatchupCard = ({
  loading,
  visibleGames,
  selectedTeams,
  getTeamLogo,
  getTeamRecord,
  formatTime,
  getTeamAbbreviation,
  liveGameData,
  selectedDate,
  setSelectedDate,
  isCalendarOpen,
  setIsCalendarOpen,
  isTeamsMenuOpen,
  setIsTeamsMenuOpen,
  mlbTeams,
  handleTeamChange,
  handleSelectAll,
  handleDeselectAll,
  teamsMenuRef,
  todayGames,
  gameBackgroundColors // Receive pre-calculated background colors
}) => {
  const [delayOver, setDelayOver] = useState(false);
  const [fadeIn, setFadeIn] = useState(false);
  const [selectedData, setSelectedData] = useState('team-history'); // State to store selected data type

  // Create a scroll position state for each game
  const [scrollPositions, setScrollPositions] = useState({});

  useEffect(() => {
    let timer;
    if (!loading) {
      timer = setTimeout(() => {
        setDelayOver(true);
        setFadeIn(true);
      }, 2000);
    } else {
      setDelayOver(false);
      setFadeIn(false);
    }
    return () => clearTimeout(timer);
  }, [loading]);

  const handleDataSelect = (dataType) => {
    setSelectedData(dataType); // Update the selected data type
  };

  // Handle scroll event to synchronize scroll positions for LastTwentyGames within each game-container
  const handleScroll = (gamePk, scrollLeft) => {
    setScrollPositions((prevPositions) => ({
      ...prevPositions,
      [gamePk]: scrollLeft,
    }));
  };

  return (
    <div className={`matchup-card fade-in`}>
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
      <div className="matchup-container">
        {loading ? (
          <div className="loading">
            <img src={`${process.env.PUBLIC_URL}/baseball.gif`} alt="Loading..." />
            <p>loading...</p>
          </div>
        ) : delayOver && visibleGames.length === 0 ? (
          <p
            className="noGames"
            style={{
              opacity: fadeIn ? 1 : 0,
              transition: 'opacity 0.5s ease-in',
            }}
          >
            No games scheduled for this date.
          </p>
        ) : (
          <>
            {visibleGames.map((game) => (
              <div
                className={`game-container ${
                  selectedTeams.includes(game.teams.away.team.id) ||
                  selectedTeams.includes(game.teams.home.team.id)
                    ? 'fade-in'
                    : 'fade-out'
                }`}
                key={game.gamePk}
              >
                <div className="game-time-container">
                  <p className="game-time">
                    {game.gameDate
                      ? formatTime(game.gameDate)
                      : 'Time not available'}
                  </p>
                </div>
                <div className="matchup-group">
                  <div className="column1">
                    <div className="row1">
                      <img
                        src={getTeamLogo(game.teams.away.team.name)}
                        alt={`${game.teams.away.team.name} logo`}
                        style={{
                          border: `2px solid ${gameBackgroundColors[game.gamePk]?.away}`,
                        }}
                      />
                    </div>
                    <div className="row2">
                      <img
                        src={getTeamLogo(game.teams.home.team.name)}
                        alt={`${game.teams.home.team.name} logo`}
                        style={{
                          border: `2px solid ${gameBackgroundColors[game.gamePk]?.home}`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="column2">
                    <div className="pitcher-info-top">
                      <span style={{ fontWeight: 'bold' }}>
                        {game.teams.away.team.name} ({getTeamRecord(game.teams.away.team.id)})
                      </span>
                      <div className="pitcher-details">
                        {game.teams.away.probablePitcher?.fullName ? (
                          <>
                            <b>P:</b> {game.teams.away.probablePitcher.fullName} ({game.teams.away.probablePitcher.pitchHand}) /
                            <b> ERA:</b> {game.teams.away.probablePitcher.era} <br />
                            <b>G:</b> {game.teams.away.probablePitcher.gamesPlayed} /
                            <b> IP:</b> {game.teams.away.probablePitcher.inningsPitched} /
                            <b> AVG IP: </b>
                            {game.teams.away.probablePitcher.gamesPlayed > 0
                              ? (game.teams.away.probablePitcher.inningsPitched / game.teams.away.probablePitcher.gamesPlayed).toFixed(1)
                              : 'N/A'}
                          </>
                        ) : (
                          <span><b>P:</b> N/A</span>
                        )}
                      </div>
                    </div>

                    <p className="vs">@</p>

                    <div className="pitcher-info-bottom">
                      <span style={{ fontWeight: 'bold' }}>
                        {game.teams.home.team.name} ({getTeamRecord(game.teams.home.team.id)})
                      </span>
                      <div className="pitcher-details">
                        {game.teams.home.probablePitcher?.fullName ? (
                          <>
                            <b>P:</b> {game.teams.home.probablePitcher.fullName} ({game.teams.home.probablePitcher.pitchHand}) /
                            <b> ERA:</b> {game.teams.home.probablePitcher.era} <br />
                            <b>G:</b> {game.teams.home.probablePitcher.gamesPlayed} /
                            <b> IP:</b> {game.teams.home.probablePitcher.inningsPitched} /
                            <b> AVG IP: </b>
                            {game.teams.home.probablePitcher.gamesPlayed > 0
                              ? (game.teams.home.probablePitcher.inningsPitched / game.teams.home.probablePitcher.gamesPlayed).toFixed(1)
                              : 'N/A'}
                          </>
                        ) : (
                          <span><b>P:</b> N/A</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="column3"></div>
                </div>
                <div className="game-data">
                  <Scoreboard
                    game={game}
                    getTeamAbbreviation={getTeamAbbreviation}
                    liveData={liveGameData[game.gamePk]?.liveData} // Pass live data
                  />
                  <div className="game-data-container stat-toggle-container">
                    <select
                      value={selectedData}
                      onChange={(e) => handleDataSelect(e.target.value)}
                    >
                      <option value="team-history">TEAM W/L HISTORY</option>
                      <option value="team-stats">TEAM STATS</option>
                    </select>
                    {selectedData === 'team-history' && (
                      <div className="last-twenty-wrapper">
                        <LastTwentyGames
                          games={game.teams.away.lastTwentyGames}
                          teamId={game.teams.away.team.id}
                          onScroll={(scrollLeft) => handleScroll(game.gamePk, scrollLeft)} // Pass scroll handler for the current game
                          scrollPosition={scrollPositions[game.gamePk] || 0} // Get scroll position for this specific game
                        />
                        <LastTwentyGames
                          games={game.teams.home.lastTwentyGames}
                          teamId={game.teams.home.team.id}
                          onScroll={(scrollLeft) => handleScroll(game.gamePk, scrollLeft)} // Pass scroll handler for the current game
                          scrollPosition={scrollPositions[game.gamePk] || 0} // Get scroll position for this specific game
                        />
                      </div>
                    )}
                    {selectedData === 'team-stats' && (
                      <div className="team-stats">
                        <p>Batting Average:</p>
                        <p>Home Runs:</p>
                        <p>ERA:</p>
                        <p>OBP:</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
};

export default MatchupCard;
