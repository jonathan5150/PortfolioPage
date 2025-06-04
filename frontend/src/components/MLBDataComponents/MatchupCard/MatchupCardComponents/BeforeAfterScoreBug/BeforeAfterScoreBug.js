import React from 'react';
import PitcherMatchup from '../PitcherMatchup';
import Scoreboard from '../Scoreboard';

const BeforeAfterScoreBug = ({
  game,
  gamePk,
  scheduledDate, // 👈 Add this
  handleStarClick,
  getTeamLogo,
  gameBackgroundColors,
  starredTeams,
  getTeamRecord,
  getTeamAbbreviation,
  liveData,
}) => {
  const detailedState = liveData?.gameData?.status?.detailedState;

  const now = new Date();
  const gameStartTime = new Date(scheduledDate); // 👈 use explicit prop
  const isPostponed = detailedState === 'Postponed: Rain';
  const hasGameStarted = !isPostponed && now >= gameStartTime;


  return (
    <>
      <div className="matchup-group">
        <div className="matchup-columns">
          <div className="column1">
            <div className="row1">
              <div
                className="team-logo-container"
                onClick={() => handleStarClick(gamePk, game.teams.away.team.id)}
              >
                <img
                  src={getTeamLogo(game.teams.away.team.name)}
                  alt={`${game.teams.away.team.name} logo`}
                  style={{ border: `2px solid ${gameBackgroundColors[gamePk]?.away}` }}
                />
                {starredTeams[gamePk] === game.teams.away.team.id && (
                  <div className="star-icon">⭐</div>
                )}
              </div>
            </div>
            <div className="row2">
              <div
                className="team-logo-container"
                onClick={() => handleStarClick(gamePk, game.teams.home.team.id)}
              >
                <img
                  src={getTeamLogo(game.teams.home.team.name)}
                  alt={`${game.teams.home.team.name} logo`}
                  style={{ border: `2px solid ${gameBackgroundColors[gamePk]?.home}` }}
                />
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

      {/* Show scoreboard only if the game has started and is not postponed */}
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
