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
  const isFinished = ['F', 'O'].includes(statusCode);

  const now = new Date();
  const gameStartTime = new Date(scheduledDate);
  const isPostponed = detailedState === 'Postponed: Rain';
  const hasGameStarted = !isPostponed && now >= gameStartTime;

  const containerStyle = {
    position: 'relative',
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

  const getTeamBackgroundColor = (teamId) => {
    if (!statusCode || !isFinished) return 'rgba(85, 85, 85, 1)';

    const homeTeam = liveData?.liveData?.boxscore?.teams?.home;
    const awayTeam = liveData?.liveData?.boxscore?.teams?.away;
    const homeScore = liveData?.liveData?.linescore?.teams?.home?.runs;
    const awayScore = liveData?.liveData?.linescore?.teams?.away?.runs;

    if (!homeTeam || !awayTeam) return 'rgba(50, 50, 50, 0.9)';

    if (homeTeam.team.id === teamId) {
      return homeScore > awayScore
        ? 'rgba(0, 155, 0, 0.3)' // green
        : 'rgba(255, 0, 0, 0.3)'; // red
    }
    if (awayTeam.team.id === teamId) {
      return awayScore > homeScore
        ? 'rgba(0, 155, 0, 0.3)' // green
        : 'rgba(255, 0, 0, 0.3)'; // red
    }

    return 'rgba(50, 50, 50, 0.9)';
  };

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
                  style={imageStyle(getTeamBackgroundColor(game.teams.away.team.id))}
                />
                {isFinished && (
                  <span style={triangleStyle(getTeamBackgroundColor(game.teams.away.team.id))} />
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
                  style={imageStyle(getTeamBackgroundColor(game.teams.home.team.id))}
                />
                {isFinished && (
                  <span style={triangleStyle(getTeamBackgroundColor(game.teams.home.team.id))} />
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
