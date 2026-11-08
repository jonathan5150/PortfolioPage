import React from 'react';
import TeamCell from './TeamCell';
import Linescore from './Linescore';
import { headshotUrl } from '../../../pages/NFLData/NFLDataApi/endpoints';
import { getEventPredictor } from '../../../pages/NFLData/NFLDataApi/bettingService';
import { getGameConditions } from '../../../pages/NFLData/NFLDataApi/gameConditions';
import useAsyncData from '../shared/useAsyncData';
import { getTeamBorderColor } from '../shared/teamColors';

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

// Everything below the team cells that only shows once the game is opened.
const InfoDrawer = ({ open, maxHeight = 260, children }) => (
  <div
    className="info-drawer"
    style={{
      gridColumn: '1 / span 2',
      overflow: 'hidden',
      padding: open ? '0 0 3px' : '0',
      maxHeight: open ? `${maxHeight}px` : '0px',
      opacity: open ? 1 : 0,
      transition: 'max-height 0.6s ease, opacity 0.45s ease, padding 0.4s ease',
    }}
  >
    {children}
  </div>
);

// Top bar of a card, always four columns: when (or the final status), stadium,
// sky + temperature at kickoff, and wind (left blank indoors).
// altLabel: a second label that cross-fades with `label` forever (finished
// games swap "Final" with their original start time).
const KickoffBar = ({ game, label, altLabel }) => {
  const conditions = useAsyncData(() => getGameConditions(game), [game.id]);
  const c = conditions.data;
  const w = c?.weather;
  const indoor = c?.indoor ?? game.indoor;
  const pending = conditions.loading;

  let sky = '—';
  let wind = '—';
  if (indoor) {
    // no weather indoors: leave the sky column empty and say so in the last one
    sky = '';
    wind = '🏟️ Indoors';
  } else if (w) {
    sky = `${w.icon || ''} ${w.temperature !== null ? `${Math.round(w.temperature)}°F` : ''} ${w.sky || ''}`.trim();
    wind = w.wind !== null ? `💨 ${Math.round(w.wind)} mph ${w.windFrom}`.trim() : '—';
  } else if (pending) {
    sky = '…';
    wind = '…';
  }

  return (
    <div className="kickoff-bar">
      {altLabel ? (
        <span className="kickoff-when kickoff-swap">
          <span className="kickoff-swap-a">{label}</span>
          <span className="kickoff-swap-b" aria-hidden="true">
            {altLabel}
          </span>
        </span>
      ) : (
        <span className="kickoff-when">{label}</span>
      )}
      <span className="kickoff-where" title={c?.stadium || game.venue}>
        {c?.stadium || game.venue || '—'}
      </span>
      <span className={`kickoff-sky ${sky ? '' : 'empty'}`}>{sky}</span>
      <span className={`kickoff-wind ${wind ? '' : 'empty'}`}>{wind}</span>
    </div>
  );
};

const ordinal = (n) => (n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`);
export const formatPeriod = (period) => (period > 4 ? (period === 5 ? 'OT' : `${period - 4}OT`) : `Q${period}`);

const passingLeader = (competitor) => competitor?.leaders?.find((l) => /passing/i.test(l.category));

// "154/232, 1795 YDS, 12 TD, 4 INT" -> "1795 YDS, 12 TD, 4 INT"
const qbStatLine = (value) => String(value || '').replace(/^\s*\d+\/\d+\s*,\s*/, '');

// ---------- Pre-game ----------

// The label a game is grouped under: its start time, or Live / Final.
export const slotLabel = (game) => {
  if (game.status.state === 'post') return 'Final';
  if (game.status.state === 'in') return 'Live';
  if (game.status.isPostponed) return game.status.shortDetail || 'Postponed';
  return game.date
    ? new Date(game.date).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })
    : 'TBD';
};

const playersBoxStyle = (corner) => ({
  ...infoBoxStyle(corner),
  // square on top where it meets the open team cell; rounded at the bottom
  borderRadius: corner === 'left' ? '0 0 0 6px' : '0 0 6px 0',
  margin: '0 2px 2px', // sits right under the team cells
  justifyContent: 'flex-start',
  gap: '5px',
  padding: '5px 8px 5px 5px',
});

const PlayerRow = ({ label, name, statLine, headshot, team }) => (
  <div className="player-row">
    <div className="player-headshot" style={team ? { borderColor: getTeamBorderColor(team) } : undefined}>
      {headshot && (
        <img
          src={headshot}
          alt=""
          draggable={false}
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      )}
    </div>
    <div className="player-text">
      <div className="ellipsis">
        <span className="player-name">{name || 'N/A'}</span> <span className="player-pos">{label}</span>
      </div>
      {statLine && <div className="ellipsis player-stat-line">{statLine}</div>}
    </div>
  </div>
);

const PlayersBox = ({ rows, corner, team }) => (
  <div style={playersBoxStyle(corner)}>
    {rows.map((row) => (
      <PlayerRow key={row.label} {...row} team={team} />
    ))}
  </div>
);

export const PreGameScoreBug = ({ game, onToggle, showLinescore }) => {
  const kickoff = game.date
    ? new Date(game.date).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })
    : 'TBD';

  // ESPN FPI win probability fills the score spot before kickoff.
  const predictor = useAsyncData(() => getEventPredictor(game.id), [game.id]);

  const rows = (side) => {
    const competitor = game[side];
    const qb = passingLeader(competitor);
    return [
      {
        label: 'QB',
        name: qb ? qb.athleteFullName || qb.athleteName : null,
        statLine: qb ? qbStatLine(qb.value) : null,
        headshot: qb?.athleteId ? headshotUrl(qb.athleteId) : null,
      },
    ];
  };
  const away = rows('away');
  const home = rows('home');

  return (
    <div className="score-grid" onClick={onToggle} style={{ ...gridStyle, position: 'relative' }}>
      {['away', 'home'].map((side) => {
        const prob = predictor.data?.[side];
        const hasProb = prob !== null && prob !== undefined;
        return (
          <TeamCell
            key={side}
            side={side}
            competitor={game[side]}
            score={hasProb ? `${Math.round(prob)}%` : ''}
            scoreIsSpread={hasProb}
            subScore={hasProb ? 'WIN PROB' : null}
            corner={showLinescore ? 'top' : 'all'}
            expanded={showLinescore}
          />
        );
      })}
      <InfoDrawer open={showLinescore}>
        <div className="info-drawer-row">
          <PlayersBox rows={away} corner="left" team={game.away?.team} />
          <PlayersBox rows={home} corner="right" team={game.home?.team} />
        </div>
        <KickoffBar game={game} label={game.status.isPostponed ? game.status.shortDetail : kickoff} />
      </InfoDrawer>
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

// "3rd & 7" for a live game. Between plays (kickoffs, extra points, timeouts)
// ESPN sends down -1 and distance 0, sometimes with text like "-1th and 0", so
// only a real down (1st-4th) is shown; otherwise the clock / quarter.
const BROKEN_DOWN_TEXT = /-\s*\d|\b0th\b|\b[05-9]th\b/i;
export const situationText = (s, status) => {
  const fallback = status?.isHalftime ? 'Halftime' : status?.shortDetail || '';
  if (!s || !(s.down >= 1 && s.down <= 4)) return fallback;
  const text = s.shortDownDistanceText || s.downDistanceText;
  if (text && !BROKEN_DOWN_TEXT.test(text)) return text;
  if (s.distance === null || s.distance === undefined || s.distance < 0) return fallback;
  return `${ordinal(s.down)} & ${s.distance === 0 ? 'Goal' : s.distance}`;
};

export const LiveScoreBug = ({ game, onToggle, showLinescore }) => {
  const s = game.situation;
  const status = game.status;

  const downText = situationText(s, status);

  return (
    <div className="score-grid" onClick={onToggle} style={gridStyle}>
      {['away', 'home'].map((side) => (
        <TeamCell
          key={side}
          side={side}
          competitor={game[side]}
          score={game[side]?.score ?? 0}
          hasPossession={s?.possessionTeamId && s.possessionTeamId === game[side]?.teamId}
          expanded={showLinescore}
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

      <InfoDrawer open={showLinescore}>
        <Linescore game={game} />
        <KickoffBar game={game} label={status.shortDetail || 'Live'} />
      </InfoDrawer>
    </div>
  );
};

// ---------- Final ----------

export const FinalScoreBug = ({ game, onToggle, showLinescore }) => {
  const awayWon = game.away?.winner;
  const homeWon = game.home?.winner;

  return (
    <div className="score-grid" onClick={onToggle} style={{ ...gridStyle, position: 'relative' }}>
      {['away', 'home'].map((side) => (
        <TeamCell
          key={side}
          side={side}
          corner="all"
          competitor={game[side]}
          score={game[side]?.score ?? '-'}
          isWinner={side === 'away' ? awayWon : homeWon}
          dimmed={(side === 'away' && homeWon) || (side === 'home' && awayWon)}
          expanded={showLinescore}
        />
      ))}
      <InfoDrawer open={showLinescore}>
        <Linescore game={game} />
        <KickoffBar
          game={game}
          label={game.status.shortDetail || 'Final'}
          altLabel={
            game.date
              ? new Date(game.date).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })
              : null
          }
        />
      </InfoDrawer>
    </div>
  );
};
