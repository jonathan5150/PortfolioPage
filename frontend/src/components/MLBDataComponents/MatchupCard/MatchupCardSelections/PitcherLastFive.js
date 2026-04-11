import React from 'react';

const PitcherLastFive = ({ game, awayGames = [], homeGames = [] }) => {
  const computeRes = (g) => {
    let r = String(g?.result ?? '').trim().toUpperCase();
    if (r === 'W' || r === 'L') return r;

    if (g?.isWin === true) return 'W';
    if (g?.isLoss === true) return 'L';

    const dec = String(g?.decision ?? '').trim().toUpperCase();
    if (dec === 'W' || dec === 'L') return dec;

    const statDec = String(g?.stat?.decision ?? '').trim().toUpperCase();
    if (statDec === 'W' || statDec === 'L') return statDec;

    const teamScore =
      g?.teamScore ?? g?.team_score ?? g?.team?.score ?? g?.for ?? g?.runsFor;
    const oppScore =
      g?.oppScore ?? g?.opponentScore ?? g?.opponent?.score ?? g?.against ?? g?.runsAgainst;

    const ts = Number(teamScore);
    const os = Number(oppScore);
    if (!Number.isNaN(ts) && !Number.isNaN(os)) return ts > os ? 'W' : 'L';

    // Default to "L" (red) if undetermined
    return 'L';
  };

  const renderPitcherGames = (name, games) => (
    <div className="pitcher-block">
      <h3 style={{ margin: '6px 0' }}>{name}</h3>
      {(!Array.isArray(games) || games.length === 0) ? (
        <p style={{ margin: 0 }}>No recent starts found.</p>
      ) : (
        <table style={{ fontSize: '12px', width: '100%', tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th style={{ width: '18%' }}>DATE</th>
              <th style={{ width: '16%' }}>OPP</th>
              <th style={{ width: '12%' }}>IP</th>
              <th style={{ width: '12%' }}>H</th>
              <th style={{ width: '12%' }}>ER</th>
              <th style={{ width: '12%' }}>BB</th>
              <th style={{ width: '12%' }}>K</th>
              <th style={{ width: '10%' }}>RES</th>
            </tr>
          </thead>
          <tbody>
            {games.map((g, idx) => {
              const mm = Number(g?.date?.split?.('-')?.[1] || 0);
              const dd = Number(g?.date?.split?.('-')?.[2] || 0);
              const dateStr = mm && dd ? `${mm}/${dd}` : g?.date || '';

              const resChar = computeRes(g);

              const resultStyle = {
                color:
                  resChar === 'W'
                    ? 'rgba(0, 155, 0, 0.6)'
                    : 'rgba(255, 0, 0, 0.6)', // always red otherwise
                whiteSpace: 'nowrap',
                textAlign: 'center',
              };

              return (
                <tr key={idx}>
                  <td>{dateStr}</td>
                  <td>{g?.opponent}</td>
                  <td>{g?.inningsPitched}</td>
                  <td>{g?.hits}</td>
                  <td>{g?.earnedRuns}</td>
                  <td>{g?.walks}</td>
                  <td>{g?.strikeouts}</td>
                  <td style={resultStyle}>{resChar}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );

  const awayName = game?.teams?.away?.probablePitcher?.fullName || 'Away Pitcher';
  const homeName = game?.teams?.home?.probablePitcher?.fullName || 'Home Pitcher';

  return (
    <div className="pitcher-last-five-wrapper">
      {renderPitcherGames(awayName, awayGames)}
      {renderPitcherGames(homeName, homeGames)}
    </div>
  );
};

export default PitcherLastFive;
