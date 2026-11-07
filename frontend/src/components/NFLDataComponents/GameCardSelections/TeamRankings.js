import React from 'react';
import { viewportStyle, sectionTitleStyle, messageStyle, sourceNoteStyle } from '../shared/tableStyles';
import { getTeamColor, washOut } from '../shared/teamColors';

// Offense / defense rankings for both teams, styled like the MLB "TEAM STATS" panel.

const rowStyle = {
  display: 'grid',
  gridTemplateColumns: '1fr 36px 72px 36px 1fr',
  alignItems: 'center',
  columnGap: '10px',
  minHeight: '25px',
  padding: '0 10px',
};

const rankStyle = (rank, teamCount) => ({
  color: 'white',
  fontSize: '0.6rem',
  fontWeight: 500,
  justifySelf: 'center',
  width: '32px',
  padding: '1px 0',
  textAlign: 'center',
  borderRadius: '5px',
  fontVariantNumeric: 'tabular-nums',
  background: rank && rank <= 5 ? '#b59841' : rank && rank > teamCount - 5 ? '#9c4848' : 'transparent',
});

const formatValue = (value, metric) => {
  if (value === null || value === undefined) return '—';
  const text = metric.decimals ? value.toFixed(metric.decimals) : String(Math.round(value * 10) / 10);
  const signed = metric.key === 'toDiff' && value > 0 ? `+${text}` : text;
  return `${signed}${metric.suffix || ''}`;
};

const winnerBackground = (winner, team) => {
  const color = getTeamColor(team);
  if (!winner || !color) return {};
  const washed = washOut(color, 0.1);
  return {
    background: `linear-gradient(${winner === 'away' ? 'to right' : 'to left'}, ${washed} 0%, ${washed.replace(
      /[\d.]+\)$/,
      '0.35)'
    )} 6%, rgba(30, 30, 30, 0.55) 45%, transparent 100%)`,
  };
};

const TeamRankings = ({ game, rankings }) => {
  if (!rankings) {
    return (
      <div style={viewportStyle}>
        <div style={messageStyle}>Loading team rankings…</div>
      </div>
    );
  }
  if (rankings.error || !rankings.metrics) {
    return (
      <div style={viewportStyle}>
        <div style={messageStyle}>Team rankings are unavailable right now.</div>
      </div>
    );
  }

  const awayId = game.away?.teamId;
  const homeId = game.home?.teamId;
  const { metrics, values, ranks, teamCount } = rankings;

  const rows = [
    {
      section: 'RECORD',
      key: 'record',
      label: 'RECORD',
      awayDisplay: game.away?.record || '—',
      homeDisplay: game.home?.record || '—',
    },
    ...metrics.map((metric) => {
      const awayRank = ranks[metric.key]?.[awayId] ?? null;
      const homeRank = ranks[metric.key]?.[homeId] ?? null;
      let winner = null;
      if (awayRank && homeRank && awayRank !== homeRank) winner = awayRank < homeRank ? 'away' : 'home';
      return {
        section: metric.section,
        key: metric.key,
        label: metric.label,
        awayDisplay: formatValue(values[metric.key]?.[awayId], metric),
        homeDisplay: formatValue(values[metric.key]?.[homeId], metric),
        awayRank,
        homeRank,
        winner,
      };
    }),
  ];

  return (
    <div style={viewportStyle}>
      {rows.map((row, index) => (
        <React.Fragment key={row.key}>
          {row.section && (
            <div style={{ ...sectionTitleStyle, borderTop: index === 0 ? 'none' : sectionTitleStyle.borderTop }}>
              {row.section}
            </div>
          )}
          <div
            style={{
              ...rowStyle,
              ...winnerBackground(row.winner, row.winner === 'away' ? game.away?.team : game.home?.team),
              borderBottom: index === rows.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div className="ranking-value" style={{ textAlign: 'left' }}>
              {row.awayDisplay}
            </div>
            <div style={rankStyle(row.awayRank, teamCount)}>{row.awayRank ? `#${row.awayRank}` : ''}</div>
            <div className="ranking-label">{row.label}</div>
            <div style={rankStyle(row.homeRank, teamCount)}>{row.homeRank ? `#${row.homeRank}` : ''}</div>
            <div className="ranking-value" style={{ textAlign: 'right' }}>
              {row.homeDisplay}
            </div>
          </div>
        </React.Fragment>
      ))}
      <div style={sourceNoteStyle}>
        {rankings.season} regular season · source: {rankings.source}
      </div>
    </div>
  );
};

export default TeamRankings;
