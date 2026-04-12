import React, { useCallback, useEffect, useRef } from 'react';
import teamPrimaryColors from '../mlbUtils/teamPrimaryColors';

const BeforeScoreBug = ({
  game,
  gamePk,
  handleStarClick,
  getTeamLogo,
  gameBackgroundColors,
  selectedStarTeamId,
  getTeamAbbreviation,
  liveData,
  onToggleStats,
}) => {
  const trueLiveData = liveData?.liveData ?? liveData;

  const longPressTimerRef = useRef(null);
  const longPressTriggeredRef = useRef(false);

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const startLongPress = useCallback(
    (e, teamId) => {
      e.preventDefault();
      e.stopPropagation();

      clearLongPress();
      longPressTriggeredRef.current = false;

      longPressTimerRef.current = setTimeout(() => {
        handleStarClick?.(teamId);

        longPressTriggeredRef.current = true;
        longPressTimerRef.current = null;
      }, 1000);
    },
    [clearLongPress, handleStarClick]
  );

  const suppressClickAfterLongPress = useCallback((e) => {
    if (longPressTriggeredRef.current) {
      e.preventDefault();
      e.stopPropagation();
      longPressTriggeredRef.current = false;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearLongPress();
    };
  }, [clearLongPress]);

  const gameNotStarted =
    game.status.abstractGameState === 'Preview' ||
    game.status.abstractGameState === 'Scheduled';

  const awayTeam = game.teams.away.team;
  const homeTeam = game.teams.home.team;

  const awayScore = gameNotStarted
    ? '-'
    : trueLiveData?.linescore?.teams?.away?.runs ?? '-';

  const homeScore = gameNotStarted
    ? '-'
    : trueLiveData?.linescore?.teams?.home?.runs ?? '-';

  const formattedStartTime = new Date(game.gameDate).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });

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
        <span>
          <b>P:</b> N/A
        </span>
      )}
    </div>
  );

  const renderTeamCell = (team, score, side, record) => {
    const abbr = getTeamAbbreviation(team.id);
    const teamName = team.name;
    const gradientColor = teamPrimaryColors[teamName] || null;
    const isStarred = selectedStarTeamId === team.id;

    return (
      <div
        className="team-cell"
        onPointerDown={(e) => startLongPress(e, team.id)}
        onPointerUp={(e) => {
          e.preventDefault();
          e.stopPropagation();
          clearLongPress();
        }}
        onPointerLeave={clearLongPress}
        onPointerCancel={clearLongPress}
        onContextMenu={(e) => e.preventDefault()}
        style={{
          display: 'flex',
          cursor: 'default',
          position: 'relative',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          WebkitTapHighlightColor: 'transparent',
          WebkitTouchCallout: 'none',
          touchAction: 'manipulation',
          outline: 'none',
        }}
      >
        {gradientColor && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              right: 0,
              left: 0,
              background:
                side === 'home'
                  ? `linear-gradient(to right, ${gradientColor} 25%, transparent), ${gradientColor}`
                  : `linear-gradient(to right, ${gradientColor} 25%, transparent), ${gradientColor}`,
              backgroundBlendMode: 'screen',
              pointerEvents: 'none',
              zIndex: 1,
              borderRadius: side === 'away' ? '6px 0 0 0' : '0 6px 0 0',
            }}
          />
        )}

        <div
          className="team-info-container"
          style={{
            width: '100%',
            height: '50px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            border: isStarred ? '2px solid #c49410' : '2px solid rgb(85, 85, 85)',
            backgroundColor: 'rgba(70, 70, 70, 0.8)',
            borderRadius: side === 'away' ? '6px 0 0 0' : '0 6px 0 0',
            padding: '5px 10px',
            opacity: 0.85,
            position: 'relative',
            zIndex: 2,
            userSelect: 'none',
            WebkitUserSelect: 'none',
            WebkitTapHighlightColor: 'transparent',
            outline: 'none',
          }}
        >
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <img
              src={getTeamLogo(teamName)}
              alt={`${team.name} logo`}
              style={{
                width: '37px',
                height: '37px',
                objectFit: 'contain',
                userSelect: 'none',
                WebkitUserDrag: 'none',
                outline: 'none',
                WebkitTapHighlightColor: 'transparent',
              }}
            />
          </div>

          <div
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '40px' }}
          >
            <div
              className="abbreviation"
              style={{
                height: '30px',
                fontWeight: 'bold',
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
              {record || '0-0'}
            </div>
          </div>

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
        </div>
      </div>
    );
  };

  const awayRecord = game.teams.away.displayRecord || game.teams.away.pregameRecord || '0-0';
  const homeRecord = game.teams.home.displayRecord || game.teams.home.pregameRecord || '0-0';

  return (
    <div
      className="score-grid"
      onClick={onToggleStats}
      onClickCapture={suppressClickAfterLongPress}
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gridTemplateRows: 'auto auto auto',
        marginBottom: '1px',
        cursor: 'pointer',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
        outline: 'none',
        position: 'relative',
        paddingTop: '15px',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '0',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1,
          minWidth: '12px',
          height: '12px',
          padding: '3px 10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '9px',
          color: 'white',
          borderTopLeftRadius: '0px',
          borderTopRightRadius: '0px',
          borderBottomLeftRadius: '12px',
          borderBottomRightRadius: '12px',
          lineHeight: 1,
          pointerEvents: 'none',
        }}
      >
        {formattedStartTime}
      </div>

      <div style={{ margin: '2px' }}>
        {renderTeamCell(awayTeam, awayScore, 'away', awayRecord)}
      </div>

      <div style={{ margin: '2px' }}>
        {renderTeamCell(homeTeam, homeScore, 'home', homeRecord)}
      </div>

      <div
        style={{
          margin: '2px',
          border: '2px solid #555555',
          backgroundColor: 'rgba(70, 70, 70, 0.8)',
          opacity: 0.85,
          borderRadius: '0 0 0 6px',
          padding: '3px',
        }}
      >
        {renderPitcherInfo(awayTeam, game.teams.away.probablePitcher)}
      </div>

      <div
        style={{
          margin: '2px',
          border: '2px solid #555555',
          backgroundColor: 'rgba(70, 70, 70, 0.8)',
          opacity: 0.85,
          padding: '3px',
          borderRadius: '0 0 6px 0',
        }}
      >
        {renderPitcherInfo(homeTeam, game.teams.home.probablePitcher)}
      </div>
    </div>
  );
};

export default BeforeScoreBug;