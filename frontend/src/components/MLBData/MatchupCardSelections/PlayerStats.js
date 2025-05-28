import React from 'react';

const renderPlayerTable = (teamName, players) => (
  <div className="lineup">
    <h3>{teamName}</h3>
    <table style={{ fontSize: '12px', width: '100%', tableLayout: 'fixed' }}>
      <thead>
        <tr>
          <th style={{ width: '5%' }}>#</th>
          <th style={{ width: '36%' }}>Name</th>
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
          <tr key={player.id || index}>
            <td>{index + 1}</td>
            <td style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {player.fullName}
            </td>
            <td>{player.primaryPosition?.abbreviation || 'N/A'}</td>
            <td>{player.seasonStats?.avg || 'N/A'}</td>
            <td>{player.seasonStats?.hits || 'N/A'}</td>
            <td>{player.seasonStats?.rbi || 'N/A'}</td>
            <td>{player.seasonStats?.homeRuns || 'N/A'}</td>
            <td>{player.seasonStats?.stolenBases || 'N/A'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const PlayerStats = ({ game }) => {
  return (
    <div className="player-stats">
      {renderPlayerTable(game.teams.away.team.name, game.lineups?.awayPlayers)}
      {renderPlayerTable(game.teams.home.team.name, game.lineups?.homePlayers)}
    </div>
  );
};

export default PlayerStats;
