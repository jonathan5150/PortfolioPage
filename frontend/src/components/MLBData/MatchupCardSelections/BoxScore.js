import React from 'react';

const BoxScore = ({ liveData }) => {
  const boxscore = liveData?.liveData?.boxscore;

  const away = boxscore?.teams?.away;
  const home = boxscore?.teams?.home;

  const renderTeam = (teamData, label) => {
    const players = teamData?.players || {};
    const battingOrder = teamData?.battingOrder || [];
    const pitcherIdsInOrder = teamData?.pitchers || [];

    const batters = battingOrder
      .map((id) => players[`ID${id}`])
      .filter((p) => p && p.stats?.batting);

    const batterTotals = batters.reduce(
      (totals, p) => {
        const b = p.stats.batting;
        return {
          AB: totals.AB + (b.atBats || 0),
          R: totals.R + (b.runs || 0),
          H: totals.H + (b.hits || 0),
          RBI: totals.RBI + (b.rbi || 0),
          BB: totals.BB + (b.baseOnBalls || 0),
          SO: totals.SO + (b.strikeOuts || 0),
          HR: totals.HR + (b.homeRuns || 0),
        };
      },
      { AB: 0, R: 0, H: 0, RBI: 0, BB: 0, SO: 0, HR: 0 }
    );

    const pitchers = pitcherIdsInOrder
      .map((id) => players[`ID${id}`])
      .filter((p) => p && p.stats?.pitching);

    const pitcherTotals = pitchers.reduce(
      (totals, p) => {
        const pitching = p.stats.pitching;
        const ip = parseFloat(pitching.inningsPitched || 0);
        const hits = pitching.hits || 0;
        const er = pitching.earnedRuns || 0;
        const so = pitching.strikeOuts || 0;
        const bb = pitching.baseOnBalls || 0;
        const era = (er / (ip || 1)) * 9;

        return {
          IP: totals.IP + ip,
          H: totals.H + hits,
          ER: totals.ER + er,
          K: totals.K + so,
          BB: totals.BB + bb,
          ERAList: [...totals.ERAList, era],
        };
      },
      { IP: 0, H: 0, ER: 0, K: 0, BB: 0, ERAList: [] }
    );

    const formatIP = (ip) => (typeof ip === 'number' ? ip.toFixed(1) : ip);
    const averageERA =
      pitcherTotals.ERAList.length > 0
        ? (pitcherTotals.ERAList.reduce((sum, e) => sum + e, 0) / pitcherTotals.ERAList.length).toFixed(2)
        : '—';

    const cellStyle = {
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      maxWidth: '100px',
    };

    return (
      <div style={{ width: '100%' }}>
        <h3 style={{ textAlign: 'center' }}>{teamData?.team?.name || label}</h3>

        <h3 style={{ fontSize: '12px', width: '100%', margin: '0px' }}>Batters</h3>
        <table style={{ width: '100%', fontSize: '12px' }}>
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
            {batters.map((p, i) => {
              const b = p.stats.batting;
              const name = p.person?.fullName || '—';
              const pos = p.position?.abbreviation || '—';
              return (
                <tr key={i}>
                  <td style={{ ...cellStyle, textAlign: 'left' }}>{name}</td>
                  <td>{pos}</td>
                  <td>{b.atBats ?? 0}</td>
                  <td>{b.runs ?? 0}</td>
                  <td>{b.hits ?? 0}</td>
                  <td>{b.rbi ?? 0}</td>
                  <td>{b.baseOnBalls ?? 0}</td>
                  <td>{b.strikeOuts ?? 0}</td>
                  <td>{b.homeRuns ?? 0}</td>
                </tr>
              );
            })}
            <tr style={{ fontWeight: 'bold', borderTop: '1px solid #ccc' }}>
              <td style={{ textAlign: 'left' }}>Total</td>
              <td>—</td>
              <td>{batterTotals.AB}</td>
              <td>{batterTotals.R}</td>
              <td>{batterTotals.H}</td>
              <td>{batterTotals.RBI}</td>
              <td>{batterTotals.BB}</td>
              <td>{batterTotals.SO}</td>
              <td>{batterTotals.HR}</td>
            </tr>
          </tbody>
        </table>

        <h3 style={{ fontSize: '12px', width: '100%', margin: '0px' }}>Pitchers</h3>
        <table style={{ width: '100%', fontSize: '12px' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', width: '30%' }}>Name</th>
              <th style={{ width: '11%' }}>IP</th>
              <th style={{ width: '11%' }}>H</th>
              <th style={{ width: '11%' }}>ER</th>
              <th style={{ width: '11%' }}>K</th>
              <th style={{ width: '11%' }}>BB</th>
              <th style={{ width: '15%' }}>ERA</th>
            </tr>
          </thead>
          <tbody>
            {pitchers.map((p, i) => {
              const pitching = p.stats.pitching;
              const name = p.person?.fullName || '—';
              const ip = pitching.inningsPitched || '0.0';
              const h = pitching.hits ?? 0;
              const er = pitching.earnedRuns ?? 0;
              const k = pitching.strikeOuts ?? 0;
              const bb = pitching.baseOnBalls ?? 0;
              const era = (er / (parseFloat(ip || 1))) * 9;
              return (
                <tr key={i}>
                  <td style={{ ...cellStyle, textAlign: 'left' }}>{name}</td>
                  <td>{ip}</td>
                  <td>{h}</td>
                  <td>{er}</td>
                  <td>{k}</td>
                  <td>{bb}</td>
                  <td>{era.toFixed(2)}</td>
                </tr>
              );
            })}
            <tr style={{ fontWeight: 'bold', borderTop: '1px solid #ccc' }}>
              <td style={{ textAlign: 'left' }}>Total</td>
              <td>{formatIP(pitcherTotals.IP)}</td>
              <td>{pitcherTotals.H}</td>
              <td>{pitcherTotals.ER}</td>
              <td>{pitcherTotals.K}</td>
              <td>{pitcherTotals.BB}</td>
              <td>{averageERA}</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  if (!away || !home) {
    return <p style={{ fontStyle: 'italic', color: '#888' }}>Box score not yet available.</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {renderTeam(away, 'Away')}
      {renderTeam(home, 'Home')}
    </div>
  );
};

export default BoxScore;
