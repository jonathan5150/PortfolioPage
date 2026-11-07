import React, { useEffect, useMemo, useRef } from 'react';
import TeamsMenu from './NFLDataNavbarComponents/TeamsMenu';
import WeekMenu from './NFLDataNavbarComponents/WeekMenu';

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
  hasLiveGames,
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

  const flatWeeks = useMemo(
    () => calendar.flatMap((section) => section.weeks.map((w) => ({ seasonType: section.seasonType, ...w }))),
    [calendar]
  );
  const currentIndex = flatWeeks.findIndex((w) => w.seasonType === seasonType && w.week === week);
  const currentWeek = flatWeeks[currentIndex];
  const prevWeek = currentIndex > 0 ? flatWeeks[currentIndex - 1] : null;
  const nextWeek = currentIndex >= 0 && currentIndex < flatWeeks.length - 1 ? flatWeeks[currentIndex + 1] : null;

  const weekLabel = currentWeek
    ? `${/^(pre|hall)/i.test(currentWeek.label) ? '' : shortSeasonType(seasonType)}${currentWeek.label}`.toUpperCase()
    : week
      ? `WEEK ${week}`
      : 'WEEK';

  return (
    <div className="nflDataNavbar">
      <div className="logo-text-overlay">
        NFL Stats Guide
        {hasLiveGames && <span className="live-dot" title="Games in progress – updating live" />}
      </div>

      <div className="controls">
        <div className="teams-dropdown-wrapper" ref={teamsRef}>
          <button
            type="button"
            className="nfl-control-button"
            onClick={() => {
              setIsTeamsMenuOpen((prev) => !prev);
              setIsWeekMenuOpen(false);
            }}
          >
            TEAMS <span className={`arrow ${isTeamsMenuOpen ? 'open' : 'closed'}`}>▼</span>
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
            {weekLabel} <span className={`arrow ${isWeekMenuOpen ? 'open' : 'closed'}`}>▼</span>
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
            <div className="nfl-dropdown-menu week-dropdown">
              <WeekMenu
                calendar={calendar}
                seasons={seasons}
                season={season}
                seasonType={seasonType}
                week={week}
                onSelectWeek={(st, w) => {
                  onSelectWeek(st, w);
                  setIsWeekMenuOpen(false);
                }}
                onSelectSeason={onSelectSeason}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NFLDataNavbar;
