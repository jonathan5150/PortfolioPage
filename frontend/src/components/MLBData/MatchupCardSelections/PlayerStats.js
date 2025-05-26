import React from 'react';

const PlayerStats = ({ game }) => {
  return (
    <div className="player-stats">
      <div className="lineup">
        <h3>{game.teams.away.team.name}</h3>
        {game.lineups?.awayPlayers?.map((player, index) => (
          <div key={player.id || index}>
            <p>
              {index + 1}. {player.fullName} – {player.primaryPosition?.abbreviation || 'N/A'}
              <br />
              <strong>AVG: </strong> {player.seasonStats?.avg || 'N/A'},
              <strong> H: </strong> {player.seasonStats?.hits || 'N/A'},
              <strong> RBI: </strong> {player.seasonStats?.rbi || 'N/A'},
              <strong> HR: </strong> {player.seasonStats?.homeRuns || 'N/A'},
              <strong> SB: </strong> {player.seasonStats?.stolenBases || 'N/A'}
            </p>
          </div>
        ))}
      </div>
      <div className="lineup">
        <h3>{game.teams.home.team.name}</h3>
        {game.lineups?.homePlayers?.map((player, index) => (
          <div key={player.id || index}>
            <p>
              {index + 1}. {player.fullName} – {player.primaryPosition?.abbreviation || 'N/A'}
              <br />
              <strong>AVG: </strong> {player.seasonStats?.avg || 'N/A'},
              <strong> H: </strong> {player.seasonStats?.hits || 'N/A'},
              <strong> RBI: </strong> {player.seasonStats?.rbi || 'N/A'},
              <strong> HR: </strong> {player.seasonStats?.homeRuns || 'N/A'},
              <strong> SB: </strong> {player.seasonStats?.stolenBases || 'N/A'}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PlayerStats;