import React, { useCallback, useEffect, useRef } from 'react';
import Scoreboard from '../Scoreboard';
import teamPrimaryColors, {
  getTeamBackgroundStyle,
  washOut,
} from '../mlbUtils/teamPrimaryColors';

const LiveScoreBug = ({
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

  const awayTeam = game.teams.away.team;
  const homeTeam = game.teams.home.team;
  const awayScore = trueLiveData?.linescore?.teams?.away?.runs ?? '-';
  const homeScore = trueLiveData?.linescore?.teams?.home?.runs ?? '-';

  const count = trueLiveData?.plays?.currentPlay?.count || {};
  const balls = count.balls ?? 0;
  const strikes = count.strikes ?? 0;
  const outs = count.outs ?? 0;

  const offense = trueLiveData?.linescore?.offense || {};
  const onFirst = !!offense.first;
  const onSecond = !!offense.second;
  const onThird = !!offense.third;

  const inning = trueLiveData?.linescore?.currentInning ?? '';
  const isTopInning = trueLiveData?.linescore?.isTopInning;
  const inningArrow = isTopInning ? '▲' : '▼';

  const batter = trueLiveData?.plays?.currentPlay?.matchup?.batter;
  const pitcher = trueLiveData?.plays?.currentPlay?.matchup?.pitcher;

  const allPlayers = {
    ...trueLiveData?.boxscore?.teams?.away?.players,
    ...trueLiveData?.boxscore?.teams?.home?.players,
  };

  const getBatterLine = () => {
    if (!batter || !batter.id || !allPlayers) return '';
    const playerData = allPlayers[`ID${batter.id}`];
    if (!playerData || !playerData.stats?.batting) return '';
    const stats = playerData.stats.batting;

    const hits = stats.hits ?? 0;
    const atBats = stats.atBats ?? 0;
    const rbi = stats.rbi ?? 0;
    const homeRuns = stats.homeRuns ?? 0;

    const parts = [];
    parts.push(`${hits} for ${atBats}`);
    if (rbi > 0) parts.push(`${rbi} RBI`);
    if (homeRuns > 0) parts.push(`${homeRuns} HR`);
    return parts.join(', ');
  };

  const getPitcherLine = () => {
    if (!pitcher || !pitcher.id || !allPlayers) return '';
    const playerData = allPlayers[`ID${pitcher.id}`];
    if (!playerData || !playerData.stats?.pitching) return '';
    const stats = playerData.stats.pitching;

    const earnedRuns = stats.earnedRuns ?? 0;
    const strikeOuts = stats.strikeOuts ?? 0;

    return `${earnedRuns} ER, ${strikeOuts} K`;
  };

  const formatName = (player) => {
    if (!player?.fullName) return 'N/A';
    const parts = player.fullName.split(' ');
    if (parts.length === 1) return parts[0];
    if (parts.length >= 3 && parts[parts.length - 1].includes('.')) {
      return parts.slice(-2).join(' ');
    }
    return parts.slice(-1)[0];
  };

  const cellMargin = '2px';

  const awayRecord = game.teams.away.displayRecord || game.teams.away.pregameRecord || '0-0';
  const homeRecord = game.teams.home.displayRecord || game.teams.home.pregameRecord || '0-0';

  const renderTeamCell = (team, score, side, record) => {
    const abbr = getTeamAbbreviation(team.id);
    const teamName = team.name;
    const backgroundColor = teamPrimaryColors[teamName];
    const isStarred = selectedStarTeamId === team.id;
    const borderColor = backgroundColor
      ? washOut(backgroundColor, 0.2)
      : 'rgb(85, 85, 85)';

    const logoFilters = {
      'Los Angeles Dodgers': 'brightness(0.65) contrast(1.4)',
      'Philadelphia Phillies': 'brightness(0.75) contrast(2)',
      'St. Louis Cardinals': 'brightness(1) contrast(1.2)',
    };

    const filter = logoFilters[teamName] || 'none';

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
          margin: '2px',
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
            border: isStarred
              ? '2px solid #c49410'
              : `2px solid ${borderColor}`,
            borderRadius: side === 'away' ? '6px 0 0 0' : '0 6px 0 0',
            padding: '5px 10px',
            position: 'relative',
            zIndex: 2,
          }}
        >
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <img
              src={getTeamLogo(team.id)}
              alt={`${team.name} logo`}
              style={{
                width: '40px',
                height: '40px',
                objectFit: 'contain',
                filter,
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
                height: '20px',
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
                fontSize: '9px',
                color: '#fff',
                lineHeight: '12px',
                width: '60px',
                textAlign: 'center',
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
              width: '40px',
              textAlign: 'center',
            }}
          >
            {score}
          </div>
        </div>
      </div>
    );
  };

  const renderPitchOutBox = () => (
    <div
      className="pitch-out-container"
      style={{ display: 'flex', margin: cellMargin, boxSizing: 'border-box', gap: '4px' }}
    >
      <div
        style={{
          flex: 1,
          height: '60px',
          border: '2px solid #555555',
          backgroundColor: 'rgba(70, 70, 70, 1)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          borderRadius: '0 0 0 0',
        }}
      >
        <div style={{ fontWeight: 'bold', color: '#fff', marginBottom: '4px' }}>
          {balls}-{strikes}
        </div>

        <div style={{ display: 'flex', gap: '4px' }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: i < outs ? '#b59841' : 'transparent',
                border: '2px solid #555555',
              }}
            />
          ))}
        </div>
      </div>

      <div
        style={{
          flex: 1,
          height: '60px',
          border: '2px solid #555555',
          backgroundColor: 'rgba(70, 70, 70, 1)',
          borderRadius: '0 0 6px 0',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <div style={{ position: 'relative', width: '50px', height: '50px' }}>
          <div
            style={{
              position: 'absolute',
              top: '10px',
              left: '50%',
              transform: 'translate(-50%, 0) rotate(45deg)',
              width: '16px',
              height: '16px',
              backgroundColor: onSecond ? '#b59841' : 'white',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: -3,
              left: '95%',
              transform: 'translate(-100%, 0) rotate(45deg)',
              width: '16px',
              height: '16px',
              backgroundColor: onFirst ? '#b59841' : 'white',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: -3,
              left: 3,
              transform: 'rotate(45deg)',
              width: '16px',
              height: '16px',
              backgroundColor: onThird ? '#b59841' : 'white',
            }}
          />
        </div>

        <div
          style={{
            marginTop: '2px',
            marginBottom: '4px',
            marginRight: '2px',
            fontWeight: 'bold',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{ fontSize: '6px', marginRight: '2px' }}>{inningArrow}</span>
          <span style={{ fontSize: '13px' }}>{inning}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div
      className="score-grid"
      onClick={onToggleStats}
      onClickCapture={suppressClickAfterLongPress}
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gridTemplateRows: '1fr 1fr auto',
        padding: '5px 5px 0 5px',
        cursor: 'pointer',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
        outline: 'none',
      }}
    >
      <div>
        {renderTeamCell(awayTeam, awayScore, 'away', awayRecord)}
      </div>

      <div>
        {renderTeamCell(homeTeam, homeScore, 'home', homeRecord)}
      </div>

      <div
        style={{
          margin: cellMargin,
          border: '2px solid #555555',
          backgroundColor: 'rgba(70, 70, 70, 1)',
          fontSize: '11px',
          color: 'white',
          padding: '6px 8px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          lineHeight: '1.3',
          textAlign: 'left',
          paddingLeft: '14px',
          borderRadius: '0 0 0 6px',
        }}
      >
        <div style={{ marginBottom: '4px' }}>
          {batter ? `${formatName(batter)} (${getBatterLine()})` : 'Batter: N/A'}
        </div>
        <div>
          {pitcher ? `${formatName(pitcher)} (${getPitcherLine()})` : 'Pitcher: N/A'}
        </div>
      </div>

      <div>
        {renderPitchOutBox()}
      </div>

      <div
        style={{
          gridColumn: '1 / span 2',
          overflow: 'hidden',
          paddingLeft: showScoreboard ? '2px' : '5px',
          paddingRight: showScoreboard ? '2px' : '5px',
          paddingTop: showScoreboard ? '2px' : '1px',
          paddingBottom: showScoreboard ? '4px' : '0',
          maxHeight: showScoreboard ? '120px' : '0px',
          opacity: showScoreboard ? 1 : 0,
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

export default LiveScoreBug;