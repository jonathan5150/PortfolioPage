import React, { useCallback, useRef, useState } from 'react';
import NFLDataNavbar from '../NFLDataNavbar/NFLDataNavbar';
import GameCard from '../GameCard/GameCard';

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

  // A tap that only closes a navbar menu shouldn't also open a game card.
  const handleOutsideClose = useCallback(() => {
    suppressNextToggleRef.current = true;
    setTimeout(() => {
      suppressNextToggleRef.current = false;
    }, 400);
  }, []);

  return (
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
      />

      <div className="matchup-container">
        {loading ? (
          <div className="loading inline-loading">
            <div className="loading-football" role="img" aria-label="Loading">
              🏈
            </div>
            <p>loading...</p>
          </div>
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
    </div>
  );
};

export default GameList;
