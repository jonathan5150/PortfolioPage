import React, { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import TeamCell from '../../components/NFLDataComponents/ScoreBug/TeamCell';
import Marquee from '../../components/NFLDataComponents/shared/Marquee';
import useAsyncData from '../../components/NFLDataComponents/shared/useAsyncData';
import { getTeamColor, getTeamRingColors, washOut } from '../../components/NFLDataComponents/shared/teamColors';
import { getLeagueOdds, getLeaguePredictor } from './leagueApi';
import { BoxScorePanel, LinesPanel, PlayersPanel, useGameLines } from './TeamPanels';

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

const InfoDrawer = ({ open, children }) => (
  <div
    className="info-drawer"
    style={{
      gridColumn: '1 / span 2',
      overflow: 'hidden',
      padding: open ? '0 0 3px' : '0',
      maxHeight: open ? '320px' : '0px',
      opacity: open ? 1 : 0,
      transition: 'max-height 0.6s ease, opacity 0.45s ease, padding 0.4s ease',
    }}
  >
    {children}
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
  const name = p <= 4 ? `Q${p}` : p === 5 ? 'OT' : `${p - 4}OT`;
  return `${name} ${status.displayClock || ''}`.trim();
};

// ---------- linescore (quarters / innings) ----------

const Linescore = ({ lg, game }) => {
  const regulation = lg === 'mlb' ? 9 : 4;
  const periods = Math.max(regulation, game.away?.linescores?.length || 0, game.home?.linescores?.length || 0);
  const label = (i) => (lg === 'mlb' ? String(i + 1) : i < 4 ? String(i + 1) : i === 4 ? 'OT' : `OT${i - 3}`);
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

// MLB probable starters (pregame), NBA top scorer (pregame)
const Starters = ({ lg, game }) => {
  const rows = ['away', 'home'].map((side) => {
    const c = game[side];
    if (lg === 'mlb') {
      const p = c?.probable;
      return { side, label: 'SP', name: p?.name, line: p?.line, headshot: p?.headshot };
    }
    const leader = (c?.leaders || []).find((l) => /point/i.test(l.category)) || c?.leaders?.[0];
    return { side, label: leader?.label || '', name: leader?.athleteFullName, line: leader?.value };
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
  const predictor = useAsyncData(() => getLeaguePredictor(lg, game.id), [lg, game.id], { enabled: pre });
  const odds = useAsyncData(() => getLeagueOdds(lg, game.id), [lg, game.id], { enabled: pre });

  const cells = ['away', 'home'].map((side) => {
    const prob = predictor.data?.[side];
    const showProb = pre && prob !== null && prob !== undefined;
    const other = side === 'away' ? 'home' : 'away';
    return (
      <TeamCell
        key={side}
        side={side}
        competitor={game[side]}
        score={pre ? '' : (game[side]?.score ?? 0)}
        winProb={showProb ? prob : null}
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
    const halftime = game.status.isHalftime;
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
    // NBA in play: a single row, the last play on the left and the clock on the right
    const oneRow = lg === 'nba' && !halftime;
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

const TeamGameCard = memo(({ lg, game, isOpen, onUserToggle, hideMode, hidden, onToggleHidden }) => {
  const [hasOpened, setHasOpened] = useState(false);
  const [tab, setTab] = useState(game.status.state === 'pre' ? 'lines' : 'boxscore');
  useEffect(() => {
    if (isOpen) {
      setHasOpened(true);
      setTab(game.status.state === 'pre' ? 'lines' : 'boxscore');
      return undefined;
    }
    const timer = setTimeout(() => setHasOpened(false), 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const lines = useGameLines(lg, game, isOpen && tab === 'lines');

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
          <input
            type="checkbox"
            checked={hidden}
            onChange={() => onToggleHidden(game.id)}
            aria-label={`Hide ${game.away?.team?.abbreviation || ''} at ${game.home?.team?.abbreviation || ''}`}
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
              marginBottom: isOpen ? '7px' : '0',
              borderWidth: isOpen ? '2px' : '0px',
              pointerEvents: isOpen ? 'auto' : 'none',
              transition: 'height 0.35s ease, opacity 0.25s ease, padding 0.25s ease, margin 0.25s ease',
              boxSizing: 'content-box',
            }}
          >
            <div ref={innerRef}>
              <div className="stat-section">
                {hasOpened && (
                  <div className="betting-panel">
                    <div className="bet-tabs" role="tablist">
                      {TABS.map((t) => (
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
                    {tab === 'lines' && <LinesPanel lg={lg} game={game} lines={lines} />}
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
