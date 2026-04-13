import React, { useState, useRef } from 'react';
import teamPrimaryColors, {
  TEAM_SATURATION,
} from '../MatchupCardComponents/mlbUtils/teamPrimaryColors';

const viewportStyle = {
  width: '100%',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  borderRadius: '8px',
  overflow: 'hidden',
  background: 'rgba(30, 30, 30, 0.55)',
};

const containerStyle = {
  width: '100%',
  background: 'transparent',
};

const sectionTitleStyle = {
  padding: '6px 10px',
  background: 'rgba(255, 255, 255, 0.04)',
  color: 'rgba(255,255,255,0.8)',
  fontSize: '0.63rem',
  fontWeight: 300,
  letterSpacing: '0.08em',
  borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
};

const tableStyle = {
  width: '100%',
  fontSize: '12px',
  borderCollapse: 'collapse',
  tableLayout: 'fixed',
};

const thStyle = {
  padding: '5px 6px',
  fontSize: '0.63rem',
  fontWeight: 600,
  color: 'rgba(255,255,255,0.82)',
  background: 'rgba(255,255,255,0.03)',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
  textAlign: 'center',
};

const tdStyle = {
  padding: '5px 6px',
  color: 'white',
  borderBottom: '1px solid rgba(255,255,255,0.06)',
  textAlign: 'center',
  fontSize: '0.7rem',
};

const totalRowStyle = {
  fontWeight: 700,
  background: 'rgba(255,255,255,0.04)',
};

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
    ...tdStyle,
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
      <div style={viewportStyle}>
        <div
          style={{
            padding: '14px 10px',
            textAlign: 'center',
            color: 'rgba(255,255,255,0.8)',
            fontSize: '0.7rem',
          }}
        >
          Lineup not yet available
        </div>
      </div>
    );
  }

  const renderTeam = (teamData, label) => {
    const players = teamData?.players || {};
    const battingOrder = teamData?.battingOrder || [];
    const bench = teamData?.bench || [];
    const batterIdsFromAPI = teamData?.batters || [];
    const pitcherIdsInOrder = teamData?.pitchers || [];
    const teamName = teamData?.team?.name || label;
    const teamColor = teamPrimaryColors[teamName];

    const displayedPlayers = new Set();

    const renderPlayer = (id, forceRender = false) => {
      if (displayedPlayers.has(id) && !forceRender) return null;

      const player = players[`ID${id}`];
      const playerStats = player?.stats?.batting;
      const playerName = player?.person?.fullName || '—';
      const playerPos = player?.position?.abbreviation || '—';

      if (
        !forceRender &&
        (!playerStats?.atBats &&
          !playerStats?.runs &&
          !playerStats?.hits &&
          !playerStats?.rbi &&
          !playerStats?.baseOnBalls &&
          !playerStats?.strikeOuts &&
          !playerStats?.homeRuns)
      ) {
        return null;
      }

      displayedPlayers.add(id);

      return (
        <tr key={id}>
          <td style={{ ...cellStyle, textAlign: 'left' }}>{playerName}</td>
          <td style={tdStyle}>{playerPos}</td>
          <td style={tdStyle}>{playerStats?.atBats ?? 0}</td>
          <td style={tdStyle}>{playerStats?.runs ?? 0}</td>
          <td style={tdStyle}>{playerStats?.hits ?? 0}</td>
          <td style={tdStyle}>{playerStats?.rbi ?? 0}</td>
          <td style={tdStyle}>{playerStats?.baseOnBalls ?? 0}</td>
          <td style={tdStyle}>{playerStats?.strikeOuts ?? 0}</td>
          <td style={tdStyle}>{playerStats?.homeRuns ?? 0}</td>
        </tr>
      );
    };

    const allBatters = Object.values(players).filter((p) => p?.stats?.batting);

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
        ? (
            pitcherTotals.ERAList.reduce((sum, e) => sum + e, 0) /
            pitcherTotals.ERAList.length
          ).toFixed(2)
        : '—';

    return (
      <div style={containerStyle}>
        <div style={{ position: 'relative', overflow: 'hidden' }}>
          <h3
            style={{
              margin: 0,
              display: 'flex',
              padding: '4px 0',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              zIndex: 2,
              fontWeight: 300,
              lineHeight: 1,
              color: '#fff',
              borderRadius: '8px 8px 0 0',
              background: teamColor
                ? `linear-gradient(to right, ${teamColor} 25%, transparent), ${teamColor}`
                : undefined,
              backgroundBlendMode: teamColor ? 'screen' : undefined,
              filter: teamColor ? `saturate(${TEAM_SATURATION})` : undefined,
            }}
          >
            {teamName}
            <button
              onClick={() => handleSetShowing(showing === 'away' ? 'home' : 'away')}
              style={{
                position: 'absolute',
                right: '0.5rem',
                fontSize: '0.6rem',
                background: 'transparent',
                color: 'white',
                transform: showing === 'away' ? 'scaleX(1)' : 'scaleX(-1)',
                transition: 'transform 0.3s',
                border: 'none',
                cursor: 'pointer',
                marginBottom: '1px',
              }}
            >
              ▶
            </button>
          </h3>
        </div>

        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={{ ...thStyle, textAlign: 'left', width: '40%' }}></th>
              <th style={{ ...thStyle, width: '7.5%' }}>POS</th>
              <th style={{ ...thStyle, width: '7.5%' }}>AB</th>
              <th style={{ ...thStyle, width: '7.5%' }}>R</th>
              <th style={{ ...thStyle, width: '7.5%' }}>H</th>
              <th style={{ ...thStyle, width: '7.5%' }}>RBI</th>
              <th style={{ ...thStyle, width: '7.5%' }}>BB</th>
              <th style={{ ...thStyle, width: '7.5%' }}>SO</th>
              <th style={{ ...thStyle, width: '7.5%' }}>HR</th>
            </tr>
          </thead>
          <tbody>
            {battingOrder.map((id) => renderPlayer(id, true))}
            {bench.map((id) => renderPlayer(id))}
            {batterIdsFromAPI.map((id) => renderPlayer(id))}

            <tr style={totalRowStyle}>
              <td style={{ ...tdStyle, textAlign: 'left', fontWeight: 700 }}>Total</td>
              <td style={tdStyle}>—</td>
              <td style={tdStyle}>{batterTotals.AB}</td>
              <td style={tdStyle}>{batterTotals.R}</td>
              <td style={tdStyle}>{batterTotals.H}</td>
              <td style={tdStyle}>{batterTotals.RBI}</td>
              <td style={tdStyle}>{batterTotals.BB}</td>
              <td style={tdStyle}>{batterTotals.SO}</td>
              <td style={{ ...tdStyle, borderBottom: 'none' }}>{batterTotals.HR}</td>
            </tr>
          </tbody>
        </table>

        <div style={sectionTitleStyle}>PITCHING</div>

        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={{ ...thStyle, textAlign: 'left', width: '40%' }}></th>
              <th style={{ ...thStyle, width: '10%' }}>IP</th>
              <th style={{ ...thStyle, width: '10%' }}>H</th>
              <th style={{ ...thStyle, width: '10%' }}>ER</th>
              <th style={{ ...thStyle, width: '10%' }}>K</th>
              <th style={{ ...thStyle, width: '10%' }}>BB</th>
              <th style={{ ...thStyle, width: '10%' }}>ERA</th>
            </tr>
          </thead>
          <tbody>
            {pitchers.map((p, i) => {
              const pitching = p.stats?.pitching;
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
                  <td style={tdStyle}>{formatIP(ip)}</td>
                  <td style={tdStyle}>{h}</td>
                  <td style={tdStyle}>{er}</td>
                  <td style={tdStyle}>{k}</td>
                  <td style={tdStyle}>{bb}</td>
                  <td style={tdStyle}>{era.toFixed(2)}</td>
                </tr>
              );
            })}

            <tr style={totalRowStyle}>
              <td style={{ ...tdStyle, textAlign: 'left', fontWeight: 700, borderBottom: 'none' }}>
                Total
              </td>
              <td style={{ ...tdStyle, borderBottom: 'none' }}>{formatIP(pitcherTotals.IP)}</td>
              <td style={{ ...tdStyle, borderBottom: 'none' }}>{pitcherTotals.H}</td>
              <td style={{ ...tdStyle, borderBottom: 'none' }}>{pitcherTotals.ER}</td>
              <td style={{ ...tdStyle, borderBottom: 'none' }}>{pitcherTotals.K}</td>
              <td style={{ ...tdStyle, borderBottom: 'none' }}>{pitcherTotals.BB}</td>
              <td style={{ ...tdStyle, borderBottom: 'none' }}>{averageERA}</td>
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
        height: '100%',
      }}
    >
      <div style={viewportStyle}>
        <div
          style={{
            display: 'flex',
            width: '200%',
            transform: showing === 'away' ? 'translateX(0%)' : 'translateX(-50%)',
            transition: 'transform 0.4s ease',
          }}
        >
          <div
            style={{
              flex: '0 0 50%',
              maxWidth: '50%',
              minWidth: '50%',
            }}
          >
            {renderTeam(away, 'Away')}
          </div>

          <div
            style={{
              flex: '0 0 50%',
              maxWidth: '50%',
              minWidth: '50%',
            }}
          >
            {renderTeam(home, 'Home')}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BoxScore;