import React, { useState, useEffect, useMemo } from 'react';

const PlayerStats = ({
  game,
  batterGameLogs,
  playerStatsSortConfig,
  setPlayerStatsSortConfig,
  setContentKey,
  setSelectedPlayers,
  onHeightChange // ⬅️ NEW PROP
}) => {
  const awayTeamId = game.teams.away.team.id;
  const homeTeamId = game.teams.home.team.id;
  const awayTeamName = game.teams.away.team.name;
  const homeTeamName = game.teams.home.team.name;

  const awayRoster = batterGameLogs[awayTeamId]?.roster || [];
  const homeRoster = batterGameLogs[homeTeamId]?.roster || [];

  const [selectedTeam, setSelectedTeam] = useState(awayTeamId);

  const sortConfig = useMemo(() => {
    return playerStatsSortConfig || { key: 'gamesPlayed', direction: 'desc' };
  }, [playerStatsSortConfig]);

  // ⬇️ TRIGGER HEIGHT RECALC ON RELEVANT CHANGES
  useEffect(() => {
    if (onHeightChange) {
      const timeout = setTimeout(onHeightChange, 50); // slight delay for DOM render
      return () => clearTimeout(timeout);
    }
  }, [selectedTeam, sortConfig, batterGameLogs, onHeightChange]);

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
      } else {
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
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
      <span style={{ fontSize: '10px', verticalAlign: 'middle', marginLeft: '2px', position: 'relative', top: '-2px' }}>
        {sortConfig.direction === 'asc' ? '▲' : '▼'}
      </span>
    );
  };

  const renderGamesPerStat = (stat, gamesPlayed) => {
    if (!gamesPlayed || !stat || stat === 0) return '–';
    const value = (gamesPlayed / stat).toFixed(1);
    return value.endsWith('.0') ? value.slice(0, -2) : value;
  };

  const renderGamesSinceStat = (logs = [], statKey) => {
    if (!Array.isArray(logs) || logs.length === 0) return '–';
    const reversed = [...logs].sort((a, b) => new Date(b.date) - new Date(a.date));
    for (let i = 0; i < reversed.length; i++) {
      const val = parseInt(reversed[i][statKey]) || 0;
      if (val > 0) return i >= 0 ? i : '0';
    }
    return '–';
  };

  const getGamesSinceColor = (since, perStat) => {
    if (since === '–' || perStat === '–') return undefined;
    const sinceNum = Number(since);
    const perStatNum = Number(perStat);
    if (isNaN(sinceNum) || isNaN(perStatNum)) return undefined;
    return sinceNum > perStatNum ? 'red' : undefined;
  };

  const renderPlayerTable = (teamName, players, teamId) => {
    const filteredPlayers = players.filter(p => (p.seasonStats?.gamesPlayed || 0) >= 20);
    const sortedPlayers = sortPlayers(filteredPlayers);

    return (
      <div className="lineup noselect" tabIndex={-1} draggable={false} style={{ marginBottom: '3px' }}>

        <table style={{ fontSize: '12px', marginBottom: '3px', width: '100%', tableLayout: 'fixed', cursor: 'pointer' }}>
          <thead>
            <tr>
              <th style={{ width: '35%', textAlign: 'center', paddingLeft: '5px' }} onClick={() => handleSort('fullName')}>
                NAME{renderArrow('fullName')}
              </th>
              <th style={{ width: '8%' }} onClick={() => handleSort('gamesPlayed')}>GP{renderArrow('gamesPlayed')}</th>
              <th style={{ width: '8%' }} onClick={() => handleSort('hits')}>H{renderArrow('hits')}</th>
              <th style={{ width: '8%' }} onClick={() => handleSort('rbi')}>RBI{renderArrow('rbi')}</th>
              <th style={{ width: '8%' }} onClick={() => handleSort('baseOnBalls')}>BB{renderArrow('baseOnBalls')}</th>
              <th style={{ width: '8%' }} onClick={() => handleSort('strikeOuts')}>SO{renderArrow('strikeOuts')}</th>
              <th style={{ width: '8%' }} onClick={() => handleSort('homeRuns')}>HR{renderArrow('homeRuns')}</th>
              <th style={{ width: '8%' }} onClick={() => handleSort('stolenBases')}>SB{renderArrow('stolenBases')}</th>
              <th style={{ width: '8%' }} onClick={() => handleSort('avg')}>AVG{renderArrow('avg')}</th>
            </tr>
          </thead>
          <tbody>
            {sortedPlayers.map((player, index) => {
              const stats = player.seasonStats || {};
              const gp = stats.gamesPlayed || 0;
              const playerName = player.fullName || player.person?.fullName || '';
              const logs = batterGameLogs[teamId]?.logs?.[playerName] || {};

              const perStats = {
                hits: renderGamesPerStat(stats.hits, gp),
                rbi: renderGamesPerStat(stats.rbi, gp),
                baseOnBalls: renderGamesPerStat(stats.baseOnBalls, gp),
                strikeOuts: renderGamesPerStat(stats.strikeOuts, gp),
                homeRuns: renderGamesPerStat(stats.homeRuns, gp),
                stolenBases: renderGamesPerStat(stats.stolenBases, gp),
              };

              const sinceStats = {
                hits: renderGamesSinceStat(logs, 'hits'),
                rbi: renderGamesSinceStat(logs, 'rbi'),
                baseOnBalls: renderGamesSinceStat(logs, 'baseOnBalls'),
                strikeOuts: renderGamesSinceStat(logs, 'strikeOuts'),
                homeRuns: renderGamesSinceStat(logs, 'homeRuns'),
                stolenBases: renderGamesSinceStat(logs, 'stolenBases'),
              };

              return (
                <React.Fragment key={player.person?.id || index}>
                  <tr>
                    <td
                      onClick={() => {
                        setContentKey('batter-gamelog');
                        setSelectedPlayers(teamId, playerName);
                        setTimeout(() => {
                          const dropdown = document.querySelector(`select[value="${playerName}"]`);
                          if (dropdown) dropdown.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }, 50);
                      }}
                      style={{
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        textAlign: 'left',
                        paddingLeft: '5px',
                        userSelect: 'none',
                        textDecoration: 'underline',
                        cursor: 'pointer'
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
                  <tr style={{ fontStyle: 'italic', color: '#888' }}>
                    <td style={{ textAlign: 'right', paddingRight: '5px' }}>GAMES PER STAT</td>
                    <td></td>
                    <td style={{ textAlign: 'center' }}>{perStats.hits}</td>
                    <td style={{ textAlign: 'center' }}>{perStats.rbi}</td>
                    <td style={{ textAlign: 'center' }}>{perStats.baseOnBalls}</td>
                    <td style={{ textAlign: 'center' }}>{perStats.strikeOuts}</td>
                    <td style={{ textAlign: 'center' }}>{perStats.homeRuns}</td>
                    <td style={{ textAlign: 'center' }}>{perStats.stolenBases}</td>
                    <td></td>
                  </tr>
                  <tr style={{ fontStyle: 'italic', color: '#aaa' }}>
                    <td style={{ textAlign: 'right', paddingRight: '5px' }}>GAMES SINCE</td>
                    <td></td>
                    {Object.keys(sinceStats).map((key) => {
                      const color = getGamesSinceColor(sinceStats[key], perStats[key]);
                      return (
                        <td key={key} style={{ textAlign: 'center', color: color }}>{sinceStats[key]}</td>
                      );
                    })}
                    <td></td>
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="player-stats">
      <div style={{ fontSize: '7px', display: 'flex', justifyContent: 'center', marginBottom: '5px' }}>
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
