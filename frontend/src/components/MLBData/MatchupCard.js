import React, { useState, useEffect } from 'react';
import Scoreboard from './Scoreboard';
import LastTwentyGames from './LastTwentyGames';

const MatchupCard = ({ loading, visibleGames, selectedTeams, getTeamLogo, getTeamRecord, formatTime, getTeamAbbreviation, getTeamScore, liveGameData }) => {
  const [delayOver, setDelayOver] = useState(false);
  const [fadeIn, setFadeIn] = useState(false);

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

  return (
    <div className={`matchup-card fade-in`}>
      <div className="matchup-container">
        {loading ? (
          <div className="loading">
            <img src={`${process.env.PUBLIC_URL}/baseball.gif`} alt="Loading..." />
            <p>loading...</p>
          </div>
        ) : (
          delayOver && visibleGames.length === 0 ? (
            <p
              className="noGames"
              style={{
                opacity: fadeIn ? 1 : 0,
                transition: 'opacity 0.5s ease-in'
              }}
            >
              No games scheduled for this date.
            </p>
          ) : (
            visibleGames.map((game) => (
              <div className={`game-container ${selectedTeams.includes(game.teams.away.team.id) || selectedTeams.includes(game.teams.home.team.id) ? 'fade-in' : 'fade-out'}`} key={game.gamePk}>
                <div className="game-time-container">
                    <p className="game-time">{game.gameDate ? formatTime(game.gameDate) : 'Time not available'}</p>
                </div>
                <div className="matchup-group">
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
                  {/*<div className="game-data-container">
                    <p>turkey</p>
                  </div>*/}
                  <Scoreboard
                    game={game}
                    getTeamAbbreviation={getTeamAbbreviation}
                    getTeamScore={getTeamScore}
                    liveData={liveGameData[game.gamePk]} // Pass live data
                  />
                  <div className="game-data-container">
                    <p className="game-data-title">TEAM W/L HISTORY</p>
                    <div className="last-twenty-wrapper">
                      <LastTwentyGames games={game.teams.away.lastTwentyGames} teamId={game.teams.away.team.id} />
                      <LastTwentyGames games={game.teams.home.lastTwentyGames} teamId={game.teams.home.team.id} />
                    </div>
                  </div>
                </div>
              </div>
            ))
          )
        )}
      </div>
    </div>
  );
};

export default MatchupCard;
