import React from 'react';
import Scoreboard from './Scoreboard';
import LastFiveGames from './LastFiveGames';

const MatchupCard = ({ visibleGames, selectedTeams, getTeamLogo, getTeamRecord, formatTime, getTeamAbbreviation, getTeamScore }) => {
  return (
    <div className={`matchup-card fade-in`}>
      <div className="matchup-container">
        {visibleGames.length === 0 ? (
          <p className="noGames">No games scheduled for this date.</p>
        ) : (
          visibleGames.map((game) => (
            <div className={`game-container ${selectedTeams.includes(game.teams.away.team.id) || selectedTeams.includes(game.teams.home.team.id) ? 'fade-in' : 'fade-out'}`} key={game.gamePk}>
              <p className="gameTime">{game.gameDate ? formatTime(game.gameDate) : 'Time not available'}</p>
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
  );
};

export default MatchupCard;