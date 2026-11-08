import React, { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { PreGameScoreBug, LiveScoreBug, FinalScoreBug } from '../ScoreBug/ScoreBugs';
import BoxScore from '../GameCardSelections/BoxScore';
import TeamRankings from '../GameCardSelections/TeamRankings';
import PlayerSeasonStats from '../GameCardSelections/PlayerSeasonStats';
import PlayerGameLog from '../GameCardSelections/PlayerGameLog';
import TeamHistory from '../GameCardSelections/TeamHistory';
import Betting from '../GameCardSelections/Betting';
import { usePersistentMapEntry } from '../shared/usePersistentState';
import { getTeamRingColors } from '../shared/teamColors';
import useGameSummary from './useGameSummary';

export const PANEL_OPTIONS = [
  { value: 'betting', label: 'BETTING' },
  { value: 'box-score', label: 'BOX SCORE' },
  { value: 'team-rankings', label: 'TEAM RANKINGS' },
  { value: 'team-history', label: 'TEAM W/L HISTORY' },
  { value: 'season-stats', label: 'SEASON STATS' },
  { value: 'game-log', label: 'PLAYER GAME LOG' },
];

// The panel picker row (view dropdown + SET / CLOSE) is switched off for now:
// every game shows the Betting panel. Flip this to bring the row back.
const SHOW_PANEL_CONTROLS = false;

const controlButtonStyle = {
  padding: '4px 10px',
  borderRadius: '6px',
  border: '1px solid #555',
  background: 'rgba(60, 60, 60, 0.9)',
  color: 'white',
  fontSize: '0.7rem',
  cursor: 'pointer',
  height: '30px',
  whiteSpace: 'nowrap',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: 'DM Sans, sans-serif',
  fontWeight: 500,
  flex: 1,
  minWidth: 0,
};

const GameCard = memo(function GameCard({
  game,
  teamsById,
  season,
  currentSeason,
  rankings,
  syncCommand,
  onBroadcast,
  suppressNextToggleRef,
  // The list owns which game is open (one at a time). A per-card boolean means
  // opening, switching or closing a game only re-renders the cards that change.
  isOpen = false,
  onUserToggle,
  hideMode = false,
  hidden = false,
  onToggleHidden,
}) {
  const state = game.status.state;
  const [storedPanel, setPanelKey] = usePersistentMapEntry('panelByGame', game.id, 'betting');
  const panelKey = SHOW_PANEL_CONTROLS ? storedPanel : 'betting';
  const panelOptions = PANEL_OPTIONS;
  const isExpanded = isOpen;
  // Only the open game keeps its panel built (and for a moment after closing,
  // so the collapse animates). Panels for every game opened used to stay
  // mounted, which piled up memory on low-RAM phones; reopening rebuilds from
  // the fetch cache, so it doesn't refetch.
  const [hasOpened, setHasOpened] = useState(false);
  useEffect(() => {
    if (isExpanded) {
      setHasOpened(true);
      return undefined;
    }
    const timer = setTimeout(() => setHasOpened(false), 500);
    return () => clearTimeout(timer);
  }, [isExpanded]);

  // Fetch the detailed summary only when the box score is actually showing.
  const summaryState = useGameSummary(game, isExpanded && panelKey === 'box-score');

  // ---- expand / collapse animation ----
  const innerRef = useRef(null);
  const [height, setHeight] = useState(0);

  useLayoutEffect(() => {
    if (!isExpanded) {
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
    // hasOpened: re-measure once the panel mounts (cards can start open in bet mode)
  }, [isExpanded, hasOpened]);

  // ---- sync commands from other cards ----
  const lastNonceRef = useRef(null);
  useEffect(() => {
    if (!syncCommand?.nonce || lastNonceRef.current === syncCommand.nonce) return;
    lastNonceRef.current = syncCommand.nonce;

    if (syncCommand.type === 'set-all' && syncCommand.sourceGameId !== game.id) {
      setPanelKey(syncCommand.panelKey);
    }
  }, [syncCommand, game.id, setPanelKey]);

  // A hidden game can't be opened; hiding an open game closes it.
  useEffect(() => {
    if (hidden && isOpen) onUserToggle?.(game.id, false);
  }, [hidden, isOpen, onUserToggle, game.id]);

  // A click asks the list to open/close this game (CLOSE on the panel goes
  // through the list's close-all, which clears the open game).
  const toggle = useCallback(() => {
    if (suppressNextToggleRef?.current || hidden) return;
    onUserToggle?.(game.id, !isOpen);
  }, [suppressNextToggleRef, hidden, isOpen, onUserToggle, game.id]);

  // In HIDE GAMES mode a tap anywhere on the game hides/unhides it instead of opening it.
  const handleHideClick = useCallback(
    (e) => {
      if (!hideMode) return;
      e.preventDefault();
      e.stopPropagation();
      onToggleHidden?.(game.id);
    },
    [hideMode, onToggleHidden, game.id],
  );

  const awayTeam = teamsById[game.away?.teamId] || game.away?.team;
  const homeTeam = teamsById[game.home?.teamId] || game.home?.team;

  // The ring around an open game swirls in the two teams' colours.
  const [awaySolid, awayLight] = getTeamRingColors(game.away?.team);
  const [homeSolid, homeLight] = getTeamRingColors(game.home?.team);
  const ringStyle = {
    '--ring-away': awaySolid,
    '--ring-away-light': awayLight,
    '--ring-home': homeSolid,
    '--ring-home-light': homeLight,
  };

  const renderPanel = () => {
    switch (panelKey) {
      case 'box-score':
        return <BoxScore game={game} summaryState={summaryState} />;
      case 'betting':
        return <Betting game={game} rankings={rankings} isOpen={isExpanded} />;
      case 'team-history':
        return <TeamHistory game={game} />;
      case 'season-stats':
        return (
          <PlayerSeasonStats
            gameId={game.id}
            awayTeam={awayTeam}
            homeTeam={homeTeam}
            season={season}
            currentSeason={currentSeason}
          />
        );
      case 'game-log':
        return <PlayerGameLog gameId={game.id} game={game} awayTeam={awayTeam} homeTeam={homeTeam} season={season} />;
      case 'team-rankings':
      default:
        return <TeamRankings game={game} rankings={rankings} />;
    }
  };

  const bugProps = {
    game,
    onToggle: toggle,
    showLinescore: isExpanded,
  };

  return (
    <div
      className={`game-slot ${isExpanded ? 'open' : ''} ${hideMode ? 'hide-mode' : ''} ${hidden ? 'hidden-game' : ''}`}
      data-game-id={game.id}
      style={ringStyle}
    >
      {hideMode && (
        <label className="hide-check">
          <input
            type="checkbox"
            checked={hidden}
            onChange={() => onToggleHidden?.(game.id)}
            aria-label={`Hide ${game.away?.team?.abbreviation || ''} at ${game.home?.team?.abbreviation || ''}`}
          />
        </label>
      )}
      {/* swirling ring for the open game, drawn as four thin edge strips so only
          the 3px border repaints while it spins (see .game-ring in NFLData.scss) */}
      <span className="game-ring" aria-hidden="true">
        <i className="ring-top" />
        <i className="ring-right" />
        <i className="ring-bottom" />
        <i className="ring-left" />
      </span>
      <div className="game-slot-body" onClickCapture={handleHideClick}>
        {hidden && <div className="hidden-overlay">HIDDEN</div>}
        <div className="game-slot-content">
          {state === 'in' ? (
            <LiveScoreBug {...bugProps} />
          ) : state === 'post' ? (
            <FinalScoreBug {...bugProps} />
          ) : (
            <PreGameScoreBug {...bugProps} />
          )}

          <div
            className="game-data-container stat-toggle-container"
            style={{
              overflow: 'hidden',
              height: isExpanded ? `${height}px` : '0px',
              opacity: isExpanded ? 1 : 0,
              padding: isExpanded ? '5px' : '0 5px',
              marginBottom: isExpanded ? '7px' : '0',
              borderWidth: isExpanded ? '2px' : '0px',
              pointerEvents: isExpanded ? 'auto' : 'none',
              transition: 'height 0.35s ease, opacity 0.25s ease, padding 0.25s ease, margin 0.25s ease',
              boxSizing: 'content-box',
            }}
          >
            <div ref={innerRef}>
              {SHOW_PANEL_CONTROLS && (
                <div className="panel-controls">
                  <div className="panel-select-wrapper">
                    <select
                      value={panelKey}
                      onChange={(e) => setPanelKey(e.target.value)}
                      className="panel-select"
                      aria-label="Choose stats view"
                    >
                      {panelOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <span className="panel-select-arrow">▼</span>
                  </div>

                  <div className="panel-sync-buttons">
                    <button
                      type="button"
                      style={controlButtonStyle}
                      onClick={() => onBroadcast('set-all', game.id, panelKey)}
                    >
                      SET
                    </button>
                    <button type="button" style={controlButtonStyle} onClick={() => onBroadcast('close-all', game.id)}>
                      CLOSE
                    </button>
                  </div>
                </div>
              )}

              <div className="stat-section">{hasOpened ? renderPanel() : null}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default GameCard;
