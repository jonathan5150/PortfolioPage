import React from 'react';

const PitcherLastFive = ({ game, awayGames, homeGames }) => {
  const renderPitcherGames = (name, games) => (
    <div className="pitcher-block">
      <h3>{name}</h3>
      {games.length === 0 ? (
        <p>No recent starts found.</p>
      ) : (
        <table style={{ fontSize: '13px', width: '100%', tableLayout: 'fixed'}}>
          <thead>
            <tr>
              <th style={{ width: '16%' }}>DATE</th>
              <th style={{ width: '16%' }}>OPP</th>
              <th style={{ width: '12%' }}>IP</th>
              <th style={{ width: '12%' }}>H</th>
              <th style={{ width: '12%' }}>ER</th>
              <th style={{ width: '12%' }}>BB</th>
              <th style={{ width: '12%' }}>K</th>
              <th style={{ width: '12%' }}>RES</th>
            </tr>
          </thead>
          <tbody>
            {games.map((game, idx) => {
              const resultStyle = {
                fontWeight: 'bold',
                color:
                  game.result === 'W'
                    ? 'rgba(0, 155, 0, 0.6)'
                    : game.result === 'L'
                    ? 'rgba(255, 0, 0, 0.6)'
                    : undefined,
              };

              return (
                <tr key={idx}>
                  <td>{`${parseInt(game.date.split('-')[1])}/${parseInt(game.date.split('-')[2])}`}</td>
                  <td>{game.opponent}</td>
                  <td>{game.inningsPitched}</td>
                  <td>{game.hits}</td>
                  <td>{game.earnedRuns}</td>
                  <td>{game.walks}</td>
                  <td>{game.strikeouts}</td>
                  <td style={resultStyle}>{game.result}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );

  return (
    <div className="pitcher-last-five-wrapper">
      {renderPitcherGames(game.teams.away.probablePitcher?.fullName || 'Away Pitcher', awayGames)}
      {renderPitcherGames(game.teams.home.probablePitcher?.fullName || 'Home Pitcher', homeGames)}
    </div>
  );
};

export default PitcherLastFive;
