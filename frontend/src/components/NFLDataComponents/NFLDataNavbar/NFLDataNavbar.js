import React, { useEffect, useMemo, useRef } from 'react';
import TeamsMenu from './NFLDataNavbarComponents/TeamsMenu';
import SportSwitcher from '../../../sports/SportSwitcher';
import DayCalendar from '../../../sports/DayCalendar';
import { fetchJson } from '../../../pages/NFLData/NFLDataApi/http';

const pad = (n) => String(n).padStart(2, '0');
const dayKey = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
// every day key a week covers, start (inclusive) to end (exclusive)
const weekDays = (w) => {
  const out = new Set();
  if (!w?.startDate) return out;
  const end = new Date(w.endDate || w.startDate).getTime();
  const d = new Date(w.startDate);
  d.setHours(12, 0, 0, 0);
  for (let i = 0; i < 10 && d.getTime() < end; i += 1) {
    out.add(dayKey(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
};
// ESPN's NFL game days this season, YYYYMMDD
const nflGameDays = async () => {
  const json = await fetchJson('https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/calendar/ondays', {
    ttlMs: 6 * 60 * 60 * 1000,
  }).catch(() => null);
  return (json?.eventDate?.dates || []).map((d) => String(d).slice(0, 10).replace(/-/g, ''));
};

const shortSeasonType = (seasonType) => (seasonType === 1 ? 'PRE ' : '');

const NFLDataNavbar = ({
  teams,
  selectedTeams,
  onTeamChange,
  onSelectAll,
  onDeselectAll,
  calendar,
  seasons,
  season,
  seasonType,
  week,
  onSelectWeek,
  onSelectSeason,
  isTeamsMenuOpen,
  setIsTeamsMenuOpen,
  isWeekMenuOpen,
  setIsWeekMenuOpen,
  onOutsideClose,
  hideMode,
  counts,
  onToggleHideMode,
}) => {
  const teamsRef = useRef(null);
  const weekRef = useRef(null);

  // Close menus when tapping elsewhere (same behaviour as the MLB navbar).
  useEffect(() => {
    if (!isTeamsMenuOpen && !isWeekMenuOpen) return undefined;

    const handlePointerDown = (event) => {
      const inTeams = teamsRef.current?.contains(event.target);
      const inWeek = weekRef.current?.contains(event.target);
      if (!inTeams && !inWeek) {
        setIsTeamsMenuOpen(false);
        setIsWeekMenuOpen(false);
        onOutsideClose?.();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => document.removeEventListener('pointerdown', handlePointerDown, true);
  }, [isTeamsMenuOpen, isWeekMenuOpen, setIsTeamsMenuOpen, setIsWeekMenuOpen, onOutsideClose]);

  // Preseason weeks aren't offered: regular season and playoffs only.
  const seasonCalendar = useMemo(() => calendar.filter((section) => section.seasonType !== 1), [calendar]);

  const flatWeeks = useMemo(
    () => seasonCalendar.flatMap((section) => section.weeks.map((w) => ({ seasonType: section.seasonType, ...w }))),
    [seasonCalendar],
  );
  const currentIndex = flatWeeks.findIndex((w) => w.seasonType === seasonType && w.week === week);
  const currentWeek = flatWeeks[currentIndex];
  const prevWeek = currentIndex > 0 ? flatWeeks[currentIndex - 1] : null;
  const nextWeek = currentIndex >= 0 && currentIndex < flatWeeks.length - 1 ? flatWeeks[currentIndex + 1] : null;

  // the calendar: game days lit gold, the shown week drawn as one gold band;
  // picking any day jumps to the week it falls in
  const weekOfDay = (key) => flatWeeks.find((w) => weekDays(w).has(key)) || null;
  const selectedDays = useMemo(() => weekDays(currentWeek), [currentWeek]);
  const loadEventDays = useMemo(
    () => async (y, m) => {
      const prefix = `${y}${pad(m + 1)}`;
      const covered = new Set(flatWeeks.flatMap((w) => [...weekDays(w)]));
      return new Set((await nflGameDays()).filter((k) => k.startsWith(prefix) && covered.has(k)));
    },
    [flatWeeks],
  );
  const pickWeek = (w) => {
    if (!w) return;
    onSelectWeek(w.seasonType, w.week);
    setIsWeekMenuOpen(false);
  };
  const pickToday = () => {
    const today = dayKey(new Date());
    const now = Date.now();
    pickWeek(
      weekOfDay(today) ||
        flatWeeks.find((w) => new Date(w.startDate).getTime() > now) ||
        flatWeeks[flatWeeks.length - 1],
    );
  };

  const weekLabel = currentWeek
    ? `${/^(pre|hall)/i.test(currentWeek.label) ? '' : shortSeasonType(seasonType)}${currentWeek.label}`.toUpperCase()
    : week
      ? `WEEK ${week}`
      : 'WEEK';

  return (
    <div className="nflDataNavbar">
      <h1 className="nfl-title">
        <span className="nfl-title-badge">NFL</span>
        <span className="nfl-title-text">Stats Guide</span>
      </h1>

      <div className="controls">
        {/* sport picker (left half), the day / week picker, then TEAMS and GAMES */}
        <div className="controls-left">
          <SportSwitcher current="nfl" />
        </div>

        <div className="week-control" ref={weekRef}>
          <button
            type="button"
            className="nfl-control-button week-step"
            disabled={!prevWeek}
            aria-label="Previous week"
            onClick={() => prevWeek && onSelectWeek(prevWeek.seasonType, prevWeek.week)}
          >
            ◀
          </button>

          <button
            type="button"
            className="nfl-control-button week-button"
            onClick={() => {
              setIsWeekMenuOpen((prev) => !prev);
              setIsTeamsMenuOpen(false);
            }}
          >
            {weekLabel}
          </button>

          <button
            type="button"
            className="nfl-control-button week-step"
            disabled={!nextWeek}
            aria-label="Next week"
            onClick={() => nextWeek && onSelectWeek(nextWeek.seasonType, nextWeek.week)}
          >
            ▶
          </button>

          {isWeekMenuOpen && (
            <div className="nfl-dropdown-menu week-dropdown league-day-picker">
              <DayCalendar
                value={[...selectedDays][0] || null}
                selectedDays={selectedDays}
                onPick={(key) => pickWeek(weekOfDay(key))}
                onToday={pickToday}
                loadEventDays={loadEventDays}
              />
            </div>
          )}
        </div>

        <div className="controls-right">
          <div className="teams-dropdown-wrapper" ref={teamsRef}>
            <button
              type="button"
              className="nfl-control-button"
              onClick={() => {
                setIsTeamsMenuOpen((prev) => !prev);
                setIsWeekMenuOpen(false);
              }}
            >
              <span className="control-label">TEAMS</span>
              {counts && (
                <span className="control-count">
                  {counts.teamsShown}/{counts.teamsTotal}
                </span>
              )}
            </button>

            {isTeamsMenuOpen && (
              <div className="nfl-dropdown-menu">
                <TeamsMenu
                  teams={teams}
                  selectedTeams={selectedTeams}
                  onTeamChange={onTeamChange}
                  onSelectAll={onSelectAll}
                  onDeselectAll={onDeselectAll}
                />
              </div>
            )}
          </div>
          <button
            type="button"
            className={`nfl-control-button hide-games-button ${hideMode ? 'active' : ''}`}
            aria-pressed={Boolean(hideMode)}
            onClick={() => {
              setIsTeamsMenuOpen(false);
              setIsWeekMenuOpen(false);
              onToggleHideMode?.();
            }}
          >
            <span className="control-label">GAMES</span>
            {counts && (
              <span className="control-count">
                {counts.gamesShown}/{counts.gamesTotal}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NFLDataNavbar;
