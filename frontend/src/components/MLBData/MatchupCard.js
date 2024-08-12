import React, { useState, useEffect } from 'react';
import Scoreboard from './Scoreboard';
import LastTwentyGames from './LastTwentyGames';
import MLBDataNavbar from './MLBDataNavbar';
import Cookies from 'js-cookie';

const MatchupCard = ({
  loading,
  visibleGames,
  selectedTeams,
  getTeamLogo,
  getTeamRecord,
  formatTime,
  getTeamAbbreviation,
  liveGameData,
  userPicks,
  setUserPicks,
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
  todayGames // Access todayGames passed from MLBData
}) => {
  const [delayOver, setDelayOver] = useState(false);
  const [fadeIn, setFadeIn] = useState(false);
  const [correctGuesses, setCorrectGuesses] = useState({ correct: 0, total: 0 });
  const [allGamesLoaded, setAllGamesLoaded] = useState(false);

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

  useEffect(() => {
    // Set a timer to check when all games are loaded
    let timer;
    if (visibleGames.length > 0) {
      timer = setTimeout(() => {
        setAllGamesLoaded(true);
      }, 2000); // Adjust this delay as needed
    } else {
      setAllGamesLoaded(false);
    }
    return () => clearTimeout(timer);
  }, [visibleGames]);

  const handlePick = (gameId, teamId) => {
    if (userPicks[gameId] === teamId && userPicks[gameId] !== '') {
      const updatedPicks = { ...userPicks, [gameId]: '' };
      setUserPicks(updatedPicks);
      Cookies.set('userPicks', JSON.stringify(updatedPicks), { expires: 7 });
    } else {
      const updatedPicks = { ...userPicks, [gameId]: teamId };
      setUserPicks(updatedPicks);
      Cookies.set('userPicks', JSON.stringify(updatedPicks), { expires: 7 });
    }
  };

  const getTeamBackgroundColor = (gamePk, teamId) => {
    const gameData = liveGameData[gamePk];
    const statusCode = gameData?.gameData?.status?.statusCode;

    if (!statusCode || statusCode !== 'F') return 'rgba(70, 70, 70, 0.8)'; // Ensure the game is finished

    const homeTeam = gameData.liveData.boxscore.teams.home;
    const awayTeam = gameData.liveData.boxscore.teams.away;

    const homeScore = gameData.liveData.linescore.teams.home.runs;
    const awayScore = gameData.liveData.linescore.teams.away.runs;

    if (homeTeam.team.id === teamId) {
      return homeScore > awayScore ? 'rgba(0, 255, 0, 0.1)' : 'rgba(255, 0, 0, 0.1)';
    }
    if (awayTeam.team.id === teamId) {
      return awayScore > homeScore ? 'rgba(0, 255, 0, 0.1)' : 'rgba(255, 0, 0, 0.1)';
    }
    return 'rgba(70, 70, 70, 0.8)';
  };

  useEffect(() => {
    // Calculate correct guesses based on game results and user picks
    const calculateCorrectGuesses = () => {
      let correct = 0;
      let total = 0;

      visibleGames.forEach((game) => {
        const gameData = liveGameData[game.gamePk];
        const statusCode = gameData?.gameData?.status?.statusCode;

        if (statusCode === 'F' && userPicks[game.gamePk]) {
          // Ensure the game is finished and the user has made a pick
          total++;
          const homeTeam = gameData.liveData.boxscore.teams.home;
          const awayTeam = gameData.liveData.boxscore.teams.away;
          const homeScore = gameData.liveData.linescore.teams.home.runs;
          const awayScore = gameData.liveData.linescore.teams.away.runs;

          const winningTeamId =
            homeScore > awayScore ? homeTeam.team.id : awayTeam.team.id;

          if (userPicks[game.gamePk] === winningTeamId) {
            correct++;
          }
        }
      });

      setCorrectGuesses({ correct, total });
    };

    calculateCorrectGuesses();
  }, [liveGameData, userPicks, visibleGames]);

  const calculateGuessPercentage = () => {
    if (correctGuesses.total === 0) return 'N/A';
    return (
      ((correctGuesses.correct / correctGuesses.total) * 100).toFixed(2) + '%'
    );
  };

  // Access totalGames from the first item in the todayGames array
  const totalGamesToday = todayGames.length > 0 ? todayGames[0].totalGames : 0;
  const totalGamesDisplayed = visibleGames.length;

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
                          backgroundColor: getTeamBackgroundColor(
                            game.gamePk,
                            game.teams.away.team.id
                          ),
                        }}
                      />
                    </div>
                    <div className="row2">
                      <img
                        src={getTeamLogo(game.teams.home.team.name)}
                        alt={`${game.teams.home.team.name} logo`}
                        style={{
                          backgroundColor: getTeamBackgroundColor(
                            game.gamePk,
                            game.teams.home.team.id
                          ),
                        }}
                      />
                    </div>
                  </div>
                  <div className="column2">
                    <div className="pitcher-info-top">
                      <span style={{ fontWeight: 'bold' }}>
                        {game.teams.away.team.name} (
                        {getTeamRecord(game.teams.away.team.id)})
                      </span>
                      <div className="pitcher-details">
                        {game.teams.away.probablePitcher?.fullName === '?' ? (
                          'P: TBD'
                        ) : (
                          <>
                            <b>P:</b> {game.teams.home.probablePitcher?.fullName},
                            <b> ERA:</b> {game.teams.home.probablePitcher?.era}  <br />
                            <b>G:</b> {game.teams.home.probablePitcher?.gamesPlayed},
                            <b> IP:</b> {game.teams.home.probablePitcher?.inningsPitched},
                            <b> AVG IP:</b> {
                              game.teams.home.probablePitcher?.gamesPlayed > 0
                              ? (game.teams.home.probablePitcher?.inningsPitched / game.teams.home.probablePitcher?.gamesPlayed).toFixed(1)
                              : 'N/A'
                            }
                          </>
                        )}
                      </div>
                    </div>
                    <p className="vs">@</p>
                    <div className="pitcher-info-bottom">
                      <span style={{ fontWeight: 'bold' }}>
                        {game.teams.home.team.name} (
                        {getTeamRecord(game.teams.home.team.id)})
                      </span>
                      <div className="pitcher-details">
                        {game.teams.away.probablePitcher?.fullName === '?' ? (
                          'P: TBD'
                        ) : (
                          <>
                            <b>P:</b> {game.teams.away.probablePitcher?.fullName},
                            <b> ERA:</b> {game.teams.away.probablePitcher?.era} <br />
                            <b>G:</b> {game.teams.away.probablePitcher?.gamesPlayed},
                            <b> IP:</b> {game.teams.away.probablePitcher?.inningsPitched},
                            <b> AVG IP:</b> {
                              game.teams.away.probablePitcher?.gamesPlayed > 0
                              ? (game.teams.away.probablePitcher?.inningsPitched / game.teams.away.probablePitcher?.gamesPlayed).toFixed(1)
                              : 'N/A'
                            }
                          </>
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
                  <div className="game-data-container">
                    <p className="game-data-title">TEAM W/L HISTORY</p>
                    <div className="last-twenty-wrapper">
                      <LastTwentyGames
                        games={game.teams.away.lastTwentyGames}
                        teamId={game.teams.away.team.id}
                      />
                      <LastTwentyGames
                        games={game.teams.home.lastTwentyGames}
                        teamId={game.teams.home.team.id}
                      />
                    </div>
                  </div>
                  <div className="user-pick game-data-container">
                    <p className="game-data-title">WHO DO YOU THINK WILL WIN?</p>
                    <div className="team-pick-container">
                      <div
                        className={`team-pick ${
                          userPicks[game.gamePk] === game.teams.away.team.id
                            ? 'selected'
                            : ''
                        }`}
                        onClick={() =>
                          handlePick(game.gamePk, game.teams.away.team.id)
                        }
                        style={{
                          backgroundColor:
                            userPicks[game.gamePk] === game.teams.away.team.id
                              ? 'rgba(0, 255, 0, 0.1)'
                              : userPicks[game.gamePk] &&
                                userPicks[game.gamePk] !==
                                  game.teams.away.team.id
                              ? 'rgba(255, 0, 0, 0.1)'
                              : 'rgba(128, 128, 128, 0.2)',
                        }}
                      >
                        <img
                          src={getTeamLogo(game.teams.away.team.name)}
                          alt={`${game.teams.away.team.name} logo`}
                        />
                      </div>
                      <div
                        className={`team-pick ${
                          userPicks[game.gamePk] === game.teams.home.team.id
                            ? 'selected'
                            : ''
                        }`}
                        onClick={() =>
                          handlePick(game.gamePk, game.teams.home.team.id)
                        }
                        style={{
                          backgroundColor:
                            userPicks[game.gamePk] === game.teams.home.team.id
                              ? 'rgba(0, 255, 0, 0.1)'
                              : userPicks[game.gamePk] &&
                                userPicks[game.gamePk] !==
                                  game.teams.home.team.id
                              ? 'rgba(255, 0, 0, 0.1)'
                              : 'rgba(128, 128, 128, 0.2)',
                        }}
                      >
                        <img
                          src={getTeamLogo(game.teams.home.team.name)}
                          alt={`${game.teams.home.team.name} logo`}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {allGamesLoaded && (
              <div className="matchup-container guess-results">
                <p>GAMES GUESSED CORRECTLY: {correctGuesses.correct} / {correctGuesses.total}</p>
                <p>CORRECT GUESS PERCENTAGE: {calculateGuessPercentage()}</p>
                <p>TOTAL GAMES TODAY: {totalGamesToday}</p>
                <p>TOTAL GAMES DISPLAYED: {totalGamesDisplayed}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default MatchupCard;
