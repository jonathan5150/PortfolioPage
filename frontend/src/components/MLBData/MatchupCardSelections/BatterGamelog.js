import React, { useEffect, useState } from 'react';

const BatterGamelog = ({
  team,
  teamType,
  showGameCountSelector,
  numGamesToShow,
  setNumGamesToShow,
  batterLogs = {}
}) => {
  const [playerLogs, setPlayerLogs] = useState({});
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [roster, setRoster] = useState([]);

  useEffect(() => {
    if (batterLogs && Object.keys(batterLogs).length > 0) {
      setPlayerLogs(batterLogs);

      const names = Object.keys(batterLogs);
      setRoster(
        names.map((name) => ({
          person: { fullName: name, id: null },
          position: { abbreviation: 'N/A' },
        }))
      );
    }
  }, [batterLogs]);

  useEffect(() => {
    if (!selectedPlayer && Object.keys(playerLogs).length > 0) {
      const leader = Object.entries(playerLogs)
        .map(([name, logs]) => ({
          name,
          homeRuns: logs.reduce((sum, g) => sum + (parseInt(g.homeRuns) || 0), 0),
        }))
        .sort((a, b) => b.homeRuns - a.homeRuns)[0];

      if (leader) {
        setSelectedPlayer(leader.name);
      }
    }
  }, [playerLogs, selectedPlayer]);

  const games = (playerLogs[selectedPlayer] || []).slice(0, numGamesToShow);

  return (
    <div className="batter-gamelog-wrapper">
      <div style={{ position: 'relative', marginBottom: '10px', height: '30px' }}>
        <div
          style={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            textAlign: 'center',
          }}
        >
          <h3 style={{ margin: '7px 0px 5px 0px' }}>{team.name}</h3>
        </div>

        {showGameCountSelector && (
          <div style={{ position: 'absolute', right: 0 }}>
            <select
              value={numGamesToShow}
              onChange={(e) => setNumGamesToShow(parseInt(e.target.value))}
              style={{ padding: '4px' }}
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
        )}
      </div>

      {roster.length > 0 && (
        <select
          value={selectedPlayer}
          onChange={(e) => setSelectedPlayer(e.target.value)}
          style={{ marginBottom: '10px', padding: '4px', width: '100%' }}
        >
          {roster
            .filter((player) => (playerLogs[player.person.fullName] || []).length > 0)
            .map((player) => {
              const position = player.position?.abbreviation || 'N/A';
              return (
                <option key={player.person.fullName} value={player.person.fullName}>
                  {player.person.fullName} ({position})
                </option>
              );
            })}
        </select>
      )}

      {games.length === 0 ? (
        <p>No recent games found for {selectedPlayer}.</p>
      ) : (
        <table style={{ fontSize: '13px', width: '100%', tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th style={{ width: '12%' }}>DATE</th>
              <th style={{ width: '14%' }}>OPP</th>
              <th style={{ width: '8%' }}>AVG</th>
              <th style={{ width: '8%' }}>H</th>
              <th style={{ width: '8%' }}>RBI</th>
              <th style={{ width: '8%' }}>HR</th>
              <th style={{ width: '8%' }}>SB</th>
            </tr>
          </thead>
          <tbody>
            {games.map((game, idx) => (
              <tr key={idx}>
                <td>{`${parseInt(game.date.split('-')[1])}/${parseInt(game.date.split('-')[2])}`}</td>
                <td>{game.opponent}</td>
                <td>{game.avg}</td>
                <td>{game.hits}</td>
                <td>{game.rbi}</td>
                <td>{game.homeRuns}</td>
                <td>{game.stolenBases}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default BatterGamelog;
