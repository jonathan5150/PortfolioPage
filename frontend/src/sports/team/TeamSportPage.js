import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import FitText from '../../components/NFLDataComponents/shared/FitText';
import SportSwitcher from '../SportSwitcher';
import DayCalendar from '../DayCalendar';
import { relativeDay } from '../relativeDay';
import { groupByDay } from '../dayGroups';
import SlideOpen from '../../components/NFLDataComponents/shared/SlideOpen';
import LastUpdated from '../../components/NFLDataComponents/shared/LastUpdated';
import usePersistentState from '../../components/NFLDataComponents/shared/usePersistentState';
import useAsyncData from '../../components/NFLDataComponents/shared/useAsyncData';
import TeamsMenu from '../../components/NFLDataComponents/NFLDataNavbar/NFLDataNavbarComponents/TeamsMenu';
import LoadingField from '../../components/NFLDataComponents/shared/LoadingField';
import TitleText from '../../components/NFLDataComponents/shared/TitleText';
import { ParlayProvider } from '../../components/NFLDataComponents/shared/ParlayContext';
import ParlayBar from '../../components/NFLDataComponents/ParlayBar/ParlayBar';
import { ModelResults } from '../../components/NFLDataComponents/GameList/PredictionRecord';
import ConfidentBets, { asBetItems, leagueTicketLoader } from '../../components/NFLDataComponents/GameList/DayBets';
import ModelPanel from '../../components/NFLDataComponents/GameList/ModelPanel';
import SettingsPanel from '../../components/NFLDataComponents/GameList/SettingsPanel';
import { graderFor, seasonLoaderFor } from '../../pages/NFLData/NFLDataApi/modelGrading';
import {
  LEAGUES,
  dayFromKey,
  findGameDay,
  getLeagueEventDays,
  getLeagueOdds,
  getLeagueScoreboard,
  getLeagueTeams,
  getLeaguePredictor,
  getLeagueSummary,
  getLeagueTeamSchedule,
} from './leagueApi';
import useBackgroundPrefetch, { byPriority } from '../../components/NFLDataComponents/shared/useBackgroundPrefetch';
import { loadTeamModel } from '../../pages/NFLData/NFLDataApi/teamModels';
import { preloadOdds } from '../../components/NFLDataComponents/shared/preloadOdds';
import useGameFocus, { teamLineColor } from '../../components/NFLDataComponents/shared/useGameFocus';
import TeamGameCard from './TeamGameCard';
import { getTeamStatsTable } from '../../components/NFLDataComponents/shared/TeamStatsCompare';
import '../../pages/NFLData/NFLData.scss';
import './TeamSport.scss';
import '../SportTitles.scss';

// What each game's BOX SCORE and LINES tabs load, for loading in the background,
// in this order: live and upcoming games' lines, then every finished game's box
// score (a finished game opens on its box score), then finished games' lines,
// then each team's schedule (its results rows and days of rest).
const leagueLinesTasks = (lg) => (game) => [
  {
    key: `${lg}:odds:${game.id}`,
    run: () => getLeagueOdds(lg, game.id, { final: game.status?.state === 'post' }),
  },
  { key: `${lg}:predictor:${game.id}`, run: () => getLeaguePredictor(lg, game.id) },
];
const leagueBoxTask = (lg) => (game) => ({
  key: `${lg}:summary:${game.id}`,
  run: () => getLeagueSummary(lg, game.id, { final: true }),
});
const leagueScheduleTasks = (lg) => (game) =>
  ['away', 'home'].map((side) => ({
    key: `${lg}:schedule:${game[side]?.teamId}:${game.season}`,
    run: () => getLeagueTeamSchedule(lg, game[side]?.teamId, game.season),
  }));
const leagueBackgroundTasks = (lg, games) => {
  const finished = games.filter((g) => g.status?.state === 'post');
  return [
    ...byPriority(games.filter((g) => g.status?.state !== 'post')).flatMap(leagueLinesTasks(lg)),
    // every team's season stats (one download), for upcoming games' STATS
    ...(games.some((g) => g.status?.state === 'pre')
      ? [{ key: `${lg}:teamStats`, run: () => getTeamStatsTable(lg) }]
      : []),
    ...finished.map(leagueBoxTask(lg)),
    ...finished.flatMap(leagueLinesTasks(lg)),
    ...(lg === 'nba' ? [{ key: 'nba:teamModel', run: () => loadTeamModel('nba') }] : []),
    ...byPriority(games).flatMap(leagueScheduleTasks(lg)),
  ];
};

const SECTIONS = [
  { key: 'post', label: 'FINISHED' },
  { key: 'in', label: 'LIVE' },
  { key: 'pre', label: 'UPCOMING' },
];
const LIVE_POLL_MS = 20000;
const IDLE_POLL_MS = 5 * 60 * 1000;

const dayLabel = (key) =>
  dayFromKey(key).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();

// ---------- model results: the NFL panel, graded with this league's engine ----------

const MODEL_NOTES = {
  nba: "BETS: the better-rested team on the spread when it's had 2+ more days off (home teams covered 57.5% from 2022-26; road teams 52.5-53.5% in every stretch from 2007). Everything else is a lean: no moneyline or total rule beat the closing prices, so EVERY PICK includes picks we wouldn't bet.",
  mlb: "The MLB picks are leans from ESPN's model and the betting market. They haven't been backtested like the NFL and NBA models yet.",
};

// ---------- the page ----------

const TeamSportPage = ({ lg }) => {
  const league = LEAGUES[lg];
  const [day, setDay] = useState(null); // YYYYMMDD; null until ESPN says which day is current
  const [board, setBoard] = useState(null);
  const [error, setError] = useState(null);
  const [refresh, setRefresh] = useState(0);
  // another day was picked and its games aren't in yet: the loading screen
  // shows under the header, with everything else hidden
  const [switching, setSwitching] = useState(false);

  // the current day (ESPN's pick) on first load, then whichever day is chosen;
  // learning the day from that first board mustn't download it a second time
  const seededDay = useRef(null);
  useEffect(() => {
    if (day && seededDay.current === day) {
      seededDay.current = null;
      return undefined;
    }
    seededDay.current = null;
    let active = true;
    getLeagueScoreboard(lg, day, { live: refresh > 0 })
      // the loading screen stays up until the day's pregame moneylines are in
      .then((data) =>
        (refresh > 0
          ? Promise.resolve()
          : preloadOdds(
              (data.events || [])
                .filter((g) => g.status?.state === 'pre')
                .map((g) => ({ key: `${lg}:${g.id}`, load: () => getLeagueOdds(lg, g.id) })),
            )
        ).then(() => data),
      )
      .then((data) => {
        if (!active) return;
        setSwitching(false);
        setBoard(data);
        setError(null);
        if (!day && data.day) {
          seededDay.current = data.day;
          setDay(data.day);
        }
      })
      .catch((e) => {
        if (!active) return;
        setSwitching(false);
        setError(e);
      });
    return () => {
      active = false;
    };
  }, [lg, day, refresh]);

  const games = useMemo(() => board?.events || [], [board]);
  const anyLive = games.some((g) => g.status.state === 'in');
  useEffect(() => {
    const id = setInterval(
      () => {
        if (document.visibilityState !== 'hidden') setRefresh((r) => r + 1);
      },
      anyLive ? LIVE_POLL_MS : IDLE_POLL_MS,
    );
    return () => clearInterval(id);
  }, [anyLive]);

  // ---- teams filter ----
  const teams = useAsyncData(() => getLeagueTeams(lg), [lg]);
  const [savedTeams, setSavedTeams] = usePersistentState(`selectedTeams:${lg}`, null);
  const allTeamIds = useMemo(() => (teams.data || []).map((t) => t.id), [teams.data]);
  const selectedTeams = Array.isArray(savedTeams) ? savedTeams : allTeamIds;
  const selected = useMemo(() => new Set(selectedTeams), [selectedTeams]);
  const [teamsOpen, setTeamsOpen] = useState(false);
  const teamsRef = useRef(null);
  useEffect(() => {
    if (!teamsOpen) return undefined;
    const close = (e) => {
      if (!teamsRef.current?.contains(e.target)) setTeamsOpen(false);
    };
    document.addEventListener('pointerdown', close, true);
    return () => document.removeEventListener('pointerdown', close, true);
  }, [teamsOpen]);

  // ---- hide games ----
  const [hideMode, setHideMode] = useState(false);
  const [hiddenIds, setHiddenIds] = usePersistentState(`hiddenGames:${lg}`, []);
  const hiddenSet = useMemo(() => new Set(hiddenIds), [hiddenIds]);
  const toggleHidden = useCallback(
    (id) => setHiddenIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])),
    [setHiddenIds],
  );

  const teamGames = useMemo(
    () => (selected.size ? games.filter((g) => selected.has(g.away?.teamId) || selected.has(g.home?.teamId)) : []),
    [games, selected],
  );
  const shownGames = useMemo(
    () => (hideMode ? teamGames : teamGames.filter((g) => !hiddenSet.has(g.id))),
    [teamGames, hideMode, hiddenSet],
  );
  const counts = useMemo(() => {
    const visible = games.filter((g) => !hiddenSet.has(g.id));
    const weekTeams = new Set(games.flatMap((g) => [g.away?.teamId, g.home?.teamId]).filter(Boolean));
    const shownTeams = new Set(
      visible.flatMap((g) => [g.away?.teamId, g.home?.teamId]).filter((id) => id && selected.has(id)),
    );
    return {
      teamsShown: shownTeams.size,
      teamsTotal: weekTeams.size,
      gamesShown: visible.filter((g) => selected.has(g.away?.teamId) || selected.has(g.home?.teamId)).length,
      gamesTotal: games.length,
    };
  }, [games, hiddenSet, selected]);

  // ---- open game ----
  const [openGameId, setOpenGameId] = useState(null);
  const onUserToggle = useCallback((id, open) => setOpenGameId((prev) => (open ? id : prev === id ? null : prev)), []);
  const hasOpenGame = Boolean(openGameId) && shownGames.some((g) => g.id === openGameId);

  // around the open game: everything else fades (.game-focus), team-coloured
  // lines, tap outside to close, the slide up to the top of the scrolling box
  // and back (see useGameFocus)
  const panelRef = useRef(null);
  const openGame = hasOpenGame ? shownGames.find((g) => g.id === openGameId) : null;
  // BOX SCORE and LINES for every game shown, loaded quietly in the background
  // (see useBackgroundPrefetch). With live games on, it waits while one is open;
  // with none, it keeps going even then.
  const hasLive = shownGames.some((g) => g.status?.state === 'in');
  useBackgroundPrefetch(leagueBackgroundTasks(lg, shownGames), { paused: hasLive && hasOpenGame });
  const { focusSpace } = useGameFocus({
    openKey: openGame?.id,
    lineA: openGame ? teamLineColor(openGame.away?.team) : null,
    lineB: openGame ? teamLineColor(openGame.home?.team) : null,
    onClose: () => setOpenGameId(null),
    panelRef,
  });

  // ---- sections ----
  const sections = useMemo(
    () =>
      SECTIONS.map((s) => {
        const days = groupByDay(
          shownGames.filter((g) =>
            s.key === 'pre' ? !['post', 'in'].includes(g.status.state) : g.status.state === s.key,
          ),
        );
        return { ...s, days, slots: days.flatMap((d) => d.slots) };
      }).filter((s) => s.slots.length),
    [shownGames],
  );
  const cookieName = `${lg}Collapsed_${day}`;
  const [savedCollapsed, setSavedCollapsed] = useState(null);
  // not saved anywhere: every new day starts from the default view
  useEffect(() => setSavedCollapsed(null), [cookieName]);
  // GAMES (hiding games): every section opens, so every game can be checked off
  useEffect(() => {
    if (hideMode) setSavedCollapsed(new Set());
  }, [hideMode]);
  const defaultCollapsed = useMemo(() => {
    const keys = sections.map((s) => s.key);
    // live games: LIVE and UPCOMING open; otherwise UPCOMING, else FINISHED
    const open = keys.includes('in') ? ['in', 'pre'] : keys.includes('pre') ? ['pre'] : ['post'];
    return new Set(keys.filter((k) => !open.includes(k)));
  }, [sections]);
  const collapsed = savedCollapsed || defaultCollapsed;
  const toggleSection = (key, list) => {
    const next = new Set(collapsed);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSavedCollapsed(next);
    if (list.some((g) => g.id === openGameId)) setOpenGameId(null);
  };

  // ---- day navigation: the nearest earlier / later day that has games ----
  const [stepping, setStepping] = useState(false);
  const step = (dir) => {
    if (!day || stepping) return;
    setStepping(true);
    findGameDay(lg, day, dir)
      .then((next) => {
        if (next) {
          if (next !== day) setSwitching(true);
          setDay(next);
          setOpenGameId(null);
        }
      })
      .catch(() => {})
      .finally(() => setStepping(false));
  };
  const [pickingDay, setPickingDay] = useState(false);
  const dayRef = useRef(null);
  useEffect(() => {
    if (!pickingDay) return undefined;
    const close = (e) => {
      if (!dayRef.current?.contains(e.target)) setPickingDay(false);
    };
    document.addEventListener('pointerdown', close, true);
    return () => document.removeEventListener('pointerdown', close, true);
  }, [pickingDay]);
  const loadEventDays = useCallback((y, m) => getLeagueEventDays(lg, y, m), [lg]);
  const pickDay = (key) => {
    if (key !== day) setSwitching(true);
    setDay(key);
    setPickingDay(false);
    setOpenGameId(null);
  };

  if (error && !board) {
    return (
      <div className="nfl-data-container">
        <p className="noGames">Couldn't load the {league.label} schedule.</p>
      </div>
    );
  }
  if (!board) {
    return (
      <div className="nfl-data-container loading-background">
        <LoadingField />
      </div>
    );
  }

  return (
    <ParlayProvider>
      {/* pinned layout: the header stays put and everything under it scrolls in
          its own box; game-focus fades everything but an open game */}
      <div className="nfl-data-container pinned-layout">
        <div>
          <div className={`matchup-card fade-in ${hasOpenGame ? 'game-focus' : ''} ${focusSpace ? 'focus-space' : ''}`}>
            <div className="nflDataNavbar pinned-header">
              <h1 className={`nfl-title sport-title-${lg}`}>
                <span className="nfl-title-badge">{league.label}</span>
                <TitleText>Stats Guide</TitleText>
              </h1>
              <div className="controls">
                <div className="controls-left">
                  <SportSwitcher current={lg} />
                </div>
                <div className="week-control" ref={dayRef}>
                  <button
                    type="button"
                    className="nfl-control-button week-step"
                    aria-label="Previous day"
                    onClick={() => step(-1)}
                  >
                    ◀
                  </button>
                  <button
                    type="button"
                    className="nfl-control-button week-button"
                    onClick={() => setPickingDay((o) => !o)}
                  >
                    <FitText>{day ? dayLabel(day) : 'TODAY'}</FitText>
                  </button>
                  <button
                    type="button"
                    className="nfl-control-button week-step"
                    aria-label="Next day"
                    onClick={() => step(1)}
                  >
                    ▶
                  </button>
                  {pickingDay && (
                    <div className="nfl-dropdown-menu week-dropdown league-day-picker">
                      <DayCalendar
                        value={day}
                        onPick={pickDay}
                        onToday={() => pickDay(null)}
                        loadEventDays={loadEventDays}
                      />
                    </div>
                  )}
                </div>
                <div className="controls-right">
                  <div className="teams-dropdown-wrapper" ref={teamsRef}>
                    <button type="button" className="nfl-control-button" onClick={() => setTeamsOpen((o) => !o)}>
                      <span className="control-label">TEAMS</span>
                      <span className="control-count">
                        {counts.teamsShown}/{counts.teamsTotal}
                      </span>
                    </button>
                    {teamsOpen && (
                      <div className="nfl-dropdown-menu">
                        <TeamsMenu
                          teams={teams.data || []}
                          selectedTeams={selectedTeams}
                          onTeamChange={(id) =>
                            setSavedTeams(
                              selectedTeams.includes(id)
                                ? selectedTeams.filter((x) => x !== id)
                                : [...selectedTeams, id],
                            )
                          }
                          onSelectAll={() => setSavedTeams(allTeamIds)}
                          onDeselectAll={() => setSavedTeams([])}
                        />
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    className={`nfl-control-button hide-games-button ${hideMode ? 'active' : ''}`}
                    aria-pressed={hideMode}
                    onClick={() => {
                      setOpenGameId(null);
                      setHideMode((h) => !h);
                    }}
                  >
                    <span className="control-label">GAMES</span>
                    <span className="control-count">
                      {counts.gamesShown}/{counts.gamesTotal}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            <div className="nfl-scroll-panel" ref={panelRef}>
              {switching && <LoadingField className="inline-loading" />}
              {!switching && (
                <div className={`matchup-container ${hasOpenGame ? 'has-open' : ''}`}>
                  {!shownGames.length ? (
                    <p className="noGames">
                      {!games.length
                        ? `No ${league.label} games on ${day ? dayLabel(day) : 'this day'}.`
                        : !teamGames.length
                          ? 'No games for your selected teams on this day.'
                          : 'Every game on this day is hidden. Use GAMES to bring them back.'}
                    </p>
                  ) : (
                    sections.map((section) => {
                      const list = section.slots.flatMap((s) => s.games);
                      return (
                        <div
                          key={section.key}
                          className={`game-section ${collapsed.has(section.key) ? 'collapsed' : ''}`}
                        >
                          <button
                            type="button"
                            className={`game-section-label ${section.key} ${collapsed.has(section.key) ? 'collapsed' : ''}`}
                            aria-expanded={!collapsed.has(section.key)}
                            onClick={() => toggleSection(section.key, list)}
                          >
                            <span className="game-section-name">
                              {section.key === 'pre' && day && relativeDay(dayFromKey(day)) !== 'TODAY'
                                ? relativeDay(dayFromKey(day)) || section.label
                                : section.label}
                              <span className="gold-caret" aria-hidden="true" />
                            </span>
                            <span className="game-section-count">{list.length}</span>
                          </button>
                          <SlideOpen open={!collapsed.has(section.key)} className="game-section-body">
                            {/* one container per day (WED 11/11 ... TODAY), each start time inside it */}
                            {section.days.map((d) => (
                              <div key={d.key} className="game-container game-group">
                                <div className="game-group-time">
                                  <span>{d.label}</span>
                                  {d.when && <span className="game-group-when">{d.when}</span>}
                                </div>
                                {d.slots.map((slot) => (
                                  <React.Fragment key={slot.label || 'all'}>
                                    {slot.label && <div className="game-group-subtime">{slot.label}</div>}
                                    {slot.games.map((game) => (
                                      <TeamGameCard
                                        key={game.id}
                                        lg={lg}
                                        game={game}
                                        isOpen={openGameId === game.id}
                                        onUserToggle={onUserToggle}
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
                      );
                    })
                  )}
                </div>
              )}

              {day && !switching && (
                <ModelPanel spreadLabel={lg === 'mlb' ? 'Run line' : 'Spread'}>
                  {({ unit, scope, filter, minOdds }) => (
                    <>
                      <ConfidentBets
                        items={asBetItems(games)}
                        loadTickets={leagueTicketLoader(lg)}
                        stake={unit}
                        scope={scope}
                        filter={filter}
                        minOdds={minOdds}
                        period="DAY"
                      />
                      <ModelResults
                        games={games}
                        stake={unit}
                        scope={scope}
                        filter={filter}
                        minOdds={minOdds}
                        gradeGame={graderFor(lg)}
                        lg={lg}
                        loadSeason={seasonLoaderFor(lg)}
                        period="DAY"
                        spreadLabel={lg === 'mlb' ? 'Run line' : 'Spread'}
                        note={MODEL_NOTES[lg]}
                      />
                    </>
                  )}
                </ModelPanel>
              )}
              {!switching && <SettingsPanel />}
              {!switching && <LastUpdated />}
            </div>
            <ParlayBar />
            {hideMode && (
              <button type="button" className="hide-done-bar" onClick={() => setHideMode(false)}>
                DONE
              </button>
            )}
          </div>
        </div>
      </div>
    </ParlayProvider>
  );
};

export default TeamSportPage;
