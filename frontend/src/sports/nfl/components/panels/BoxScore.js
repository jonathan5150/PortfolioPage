import React, { useMemo, useState } from 'react';
import SwipeTeamPanel from '../table/SwipeTeamPanel';
import StatTable from '../table/StatTable';
import { viewportStyle, sectionTitleStyle, messageStyle } from '../table/tableStyles';
import { BOX_SCORE_SECTIONS, buildCategoryTable } from './boxScoreColumns';
import { formatPeriod } from '../ScoreBugs';
import TeamToggle from '../../../shared/components/TeamToggle';
import { getTeamTextColor } from '../../../shared/utils/teamColors';

const ScoringPlays = ({ summary, teamsById }) => {
  if (!summary.scoringPlays.length) return null;
  // which side's number went up on each play (compared with the play before),
  // so that number can be shown in the scoring team's colour
  let prev = { away: 0, home: 0 };
  const plays = summary.scoringPlays.map((play) => {
    const away = Number(play.awayScore) || 0;
    const home = Number(play.homeScore) || 0;
    const side = away > prev.away ? 'away' : home > prev.home ? 'home' : null;
    prev = { away, home };
    return { play, side };
  });
  return (
    <div style={{ ...viewportStyle, marginTop: '6px' }}>
      <div style={{ ...sectionTitleStyle, borderTop: 'none' }}>SCORING PLAYS</div>
      {plays.map(({ play, side }) => {
        const teamColor = teamsById[play.teamId] ? getTeamTextColor(teamsById[play.teamId]) : undefined;
        return (
          <div key={play.id || play.text} className="scoring-play">
            <span className="scoring-play-meta">
              {play.period ? formatPeriod(play.period) : ''} {play.clock}
            </span>
            {/* the scoring team's abbreviation in a vivid team colour, readable on the dark rows */}
            <span className="scoring-play-team" style={teamColor ? { color: teamColor } : undefined}>
              {teamsById[play.teamId]?.abbreviation || play.type}
            </span>
            <span className="scoring-play-text" title={play.text}>
              {play.text}
            </span>
            {/* the scoring team's new score in its colour, like its abbreviation */}
            <span className="scoring-play-score">
              <span style={side === 'away' && teamColor ? { color: teamColor } : undefined}>{play.awayScore}</span>-
              <span style={side === 'home' && teamColor ? { color: teamColor } : undefined}>{play.homeScore}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
};

// withToggle: the Betting panel's BOX SCORE tab. Away / home buttons with
// SCORING PLAYS attached underneath pick what's shown, one at a time.
const BoxScore = ({ game, summaryState, withToggle = false }) => {
  const [showing, setShowing] = useState('away');
  // SCORING PLAYS every time the game is opened (the panel remounts this on open)
  const [view, setView] = useState('scoring');
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
            filled
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
