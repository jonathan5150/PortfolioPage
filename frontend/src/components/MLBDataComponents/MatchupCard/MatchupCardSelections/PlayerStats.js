import React, { useState, useEffect, useMemo } from 'react';
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

  const [selectedTeam, setSelectedTeam] = useState(() => {
    const cookie = Cookies.get('playerStatsTeam');
    const parsed = parseInt(cookie);
    if (parsed === awayTeamId || parsed === homeTeamId) return parsed;
    return awayTeamId;
  });

  useEffect(() => {
    Cookies.set('playerStatsTeam', selectedTeam, { expires: 7 });
  }, [selectedTeam]);

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
          fontSize: '10px',
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

  const renderPlayerTable = (teamName, players, teamId) => {

    let filteredPlayers = players.filter(
      (p) => (p.seasonStats?.gamesPlayed || 0) >= (isPostseason ? 1 : 20)
    );

    // fallback: still enforce > 0 GP
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
        style={{ marginBottom: '3px' }}
      >
        <table
          style={{
            fontSize: '12px',
            marginBottom: '3px',
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
                      paddingLeft: '5px',
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
    <div className="player-stats">
      <div
        style={{
          fontSize: '7px',
          display: 'flex',
          justifyContent: 'center',
          marginBottom: '5px'
        }}
      >
        <select
          id="team-select"
          value={selectedTeam}
          onChange={(e) => setSelectedTeam(parseInt(e.target.value))}
        >
          <option value={awayTeamId}>{awayTeamName}</option>
          <option value={homeTeamId}>{homeTeamName}</option>
        </select>
      </div>

      {selectedTeam === awayTeamId && renderPlayerTable(awayTeamName, awayRoster, awayTeamId)}
      {selectedTeam === homeTeamId && renderPlayerTable(homeTeamName, homeRoster, homeTeamId)}
    </div>
  );
};

export default PlayerStats;