import React, { useState, useRef } from 'react';

const BoxScore = ({ liveData, gamePk, initialShowing = 'away', onShowingChange }) => {
  const boxscore = liveData?.liveData?.boxscore;
  const away = boxscore?.teams?.away;
  const home = boxscore?.teams?.home;

  const lineupUnavailable = !away?.battingOrder?.length || !home?.battingOrder?.length;

  const formatIP = (ip) => (typeof ip === 'number' ? ip.toFixed(1) : ip);

  const parseInningsPitched = (ipStr) => {
    if (!ipStr || typeof ipStr !== 'string') return 0;
    const [whole, decimal] = ipStr.split('.').map(Number);
    return whole + (decimal === 1 ? 1 / 3 : decimal === 2 ? 2 / 3 : 0);
  };

  const cellStyle = {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '100px',
  };

  const [showing, setShowing] = useState(initialShowing);
  const touchStartX = useRef(null);
  const dragDeltaX = useRef(0);

  const handleSetShowing = (next) => {
    setShowing(next);
    if (onShowingChange) onShowingChange(next);
  };

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    dragDeltaX.current = 0;
  };

  const handleTouchMove = (e) => {
    const currentX = e.touches[0].clientX;
    dragDeltaX.current = currentX - touchStartX.current;

    if (dragDeltaX.current > 30 && showing === 'home') {
      handleSetShowing('away');
      dragDeltaX.current = 0;
    } else if (dragDeltaX.current < -30 && showing === 'away') {
      handleSetShowing('home');
      dragDeltaX.current = 0;
    }
  };

  const handleTouchEnd = () => {
    dragDeltaX.current = 0;
  };

  if (!away || !home || lineupUnavailable) {
    return (
      <div style={{ padding: '1rem', textAlign: 'center', fontStyle: 'italic' }}>
        Lineup not yet available
      </div>
    );
  }

  const renderTeam = (teamData, label) => {
    const players = teamData?.players || {};
    const battingOrder = teamData?.battingOrder || [];
    const pitcherIdsInOrder = teamData?.pitchers || [];

    const allBatters = Object.values(players).filter(p => p?.stats?.batting);
    const batterTotals = allBatters.reduce(
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
        const ip = parseInningsPitched(pitching.inningsPitched);
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

    const averageERA =
      pitcherTotals.ERAList.length > 0
        ? (pitcherTotals.ERAList.reduce((sum, e) => sum + e, 0) / pitcherTotals.ERAList.length).toFixed(2)
        : '—';

    return (
      <div style={{ width: '100%' }}>
        <h3 style={{ textAlign: 'center' }}>{teamData?.team?.name || label}</h3>

        <h3 style={{ fontSize: '12px', width: '100%', margin: '0px', display: 'block' }}>Batters</h3>
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
            {battingOrder.map((id, i) => {
              const starter = players[`ID${id}`];
              const starterStats = starter?.stats?.batting;
              const starterName = starter?.person?.fullName || '—';
              const starterPos = starter?.position?.abbreviation || '—';

              const subs = Object.values(players).filter(
                (p) =>
                  p?.stats?.batting &&
                  p.battingOrder === id &&
                  p.person?.id !== starter?.person?.id
              );

              return (
                <React.Fragment key={id}>
                  {starterStats && (
                    <tr>
                      <td style={{ ...cellStyle, textAlign: 'left' }}>{starterName}</td>
                      <td>{starterPos}</td>
                      <td>{starterStats.atBats ?? 0}</td>
                      <td>{starterStats.runs ?? 0}</td>
                      <td>{starterStats.hits ?? 0}</td>
                      <td>{starterStats.rbi ?? 0}</td>
                      <td>{starterStats.baseOnBalls ?? 0}</td>
                      <td>{starterStats.strikeOuts ?? 0}</td>
                      <td>{starterStats.homeRuns ?? 0}</td>
                    </tr>
                  )}
                  {subs.map((sub, j) => {
                    const s = sub.stats.batting;
                    return (
                      <tr key={`sub-${i}-${j}`}>
                        <td style={{ ...cellStyle, textAlign: 'left', fontStyle: 'italic' }}>
                          — {sub.person?.fullName}
                        </td>
                        <td>{sub.position?.abbreviation || '—'}</td>
                        <td>{s.atBats ?? 0}</td>
                        <td>{s.runs ?? 0}</td>
                        <td>{s.hits ?? 0}</td>
                        <td>{s.rbi ?? 0}</td>
                        <td>{s.baseOnBalls ?? 0}</td>
                        <td>{s.strikeOuts ?? 0}</td>
                        <td>{s.homeRuns ?? 0}</td>
                      </tr>
                    );
                  })}
                </React.Fragment>
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

        <h3 style={{ fontSize: '12px', width: '100%', margin: '0px', display: 'block' }}>Pitchers</h3>
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
              const ip = parseInningsPitched(pitching.inningsPitched);
              const h = pitching.hits ?? 0;
              const er = pitching.earnedRuns ?? 0;
              const k = pitching.strikeOuts ?? 0;
              const bb = pitching.baseOnBalls ?? 0;
              const era = (er / (ip || 1)) * 9;
              return (
                <tr key={i}>
                  <td style={{ ...cellStyle, textAlign: 'left' }}>{name}</td>
                  <td>{formatIP(ip)}</td>
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

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        position: 'relative',
        overflow: 'hidden',
        height: '100%',
      }}
    >
      <button
        onClick={() => handleSetShowing(showing === 'away' ? 'home' : 'away')}
        style={{
          position: 'absolute',
          fontSize: '0.6rem',
          top: '6px',
          right: '1rem',
          background: 'rgba(0,0,0,0.0)',
          color: 'white',
          transform: showing === 'away' ? 'rotate(0deg)' : 'rotate(180deg)',
          transition: 'transform 0.3s',
          border: 'none',
          padding: '4px 8px',
          cursor: 'pointer',
          zIndex: 1,
        }}
      >
        ▶
      </button>

      <div
        style={{
          display: 'flex',
          width: '200%',
          transform: showing === 'away' ? 'translateX(0%)' : 'translateX(-50%)',
          transition: 'transform 0.4s ease',
        }}
      >
        <div style={{ width: '100%' }}>{renderTeam(away, 'Away')}</div>
        <div style={{ width: '100%' }}>{renderTeam(home, 'Home')}</div>
      </div>
    </div>
  );
};

export default BoxScore;
