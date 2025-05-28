// MatchupCardSelections/PitcherLastFive.js
import React from 'react';

const PitcherLastFive = ({ game, awayGames, homeGames }) => {
  const renderPitcherGames = (name, games) => (
    <div className="pitcher-block">
      <h3>{name}</h3>
      {games.length === 0 ? (
        <p>No recent starts found.</p>
      ) : (
        <table style={{ fontSize: '14px', width: '100%', tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th>Date</th>
              <th>OPP</th>
              <th>IP</th>
              <th>H</th>
              <th>ER</th>
              <th>BB</th>
              <th>K</th>
              <th>RES</th>
            </tr>
          </thead>
          <tbody>
            {games.map((game, idx) => (
              <tr key={idx}>
                <td>{`${parseInt(game.date.split('-')[1])}/${parseInt(game.date.split('-')[2])}`}</td>
                <td>{game.opponent}</td>
                <td>{game.inningsPitched}</td>
                <td>{game.hits}</td>
                <td>{game.earnedRuns}</td>
                <td>{game.walks}</td>
                <td>{game.strikeouts}</td>
                <td>{game.result}</td>
              </tr>
            ))}
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
