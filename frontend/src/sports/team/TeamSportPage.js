import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import FitText from '../../components/NFLDataComponents/shared/FitText';
import SportSwitcher from '../SportSwitcher';
import DayCalendar from '../DayCalendar';
import { relativeDay } from '../relativeDay';
import SlideOpen from '../../components/NFLDataComponents/shared/SlideOpen';
import LastUpdated from '../../components/NFLDataComponents/shared/LastUpdated';
import usePersistentState from '../../components/NFLDataComponents/shared/usePersistentState';
import useAsyncData from '../../components/NFLDataComponents/shared/useAsyncData';
import TeamsMenu from '../../components/NFLDataComponents/NFLDataNavbar/NFLDataNavbarComponents/TeamsMenu';
import LoadingField from '../../components/NFLDataComponents/shared/LoadingField';
import { ParlayProvider } from '../../components/NFLDataComponents/shared/ParlayContext';
import ParlayBar from '../../components/NFLDataComponents/ParlayBar/ParlayBar';
import { gradeLinePicks, linePickBets } from '../../pages/NFLData/NFLDataApi/picks';
import { ModelResults, cachedGrader } from '../../components/NFLDataComponents/GameList/PredictionRecord';
import {
  LEAGUES,
  dayFromKey,
  findGameDay,
  getEarlierGames,
  getLeagueEventDays,
  getLeagueOdds,
  getLeaguePredictor,
  getLeagueScoreboard,
  getSeasonFinished,
  getLeagueTeams,
} from './leagueApi';
import { buildLeaguePicks, restDays } from './leaguePicks';
import { loadTeamModel } from '../../pages/NFLData/NFLDataApi/teamModels';
import TeamGameCard from './TeamGameCard';
import '../../pages/NFLData/NFLData.scss';
import './TeamSport.scss';
import '../SportTitles.scss';

const SECTIONS = [
  { key: 'post', label: 'FINISHED' },
  { key: 'in', label: 'LIVE' },
  { key: 'pre', label: 'UPCOMING' },
];
const LIVE_POLL_MS = 20000;
const IDLE_POLL_MS = 5 * 60 * 1000;

const dayLabel = (key) =>
  dayFromKey(key).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();
const timeLabel = (game) =>
  game.status.isPostponed
    ? game.status.shortDetail || 'Postponed'
    : game.date
      ? new Date(game.date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
      : 'TBD';

// games grouped by start time, earliest first
const timeSlots = (games) => {
  const byLabel = new Map();
  [...games]
    .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0))
    .forEach((g) => {
      const label = timeLabel(g);
      if (!byLabel.has(label)) byLabel.set(label, []);
      byLabel.get(label).push(g);
    });
  return [...byLabel.entries()].map(([label, list]) => ({ label, games: list }));
};

// ---------- model results: the NFL panel, graded with this league's engine ----------

// grades for one finished game (cached per league in localStorage; bump the
// version when the engine changes)
const graders = {};
const graderFor = (lg) => {
  if (!graders[lg]) {
    graders[lg] = cachedGrader(`${lg}GradedPicks:v2`, async (game) => {
      const [odds, predictor, earlier, teamModel] = await Promise.all([
        getLeagueOdds(lg, game.id, { final: true }).catch(() => null),
        getLeaguePredictor(lg, game.id).catch(() => null),
        lg === 'nba' ? getEarlierGames(lg, game).catch(() => []) : [],
        loadTeamModel(lg).catch(() => null),
      ]);
      if (!odds) return null;
      const rest = lg === 'nba' ? restDays(game, earlier) : null;
      const picks = buildLeaguePicks({ lg, game, odds, predictor, rest, teamModel });
      return { ...gradeLinePicks(picks, game, odds), bets: linePickBets(picks, game, odds) };
    });
  }
  return graders[lg];
};
const seasonLoaders = {};
const seasonFor = (lg) => {
  if (!seasonLoaders[lg]) seasonLoaders[lg] = () => getSeasonFinished(lg);
  return seasonLoaders[lg];
};
const MODEL_NOTES = {
  nba: "BET: the home team with 2+ more days of rest (covered 58% from 2022-26, 57% in the 2024-26 holdout). Winner leans are the model's value side (market plus head-to-head, rest and revenge), an underdog about half the time; no moneyline or total rule beat the closing prices.",
  mlb: "The MLB picks are leans from ESPN's model and the betting market. They haven't been backtested like the NFL and NBA models yet.",
};

// ---------- the page ----------

const TeamSportPage = ({ lg }) => {
  const league = LEAGUES[lg];
  const [day, setDay] = useState(null); // YYYYMMDD; null until ESPN says which day is current
  const [board, setBoard] = useState(null);
  const [error, setError] = useState(null);
  const [refresh, setRefresh] = useState(0);

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
      .then((data) => {
        if (!active) return;
        setBoard(data);
        setError(null);
        if (!day && data.day) {
          seededDay.current = data.day;
          setDay(data.day);
        }
      })
      .catch((e) => active && setError(e));
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

  // ---- sections ----
  const sections = useMemo(
    () =>
      SECTIONS.map((s) => ({
        ...s,
        slots: timeSlots(
          shownGames.filter((g) =>
            s.key === 'pre' ? !['post', 'in'].includes(g.status.state) : g.status.state === s.key,
          ),
        ),
      })).filter((s) => s.slots.length),
    [shownGames],
  );
  const cookieName = `${lg}Collapsed_${day}`;
  const [savedCollapsed, setSavedCollapsed] = useState(null);
  // not saved anywhere: every new day starts from the default view
  useEffect(() => setSavedCollapsed(null), [cookieName]);
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
      <div className="nfl-data-container">
        <div>
          <div className="matchup-card fade-in">
            <div className="nflDataNavbar">
              <h1 className={`nfl-title sport-title-${lg}`}>
                <span className="nfl-title-badge">{league.label}</span>
                <span className="nfl-title-text">Stats Guide</span>
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
                    <div key={section.key} className={`game-section ${collapsed.has(section.key) ? 'collapsed' : ''}`}>
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
                        {section.slots.map((slot) => (
                          <div key={slot.label} className="game-container game-group">
                            <div className="game-group-time">{slot.label}</div>
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
                          </div>
                        ))}
                      </SlideOpen>
                    </div>
                  );
                })
              )}
            </div>

            {day && (
              <ModelResults
                games={games}
                gradeGame={graderFor(lg)}
                loadSeason={seasonFor(lg)}
                period="DAY"
                spreadLabel={lg === 'mlb' ? 'Run line' : 'Spread'}
                note={MODEL_NOTES[lg]}
              />
            )}
            <LastUpdated />
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
