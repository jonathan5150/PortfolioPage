import React, { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import TeamCell from '../components/TeamCell';
import Marquee from '../components/Marquee';
import useAsyncData from '../hooks/useAsyncData';
import { getTeamColor, getTeamRingColors, washOut } from '../utils/teamColors';
import { getLeagueOdds, LEAGUES } from './leagueApi';
import { peekOdds } from '../utils/preloadOdds';
import { BoxScorePanel, LinesPanel, PlayersPanel, useLinesData } from './TeamPanels';
import TeamStatsCompare from '../components/TeamStatsCompare';
import { DRAWER_TRANSITION, PANEL_TRANSITION } from '../utils/detailsTiming';

const accent = (team) => washOut(getTeamColor(team) || 'rgba(120,120,120,0.6)', 0.15).replace(/[\d.]+\)$/, '1)');
const startTime = (game) =>
  game.date ? new Date(game.date).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' }) : 'TBD';

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  cursor: 'pointer',
  userSelect: 'none',
  WebkitUserSelect: 'none',
  WebkitTapHighlightColor: 'transparent',
};

// eases its real height (see ScoreBugs' InfoDrawer)
const InfoDrawer = ({ open, children }) => (
  <div
    className="info-drawer"
    style={{
      gridColumn: '1 / span 2',
      display: 'grid',
      gridTemplateRows: open ? '1fr' : '0fr',
      opacity: open ? 1 : 0,
      transition: DRAWER_TRANSITION,
    }}
  >
    <div className="info-drawer-inner">{children}</div>
  </div>
);

// ---------- period labels ----------

const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
};
export const periodLabel = (lg, game) => {
  const { status } = game;
  if (lg === 'mlb') {
    const half = /bot/i.test(game.periodPrefix)
      ? 'Bot'
      : /mid/i.test(game.periodPrefix)
        ? 'Mid'
        : /end/i.test(game.periodPrefix)
          ? 'End'
          : 'Top';
    return `${half} ${ordinal(status.period || 1)}`;
  }
  if (status.isHalftime) return 'Halftime';
  const p = status.period || 1;
  // NHL: three periods, then overtime; a regular-season game still level after
  // one overtime goes to a shootout, a playoff game to more overtimes
  if (lg === 'nhl') {
    const playoffs = game.seasonType === 3;
    const name = p <= 3 ? ordinal(p) : p === 4 ? 'OT' : playoffs ? `${p - 3}OT` : 'SO';
    if (status.name === 'STATUS_END_PERIOD') return `End of ${name}`;
    if (p <= 3) return `P${p} ${status.displayClock || ''}`.trim();
    return name === 'SO' ? 'Shootout' : `${name} ${status.displayClock || ''}`.trim();
  }
  const name = p <= 4 ? `Q${p}` : p === 5 ? 'OT' : `${p - 4}OT`;
  return `${name} ${status.displayClock || ''}`.trim();
};

// ---------- linescore (quarters / innings / periods) ----------

const linescoreLabel = (lg, game, i) => {
  if (lg === 'mlb') return String(i + 1);
  if (lg === 'nhl') {
    if (i < 3) return String(i + 1);
    if (i === 3) return 'OT';
    return game.seasonType === 3 ? `OT${i - 2}` : 'SO';
  }
  return i < 4 ? String(i + 1) : i === 4 ? 'OT' : `OT${i - 3}`;
};

const Linescore = ({ lg, game }) => {
  const regulation = LEAGUES[lg]?.regulationPeriods || 4;
  const periods = Math.max(regulation, game.away?.linescores?.length || 0, game.home?.linescores?.length || 0);
  const label = (i) => linescoreLabel(lg, game, i);
  const state = game.status.state;
  const started = state !== 'pre';
  const current = state === 'in' ? (game.status.period || 1) - 1 : -1;
  const columns = `minmax(58px, 1.5fr) repeat(${periods}, minmax(0, 1fr)) minmax(36px, 1.1fr)`;
  const row = (c, other) => {
    const won = state === 'post' ? c?.winner : started && (c?.score ?? 0) > (other?.score ?? 0);
    return (
      <div className={`linescore-row ${won ? 'leading' : ''}`} style={{ gridTemplateColumns: columns }}>
        <div className="linescore-team" style={{ '--team-accent': accent(c?.team) }}>
          {c?.team?.logo && <img src={c.team.logo} alt="" className="linescore-logo" draggable={false} />}
          <span>{c?.team?.abbreviation}</span>
        </div>
        {Array.from({ length: periods }, (_, i) => {
          const v = c?.linescores?.[i];
          const played = v !== undefined && v !== null;
          return (
            // eslint-disable-next-line react/no-array-index-key
            <div
              key={i}
              className={`linescore-cell ${i === current ? 'current' : ''} ${played && v > 0 ? 'scored' : ''}`}
            >
              {played ? v : '–'}
            </div>
          );
        })}
        <div className="linescore-total">{started ? (c?.score ?? 0) : '–'}</div>
      </div>
    );
  };
  return (
    <div className={`linescore ${lg === 'mlb' ? 'linescore-innings' : ''} linescore-${state}`}>
      <div className="linescore-row linescore-head" style={{ gridTemplateColumns: columns }}>
        <div className="linescore-team" />
        {Array.from({ length: periods }, (_, i) => (
          // eslint-disable-next-line react/no-array-index-key
          <div key={i} className={`linescore-cell ${i === current ? 'current' : ''}`}>
            {label(i)}
          </div>
        ))}
        <div className="linescore-total">{lg === 'mlb' ? 'R' : 'T'}</div>
      </div>
      {row(game.away, game.home)}
      {row(game.home, game.away)}
    </div>
  );
};

const InfoBar = ({ game }) => (
  <div className="kickoff-bar league-info-bar">
    <span className="kickoff-when">{startTime(game)}</span>
    <span className="kickoff-where" title={game.venue}>
      {game.venue || '—'}
    </span>
    <span className="kickoff-sky">{game.broadcast || ''}</span>
  </div>
);

// MLB probable starters and NHL probable goalies (pregame); NBA shows nothing
// here before a game
const Starters = ({ lg, game }) => {
  if (lg !== 'mlb' && lg !== 'nhl') return null;
  const rows = ['away', 'home'].map((side) => {
    const p = game[side]?.probable;
    return { side, label: lg === 'nhl' ? 'G' : 'SP', name: p?.name, line: p?.line, headshot: p?.headshot };
  });
  if (!rows.some((r) => r.name)) return null;
  return (
    <div className="info-drawer-row">
      {rows.map((r) => (
        <div key={r.side} className="league-starter" style={{ borderColor: accent(game[r.side]?.team) }}>
          {r.headshot && <img src={r.headshot} alt="" className="league-starter-photo" draggable={false} />}
          <div className="league-starter-text">
            <div className="ellipsis">
              <span className="player-name">{r.name || 'TBD'}</span> <span className="player-pos">{r.label}</span>
            </div>
            {r.line && <div className="ellipsis player-stat-line">{r.line}</div>}
          </div>
        </div>
      ))}
    </div>
  );
};

// ---------- MLB: bases and count ----------

const Bases = ({ s }) => (
  <span className="league-bases" aria-label="Runners on base">
    <i className={`base second ${s.onSecond ? 'on' : ''}`} />
    <i className={`base third ${s.onThird ? 'on' : ''}`} />
    <i className={`base first ${s.onFirst ? 'on' : ''}`} />
  </span>
);

// ---------- score bugs ----------

const ScoreBug = ({ lg, game, open, onToggle }) => {
  const { state } = game.status;
  const s = game.situation;
  const pre = state === 'pre';
  const odds = useAsyncData(() => getLeagueOdds(lg, game.id), [lg, game.id], {
    enabled: pre,
    initial: peekOdds(`${lg}:${game.id}`),
  });

  const cells = ['away', 'home'].map((side) => {
    const other = side === 'away' ? 'home' : 'away';
    return (
      <TeamCell
        key={side}
        side={side}
        competitor={game[side]}
        score={pre ? '' : (game[side]?.score ?? 0)}
        showOdds={pre}
        moneyLine={odds.data?.[side]?.moneyLine}
        isWinner={state === 'post' && game[side]?.winner}
        corner={state === 'in' ? 'top' : open ? 'top' : 'all'}
        expanded={open}
        dimmed={state === 'post' && game[other]?.winner}
      />
    );
  });

  let liveRow = null;
  if (state === 'in') {
    // NHL intermissions show the win chances, like an NBA halftime
    const halftime = game.status.isHalftime || (lg === 'nhl' && game.status.name === 'STATUS_END_PERIOD');
    const clock = periodLabel(lg, game);
    const chance = s?.winProbability;
    let left = null;
    if (lg === 'mlb' && s) {
      left = (
        <>
          <Bases s={s} />
          <span className="league-count">
            {s.balls ?? 0}-{s.strikes ?? 0} · {s.outs ?? 0} out{s.outs === 1 ? '' : 's'}
          </span>
        </>
      );
    } else if (halftime && chance) {
      left = (
        <span className="halftime-odds">
          <span className="halftime-label">Win probability</span>
          {['away', 'home'].map((side, i) => (
            <React.Fragment key={side}>
              {i > 0 && <span className="halftime-sep">·</span>}
              <span className={`halftime-team ${chance[side] >= 50 ? 'ahead' : ''}`}>
                {game[side]?.team?.abbreviation} <b>{chance[side].toFixed(1)}%</b>
              </span>
            </React.Fragment>
          ))}
        </span>
      );
    }
    // NBA / NHL in play: a single row, the last play on the left and the clock on the right
    const oneRow = (lg === 'nba' || lg === 'nhl') && !halftime;
    const play =
      lg === 'mlb' && s?.batter
        ? `${s.batter}${s.pitcher ? ` vs ${s.pitcher}` : ''}${s.lastPlay ? ` — ${s.lastPlay}` : ''}`
        : s?.lastPlay;
    liveRow = (
      <div
        className={`live-play-box ${halftime ? 'halftime' : ''}`}
        style={{
          margin: '2px',
          border: '2px solid #555',
          backgroundColor: 'rgba(70,70,70,1)',
          color: '#fff',
          fontSize: '11px',
          lineHeight: 1.3,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gridColumn: '1 / span 2',
          borderRadius: '0 0 6px 6px',
          padding: '5px 10px',
          minHeight: halftime || oneRow ? 0 : '44px',
        }}
      >
        <div className="live-play-top">
          {oneRow ? (
            <span className="league-live-play">
              <Marquee className="last-play" text={play || ' '} />
            </span>
          ) : (
            <span className="ellipsis league-live-left">{left}</span>
          )}
          <span className="live-play-clock">
            <span className="live-indicator">●</span> {clock}
          </span>
        </div>
        {!halftime && !oneRow && <Marquee className="last-play" text={play || ' '} />}
      </div>
    );
  }

  return (
    <div className="score-grid" onClick={onToggle} style={{ ...gridStyle, position: 'relative' }}>
      {cells}
      {liveRow}
      <InfoDrawer open={open}>
        {pre ? <Starters lg={lg} game={game} /> : <Linescore lg={lg} game={game} />}
        <InfoBar game={game} />
      </InfoDrawer>
    </div>
  );
};

// ---------- the card ----------

const TABS = [
  { key: 'boxscore', label: 'BOX SCORE' },
  { key: 'lines', label: 'LINES' },
  { key: 'players', label: 'PLAYERS' },
];
// an upcoming game has no box score yet: STATS (both teams' season stats) instead
const UPCOMING_TABS = [{ key: 'stats', label: 'STATS' }, ...TABS.slice(1)];

const TeamGameCard = memo(({ lg, game, isOpen, onUserToggle, hideMode, hidden, onToggleHidden }) => {
  const [hasOpened, setHasOpened] = useState(false);
  const [tab, setTab] = useState(game.status.state === 'pre' ? 'lines' : 'boxscore');
  useEffect(() => {
    if (isOpen) {
      setHasOpened(true);
      setTab(game.status.state === 'pre' ? 'lines' : 'boxscore');
      return undefined;
    }
    // the closed game's panel is let go only after the list has glided back
    // (letting it go mid-glide made the glide stutter on a slow phone)
    const timer = setTimeout(() => setHasOpened(false), 2000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const linesData = useLinesData(lg, game, isOpen);

  const innerRef = useRef(null);
  const [height, setHeight] = useState(0);
  useLayoutEffect(() => {
    if (!isOpen) {
      setHeight(0);
      return undefined;
    }
    const inner = innerRef.current;
    if (!inner) return undefined;
    setHeight(inner.scrollHeight);
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => setHeight(inner.scrollHeight));
    observer.observe(inner);
    return () => observer.disconnect();
  }, [isOpen, hasOpened]);

  const toggle = () => {
    if (hidden) return;
    onUserToggle(game.id, !isOpen);
  };
  const [awaySolid] = getTeamRingColors(game.away?.team);
  const [homeSolid] = getTeamRingColors(game.home?.team);

  return (
    <div
      className={`game-slot league-${lg} ${isOpen ? 'open' : ''} ${hideMode ? 'hide-mode' : ''} ${hidden ? 'hidden-game' : ''}`}
      style={{ '--ring-away': awaySolid, '--ring-home': homeSolid }}
    >
      {hideMode && (
        <label className="hide-check">
          {/* ticked: shown; unticked: hidden */}
          <input
            type="checkbox"
            checked={!hidden}
            onChange={() => onToggleHidden(game.id)}
            aria-label={`Show ${game.away?.team?.abbreviation || ''} at ${game.home?.team?.abbreviation || ''}`}
          />
        </label>
      )}
      <span className="game-ring" aria-hidden="true" />
      <div
        className="game-slot-body"
        onClickCapture={(e) => {
          if (!hideMode) return;
          e.preventDefault();
          e.stopPropagation();
          onToggleHidden(game.id);
        }}
      >
        {hidden && <div className="hidden-overlay">HIDDEN</div>}
        <div className="game-slot-content">
          <ScoreBug lg={lg} game={game} open={isOpen} onToggle={toggle} />
          <div
            className="game-data-container stat-toggle-container"
            style={{
              overflow: 'hidden',
              height: isOpen ? `${height}px` : '0px',
              opacity: isOpen ? 1 : 0,
              padding: isOpen ? '5px' : '0 5px',
              marginBottom: isOpen ? '2.5px' : '0', // the same gap inside the ring as at the top and sides
              borderWidth: isOpen ? '2px' : '0px',
              pointerEvents: isOpen ? 'auto' : 'none',
              transition: PANEL_TRANSITION,
              boxSizing: 'content-box',
            }}
          >
            <div ref={innerRef}>
              <div className="stat-section">
                {hasOpened && (
                  <div className="betting-panel">
                    <div className="bet-tabs" role="tablist">
                      {(game.status.state === 'pre' ? UPCOMING_TABS : TABS).map((t) => (
                        <button
                          key={t.key}
                          type="button"
                          role="tab"
                          aria-selected={tab === t.key}
                          className={tab === t.key ? 'active' : ''}
                          onClick={() => setTab(t.key)}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                    {tab === 'boxscore' && <BoxScorePanel lg={lg} game={game} />}
                    {tab === 'stats' && <TeamStatsCompare lg={lg} game={game} />}
                    {tab === 'lines' && <LinesPanel lg={lg} game={game} data={linesData} />}
                    {tab === 'players' && <PlayersPanel lg={lg} game={game} />}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default TeamGameCard;
