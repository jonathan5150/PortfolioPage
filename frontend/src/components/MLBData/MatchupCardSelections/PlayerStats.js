import React from 'react';

const renderPlayerTable = (teamName, players) => (
  <div className="lineup">
    <h3>{teamName}</h3>
    <table style={{ fontSize: '12px', width: '100%', tableLayout: 'fixed' }}>
      <thead>
        <tr>
          <th style={{ width: '42%', textAlign: 'left', paddingLeft: "5px" }}>Name</th>
          <th style={{ width: '8%' }}>POS</th>
          <th style={{ width: '10%' }}>AVG</th>
          <th style={{ width: '8%' }}>H</th>
          <th style={{ width: '8%' }}>RBI</th>
          <th style={{ width: '8%' }}>HR</th>
          <th style={{ width: '8%' }}>SB</th>
        </tr>
      </thead>
      <tbody>
        {players?.map((player, index) => (
          <tr key={player.person?.id || index}>
            <td style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'left', paddingLeft: "5px" }}>
              {player.person?.fullName || player.fullName || 'N/A'}
            </td>
            <td>{player.position?.abbreviation || 'N/A'}</td>
            <td>{player.seasonStats?.avg ?? '.000'}</td>
            <td>{player.seasonStats?.hits ?? 0}</td>
            <td>{player.seasonStats?.rbi ?? 0}</td>
            <td>{player.seasonStats?.homeRuns ?? 0}</td>
            <td>{player.seasonStats?.stolenBases ?? 0}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// 🧠 Use name-based matching because ID failed earlier
const PlayerStats = ({ game, batterGameLogs }) => {
  const awayTeamId = game.teams.away.team.id;
  const homeTeamId = game.teams.home.team.id;

  const awayRoster = batterGameLogs[awayTeamId]?.roster || [];
  const homeRoster = batterGameLogs[homeTeamId]?.roster || [];

  return (
    <div className="player-stats">
      {renderPlayerTable(game.teams.away.team.name, awayRoster)}
      {renderPlayerTable(game.teams.home.team.name, homeRoster)}
    </div>
  );
};

export default PlayerStats;
