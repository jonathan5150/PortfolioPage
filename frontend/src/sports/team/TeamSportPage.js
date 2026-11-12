import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SportSwitcher from '../SportSwitcher';
import SlideOpen from '../../components/NFLDataComponents/shared/SlideOpen';
import LastUpdated from '../../components/NFLDataComponents/shared/LastUpdated';
import usePersistentState from '../../components/NFLDataComponents/shared/usePersistentState';
import useAsyncData from '../../components/NFLDataComponents/shared/useAsyncData';
import { readCookie, writeCookie } from '../../components/NFLDataComponents/shared/cookies';
import TeamsMenu from '../../components/NFLDataComponents/NFLDataNavbar/NFLDataNavbarComponents/TeamsMenu';
import LoadingField from '../../components/NFLDataComponents/shared/LoadingField';
import { betReturn, gradeLinePicks, linePickBets } from '../../pages/NFLData/NFLDataApi/picks';
import { runWithConcurrency } from '../../pages/NFLData/NFLDataApi/http';
import {
  LEAGUES,
  dayFromKey,
  findGameDay,
  getLeagueOdds,
  getLeaguePredictor,
  getLeagueScoreboard,
  getLeagueTeams,
} from './leagueApi';
import { buildLeaguePicks } from './leaguePicks';
import TeamGameCard from './TeamGameCard';
import '../../pages/NFLData/NFLData.scss';
import './TeamSport.scss';

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

const readCollapsed = (name) => {
  const v = readCookie(name);
  if (v === null) return null;
  return new Set(v.split(',').filter((k) => k && k !== 'none'));
};

// ---------- the day's model results ----------

const money = (n) => `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const signed = (n) => `${n > 0.004 ? '+' : n < -0.004 ? '-' : ''}${money(n)}`;
const tone = (n) => (n > 0.004 ? 'up' : n < -0.004 ? 'down' : 'even');
const pct = ({ W, L }) => (W + L ? `${Math.round((W / (W + L)) * 100)}%` : '—');
const MARKET_ROWS = [
  { key: 'winner', label: 'Moneyline' },
  { key: 'spread', label: 'Spread' }, // Run line for MLB (see below)
  { key: 'total', label: 'O/U' },
];

const DayModelResults = ({ lg, games, day }) => {
  const [open, setOpen] = useState(false);
  const finished = useMemo(() => games.filter((g) => g.status.state === 'post'), [games]);
  const ids = finished.map((g) => g.id).join(',');
  const graded = useAsyncData(
    async () => {
      const results = await runWithConcurrency(
        finished.map((game) => async () => {
          const [odds, predictor] = await Promise.all([
            getLeagueOdds(lg, game.id, { final: true }).catch(() => null),
            getLeaguePredictor(lg, game.id).catch(() => null),
          ]);
          if (!odds) return null;
          const picks = buildLeaguePicks({ lg, game, odds, predictor });
          return { grades: gradeLinePicks(picks, game, odds), bets: linePickBets(picks, game, odds) };
        }),
        3,
      );
      return results.map((r) => (r.ok ? r.value : null)).filter(Boolean);
    },
    [lg, ids],
    { enabled: open && finished.length > 0 },
  );
  const rows = MARKET_ROWS.map(({ key, label: base }) => {
    const label = key === 'spread' && lg === 'mlb' ? 'Run line' : base;
    const rec = { W: 0, L: 0, profit: 0 };
    (graded.data || []).forEach((g) => {
      const bet = g.bets.find((b) => b.key === key);
      if (!bet) return;
      if (bet.result === 'W' || bet.result === 'L') rec[bet.result] += 1;
      rec.profit += betReturn(10, bet.price, bet.result) - 10;
    });
    return { key, label, ...rec };
  });
  const all = rows.reduce((a, r) => ({ W: a.W + r.W, L: a.L + r.L, profit: a.profit + r.profit }), {
    W: 0,
    L: 0,
    profit: 0,
  });

  return (
    <div className="gold-box prediction-record-outer">
      <div className="prediction-record">
        <button
          type="button"
          className={`bet-results-toggle gold-box-text ${open ? 'open' : ''}`}
          onClick={() => setOpen((o) => !o)}
        >
          <span className="game-section-name">
            {open ? 'HIDE MODEL RESULTS' : 'SHOW MODEL RESULTS'}
            <span className="gold-caret" aria-hidden="true" />
          </span>
        </button>
        <SlideOpen open={open} className="model-results-body">
          <div className="model-results-content">
            <div className="prediction-record-title">{dayLabel(day)} · EVERY PICK · $10 EACH</div>
            {!finished.length ? (
              <div className="prediction-record-loading">No finished games on this day yet.</div>
            ) : !graded.data ? (
              <div className="prediction-record-loading">Grading the day's picks…</div>
            ) : (
              <>
                {[...rows, { key: 'all', label: 'Total', ...all }].map((r) => (
                  <div key={r.key} className={`season-row ${r.key === 'all' ? 'total' : ''}`}>
                    <span>{r.label}</span>
                    <span className="prediction-record-wl">
                      {r.W}-{r.L}
                    </span>
                    <span className="prediction-record-pct">{pct(r)}</span>
                    <span className={`bet-return ${tone(r.profit)}`}>{signed(r.profit)}</span>
                  </div>
                ))}
                <div className="league-model-note">
                  The {LEAGUES[lg].label} picks are leans from ESPN's model and the betting market. They haven't been
                  backtested like the NFL model yet.
                </div>
              </>
            )}
          </div>
        </SlideOpen>
      </div>
    </div>
  );
};

// ---------- the page ----------

const TeamSportPage = ({ lg }) => {
  const league = LEAGUES[lg];
  const [day, setDay] = useState(null); // YYYYMMDD; null until ESPN says which day is current
  const [board, setBoard] = useState(null);
  const [error, setError] = useState(null);
  const [refresh, setRefresh] = useState(0);

  // the current day (ESPN's pick) on first load, then whichever day is chosen
  useEffect(() => {
    let active = true;
    getLeagueScoreboard(lg, day, { live: refresh > 0 })
      .then((data) => {
        if (!active) return;
        setBoard(data);
        setError(null);
        if (!day && data.day) setDay(data.day);
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
  useEffect(() => setSavedCollapsed(day ? readCollapsed(cookieName) : null), [cookieName, day]);
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
    writeCookie(cookieName, next.size ? [...next].join(',') : 'none');
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
    <div className="nfl-data-container">
      <div>
        <div className="matchup-card fade-in">
          <div className="nflDataNavbar">
            <h1 className="nfl-title">
              <span className="nfl-title-badge">{league.label}</span>
              <span className="nfl-title-text">Stats Guide</span>
            </h1>
            <div className="controls">
              <div className="controls-left">
                <SportSwitcher current={lg} />
              </div>
              <div className="week-control">
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
                  {day ? dayLabel(day) : 'TODAY'}
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
                    <input
                      type="date"
                      value={day ? `${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6, 8)}` : ''}
                      onChange={(e) => {
                        if (!e.target.value) return;
                        setDay(e.target.value.replace(/-/g, ''));
                        setPickingDay(false);
                        setOpenGameId(null);
                      }}
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
                            selectedTeams.includes(id) ? selectedTeams.filter((x) => x !== id) : [...selectedTeams, id],
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
                        {section.label}
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

          {day && <DayModelResults lg={lg} games={games} day={day} />}
          <LastUpdated />
          {hideMode && (
            <button type="button" className="hide-done-bar" onClick={() => setHideMode(false)}>
              DONE
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeamSportPage;
