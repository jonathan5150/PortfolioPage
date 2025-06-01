import React, { useEffect, useState } from 'react';
import Cookies from 'js-cookie';

const BatterGamelog = ({
  teams = [],
  gameDate,
  getTeamAbbreviation,
  numGamesToShow,
  setNumGamesToShow
}) => {
  const [selectedPlayers, setSelectedPlayers] = useState(() => {
    const saved = Cookies.get('selectedPlayers');
    return saved ? JSON.parse(saved) : {};
  });
  const getInitialSelected = (logs = {}) => {
    const leader = Object.entries(logs)
      .map(([name, logs]) => ({
        name,
        homeRuns: logs.reduce((sum, g) => sum + (parseInt(g.homeRuns) || 0), 0),
      }))
      .sort((a, b) => b.homeRuns - a.homeRuns)[0];
    return leader?.name || '';
  };

  useEffect(() => {
    setSelectedPlayers((prev) => {
      const initial = { ...prev };
      let updated = false;

      for (const { team, logs } of teams) {
        if (!initial[team.id] && logs && Object.keys(logs).length > 0) {
          initial[team.id] = getInitialSelected(logs);
          updated = true;
        }
      }

      if (updated) {
        Cookies.set('selectedPlayers', JSON.stringify(initial), { expires: 365 });
      }

      return initial;
    });
  }, [teams]);


  const handleSelectChange = (teamId, playerName) => {
    setSelectedPlayers(prev => {
      const updated = {
        ...prev,
        [teamId]: playerName
      };
      Cookies.set('selectedPlayers', JSON.stringify(updated), { expires: 365 });
      return updated;
    });
  };

  return (
    <div className="batter-gamelog-wrapper">
      {teams.map(({ team, teamType, logs = {}, roster = [] }) => {
        const selectedPlayer = selectedPlayers[team.id] || '';
        const playerGames = logs[selectedPlayer]?.slice(0, numGamesToShow) || [];

        return (
          <div key={team.id}>
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

              {teamType === 'Away' && (
                <div style={{ position: 'absolute', right: 0 }}>
                  <select
                    value={numGamesToShow}
                    onChange={(e) => setNumGamesToShow(parseInt(e.target.value))}
                    style={{ padding: '4px' }}
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                  </select>
                </div>
              )}
            </div>

            {roster.length > 0 && (
              <select
                value={selectedPlayer}
                onChange={(e) => handleSelectChange(team.id, e.target.value)}
                style={{ marginBottom: '10px', padding: '4px', width: '100%' }}
              >
                {[...roster]
                  .sort((a, b) => {
                    const aLast = a.person.fullName.split(' ').slice(-1)[0];
                    const bLast = b.person.fullName.split(' ').slice(-1)[0];
                    return aLast.localeCompare(bLast);
                  })
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

            {playerGames.length === 0 ? (
              <p>No recent games found for {selectedPlayer}.</p>
            ) : (
              <table style={{ fontSize: '13px', width: '100%', tableLayout: 'fixed' }}>
                <thead>
                  <tr>
                    <th style={{ width: '12%' }}>DATE</th>
                    <th style={{ width: '11%' }}>OPP</th>
                    <th style={{ width: '7%' }}>AB</th>
                    <th style={{ width: '7%' }}>R</th>
                    <th style={{ width: '7%' }}>H</th>
                    <th style={{ width: '8%' }}>RBI</th>
                    <th style={{ width: '7%' }}>BB</th>
                    <th style={{ width: '7%' }}>SO</th>
                    <th style={{ width: '8%' }}>HR</th>
                    <th style={{ width: '8%' }}>SB</th>
                    <th style={{ width: '11%' }}>AVG</th>
                  </tr>
                </thead>
                <tbody>
                  {playerGames.map((game, idx) => (
                    <tr key={idx}>
                      <td>{`${parseInt(game.date.split('-')[1])}/${parseInt(game.date.split('-')[2])}`}</td>
                      <td>{game.opponent}</td>
                      <td>{game.atBats ?? 'N/A'}</td>
                      <td>{game.runs ?? 'N/A'}</td>
                      <td>{game.hits ?? 'N/A'}</td>
                      <td>{game.rbi ?? 'N/A'}</td>
                      <td>{game.baseOnBalls ?? 'N/A'}</td>
                      <td>{game.strikeOuts ?? 'N/A'}</td>
                      <td>{game.homeRuns ?? 'N/A'}</td>
                      <td>{game.stolenBases ?? 'N/A'}</td>
                      <td>{game.avg ?? 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default BatterGamelog;
