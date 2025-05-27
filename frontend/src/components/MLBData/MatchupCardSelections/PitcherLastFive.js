// MatchupCardSelections/PitcherLastFive.js
import React, { useEffect, useState } from 'react';

const fetchPitcherGameLog = async (playerId, getTeamAbbreviation, beforeDate) => {
  try {
    const url = `https://statsapi.mlb.com/api/v1/people/${playerId}/stats?stats=gameLog&group=pitching&season=2025`;
    const res = await fetch(url);
    const data = await res.json();
    const splits = data.stats?.[0]?.splits || [];

    const beforeDay = new Date(beforeDate).toISOString().split('T')[0];

    const filtered = splits
      .filter(game => game.date < beforeDay)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5);

    return filtered.map((game) => ({
      date: game.date,
      opponent: getTeamAbbreviation(game.opponent?.id) || 'N/A',
      inningsPitched: game.stat?.inningsPitched ?? 'N/A',
      hits: game.stat?.hits ?? 'N/A',
      earnedRuns: game.stat?.earnedRuns ?? 'N/A',
      walks: game.stat?.baseOnBalls ?? 'N/A',
      strikeouts: game.stat?.strikeOuts ?? 'N/A',
      result: game.isWin === true ? 'W' : game.isWin === false ? 'L' : 'ND',
    }));
  } catch (err) {
    console.error('Error fetching pitcher game log:', err);
    return [];
  }
};

const PitcherLastFive = ({ game, getTeamAbbreviation }) => {
  const [awayPitcherGames, setAwayPitcherGames] = useState([]);
  const [homePitcherGames, setHomePitcherGames] = useState([]);

  useEffect(() => {
    const loadGameLogs = async () => {
      if (game.teams.away.probablePitcher?.id) {
        const games = await fetchPitcherGameLog(
          game.teams.away.probablePitcher.id,
          getTeamAbbreviation,
          game.gameDate
        );
        setAwayPitcherGames(games);
      }
      if (game.teams.home.probablePitcher?.id) {
        const games = await fetchPitcherGameLog(
          game.teams.home.probablePitcher.id,
          getTeamAbbreviation,
          game.gameDate
        );
        setHomePitcherGames(games);
      }
    };
    loadGameLogs();
  }, [game, getTeamAbbreviation]);

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
      {renderPitcherGames(game.teams.away.probablePitcher?.fullName || 'Away Pitcher', awayPitcherGames)}
      {renderPitcherGames(game.teams.home.probablePitcher?.fullName || 'Home Pitcher', homePitcherGames)}
    </div>
  );
};

export default PitcherLastFive;
