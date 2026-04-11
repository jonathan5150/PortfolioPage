import React, { useState, useEffect, useMemo, useRef } from 'react';
import Cookies from 'js-cookie';

const PlayerStats = ({
  game,
  batterGameLogs,
  playerStatsSortConfig,
  setPlayerStatsSortConfig,
  setContentKey,
  setSelectedPlayers
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
          top: '-2px'
        }}
      >
        {sortConfig.direction === 'asc' ? '▲' : '▼'}
      </span>
    );
  };

  const renderPlayerTable = (teamName, players) => {
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
      <div
        className="lineup noselect"
        tabIndex={-1}
        draggable={false}
        style={{ marginBottom: '3px', width: '100%', flexShrink: 0 }}
      >
        <h3
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    margin: '0',
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
        <table
          style={{
            fontSize: '12px',
            marginBottom: '3px',
            paddingRight: '10px',
            width: '100%',
            tableLayout: 'fixed',
            cursor: 'pointer'
          }}
        >
          <thead>
            <tr>
              <th
                style={{ width: '35%', textAlign: 'center', paddingLeft: '5px' }}
                onClick={() => handleSort('fullName')}
              >
                NAME{renderArrow('fullName')}
              </th>
              <th style={{ width: '8%' }} onClick={() => handleSort('gamesPlayed')}>
                GP{renderArrow('gamesPlayed')}
              </th>
              <th style={{ width: '8%' }} onClick={() => handleSort('hits')}>
                H{renderArrow('hits')}
              </th>
              <th style={{ width: '8%' }} onClick={() => handleSort('rbi')}>
                RBI{renderArrow('rbi')}
              </th>
              <th style={{ width: '8%' }} onClick={() => handleSort('baseOnBalls')}>
                BB{renderArrow('baseOnBalls')}
              </th>
              <th style={{ width: '8%' }} onClick={() => handleSort('strikeOuts')}>
                SO{renderArrow('strikeOuts')}
              </th>
              <th style={{ width: '8%' }} onClick={() => handleSort('homeRuns')}>
                HR{renderArrow('homeRuns')}
              </th>
              <th style={{ width: '8%' }} onClick={() => handleSort('stolenBases')}>
                SB{renderArrow('stolenBases')}
              </th>
              <th style={{ width: '8%' }} onClick={() => handleSort('avg')}>
                AVG{renderArrow('avg')}
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedPlayers.map((player, index) => {
              const stats = player.seasonStats || {};
              const gp = stats.gamesPlayed || 0;
              const playerName = player.fullName || player.person?.fullName || '';

              return (
                <tr key={player.person?.id || index}>
                  <td
                    style={{
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      textAlign: 'left',
                      userSelect: 'none'
                    }}
                  >
                    {playerName || 'N/A'}
                  </td>
                  <td>{gp || ''}</td>
                  <td>{stats.hits ?? 0}</td>
                  <td>{stats.rbi ?? 0}</td>
                  <td>{stats.baseOnBalls ?? 0}</td>
                  <td>{stats.strikeOuts ?? 0}</td>
                  <td>{stats.homeRuns ?? 0}</td>
                  <td>{stats.stolenBases ?? 0}</td>
                  <td>{stats.avg || ''}</td>
                </tr>
              );
            })}

            {sortedPlayers.length === 0 && (
              <tr>
                <td
                  colSpan={9}
                  style={{ textAlign: 'center', padding: '6px 0', color: '#aaa' }}
                >
                  No player stats available.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div
      className="player-stats"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        position: 'relative',
        overflow: 'hidden',
        width: '100%',
      }}
    >

      <div
        style={{
          display: 'flex',
          width: '200%',
          transform: showing === 'away' ? 'translateX(0%)' : 'translateX(-50%)',
          transition: 'transform 0.4s ease',
        }}
      >
        <div style={{ width: '100%' }}>
          {renderPlayerTable(awayTeamName, awayRoster)}
        </div>
        <div style={{ width: '100%' }}>
          {renderPlayerTable(homeTeamName, homeRoster)}
        </div>
      </div>
    </div>
  );
};

export default PlayerStats;