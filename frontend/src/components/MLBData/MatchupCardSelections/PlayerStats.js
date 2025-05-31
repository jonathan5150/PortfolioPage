import React from 'react';

const PlayerStats = ({ game, batterGameLogs, playerStatsSortConfig, setPlayerStatsSortConfig }) => {
  const awayTeamId = game.teams.away.team.id;
  const homeTeamId = game.teams.home.team.id;

  const awayRoster = batterGameLogs[awayTeamId]?.roster || [];
  const homeRoster = batterGameLogs[homeTeamId]?.roster || [];

  const sortConfig = playerStatsSortConfig || { key: 'fullName', direction: 'asc' };

  const getSortableValue = (player, key) => {
    if (key === 'fullName') {
      const name = player.person?.fullName || player.fullName || '';
      return name.split(' ').pop().toLowerCase(); // sort by last name
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
      } else {
        return sortConfig.direction === 'asc'
          ? aVal - bVal
          : bVal - aVal;
      }
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
          top: '-2px',
        }}
      >
        {sortConfig.direction === 'asc' ? '▲' : '▼'}
      </span>
    );
  };

  const renderPlayerTable = (teamName, players) => {
    const sortedPlayers = sortPlayers(players);

    return (
      <div className="lineup">
        <h3>{teamName}</h3>
        <table style={{ fontSize: '12px', width: '100%', tableLayout: 'fixed', cursor: 'pointer', userSelect: 'none' }}>
          <thead>
            <tr>
              <th style={{ width: '26%', textAlign: 'left', paddingLeft: '5px' }} onClick={() => handleSort('fullName')}>
                NAME{renderArrow('fullName')}
              </th>
              <th style={{ width: '8%' }} onClick={() => handleSort('hits')}>
                H{renderArrow('hits')}
              </th>
              <th style={{ width: '10%' }} onClick={() => handleSort('rbi')}>
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
            {sortedPlayers.map((player, index) => (
              <tr key={player.person?.id || index}>
                <td
                  style={{
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    textAlign: 'left',
                    paddingLeft: '5px',
                  }}
                >
                  {player.person?.fullName || player.fullName || 'N/A'}
                </td>
                <td>{player.seasonStats?.hits ?? 0}</td>
                <td>{player.seasonStats?.rbi ?? 0}</td>
                <td>{player.seasonStats?.baseOnBalls ?? 0}</td>
                <td>{player.seasonStats?.strikeOuts ?? 0}</td>
                <td>{player.seasonStats?.homeRuns ?? 0}</td>
                <td>{player.seasonStats?.stolenBases ?? 0}</td>
                <td>{player.seasonStats?.avg ?? '.000'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="player-stats">
      {renderPlayerTable(game.teams.away.team.name, awayRoster)}
      {renderPlayerTable(game.teams.home.team.name, homeRoster)}
    </div>
  );
};

export default PlayerStats;
