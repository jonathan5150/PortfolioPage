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

  const getGamesSinceColor = (since, perStat, statKey) => {
    if (!['hits', 'rbi', 'homeRuns'].includes(statKey)) return undefined;
    const sinceNum = Number(since);
    const perStatNum = Number(perStat);
    if (isNaN(sinceNum) || isNaN(perStatNum)) return undefined;
    return sinceNum > perStatNum ? 'red' : undefined;
  };

  const getLast15Stats = (logs = [], statKey) => {
    if (!Array.isArray(logs)) return 0;
    const filtered = logs
      .filter((log) => new Date(log.date) < new Date(game.gameDate))
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 15);
    return filtered.reduce((sum, log) => sum + (parseInt(log[statKey]) || 0), 0);
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
              const logs = batterGameLogs[teamId]?.logs?.[playerName] || [];

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

              const last15Totals = ['hits', 'rbi', 'baseOnBalls', 'strikeOuts', 'homeRuns', 'stolenBases'].reduce((acc, key) => {
                acc[key] = getLast15Stats(logs, key);
                return acc;
              }, {});

              const last15 = ['hits', 'rbi', 'baseOnBalls', 'strikeOuts', 'homeRuns', 'stolenBases'].reduce((acc, key) => {
                const total = last15Totals[key];
                const raw = 15 / total;
                const perStat = total === 0 ? '–' : raw.toFixed(1).replace(/\.0$/, '');
                acc[key] = perStat;
                return acc;
              }, {});

              const last15Color = (key) => {
                if (!['hits', 'rbi', 'homeRuns'].includes(key)) return undefined;
                const last15Val = last15[key] === '–' ? NaN : parseFloat(last15[key]);
                const seasonVal = perStats[key] === '–' ? NaN : parseFloat(perStats[key]);
                if (isNaN(last15Val) || isNaN(seasonVal)) return undefined;
                return last15Val <= seasonVal * 0.8 ? 'orange' : undefined;
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
                  <tr style={{ fontStyle: 'italic', color: '#aaa' }}>
                    <td style={{ textAlign: 'right', paddingRight: '5px' }}>GAMES SINCE</td>
                    <td></td>
                    {Object.keys(sinceStats).map((key) => {
                      const color = getGamesSinceColor(sinceStats[key], perStats[key], key);
                      return (
                        <td key={key} style={{ textAlign: 'center', color }}>{sinceStats[key]}</td>
                      );
                    })}
                    <td></td>
                  </tr>
                  <tr style={{ fontStyle: 'italic', color: '#888' }}>
                    <td style={{ textAlign: 'right', paddingRight: '5px' }}>SEASON PER STAT</td>
                    <td></td>
                    {Object.values(perStats).map((val, i) => (
                      <td key={i} style={{ textAlign: 'center' }}>{val}</td>
                    ))}
                    <td></td>
                  </tr>
                  <tr style={{ fontStyle: 'italic', color: '#ccc' }}>
                    <td style={{ textAlign: 'right', paddingRight: '5px' }}>LAST 15 PER STAT</td>
                    <td></td>
                    {Object.keys(last15).map((key) => (
                      <td key={key} style={{ textAlign: 'center', color: last15Color(key) }}>{last15[key]}</td>
                    ))}
                    <td></td>
                  </tr>
                  <tr style={{ fontStyle: 'italic', color: '#bbb' }}>
                    <td style={{ textAlign: 'right', paddingRight: '5px' }}>LAST 15 TOTAL</td>
                    <td></td>
                    {Object.keys(last15Totals).map((key) => (
                      <td key={key} style={{ textAlign: 'center' }}>{last15Totals[key]}</td>
                    ))}
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
