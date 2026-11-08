import React, { useMemo } from 'react';
import SwipeTeamPanel from '../shared/SwipeTeamPanel';
import StatTable from '../shared/StatTable';
import { usePersistentMapEntry } from '../shared/usePersistentState';
import { viewportStyle, sectionTitleStyle, messageStyle } from '../shared/tableStyles';
import { BOX_SCORE_SECTIONS, buildCategoryTable } from './boxScoreColumns';
import { formatPeriod } from '../ScoreBug/ScoreBugs';
import TeamToggle from '../shared/TeamToggle';

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

// withToggle: the Betting panel's BOX SCORE tab. Away / home buttons with
// SCORING PLAYS attached underneath pick what's shown, one at a time.
const BoxScore = ({ game, summaryState, withToggle = false }) => {
  const [showing, setShowing] = usePersistentMapEntry('boxScoreSideByGame', game.id, 'away');
  const [view, setView] = usePersistentMapEntry('boxScoreViewByGame', game.id, 'scoring');
  const { data: summary, loading, error } = summaryState;

  const teamsById = useMemo(
    () => ({
      [game.away?.teamId]: game.away?.team,
      [game.home?.teamId]: game.home?.team,
    }),
    [game],
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
      <StatTable key={section.category} columns={table.columns} rows={table.rows} />
    ));
  };

  if (withToggle) {
    return (
      <div className="box-score-tab">
        <div className="td-team-toggle">
          <TeamToggle
            game={game}
            teamSide={view}
            onChange={setView}
            below={{ key: 'scoring', label: 'SCORING PLAYS' }}
          />
        </div>
        {view === 'scoring' ? (
          summary.scoringPlays.length ? (
            <ScoringPlays summary={summary} teamsById={teamsById} />
          ) : (
            <div style={messageStyle}>No scoring plays yet.</div>
          )
        ) : (
          <div style={viewportStyle}>{renderSide(view, game[view]?.team)}</div>
        )}
      </div>
    );
  }

  return (
    <div>
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
