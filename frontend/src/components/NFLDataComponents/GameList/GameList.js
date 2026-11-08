import React, { useCallback, useMemo, useRef, useState } from 'react';
import NFLDataNavbar from '../NFLDataNavbar/NFLDataNavbar';
import GameCard from '../GameCard/GameCard';
import { slotLabel } from '../ScoreBug/ScoreBugs';
import LoadingField from '../shared/LoadingField';
import usePersistentState from '../shared/usePersistentState';
import { ParlayProvider } from '../shared/ParlayContext';
import ParlayBar from '../ParlayBar/ParlayBar';
import PredictionRecord from './PredictionRecord';

const GameList = ({
  loading,
  games,
  totalGames,
  weekGames,
  teams,
  teamsById,
  selectedTeams,
  onTeamChange,
  onSelectAll,
  onDeselectAll,
  calendar,
  seasons,
  season,
  currentSeason,
  seasonType,
  week,
  onSelectWeek,
  onSelectSeason,
  isTeamsMenuOpen,
  setIsTeamsMenuOpen,
  isWeekMenuOpen,
  setIsWeekMenuOpen,
  rankings,
  hasLiveGames,
  lastUpdated,
}) => {
  // SET / OPEN / CLOSE buttons on one card broadcast to every card.
  const [syncCommand, setSyncCommand] = useState(null);
  const suppressNextToggleRef = useRef(false);

  // Only one game is open at a time: opening a game closes whichever was open.
  const [openGameId, setOpenGameId] = useState(null);
  const handleUserToggle = useCallback((gameId, open) => {
    setOpenGameId((prev) => (open ? gameId : prev === gameId ? null : prev));
  }, []);

  const broadcast = useCallback((type, sourceGameId, panelKey) => {
    if (type === 'close-all') setOpenGameId(null);
    setSyncCommand({ type, sourceGameId, panelKey, nonce: Date.now() + Math.random() });
  }, []);

  // HIDE GAMES: a checkbox shows beside every game; checking one (or tapping
  // the game) blurs it out. Hidden games are remembered across visits.
  const [hideMode, setHideMode] = useState(false);
  const [hiddenIds, setHiddenIds] = usePersistentState('hiddenGames', []);
  const hiddenSet = useMemo(() => new Set(hiddenIds), [hiddenIds]);
  const toggleHideMode = useCallback(() => {
    if (!hideMode) broadcast('close-all');
    setHideMode(!hideMode);
  }, [hideMode, broadcast]);
  const toggleHidden = useCallback(
    (gameId) =>
      setHiddenIds((prev) => (prev.includes(gameId) ? prev.filter((id) => id !== gameId) : [...prev, gameId])),
    [setHiddenIds],
  );

  // Games that start together share one container, headed by the start time.
  // Outside HIDE GAMES mode, hidden games drop out of the list entirely.
  const shownGames = useMemo(
    () => (hideMode ? games : games.filter((g) => !hiddenSet.has(g.id))),
    [games, hideMode, hiddenSet],
  );

  const slots = useMemo(() => {
    const byLabel = new Map();
    shownGames.forEach((game) => {
      const label = slotLabel(game);
      if (!byLabel.has(label)) byLabel.set(label, []);
      byLabel.get(label).push(game);
    });
    return [...byLabel.entries()].map(([label, slotGames]) => ({ label, games: slotGames }));
  }, [shownGames]);

  // A tap that only closes a navbar menu shouldn't also open a game card.
  const handleOutsideClose = useCallback(() => {
    suppressNextToggleRef.current = true;
    setTimeout(() => {
      suppressNextToggleRef.current = false;
    }, 400);
  }, []);

  return (
    <ParlayProvider>
      <div className="matchup-card fade-in">
        <NFLDataNavbar
          teams={teams}
          selectedTeams={selectedTeams}
          onTeamChange={onTeamChange}
          onSelectAll={onSelectAll}
          onDeselectAll={onDeselectAll}
          calendar={calendar}
          seasons={seasons}
          season={season}
          seasonType={seasonType}
          week={week}
          onSelectWeek={onSelectWeek}
          onSelectSeason={onSelectSeason}
          isTeamsMenuOpen={isTeamsMenuOpen}
          setIsTeamsMenuOpen={setIsTeamsMenuOpen}
          isWeekMenuOpen={isWeekMenuOpen}
          setIsWeekMenuOpen={setIsWeekMenuOpen}
          onOutsideClose={handleOutsideClose}
          hasLiveGames={hasLiveGames}
          hideMode={hideMode}
          onToggleHideMode={toggleHideMode}
        />

        <div className={`matchup-container ${openGameId ? 'has-open' : ''}`}>
          {loading ? (
            <LoadingField className="inline-loading" />
          ) : shownGames.length === 0 ? (
            <p className="noGames">
              {totalGames === 0
                ? 'No games are scheduled for this week.'
                : games.length === 0
                  ? 'No games for your selected teams this week.'
                  : 'Every game this week is hidden. Use HIDE GAMES to bring them back.'}
            </p>
          ) : (
            slots.map((slot) => (
              <div key={slot.label} className="game-container game-group">
                <div className="game-group-time">{slot.label}</div>
                {slot.games.map((game) => (
                  <GameCard
                    key={game.id}
                    game={game}
                    teamsById={teamsById}
                    season={season}
                    currentSeason={currentSeason}
                    rankings={rankings}
                    syncCommand={syncCommand}
                    onBroadcast={broadcast}
                    suppressNextToggleRef={suppressNextToggleRef}
                    openGameId={openGameId}
                    onUserToggle={handleUserToggle}
                    hideMode={hideMode}
                    hidden={hiddenSet.has(game.id)}
                    onToggleHidden={toggleHidden}
                  />
                ))}
              </div>
            ))
          )}
        </div>

        <div className="games-count-outer">
          <div className="games-count-inner">
            Games Displayed: {shownGames.length}/{totalGames}
            {lastUpdated && (
              <span className="last-updated">
                {' '}
                · updated{' '}
                {lastUpdated.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
          </div>
        </div>
        <PredictionRecord games={weekGames || games} />
        {hideMode ? (
          <button type="button" className="hide-done-bar" onClick={() => setHideMode(false)}>
            DONE
          </button>
        ) : (
          <ParlayBar />
        )}
      </div>
    </ParlayProvider>
  );
};

export default GameList;
