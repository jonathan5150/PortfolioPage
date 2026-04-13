import React from 'react';
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

const cellStyle = {
  ...tdStyle,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

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
      g?.oppScore ??
      g?.opponentScore ??
      g?.opponent?.score ??
      g?.against ??
      g?.runsAgainst;

    const ts = Number(teamScore);
    const os = Number(oppScore);
    if (!Number.isNaN(ts) && !Number.isNaN(os)) return ts > os ? 'W' : 'L';

    return 'L';
  };

  const renderPitcherGames = (name, games, teamName, isSecondPitcher = false) => {
    const teamColor = teamPrimaryColors[teamName];

    return (
      <div style={{ ...containerStyle }}>
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
              borderRadius: isSecondPitcher ? '0' : '8px 8px 0 0',
              background: teamColor
                ? `linear-gradient(to right, ${teamColor} 25%, transparent), ${teamColor}`
                : undefined,
              backgroundBlendMode: teamColor ? 'screen' : undefined,
              filter: teamColor ? `saturate(${TEAM_SATURATION})` : undefined,
            }}
          >
            {name}
          </h3>
        </div>

        {!Array.isArray(games) || games.length === 0 ? (
          <div
            style={{
              padding: '14px 10px',
              textAlign: 'center',
              color: 'rgba(255,255,255,0.8)',
              fontSize: '0.7rem',
            }}
          >
            No recent starts found.
          </div>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: '18%' }}>DATE</th>
                <th style={{ ...thStyle, width: '16%' }}>OPP</th>
                <th style={{ ...thStyle, width: '12%' }}>IP</th>
                <th style={{ ...thStyle, width: '12%' }}>H</th>
                <th style={{ ...thStyle, width: '12%' }}>ER</th>
                <th style={{ ...thStyle, width: '12%' }}>BB</th>
                <th style={{ ...thStyle, width: '12%' }}>K</th>
                <th style={{ ...thStyle, width: '10%' }}>RES</th>
              </tr>
            </thead>
            <tbody>
              {games.map((g, idx) => {
                const mm = Number(g?.date?.split?.('-')?.[1] || 0);
                const dd = Number(g?.date?.split?.('-')?.[2] || 0);
                const dateStr = mm && dd ? `${mm}/${dd}` : g?.date || '';

                const resChar = computeRes(g);
                const isLastRow = idx === games.length - 1;

                const rowTdStyle = isLastRow
                  ? { ...tdStyle, borderBottom: 'none' }
                  : tdStyle;

                return (
                  <tr key={idx}>
                    <td style={rowTdStyle}>{dateStr}</td>
                    <td style={{ ...cellStyle, borderBottom: rowTdStyle.borderBottom }}>
                      {g?.opponent}
                    </td>
                    <td style={rowTdStyle}>{g?.inningsPitched}</td>
                    <td style={rowTdStyle}>{g?.hits}</td>
                    <td style={rowTdStyle}>{g?.earnedRuns}</td>
                    <td style={rowTdStyle}>{g?.walks}</td>
                    <td style={rowTdStyle}>{g?.strikeouts}</td>
                    <td
                      style={{
                        ...rowTdStyle,
                        color: resChar === 'W' ? '#b59841' : 'rgba(255, 0, 0, 0.6)',
                        whiteSpace: 'nowrap',
                        textAlign: 'center',
                      }}
                    >
                      {resChar}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    );
  };

  const awayName = game?.teams?.away?.probablePitcher?.fullName || 'Away Pitcher';
  const homeName = game?.teams?.home?.probablePitcher?.fullName || 'Home Pitcher';
  const awayTeamName = game?.teams?.away?.team?.name || '';
  const homeTeamName = game?.teams?.home?.team?.name || '';

  return (
    <div style={viewportStyle}>
      <div className="pitcher-last-five-wrapper">
        {renderPitcherGames(awayName, awayGames, awayTeamName, false)}
        {renderPitcherGames(homeName, homeGames, homeTeamName, true)}
      </div>
    </div>
  );
};

export default PitcherLastFive;