import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './NFLData.scss';
import GameList from '../../components/NFLDataComponents/GameList/GameList';
import usePersistentState from '../../components/NFLDataComponents/shared/usePersistentState';
import { getTeams, getScoreboard, getTeamRankings } from './NFLDataApi/nflDataService';
import { isLiveStatus } from './NFLDataApi/espnParsers';

const LIVE_POLL_MS = 15000;
const PREGAME_POLL_MS = 30000;
const SEASONS_BACK = 6;

// How often to refresh the scoreboard: fast while games are live, slower when a
// kickoff is close, and not at all otherwise.
export const getPollInterval = (events, now = Date.now()) => {
  if (events.some((e) => isLiveStatus(e.status))) return LIVE_POLL_MS;
  const kickoffSoon = events.some((e) => {
    if (e.status.state !== 'pre' || !e.date) return false;
    const kickoff = new Date(e.date).getTime();
    return kickoff - now < 20 * 60 * 1000 && now - kickoff < 4 * 60 * 60 * 1000;
  });
  return kickoffSoon ? PREGAME_POLL_MS : null;
};

export const LoadingFootball = () => (
  <div className="loading">
    <div className="loading-football" role="img" aria-label="Loading">
      🏈
    </div>
    <p>loading...</p>
  </div>
);

function NFLData() {
  const [teams, setTeams] = useState([]);
  const [currentSeason, setCurrentSeason] = useState(null);
  const [selection, setSelection] = useState(null); // { season, seasonType, week }
  const [scoreboard, setScoreboard] = useState({ events: [], calendar: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rankings, setRankings] = useState(null);
  const [isTeamsMenuOpen, setIsTeamsMenuOpen] = useState(false);
  const [isWeekMenuOpen, setIsWeekMenuOpen] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  // null = "never chosen" -> show every team
  const [savedSelectedTeams, setSavedSelectedTeams] = usePersistentState('selectedTeams', null);
  const selectedTeams = useMemo(
    () => (Array.isArray(savedSelectedTeams) ? savedSelectedTeams : teams.map((t) => t.id)),
    [savedSelectedTeams, teams]
  );

  const selectionRef = useRef(selection);
  selectionRef.current = selection;

  // Mobile browsers: keep full-height layout correct when the URL bar shows/hides.
  useEffect(() => {
    const update = () => document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Initial load: teams + the current week's scoreboard.
  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const [teamList, board] = await Promise.all([getTeams(), getScoreboard()]);
        if (!active) return;
        setTeams(teamList);
        setScoreboard(board);
        setCurrentSeason(board.season);
        setSelection({ season: board.season, seasonType: board.seasonType, week: board.week });
        setLastUpdated(new Date());
      } catch (err) {
        console.error('Failed to load NFL data:', err);
        if (active) setError('Could not reach the NFL data service. Please try again in a moment.');
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  // Load the scoreboard whenever the user picks a different week/season.
  const loadScoreboard = useCallback(async (sel, { live = false } = {}) => {
    const board = await getScoreboard(sel, { live });
    // ignore responses for a week the user already navigated away from
    const current = selectionRef.current;
    if (
      current &&
      (current.season !== sel.season || current.seasonType !== sel.seasonType || current.week !== sel.week)
    ) {
      return;
    }
    setScoreboard((prev) => ({ ...board, calendar: board.calendar.length ? board.calendar : prev.calendar }));
    setLastUpdated(new Date());
  }, []);

  const isFirstSelection = useRef(true);
  useEffect(() => {
    if (!selection) return;
    if (isFirstSelection.current) {
      isFirstSelection.current = false; // initial board already loaded
      return;
    }
    setLoading(true);
    loadScoreboard(selection)
      .catch((err) => {
        console.error('Failed to load week:', err);
        setScoreboard((prev) => ({ ...prev, events: [] }));
      })
      .finally(() => setLoading(false));
  }, [selection, loadScoreboard]);


  const visibleGames = useMemo(
    () =>
      scoreboard.events.filter(
        (g) => selectedTeams.includes(g.away?.teamId) || selectedTeams.includes(g.home?.teamId)
      ),
    [scoreboard.events, selectedTeams]
  );

  // Live updates: poll only while games you're viewing are on; pause when the tab is hidden.
  const pollInterval = useMemo(() => getPollInterval(visibleGames), [visibleGames]);

  useEffect(() => {
    if (!pollInterval || !selection) return undefined;

    const tick = () => {
      if (document.visibilityState === 'hidden') return;
      loadScoreboard(selection, { live: true }).catch((err) => console.warn('Live refresh failed:', err));
    };

    const id = setInterval(tick, pollInterval);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [pollInterval, selection, loadScoreboard]);

  // Team rankings for the season being viewed (shared by every card).
  const rankingsSeason = selection?.season;
  useEffect(() => {
    if (!rankingsSeason || !teams.length) return undefined;
    let active = true;
    setRankings(null);
    getTeamRankings(rankingsSeason, teams)
      .then((r) => active && setRankings(r))
      .catch((err) => {
        console.warn('Team rankings unavailable:', err);
        if (active) setRankings({ error: true });
      });
    return () => {
      active = false;
    };
  }, [rankingsSeason, teams]);

  const teamsById = useMemo(() => Object.fromEntries(teams.map((t) => [t.id, t])), [teams]);


  const seasons = useMemo(() => {
    if (!currentSeason) return [];
    return Array.from({ length: SEASONS_BACK + 1 }, (_, i) => currentSeason - i);
  }, [currentSeason]);

  const handleTeamChange = (teamId) => {
    setSavedSelectedTeams((prev) => {
      const base = Array.isArray(prev) ? prev : teams.map((t) => t.id);
      return base.includes(teamId) ? base.filter((id) => id !== teamId) : [...base, teamId];
    });
  };

  const handleSelectWeek = (seasonType, week) =>
    setSelection((prev) => ({ ...prev, seasonType, week }));

  const handleSelectSeason = (season) => setSelection({ season, seasonType: 2, week: 1 });

  if (error) {
    return (
      <div className="nfl-data-container">
        <p className="noGames">{error}</p>
      </div>
    );
  }

  return (
    <div className={`nfl-data-container ${loading && !selection ? 'loading-background' : ''}`}>
      {!selection ? (
        <LoadingFootball />
      ) : (
        <GameList
          loading={loading}
          games={visibleGames}
          totalGames={scoreboard.events.length}
          teams={teams}
          teamsById={teamsById}
          selectedTeams={selectedTeams}
          onTeamChange={handleTeamChange}
          onSelectAll={() => setSavedSelectedTeams(teams.map((t) => t.id))}
          onDeselectAll={() => setSavedSelectedTeams([])}
          calendar={scoreboard.calendar}
          seasons={seasons}
          season={selection.season}
          currentSeason={currentSeason}
          seasonType={selection.seasonType}
          week={selection.week}
          onSelectWeek={handleSelectWeek}
          onSelectSeason={handleSelectSeason}
          isTeamsMenuOpen={isTeamsMenuOpen}
          setIsTeamsMenuOpen={setIsTeamsMenuOpen}
          isWeekMenuOpen={isWeekMenuOpen}
          setIsWeekMenuOpen={setIsWeekMenuOpen}
          rankings={rankings}
          hasLiveGames={pollInterval === LIVE_POLL_MS}
          lastUpdated={lastUpdated}
        />
      )}
    </div>
  );
}

export default NFLData;
