import React from 'react';

const BoxScore = ({ liveData }) => {
  const boxscore = liveData?.liveData?.boxscore;

  const away = boxscore?.teams?.away;
  const home = boxscore?.teams?.home;

  console.log(boxscore);

  const renderTeam = (teamData, label) => {
    const players = teamData?.players || {};
    const battingOrder = teamData?.battingOrder || [];
    const playerList = battingOrder
      .map((id) => players[`ID${id}`])
      .filter((p) => p && p.stats?.batting);

    return (
      <div style={{ width: '100%' }}>
        <h4 style={{ textAlign: 'center' }}>{teamData?.team?.name || label}</h4>
        <table style={{ width: '100%', fontSize: '12px', marginBottom: '1rem' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', width: '30%' }}>Player</th>
              <th style={{ width: '8.75%' }}>POS</th>
              <th style={{ width: '8.75%' }}>AB</th>
              <th style={{ width: '8.75%' }}>R</th>
              <th style={{ width: '8.75%' }}>H</th>
              <th style={{ width: '8.75%' }}>RBI</th>
              <th style={{ width: '8.75%' }}>BB</th>
              <th style={{ width: '8.75%' }}>SO</th>
              <th style={{ width: '8.75%' }}>HR</th>
            </tr>
          </thead>
          <tbody>
            {playerList.map((p, i) => {
              const batting = p.stats.batting;
              const pos = p.position?.abbreviation || '—';
              const name = p.person?.fullName || '—';
              return (
                <tr key={i}>
                  <td style={{ textAlign: 'left', width: '40%' }}>{name}</td>
                  <td style={{ width: '7%' }}>{pos}</td>
                  <td style={{ width: '7%' }}>{batting.atBats ?? 0}</td>
                  <td style={{ width: '7%' }}>{batting.runs ?? 0}</td>
                  <td style={{ width: '7%' }}>{batting.hits ?? 0}</td>
                  <td style={{ width: '7%' }}>{batting.rbi ?? 0}</td>
                  <td style={{ width: '7%' }}>{batting.baseOnBalls ?? 0}</td>
                  <td style={{ width: '7%' }}>{batting.strikeOuts ?? 0}</td>
                  <td style={{ width: '7%' }}>{batting.homeRuns ?? 0}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  if (!away || !home) {
    return <p style={{ fontStyle: 'italic', color: '#888' }}>Box score not yet available.</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {renderTeam(away, 'Away')}
      {renderTeam(home, 'Home')}
    </div>
  );
};

export default BoxScore;
