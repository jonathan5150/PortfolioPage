import React, { useCallback, useRef, useState } from 'react';
import NFLDataNavbar from '../NFLDataNavbar/NFLDataNavbar';
import GameCard from '../GameCard/GameCard';
import usePersistentState from '../shared/usePersistentState';
import LoadingField from '../shared/LoadingField';
import { ParlayProvider } from '../shared/ParlayContext';
import ParlayBar from '../ParlayBar/ParlayBar';

const GameList = ({
  loading,
  games,
  totalGames,
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

  const broadcast = useCallback((type, sourceGameId, panelKey) => {
    setSyncCommand({ type, sourceGameId, panelKey, nonce: Date.now() + Math.random() });
  }, []);

  // BET MODE (saved across visits). Turning it on switches every card's panel
  // to Betting without opening any; turning it off hides the Betting panel.
  const [betMode, setBetMode] = usePersistentState('betMode', false);
  const handleToggleBetMode = useCallback(() => {
    const next = !betMode;
    setBetMode(next);
    if (next) broadcast('set-all', null, 'betting');
  }, [betMode, setBetMode, broadcast]);

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
          betMode={betMode}
          onToggleBetMode={handleToggleBetMode}
          hasLiveGames={hasLiveGames}
        />

        <div className="matchup-container">
          {loading ? (
            <LoadingField className="inline-loading" />
          ) : games.length === 0 ? (
            <p className="noGames">
              {totalGames === 0
                ? 'No games are scheduled for this week.'
                : 'No games for your selected teams this week.'}
            </p>
          ) : (
            games.map((game) => (
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
                betMode={betMode}
              />
            ))
          )}
        </div>

        <div className="games-count-outer">
          <div className="games-count-inner">
            Games Displayed: {games.length}/{totalGames}
            {lastUpdated && (
              <span className="last-updated">
                {' '}
                · updated {lastUpdated.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
          </div>
        </div>
        {betMode && <ParlayBar />}
      </div>
    </ParlayProvider>
  );
};

export default GameList;
