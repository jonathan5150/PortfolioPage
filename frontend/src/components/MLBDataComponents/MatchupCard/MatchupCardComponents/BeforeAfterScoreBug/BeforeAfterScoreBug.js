import React from 'react';
import Scoreboard from '../Scoreboard';

const BeforeAfterScoreBug = ({
  game,
  gamePk,
  handleStarClick,
  getTeamLogo,
  gameBackgroundColors,
  starredTeams,
  getTeamAbbreviation,
  getTeamRecord,
  liveData,
}) => {
  const trueLiveData = liveData?.liveData ?? liveData;

  const awayTeam = game.teams.away.team;
  const homeTeam = game.teams.home.team;
  const awayScore = trueLiveData?.linescore?.teams?.away?.runs ?? '-';
  const homeScore = trueLiveData?.linescore?.teams?.home?.runs ?? '-';

  const gameState = game.status?.abstractGameState; // 'Preview', 'Live', 'Final', etc.
  const gameFinished = gameState === 'Final';
  const gameNotStarted = gameState === 'Preview';

  const getStyles = (teamSide) => {
    if (typeof awayScore !== 'number' || typeof homeScore !== 'number') {
      return { borderColor: '#555555', backgroundColor: 'rgba(70, 70, 70, 0.8)' };
    }

    const won =
      (teamSide === 'away' && awayScore > homeScore) ||
      (teamSide === 'home' && homeScore > awayScore);

    const lost =
      (teamSide === 'away' && awayScore < homeScore) ||
      (teamSide === 'home' && homeScore < awayScore);

    if (won) {
      return {
        borderColor: 'rgba(0, 128, 0, 0.6)',
        backgroundColor: 'rgba(0, 128, 0, 0.1)',
      };
    }

    if (lost) {
      return {
        borderColor: '#555555',
        backgroundColor: 'rgba(70, 70, 70, 0.8)'
      };
    }

    return {
      borderColor: '#555555',
      backgroundColor: 'rgba(70, 70, 70, 0.8)',
    };
  };

  const renderPitcherInfo = (team, pitcher) => (
    <div className="pitcher-details">
      {pitcher?.fullName ? (
        <>
          <div>
            <span style={{ fontWeight: 'bold' }}></span> {pitcher.fullName} ({pitcher.pitchHand})
          </div>
          <div>
            <span style={{ fontWeight: 'bold' }}>ERA:</span> {pitcher.era}
          </div>
        </>
      ) : (
        <span><b>P:</b> N/A</span>
      )}
    </div>
  );

  const renderTeamCell = (team, score, side) => {
    const abbr = getTeamAbbreviation(team.id);
    const record = getTeamRecord(team.id);
    const { borderColor, backgroundColor } = getStyles(side);

    return (
      <div
        className="team-cell"
        style={{
          display: 'flex',
          cursor: 'pointer',
          overflow: 'hidden',      // ✅ This is what clips the image
          width: '100%',
          height: '50px',          // ✅ Matches .team-info-container
          boxSizing: 'border-box',
        }}
        onClick={() => handleStarClick(gamePk, team.id)}
      >
        <div
          className="team-info-container"
          style={{
            width: '100%',
            height: '50px',
            minHeight: '50px',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: gameNotStarted ? 'space-evenly' : 'space-between',
            border: `2px solid ${borderColor}`,
            backgroundColor,
            borderRadius: side === 'away' ? '5px 0 0 5px' : '0 5px 5px 0',
            padding: '5px 10px',
            opacity: 0.85,
            flexDirection: side === 'home' ? 'row-reverse' : 'row',
            boxSizing: 'border-box', // Ensure padding doesn't overflow
            maxWidth: '100%',         // Enforce grid width limits
          }}
        >
          {/* Logo */}
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: gameNotStarted ? 'center' : 'flex-start',
              flex: gameNotStarted ? 1 : 'initial',
            }}
          >
            <div
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <img
                src={getTeamLogo(team.name)}
                alt={`${team.name} logo`}
                style={{
                  height: gameNotStarted ? '37px' : '30px',
                  width: gameNotStarted ? '37px' : '30px',
                  objectFit: 'cover',
                  userSelect: 'none',
                  WebkitUserDrag: 'none',
                  outline: 'none',
                  WebkitTapHighlightColor: 'transparent',
                  display: 'block',
                  position: 'relative', // Ensure it's positioned within team-cell
                }}
              />
            </div>
            {starredTeams[gamePk] === team.id && (
              <div className="star-icon" style={{ position: 'absolute', top: '0', right: '-8px' }}>⭐</div>
            )}
          </div>

          {/* Abbreviation and Record */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '40px', marginLeft: '20px', marginRight: '20px' }}>
            <div
              className="abbreviation"
              style={{
                height: '20px',
                fontWeight: 'bold',
                fontSize: '18px',
                color: '#fff',
                textAlign: 'center',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {abbr}
            </div>
            <div
              style={{
                fontSize: '11px',
                color: '#ccc',
                lineHeight: '12px',
                width: '60px',
                textAlign: 'center',
                alignItems: 'center',
              }}
            >
              {record}
            </div>
          </div>

          {/* Score */}
          {!gameNotStarted && (
            <div
              style={{
                fontWeight: 'bold',
                fontSize: '25px',
                color: '#fff',
                width: '30px',
                textAlign: 'center',
              }}
            >
              {score}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      className="score-grid"
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '2px',
        paddingRight: '10px',
        paddingLeft: '10px',
        paddingTop: '10px',
      }}
    >
      {/* Away Team Top Left */}
      {renderTeamCell(awayTeam, awayScore, 'away')}

      {/* Home Team Top Right */}
      {renderTeamCell(homeTeam, homeScore, 'home')}

      {/* Hide Pitchers if game is finished */}
      {!gameFinished && (
        <>
          <div
            style={{
              border: '2px solid #555555',
              backgroundColor: 'rgba(70, 70, 70, 0.8)',
              opacity: 0.85,
              borderRadius: '5px 0 0 5px',
              padding: '2px',
            }}
          >
            {renderPitcherInfo(game.teams.home.team, game.teams.home.probablePitcher)}
          </div>

          <div
            style={{
              border: '2px solid #555555',
              backgroundColor: 'rgba(70, 70, 70, 0.8)',
              opacity: 0.85,
              borderRadius: '0 5px 5px 0',
              padding: '2px',
            }}
          >
            {renderPitcherInfo(game.teams.away.team, game.teams.away.probablePitcher)}
          </div>
        </>
      )}

      {/* Show scoreboard only if game has started and not finished */}
      {!gameNotStarted && !gameFinished && (
        <div style={{ gridColumn: '1 / span 2' }}>
          <Scoreboard
            game={game}
            getTeamAbbreviation={getTeamAbbreviation}
            liveData={trueLiveData}
          />
        </div>
      )}
    </div>
  );
};

export default BeforeAfterScoreBug;
