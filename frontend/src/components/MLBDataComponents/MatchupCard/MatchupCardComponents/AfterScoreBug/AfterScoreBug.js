import React, { useCallback, useEffect, useRef } from 'react';
import Scoreboard from '../Scoreboard';

// Official primary colors for each MLB team
const teamPrimaryColors = {
  'Arizona Diamondbacks': 'rgba(167, 25, 48, 0.6)',
  'Atlanta Braves': 'rgba(35, 48, 115, 0.6)',
  'Baltimore Orioles': 'rgba(223, 70, 1, 0.6)',
  'Boston Red Sox': 'rgba(189, 48, 57, 0.6)',
  'Chicago White Sox': 'rgba(160, 160, 160, 0.6)',
  'Chicago Cubs': 'rgba(14, 51, 134, 0.6)',
  'Cincinnati Reds': 'rgba(179, 0, 0, 0.6)',
  'Cleveland Guardians': 'rgba(12, 35, 64, 0.6)',
  'Colorado Rockies': 'rgba(51, 0, 111, 0.6)',
  'Detroit Tigers': 'rgba(12, 35, 64, 0.6)',
  'Houston Astros': 'rgba(0, 45, 98, 0.6)',
  'Kansas City Royals': 'rgba(0, 70, 135, 0.6)',
  'Los Angeles Angels': 'rgba(200, 16, 46, 0.6)',
  'Los Angeles Dodgers': 'rgba(0, 90, 156, 0.6)',
  'Miami Marlins': 'rgba(0, 163, 224, 0.6)',
  'Milwaukee Brewers': 'rgba(19, 41, 75, 0.6)',
  'Minnesota Twins': 'rgba(0, 43, 92, 0.6)',
  'New York Yankees': 'rgba(12, 35, 64, 0.6)',
  'New York Mets': 'rgba(0, 45, 114, 0.6)',
  Athletics: 'rgba(0, 56, 49, 0.6)',
  'Philadelphia Phillies': 'rgba(232, 24, 40, 0.6)',
  'Pittsburgh Pirates': 'rgba(253, 184, 39, 0.6)',
  'San Diego Padres': 'rgba(255, 196, 37, 0.6)',
  'San Francisco Giants': 'rgba(253, 90, 30, 0.6)',
  'Seattle Mariners': 'rgba(0, 92, 92, 0.6)',
  'St. Louis Cardinals': 'rgba(196, 30, 58, 0.6)',
  'Tampa Bay Rays': 'rgba(9, 44, 92, 0.6)',
  'Texas Rangers': 'rgba(0, 50, 120, 0.6)',
  'Toronto Blue Jays': 'rgba(19, 74, 142, 0.6)',
  'Washington Nationals': 'rgba(171, 0, 3, 0.6)',
};

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
      e.stopPropagation(); // 🔥 THIS IS THE FIX
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
            border: isStarred ? '2px solid #c49410' : '2px solid rgb(85, 85, 85)',
            backgroundColor: 'rgba(70, 70, 70, 0.8)',
            borderRadius: side === 'away' ? '6px 0 0 6px' : '0 6px 6px 0',
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