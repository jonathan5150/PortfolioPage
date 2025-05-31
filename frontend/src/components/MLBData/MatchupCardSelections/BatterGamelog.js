import React, { useEffect, useState } from 'react';

const BatterGamelog = ({
  team,
  teamType,
  gameDate,
  getTeamAbbreviation,
  showGameCountSelector,
  numGamesToShow,
  setNumGamesToShow,
  batterLogs = {}
}) => {
  const [playerLogs, setPlayerLogs] = useState({});
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [roster, setRoster] = useState([]);

  useEffect(() => {
    let isMounted = true;

    const fetchBatterGameLog = async (playerId) => {
      try {
        const url = `https://statsapi.mlb.com/api/v1/people/${playerId}/stats?stats=gameLog&group=hitting&season=2025`;
        const res = await fetch(url);
        const data = await res.json();
        const splits = data.stats?.[0]?.splits || [];

        const beforeDay = new Date(gameDate).toISOString().split('T')[0];

        const filtered = splits
          .filter((game) => game.date < beforeDay)
          .sort((a, b) => new Date(b.date) - new Date(a.date));

        return filtered.map((game) => ({
          date: game.date,
          opponent: getTeamAbbreviation(game.opponent?.id) || 'N/A',
          atBats: game.stat?.atBats ?? 'N/A',
          runs: game.stat?.runs ?? 'N/A',
          hits: game.stat?.hits ?? 'N/A',
          rbi: game.stat?.rbi ?? 'N/A',
          baseOnBalls: game.stat?.baseOnBalls ?? 'N/A',
          strikeOuts: game.stat?.strikeOuts ?? 'N/A',
          homeRuns: game.stat?.homeRuns ?? 'N/A',
          stolenBases: game.stat?.stolenBases ?? 'N/A',
          avg: game.stat?.avg ?? 'N/A',
        }));
      } catch (err) {
        console.error(`Error fetching log for player ${playerId}`, err);
        return [];
      }
    };

    const loadBatterLogs = async () => {
      const logs = {};
      const homeRunLeaders = [];

      try {
        const res = await fetch(`https://statsapi.mlb.com/api/v1/teams/${team.id}/roster/40Man`);
        const data = await res.json();
        const batters = data.roster;

        if (!isMounted) return;
        setRoster(batters);

        await Promise.all(
          batters.map(async (batter) => {
            const fullName = batter.person.fullName;
            const gameLog = await fetchBatterGameLog(batter.person.id);
            logs[fullName] = gameLog;

            const totalHRs = gameLog.reduce((sum, g) => {
              const val = parseInt(g.homeRuns);
              return sum + (isNaN(val) ? 0 : val);
            }, 0);

            homeRunLeaders.push({ name: fullName, homeRuns: totalHRs });
          })
        );

        if (!isMounted) return;

        homeRunLeaders.sort((a, b) => b.homeRuns - a.homeRuns);
        setPlayerLogs(logs);

      } catch (err) {
        console.error('Error loading batter logs for team:', team.name, err);
      }
    };

    loadBatterLogs();
    return () => {
      isMounted = false;
    };
  }, [team, gameDate, getTeamAbbreviation]);

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
        <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', textAlign: 'center' }}>
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
                <option key={player.person.id} value={player.person.fullName}>
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
              <th style={{ width: '8%' }}>AB</th>
              <th style={{ width: '8%' }}>R</th>
              <th style={{ width: '8%' }}>H</th>
              <th style={{ width: '8%' }}>RBI</th>
              <th style={{ width: '8%' }}>BB</th>
              <th style={{ width: '8%' }}>SO</th>
              <th style={{ width: '8%' }}>HR</th>
              <th style={{ width: '8%' }}>SB</th>
              <th style={{ width: '10%' }}>AVG</th>
            </tr>
          </thead>
          <tbody>
            {games.map((game, idx) => (
              <tr key={idx}>
                <td>{`${parseInt(game.date.split('-')[1])}/${parseInt(game.date.split('-')[2])}`}</td>
                <td>{game.opponent}</td>
                <td>{game.atBats}</td>
                <td>{game.runs}</td>
                <td>{game.hits}</td>
                <td>{game.rbi}</td>
                <td>{game.baseOnBalls}</td>
                <td>{game.strikeOuts}</td>
                <td>{game.homeRuns}</td>
                <td>{game.stolenBases}</td>
                <td>{game.avg}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default BatterGamelog;
