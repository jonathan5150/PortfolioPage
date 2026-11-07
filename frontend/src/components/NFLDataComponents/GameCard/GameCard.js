import React, { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { PreGameScoreBug, LiveScoreBug, FinalScoreBug } from '../ScoreBug/ScoreBugs';
import BoxScore from '../GameCardSelections/BoxScore';
import TeamRankings from '../GameCardSelections/TeamRankings';
import PlayerSeasonStats from '../GameCardSelections/PlayerSeasonStats';
import PlayerGameLog from '../GameCardSelections/PlayerGameLog';
import TeamHistory from '../GameCardSelections/TeamHistory';
import Betting from '../GameCardSelections/Betting';
import { usePersistentMapEntry } from '../shared/usePersistentState';
import useGameSummary from './useGameSummary';

export const PANEL_OPTIONS = [
  { value: 'box-score', label: 'BOX SCORE' },
  { value: 'team-rankings', label: 'TEAM RANKINGS' },
  { value: 'team-history', label: 'TEAM W/L HISTORY' },
  { value: 'betting', label: 'BETTING' },
  { value: 'season-stats', label: 'SEASON STATS' },
  { value: 'game-log', label: 'PLAYER GAME LOG' },
];

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
}) {
  const state = game.status.state;
  const defaultPanel = state === 'pre' ? 'team-rankings' : 'box-score';

  const [panelKey, setPanelKey] = usePersistentMapEntry('panelByGame', game.id, defaultPanel);
  const [starredTeamId, setStarredTeamId] = usePersistentMapEntry('starredTeamByGame', game.id, null);
  const [isExpanded, setIsExpanded] = useState(false);
  // Panels mount the first time a card opens and then stay mounted, so closing
  // animates smoothly and reopening doesn't refetch.
  const [hasOpened, setHasOpened] = useState(false);
  useEffect(() => {
    if (isExpanded) setHasOpened(true);
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
  }, [isExpanded]);

  // ---- sync commands from other cards ----
  const lastNonceRef = useRef(null);
  useEffect(() => {
    if (!syncCommand?.nonce || lastNonceRef.current === syncCommand.nonce) return;
    lastNonceRef.current = syncCommand.nonce;

    if (syncCommand.type === 'set-all' && syncCommand.sourceGameId !== game.id) {
      setPanelKey(syncCommand.panelKey);
    }
    if (syncCommand.type === 'open-all') {
      setPanelKey(syncCommand.panelKey);
      setIsExpanded(true);
    }
    if (syncCommand.type === 'close-all') {
      setIsExpanded(false);
    }
  }, [syncCommand, game.id, setPanelKey]);

  const toggle = useCallback(() => {
    if (suppressNextToggleRef?.current) return;
    setIsExpanded((prev) => !prev);
  }, [suppressNextToggleRef]);

  const handleStar = useCallback(
    (teamId) => setStarredTeamId((prev) => (prev === teamId ? null : teamId)),
    [setStarredTeamId]
  );

  const awayTeam = teamsById[game.away?.teamId] || game.away?.team;
  const homeTeam = teamsById[game.home?.teamId] || game.home?.team;

  const renderPanel = () => {
    switch (panelKey) {
      case 'box-score':
        return <BoxScore game={game} summaryState={summaryState} />;
      case 'betting':
        return <Betting game={game} />;
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
    starredTeamId,
    onStar: handleStar,
    onToggle: toggle,
    showLinescore: isExpanded,
  };

  return (
    <div className="game-container">
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
          <div className="panel-controls">
            <div className="panel-select-wrapper">
              <select
                value={panelKey}
                onChange={(e) => setPanelKey(e.target.value)}
                className="panel-select"
                aria-label="Choose stats view"
              >
                {PANEL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <span className="panel-select-arrow">▼</span>
            </div>

            <div className="panel-sync-buttons">
              <button type="button" style={controlButtonStyle} onClick={() => onBroadcast('set-all', game.id, panelKey)}>
                SET
              </button>
              <button type="button" style={controlButtonStyle} onClick={() => onBroadcast('open-all', game.id, panelKey)}>
                OPEN
              </button>
              <button type="button" style={controlButtonStyle} onClick={() => onBroadcast('close-all', game.id)}>
                CLOSE
              </button>
            </div>
          </div>

          <div className="stat-section">{hasOpened ? renderPanel() : null}</div>
        </div>
      </div>
    </div>
  );
});

export default GameCard;
