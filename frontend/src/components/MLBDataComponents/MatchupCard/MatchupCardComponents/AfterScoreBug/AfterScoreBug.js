import React, { useCallback, useEffect, useRef } from 'react';
import Scoreboard from '../Scoreboard';
import teamPrimaryColors, {
  getTeamBackgroundStyle,
  washOut,
} from '../mlbUtils/teamPrimaryColors';

const AfterScoreBug = ({
  game,
  gamePk,
  handleStarClick,
  getTeamLogo,
  gameBackgroundColors,
  selectedStarTeamId,
  getTeamAbbreviation,
  liveData,
  showScoreboard = false,
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
      }, 600);
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

  const renderTeamCell = (team, score, side, record) => {
    const abbr = getTeamAbbreviation(team.id);
    const teamName = team.name;
    const isStarred = selectedStarTeamId === team.id;
    const backgroundColor = teamPrimaryColors[teamName];
    const logoFilters = {
      'Los Angeles Dodgers': 'brightness(0.65) contrast(1.4)',
      'Philadelphia Phillies': 'brightness(0.75) contrast(2)',
      'St. Louis Cardinals': 'brightness(1) contrast(1.2)',
    };

    const filter = logoFilters[teamName] || 'none';
    const borderColor = backgroundColor
      ? washOut(backgroundColor, 0.2)
      : 'rgb(85, 85, 85)';

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
        {backgroundColor && (
          <div
            style={{
              ...getTeamBackgroundStyle(backgroundColor),
              borderRadius: side === 'away' ? '6px 0 0 6px' : '0 6px 6px 0',
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
            border: isStarred
              ? '2px solid #c49410'
              : `2px solid ${borderColor}`,
            borderRadius: side === 'away' ? '6px 0 0 6px' : '0 6px 6px 0',
            padding: '5px 10px',
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

                filter, // 👈 applies per team

                userSelect: 'none',
                WebkitUserDrag: 'none',
                outline: 'none',
                WebkitTapHighlightColor: 'transparent',
              }}
            />
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              width: '40px',
            }}
          >
            <div
              className="abbreviation"
              style={{
                height: '20px',
                fontWeight: 'bold',
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
                fontSize: '9px',
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
        cursor: 'pointer',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
        outline: 'none',
      }}
    >
      <div
        style={{
          margin: '2px',
          WebkitTapHighlightColor: 'transparent',
          outline: 'none',
        }}
      >
        {renderTeamCell(awayTeam, awayScore, 'away', awayRecord)}
      </div>

      <div
        style={{
          margin: '2px',
          WebkitTapHighlightColor: 'transparent',
          outline: 'none',
        }}
      >
        {renderTeamCell(homeTeam, homeScore, 'home', homeRecord)}
      </div>

      <div
        style={{
          gridColumn: '1 / span 2',
          margin: '0px',
          overflow: 'hidden',
          paddingLeft: showScoreboard && !gameNotStarted ? '2px' : '5px',
          paddingRight: showScoreboard && !gameNotStarted ? '2px' : '5px',
          paddingTop: showScoreboard && !gameNotStarted ? '2px' : '0px',
          paddingBottom: showScoreboard && !gameNotStarted ? '3px' : '0px',
          maxHeight: showScoreboard && !gameNotStarted ? '120px' : '0px',
          opacity: showScoreboard && !gameNotStarted ? 1 : 0,
          transition: 'max-height 0.6s ease, opacity 0.45s ease, padding 0.4s ease',
        }}
      >
        <Scoreboard
          game={game}
          getTeamAbbreviation={getTeamAbbreviation}
          liveData={trueLiveData}
        />
      </div>
    </div>
  );
};

export default AfterScoreBug;