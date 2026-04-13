import React, { useState, useEffect, useMemo, useRef } from 'react';
import Cookies from 'js-cookie';
import teamPrimaryColors, {
  TEAM_SATURATION,
} from '../MatchupCardComponents/mlbUtils/teamPrimaryColors';

const viewportStyle = {
  width: '100%',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  borderRadius: '8px',
  overflow: 'hidden',
  background: 'rgba(30, 30, 30, 0.55)',
};

const containerStyle = {
  width: '100%',
  background: 'transparent',
};

const tableStyle = {
  width: '100%',
  fontSize: '12px',
  borderCollapse: 'collapse',
  tableLayout: 'fixed',
};

const thStyle = {
  padding: '5px 9px',
  fontSize: '0.63rem',
  fontWeight: 600,
  color: 'rgba(255,255,255,0.82)',
  background: 'rgba(255,255,255,0.03)',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
  textAlign: 'center',
};

const tdStyle = {
  padding: '5px 9px',
  color: 'white',
  borderBottom: '1px solid rgba(255,255,255,0.06)',
  textAlign: 'center',
  fontSize: '0.7rem',
};

const statHeaderStyle = {
  ...thStyle,
};

const statHeaderInnerStyle = {
  position: 'relative',
  left: '-12px',
};

const statCellStyle = {
  ...tdStyle,
  position: 'relative',
  left: '-12px',
};

const PlayerStats = ({
  game,
  batterGameLogs,
  playerStatsSortConfig,
  setPlayerStatsSortConfig,
  setContentKey,
  setSelectedPlayers,
}) => {
  const awayTeamId = game.teams.away.team.id;
  const homeTeamId = game.teams.home.team.id;
  const awayTeamName = game.teams.away.team.name;
  const homeTeamName = game.teams.home.team.name;

  const awayRoster = batterGameLogs[awayTeamId]?.roster || [];
  const homeRoster = batterGameLogs[homeTeamId]?.roster || [];

  const isPostseason = game?.gameType && game.gameType !== 'R';

  const [showing, setShowing] = useState(() => {
    const cookie = Cookies.get('playerStatsTeam');
    return cookie === 'home' ? 'home' : 'away';
  });

  const touchStartX = useRef(null);
  const dragDeltaX = useRef(0);

  useEffect(() => {
    Cookies.set('playerStatsTeam', showing, { expires: 7 });
  }, [showing]);

  const handleSetShowing = (next) => {
    setShowing(next);
  };

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    dragDeltaX.current = 0;
  };

  const handleTouchMove = (e) => {
    const currentX = e.touches[0].clientX;
    dragDeltaX.current = currentX - touchStartX.current;

    if (dragDeltaX.current > 30 && showing === 'home') {
      handleSetShowing('away');
      dragDeltaX.current = 0;
    } else if (dragDeltaX.current < -30 && showing === 'away') {
      handleSetShowing('home');
      dragDeltaX.current = 0;
    }
  };

  const handleTouchEnd = () => {
    dragDeltaX.current = 0;
  };

  const sortConfig = useMemo(() => {
    return playerStatsSortConfig || { key: 'gamesPlayed', direction: 'desc' };
  }, [playerStatsSortConfig]);

  const getSortableValue = (player, key) => {
    if (key === 'fullName') {
      const name = player.person?.fullName || player.fullName || '';
      return name.split(' ').pop().toLowerCase();
    }
    return player.seasonStats?.[key] ?? 0;
  };

  const sortPlayers = (players) => {
    return [...players].sort((a, b) => {
      const aVal = getSortableValue(a, sortConfig.key);
      const bVal = getSortableValue(b, sortConfig.key);

      if (typeof aVal === 'string') {
        return sortConfig.direction === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
    });
  };

  const handleSort = (key) => {
    setPlayerStatsSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      const initialDirection = key === 'fullName' ? 'asc' : 'desc';
      return { key, direction: initialDirection };
    });
  };

  const renderArrow = (key) => {
    if (sortConfig.key !== key) return null;
    return (
      <span
        style={{
          fontSize: '0.6rem',
          verticalAlign: 'middle',
          marginLeft: '2px',
          position: 'relative',
          top: '-2px',
        }}
      >
        {sortConfig.direction === 'asc' ? '▲' : '▼'}
      </span>
    );
  };

  const renderPlayerTable = (teamName, players) => {
    const teamColor = teamPrimaryColors[teamName];

    let filteredPlayers = players.filter(
      (p) => (p.seasonStats?.gamesPlayed || 0) >= (isPostseason ? 1 : 20)
    );

    if (filteredPlayers.length === 0) {
      filteredPlayers = players.filter(
        (p) => (p.seasonStats?.gamesPlayed || 0) > 0
      );
    }

    const sortedPlayers = sortPlayers(filteredPlayers);

    return (
      <div className="lineup noselect" style={{ width: '100%', flexShrink: 0 }}>
        <div style={containerStyle}>
          <div style={{ position: 'relative', overflow: 'hidden' }}>
            <h3
              style={{
                margin: 0,
                display: 'flex',
                padding: '4px 0',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                zIndex: 2,
                fontWeight: 400,
                lineHeight: 1,
                color: '#fff',
                borderRadius: '8px 8px 0 0',
                background: teamColor
                  ? `linear-gradient(to right, ${teamColor} 25%, transparent), ${teamColor}`
                  : undefined,
                backgroundBlendMode: teamColor ? 'screen' : undefined,
                filter: teamColor ? `saturate(${TEAM_SATURATION})` : undefined,
              }}
            >
              {teamName}

              <button
                onClick={() =>
                  handleSetShowing(showing === 'away' ? 'home' : 'away')
                }
                style={{
                  position: 'absolute',
                  right: '0.5rem',
                  fontSize: '0.6rem',
                  background: 'transparent',
                  color: 'white',
                  transform: showing === 'away' ? 'scaleX(1)' : 'scaleX(-1)',
                  transition: 'transform 0.3s',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                ▶
              </button>
            </h3>
          </div>

          <table style={tableStyle}>
            <thead>
              <tr>
                <th
                  style={{ ...thStyle, width: '45%', textAlign: 'left', cursor: 'pointer' }}
                  onClick={() => handleSort('fullName')}
                >
                  NAME{renderArrow('fullName')}
                </th>

                {[
                  ['GP', 'gamesPlayed'],
                  ['H', 'hits'],
                  ['RBI', 'rbi'],
                  ['BB', 'baseOnBalls'],
                  ['SO', 'strikeOuts'],
                  ['HR', 'homeRuns'],
                  ['SB', 'stolenBases'],
                  ['AVG', 'avg'],
                ].map(([label, key]) => (
                  <th
                    key={key}
                    style={{ ...statHeaderStyle, width: '6.875%', cursor: 'pointer' }}
                    onClick={() => handleSort(key)}
                  >
                    <div style={statHeaderInnerStyle}>
                      {label}
                      {renderArrow(key)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {sortedPlayers.map((player, index) => {
                const stats = player.seasonStats || {};
                const playerName =
                  player.fullName || player.person?.fullName || '';

                return (
                  <tr key={player.person?.id || index}>
                    <td style={{ ...tdStyle, textAlign: 'left' }}>
                      {playerName || 'N/A'}
                    </td>
                    <td style={statCellStyle}>{stats.gamesPlayed || ''}</td>
                    <td style={statCellStyle}>{stats.hits ?? 0}</td>
                    <td style={statCellStyle}>{stats.rbi ?? 0}</td>
                    <td style={statCellStyle}>{stats.baseOnBalls ?? 0}</td>
                    <td style={statCellStyle}>{stats.strikeOuts ?? 0}</td>
                    <td style={statCellStyle}>{stats.homeRuns ?? 0}</td>
                    <td style={statCellStyle}>{stats.stolenBases ?? 0}</td>
                    <td style={statCellStyle}>{stats.avg || ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div
      className="player-stats"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ position: 'relative', height: '100%' }}
    >
      <div style={viewportStyle}>
        <div
          style={{
            display: 'flex',
            width: '200%',
            transform:
              showing === 'away'
                ? 'translateX(0%)'
                : 'translateX(-50%)',
            transition: 'transform 0.4s ease',
          }}
        >
          <div style={{ flex: '0 0 50%' }}>
            {renderPlayerTable(awayTeamName, awayRoster)}
          </div>
          <div style={{ flex: '0 0 50%' }}>
            {renderPlayerTable(homeTeamName, homeRoster)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerStats;