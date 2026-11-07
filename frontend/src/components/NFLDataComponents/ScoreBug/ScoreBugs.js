import React from 'react';
import TeamCell, { useLongPress } from './TeamCell';
import Linescore from './Linescore';

// Three score bug variants, matching the MLB app's Before / Live / After bugs.

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  cursor: 'pointer',
  userSelect: 'none',
  WebkitUserSelect: 'none',
  WebkitTapHighlightColor: 'transparent',
};

const infoBoxStyle = (corner) => ({
  margin: '2px',
  border: '2px solid #555',
  backgroundColor: 'rgba(70,70,70,1)',
  borderRadius: corner === 'left' ? '0 0 0 6px' : '0 0 6px 0',
  padding: '5px 6px',
  color: '#fff',
  fontSize: '11px',
  lineHeight: 1.3,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  minHeight: '44px',
  minWidth: 0,
});

const LinescoreDrawer = ({ game, open }) => (
  <div
    style={{
      gridColumn: '1 / span 2',
      overflow: 'hidden',
      padding: open ? '2px 2px 3px' : '0 5px',
      maxHeight: open ? '120px' : '0px',
      opacity: open ? 1 : 0,
      transition: 'max-height 0.6s ease, opacity 0.45s ease, padding 0.4s ease',
    }}
  >
    <Linescore game={game} />
  </div>
);

const ordinal = (n) => (n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`);
export const formatPeriod = (period) => (period > 4 ? (period === 5 ? 'OT' : `${period - 4}OT`) : `Q${period}`);

const passingLeader = (competitor) => competitor?.leaders?.find((l) => /passing/i.test(l.category));

// ---------- Pre-game ----------

export const PreGameScoreBug = ({ game, starredTeamId, onStar, onToggle }) => {
  const longPress = useLongPress(onStar);
  const kickoff = game.date
    ? new Date(game.date).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })
    : 'TBD';

  const renderQbBox = (competitor, corner) => {
    const qb = passingLeader(competitor);
    return (
      <div style={infoBoxStyle(corner)}>
        {qb ? (
          <>
            <div className="ellipsis">
              <b>QB:</b> {qb.athleteFullName || qb.athleteName}
            </div>
            <div className="ellipsis" style={{ opacity: 0.85 }}>{qb.value}</div>
          </>
        ) : (
          <div className="ellipsis">
            <b>QB:</b> N/A
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className="score-grid"
      onClick={onToggle}
      onClickCapture={longPress.suppressClick}
      style={{ ...gridStyle, position: 'relative', paddingTop: '19px' }}
    >
      <div className="kickoff-tab">
        {game.status.isPostponed ? game.status.shortDetail : kickoff}
        {game.broadcast ? ` · ${game.broadcast}` : ''}
        {game.odds?.details ? ` · ${game.odds.details}` : ''}
      </div>

      {['away', 'home'].map((side) => (
        <TeamCell
          key={side}
          side={side}
          competitor={game[side]}
          score="-"
          isStarred={starredTeamId === game[side]?.teamId}
          longPress={longPress}
        />
      ))}
      {renderQbBox(game.away, 'left')}
      {renderQbBox(game.home, 'right')}
    </div>
  );
};

// ---------- Live ----------

const TimeoutDots = ({ remaining }) => (
  <span className="timeout-dots" aria-label={`${remaining ?? 0} timeouts left`}>
    {[0, 1, 2].map((i) => (
      <span key={i} className={`timeout-dot ${i < (remaining ?? 0) ? 'on' : ''}`} />
    ))}
  </span>
);

export const LiveScoreBug = ({ game, starredTeamId, onStar, onToggle, showLinescore }) => {
  const longPress = useLongPress(onStar);
  const s = game.situation;
  const status = game.status;

  const downText =
    s?.shortDownDistanceText ||
    s?.downDistanceText ||
    (s?.down ? `${ordinal(s.down)} & ${s.distance}` : status.isHalftime ? 'Halftime' : status.shortDetail);

  return (
    <div
      className="score-grid"
      onClick={onToggle}
      onClickCapture={longPress.suppressClick}
      style={gridStyle}
    >
      {['away', 'home'].map((side) => (
        <TeamCell
          key={side}
          side={side}
          competitor={game[side]}
          score={game[side]?.score ?? 0}
          isStarred={starredTeamId === game[side]?.teamId}
          hasPossession={s?.possessionTeamId && s.possessionTeamId === game[side]?.teamId}
          longPress={longPress}
        />
      ))}

      <div style={{ ...infoBoxStyle('left'), textAlign: 'left', paddingLeft: '10px' }}>
        <div className="ellipsis" style={{ fontWeight: 700 }}>
          {downText}
          {s?.possessionText ? ` · ${s.possessionText}` : ''}
          {s?.isRedZone && <span className="red-zone-tag">RZ</span>}
        </div>
        <div className="ellipsis last-play" title={s?.lastPlay || ''}>
          {s?.lastPlay || ' '}
        </div>
      </div>

      <div style={{ ...infoBoxStyle('right'), alignItems: 'center' }}>
        <div style={{ fontWeight: 700, fontSize: '13px' }}>
          <span className="live-indicator">●</span>{' '}
          {status.isHalftime ? 'HALF' : `${formatPeriod(status.period)} ${status.displayClock}`}
        </div>
        <div className="timeouts-row">
          <span>{game.away?.team?.abbreviation}</span>
          <TimeoutDots remaining={s?.awayTimeouts} />
          <TimeoutDots remaining={s?.homeTimeouts} />
          <span>{game.home?.team?.abbreviation}</span>
        </div>
      </div>

      <LinescoreDrawer game={game} open={showLinescore} />
    </div>
  );
};

// ---------- Final ----------

export const FinalScoreBug = ({ game, starredTeamId, onStar, onToggle, showLinescore }) => {
  const longPress = useLongPress(onStar);
  const awayWon = game.away?.winner;
  const homeWon = game.home?.winner;

  return (
    <div
      className="score-grid"
      onClick={onToggle}
      onClickCapture={longPress.suppressClick}
      style={{ ...gridStyle, position: 'relative', paddingTop: '19px' }}
    >
      <div className="kickoff-tab">{game.status.shortDetail || 'Final'}</div>
      {['away', 'home'].map((side) => (
        <TeamCell
          key={side}
          side={side}
          corner="all"
          competitor={game[side]}
          score={game[side]?.score ?? '-'}
          isStarred={starredTeamId === game[side]?.teamId}
          isWinner={side === 'away' ? awayWon : homeWon}
          dimmed={(side === 'away' && homeWon) || (side === 'home' && awayWon)}
          longPress={longPress}
        />
      ))}
      <LinescoreDrawer game={game} open={showLinescore} />
    </div>
  );
};
