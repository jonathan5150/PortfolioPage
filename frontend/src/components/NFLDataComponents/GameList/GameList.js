import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { groupByDay } from '../../../sports/dayGroups';
import NFLDataNavbar from '../NFLDataNavbar/NFLDataNavbar';
import GameCard from '../GameCard/GameCard';
import LoadingField from '../shared/LoadingField';
import usePersistentState from '../shared/usePersistentState';
import { ParlayProvider } from '../shared/ParlayContext';
import ParlayBar from '../ParlayBar/ParlayBar';
import ModelResults from './PredictionRecord';
import ConfidentBets, { asBetItems, leagueTicketLoader } from './DayBets';
import ModelPanel from './ModelPanel';
import SettingsPanel from './SettingsPanel';
import SlideOpen from '../shared/SlideOpen';
import LastUpdated from '../shared/LastUpdated';
import useGameFocus, { teamLineColor } from '../shared/useGameFocus';
import useBackgroundPrefetch, { byPriority } from '../shared/useBackgroundPrefetch';
import { getGameSummary } from '../../../pages/NFLData/NFLDataApi/nflDataService';
import {
  getEventOdds,
  getEventPredictor,
  getTeamBettingTrends,
  getTeamResultHistory,
} from '../../../pages/NFLData/NFLDataApi/bettingService';
import { loadTeamModel } from '../../../pages/NFLData/NFLDataApi/teamModels';
import { getTeamStatsTable } from '../shared/TeamStatsCompare';

// What each game's BOX SCORE and LINES tabs load, for loading in the background
// (never the touchdown scorer odds: those wait until PLAYERS / TD ODDS is
// opened). In this order (see backgroundTasks): live and upcoming games'
// lines, then every finished game's box score (a finished game opens on its
// box score), then finished games' lines, then each team's season trends and
// results, which each look up the odds of every game that team has played.
const nflLinesTasks = (game) => {
  const final = game.status?.state === 'post';
  return [
    { key: `nfl:odds:${game.id}`, run: () => getEventOdds(game.id, { final }) },
    { key: `nfl:predictor:${game.id}`, run: () => getEventPredictor(game.id, { final }) },
  ];
};
const nflBoxTask = (game) => ({
  key: `nfl:summary:${game.id}`,
  run: () => getGameSummary(game.id, { final: true }),
});
const nflTeamTasks = (game) =>
  ['away', 'home'].flatMap((side) => [
    { key: `nfl:trends:${game.id}:${side}`, run: () => getTeamBettingTrends(game[side]?.teamId, game) },
    { key: `nfl:results:${game.id}:${side}`, run: () => getTeamResultHistory(game[side]?.teamId, game) },
  ]);

const MERGE_WINDOW_MS = 30 * 60 * 1000;

// The list is split into FINISHED, LIVE and UPCOMING, and each part groups its
// games by start time.
const SECTIONS = [
  { key: 'post', label: 'FINISHED' },
  { key: 'in', label: 'LIVE' },
  { key: 'pre', label: 'UPCOMING' },
];

// Which sections are collapsed only lasts while you stay on a week: every
// week (and every visit) starts from the default view.
const collapsedCookie = (season, seasonType, week) => `${season}-${seasonType}-${week}`;

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
  onGameOpened,
  lastUpdated,
}) => {
  // SET / OPEN / CLOSE buttons on one card broadcast to every card.
  const [syncCommand, setSyncCommand] = useState(null);
  const suppressNextToggleRef = useRef(false);

  // Only one game is open at a time: opening a game closes whichever was open.
  const [openGameId, setOpenGameId] = useState(null);
  // the first opened game asks the page for the data only open games use
  useEffect(() => {
    if (openGameId) onGameOpened?.();
  }, [openGameId, onGameOpened]);
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

  // Only counts while that game is actually in the list (switching weeks with a
  // game open shouldn't leave the new week faded).
  const hasOpenGame = Boolean(openGameId) && shownGames.some((g) => g.id === openGameId);

  // BOX SCORE and LINES for every game shown, loaded quietly in the background
  // (see useBackgroundPrefetch). With live games on, it waits while one is open;
  // with none, it keeps going even then.
  const hasLive = shownGames.some((g) => g.status?.state === 'in');
  useBackgroundPrefetch(
    [
      ...byPriority(shownGames.filter((g) => g.status?.state !== 'post')).flatMap(nflLinesTasks),
      // every team's season stats (one download), for upcoming games' STATS
      ...(shownGames.some((g) => g.status?.state === 'pre')
        ? [{ key: 'nfl:teamStats', run: () => getTeamStatsTable('nfl') }]
        : []),
      ...shownGames.filter((g) => g.status?.state === 'post').map(nflBoxTask),
      ...shownGames.filter((g) => g.status?.state === 'post').flatMap(nflLinesTasks),
      { key: 'nfl:teamModel', run: () => loadTeamModel('nfl') },
      ...byPriority(shownGames).flatMap(nflTeamTasks),
    ],
    { paused: hasLive && hasOpenGame },
  );

  // around the open game: team-coloured lines, tap outside to close, the slide
  // up to the top of the scrolling box and back (see useGameFocus)
  const cardRef = useRef(null);
  const panelRef = useRef(null);
  const openGame = hasOpenGame ? shownGames.find((g) => g.id === openGameId) : null;
  const { focusSpace } = useGameFocus({
    openKey: openGame?.id,
    lineA: openGame ? teamLineColor(openGame.away?.team) : null,
    lineB: openGame ? teamLineColor(openGame.home?.team) : null,
    onClose: () => setOpenGameId(null),
    panelRef,
  });

  // The user's own open / closed choice for this week (null until they make one).
  const cookieName = collapsedCookie(season, seasonType, week);
  const [savedCollapsed, setSavedCollapsed] = useState(null);
  useEffect(() => setSavedCollapsed(null), [cookieName]);
  // GAMES (hiding games): every section opens, so every game can be checked off
  useEffect(() => {
    if (hideMode) setSavedCollapsed(new Set());
  }, [hideMode]);

  // TEAMS / GAMES counts for the navbar, out of everyone playing this week.
  // They follow the user's choices live: teams ticked in the teams menu, and
  // games checked off in HIDE GAMES (counted as they're checked, before DONE).
  const counts = useMemo(() => {
    const week = weekGames || games;
    const visible = week.filter((g) => !hiddenSet.has(g.id));
    const selected = new Set(selectedTeams);
    const weekTeams = new Set(week.flatMap((g) => [g.away?.teamId, g.home?.teamId]).filter(Boolean));
    const shownTeams = new Set(
      visible.flatMap((g) => [g.away?.teamId, g.home?.teamId]).filter((id) => id && selected.has(id)),
    );
    const gamesShown = visible.filter((g) => selected.has(g.away?.teamId) || selected.has(g.home?.teamId)).length;
    return { teamsShown: shownTeams.size, teamsTotal: weekTeams.size, gamesShown, gamesTotal: totalGames };
  }, [weekGames, games, hiddenSet, selectedTeams, totalGames]);

  const sections = useMemo(
    () =>
      SECTIONS.map((section) => {
        const days = groupByDay(
          shownGames.filter((g) =>
            section.key === 'pre' ? !['post', 'in'].includes(g.status.state) : g.status.state === section.key,
          ),
          { mergeWindowMs: MERGE_WINDOW_MS },
        );
        return { ...section, days, slots: days.flatMap((d) => d.slots) };
      }).filter((section) => section.slots.length > 0),
    [shownGames],
  );

  // Until the user opens or closes a section themselves, only one is open: LIVE
  // when games are on, otherwise UPCOMING, otherwise FINISHED.
  const defaultCollapsed = useMemo(() => {
    const keys = sections.map((s) => s.key);
    // live games: LIVE and UPCOMING open; otherwise UPCOMING, else FINISHED
    const open = keys.includes('in') ? ['in', 'pre'] : keys.includes('pre') ? ['pre'] : ['post'];
    return new Set(keys.filter((k) => !open.includes(k)));
  }, [sections]);
  const collapsed = savedCollapsed || defaultCollapsed;

  const toggleSection = useCallback(
    (key, sectionGames) => {
      const next = new Set(collapsed);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      setSavedCollapsed(next);
      // remembered for this week, "none" when everything is open
      // collapsing the section that holds the open game closes that game
      if (sectionGames.some((g) => g.id === openGameId)) setOpenGameId(null);
    },
    [collapsed, openGameId],
  );

  // A tap that only closes a navbar menu shouldn't also open a game card.
  const handleOutsideClose = useCallback(() => {
    suppressNextToggleRef.current = true;
    setTimeout(() => {
      suppressNextToggleRef.current = false;
    }, 400);
  }, []);

  return (
    <ParlayProvider>
      {/* game-focus: while a game is open everything else in the list fades away
          (keeping its space, so nothing moves) to show the team-coloured lines */}
      <div
        ref={cardRef}
        className={`matchup-card fade-in ${hasOpenGame ? 'game-focus' : ''} ${focusSpace ? 'focus-space' : ''}`}
      >
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
          hideMode={hideMode}
          counts={counts}
          onToggleHideMode={toggleHideMode}
        />

        {/* everything under the pinned header scrolls inside this faint box, so
            what scrolls up is cut off cleanly at its top edge; while a game is
            open it stops scrolling (see game focus below) */}
        <div className="nfl-scroll-panel" ref={panelRef}>
          <div className={`matchup-container ${hasOpenGame ? 'has-open' : ''}`}>
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
              sections.map((section) => (
                // the gold box holds the heading and, when open, that section's games
                <div key={section.key} className={`game-section ${collapsed.has(section.key) ? 'collapsed' : ''}`}>
                  <button
                    type="button"
                    className={`game-section-label ${section.key} ${collapsed.has(section.key) ? 'collapsed' : ''}`}
                    aria-expanded={!collapsed.has(section.key)}
                    onClick={() =>
                      toggleSection(
                        section.key,
                        section.slots.flatMap((slot) => slot.games),
                      )
                    }
                  >
                    {/* the name sits dead centre with its arrow just off its right side;
                      the game count is pinned to the far right */}
                    <span className="game-section-name">
                      {section.label}
                      <span className="gold-caret" aria-hidden="true" />
                    </span>
                    <span className="game-section-count">
                      {section.slots.reduce((n, slot) => n + slot.games.length, 0)}
                    </span>
                  </button>
                  <SlideOpen open={!collapsed.has(section.key)} className="game-section-body">
                    {/* one container per day (SUN 11/15 ... TODAY), each start time inside it */}
                    {section.days.map((day) => (
                      <div key={day.key} className="game-container game-group">
                        <div className="game-group-time">
                          <span>{day.label}</span>
                          {day.when && <span className="game-group-when">{day.when}</span>}
                        </div>
                        {day.slots.map((slot) => (
                          <React.Fragment key={slot.label || 'all'}>
                            {slot.label && <div className="game-group-subtime">{slot.label}</div>}
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
                                isOpen={openGameId === game.id}
                                onUserToggle={handleUserToggle}
                                hideMode={hideMode}
                                hidden={hiddenSet.has(game.id)}
                                onToggleHidden={toggleHidden}
                              />
                            ))}
                          </React.Fragment>
                        ))}
                      </div>
                    ))}
                  </SlideOpen>
                </div>
              ))
            )}
          </div>

          {!loading && (
            <ModelPanel>
              {({ unit, scope, filter, minOdds }) => (
                <>
                  <ConfidentBets
                    items={asBetItems(weekGames || games)}
                    loadTickets={leagueTicketLoader('nfl')}
                    stake={unit}
                    filter={filter}
                    period="WEEK"
                  />
                  <ModelResults
                    games={weekGames || games}
                    stake={unit}
                    scope={scope}
                    filter={filter}
                    minOdds={minOdds}
                  />
                </>
              )}
            </ModelPanel>
          )}
          {!loading && <SettingsPanel />}
          {!loading && <LastUpdated />}
        </div>
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
