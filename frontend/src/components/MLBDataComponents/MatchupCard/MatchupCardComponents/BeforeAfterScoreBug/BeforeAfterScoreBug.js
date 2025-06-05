import React from 'react';
import PitcherMatchup from '../PitcherMatchup';
import Scoreboard from '../Scoreboard';

const BeforeAfterScoreBug = ({
  game,
  gamePk,
  scheduledDate,
  handleStarClick,
  getTeamLogo,
  gameBackgroundColors,
  starredTeams,
  getTeamRecord,
  getTeamAbbreviation,
  liveData,
}) => {
  const detailedState = liveData?.gameData?.status?.detailedState;
  const statusCode = liveData?.gameData?.status?.statusCode;
  const isFinished = ['F', 'O'].includes(statusCode); // Final or Game Over

  const now = new Date();
  const gameStartTime = new Date(scheduledDate);
  const isPostponed = detailedState === 'Postponed: Rain';
  const hasGameStarted = !isPostponed && now >= gameStartTime;

  const containerStyle = {
    position: 'relative'
  };

  const imageStyle = (color) => ({
    width: '100%',
    height: 'auto',
    border: `2px solid ${color}`,
    borderRadius: '4px',
    position: 'relative',
  });

  const triangleStyle = (color) => ({
    position: 'absolute',
    top: 8,
    right: 6,
    width: 0,
    height: 0,
    borderStyle: 'solid',
    borderWidth: '0 16px 16px 0',
    borderColor: `transparent ${color} transparent transparent`,
    borderRadius: '2px',
    zIndex: 2,
  });

  return (
    <>
      <div className="matchup-group">
        <div className="matchup-columns">
          <div className="column1">
            <div className="row1">
              <div
                className="team-logo-container"
                style={containerStyle}
                onClick={() => handleStarClick(gamePk, game.teams.away.team.id)}
              >
                <img
                  src={getTeamLogo(game.teams.away.team.name)}
                  alt={`${game.teams.away.team.name} logo`}
                  style={imageStyle(gameBackgroundColors[gamePk]?.away)}
                />
                {isFinished && (
                  <span style={triangleStyle(gameBackgroundColors[gamePk]?.away)} />
                )}
                {starredTeams[gamePk] === game.teams.away.team.id && (
                  <div className="star-icon">⭐</div>
                )}
              </div>
            </div>
            <div className="row2">
              <div
                className="team-logo-container"
                style={containerStyle}
                onClick={() => handleStarClick(gamePk, game.teams.home.team.id)}
              >
                <img
                  src={getTeamLogo(game.teams.home.team.name)}
                  alt={`${game.teams.home.team.name} logo`}
                  style={imageStyle(gameBackgroundColors[gamePk]?.home)}
                />
                {isFinished && (
                  <span style={triangleStyle(gameBackgroundColors[gamePk]?.home)} />
                )}
                {starredTeams[gamePk] === game.teams.home.team.id && (
                  <div className="star-icon">⭐</div>
                )}
              </div>
            </div>
          </div>
          <div className="column2">
            <PitcherMatchup game={game} getTeamRecord={getTeamRecord} />
          </div>
        </div>
      </div>

      {hasGameStarted && (
        <Scoreboard
          game={game}
          getTeamAbbreviation={getTeamAbbreviation}
          liveData={liveData?.liveData}
        />
      )}
    </>
  );
};

export default BeforeAfterScoreBug;
