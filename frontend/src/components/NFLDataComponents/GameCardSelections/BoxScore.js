import React, { useMemo } from 'react';
import SwipeTeamPanel from '../shared/SwipeTeamPanel';
import StatTable from '../shared/StatTable';
import { usePersistentMapEntry } from '../shared/usePersistentState';
import { viewportStyle, sectionTitleStyle, messageStyle } from '../shared/tableStyles';
import { getTeamColor, washOut } from '../shared/teamColors';
import { BOX_SCORE_SECTIONS, TEAM_STAT_ROWS, buildCategoryTable } from './boxScoreColumns';
import { formatPeriod } from '../ScoreBug/ScoreBugs';

const leadingNumber = (displayValue) => {
  if (displayValue === null || displayValue === undefined) return null;
  const str = String(displayValue);
  // "7-14" (3rd down), "6-45" (penalties): compare conversions/count
  // "31:20" (possession): compare minutes
  const timeMatch = str.match(/^(\d+):(\d+)$/);
  if (timeMatch) return Number(timeMatch[1]) * 60 + Number(timeMatch[2]);
  const n = parseFloat(str);
  return Number.isFinite(n) ? n : null;
};

const comparisonGradient = (winnerSide, team) => {
  const color = getTeamColor(team);
  if (!winnerSide || !color) return {};
  const washed = washOut(color, 0.1);
  const direction = winnerSide === 'away' ? 'to right' : 'to left';
  return {
    background: `linear-gradient(${direction}, ${washed} 0%, ${washed.replace(/[\d.]+\)$/, '0.3)')} 8%, rgba(30,30,30,0.55) 45%, transparent 100%)`,
  };
};

const TeamComparison = ({ summary }) => {
  const away = summary.teamStats.find((t) => t.homeAway === 'away') || summary.teamStats[0];
  const home = summary.teamStats.find((t) => t.homeAway === 'home') || summary.teamStats[1];
  if (!away || !home) return null;

  const valueOf = (teamStats, name) => teamStats.stats.find((s) => s.name === name)?.displayValue;

  const rows = TEAM_STAT_ROWS.map((row) => ({
    ...row,
    away: valueOf(away, row.name),
    home: valueOf(home, row.name),
  })).filter((row) => row.away !== undefined || row.home !== undefined);

  return (
    <div style={{ ...viewportStyle, marginBottom: '6px' }}>
      <div style={{ ...sectionTitleStyle, borderTop: 'none', display: 'flex', justifyContent: 'space-between' }}>
        <span>{away.team?.abbreviation}</span>
        <span>TEAM STATS</span>
        <span>{home.team?.abbreviation}</span>
      </div>
      {rows.map((row, i) => {
        const a = leadingNumber(row.away);
        const h = leadingNumber(row.home);
        let winner = null;
        if (a !== null && h !== null && a !== h) {
          const awayBetter = row.lowerIsBetter ? a < h : a > h;
          winner = awayBetter ? 'away' : 'home';
        }
        const winnerTeam = winner === 'away' ? away.team : winner === 'home' ? home.team : null;

        return (
          <div
            key={row.name}
            className="comparison-row"
            style={{
              ...comparisonGradient(winner, winnerTeam),
              borderBottom: i === rows.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div style={{ textAlign: 'left' }}>{row.away ?? '—'}</div>
            <div className="comparison-label">{row.label}</div>
            <div style={{ textAlign: 'right' }}>{row.home ?? '—'}</div>
          </div>
        );
      })}
    </div>
  );
};

const ScoringPlays = ({ summary, teamsById }) => {
  if (!summary.scoringPlays.length) return null;
  return (
    <div style={{ ...viewportStyle, marginTop: '6px' }}>
      <div style={{ ...sectionTitleStyle, borderTop: 'none' }}>SCORING PLAYS</div>
      {summary.scoringPlays.map((play) => (
        <div key={play.id || play.text} className="scoring-play">
          <span className="scoring-play-meta">
            {play.period ? formatPeriod(play.period) : ''} {play.clock}
          </span>
          <span className="scoring-play-team">{teamsById[play.teamId]?.abbreviation || play.type}</span>
          <span className="scoring-play-text" title={play.text}>
            {play.text}
          </span>
          <span className="scoring-play-score">
            {play.awayScore}-{play.homeScore}
          </span>
        </div>
      ))}
    </div>
  );
};

const BoxScore = ({ game, summaryState }) => {
  const [showing, setShowing] = usePersistentMapEntry('boxScoreSideByGame', game.id, 'away');
  const { data: summary, loading, error } = summaryState;

  const teamsById = useMemo(
    () => ({
      [game.away?.teamId]: game.away?.team,
      [game.home?.teamId]: game.home?.team,
    }),
    [game]
  );

  if (game.status.state === 'pre') {
    return (
      <div style={viewportStyle}>
        <div style={messageStyle}>Box score will be available at kickoff.</div>
      </div>
    );
  }
  if (loading && !summary) {
    return (
      <div style={viewportStyle}>
        <div style={messageStyle}>Loading box score…</div>
      </div>
    );
  }
  if (!summary) {
    return (
      <div style={viewportStyle}>
        <div style={messageStyle}>{error ? 'Box score unavailable right now.' : 'Box score not yet available.'}</div>
      </div>
    );
  }

  const renderSide = (side, team) => {
    const playerData = summary.players[game[side]?.teamId];
    const sections = BOX_SCORE_SECTIONS.map((section) => {
      const category = playerData?.categories?.[section.category];
      if (!category || !category.athletes.length) return null;
      return { section, table: buildCategoryTable(category, section) };
    }).filter(Boolean);

    if (!sections.length) {
      return <div style={messageStyle}>No player stats yet for {team?.abbreviation}.</div>;
    }

    return sections.map(({ section, table }) => (
      <StatTable
        key={section.category}
        columns={table.columns}
        rows={table.rows}
        totals={section.category === 'passing' || section.category === 'rushing' || section.category === 'receiving' ? table.totals : null}
      />
    ));
  };

  return (
    <div>
      <TeamComparison summary={summary} />
      <SwipeTeamPanel
        awayTeam={game.away?.team}
        homeTeam={game.home?.team}
        showing={showing}
        onShowingChange={setShowing}
        renderSide={renderSide}
      />
      <ScoringPlays summary={summary} teamsById={teamsById} />
    </div>
  );
};

export default BoxScore;
