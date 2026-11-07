import React from 'react';

const formatRange = (start, end) => {
  if (!start) return '';
  const opts = { month: 'numeric', day: 'numeric' };
  const s = new Date(start).toLocaleDateString([], opts);
  const e = end ? new Date(new Date(end).getTime() - 1).toLocaleDateString([], opts) : '';
  return e && e !== s ? `${s}–${e}` : s;
};

const WeekMenu = ({ calendar, seasons, season, seasonType, week, onSelectWeek, onSelectSeason }) => (
  <div className="nfl-menu week-menu">
    <div className="week-menu-season">
      <select value={season ?? ''} onChange={(e) => onSelectSeason(Number(e.target.value))} aria-label="Season">
        {seasons.map((s) => (
          <option key={s} value={s}>
            {s} SEASON
          </option>
        ))}
      </select>
    </div>

    <div className="week-menu-list">
      {calendar.map((section) => (
        <div key={section.seasonType} className="week-menu-section">
          <div className="week-menu-section-title">{section.label}</div>
          <ul>
            {section.weeks.map((w) => {
              const active = section.seasonType === seasonType && w.week === week;
              return (
                <li key={`${section.seasonType}-${w.week}`}>
                  <button
                    type="button"
                    className={`week-option ${active ? 'active' : ''}`}
                    onClick={() => onSelectWeek(section.seasonType, w.week)}
                  >
                    <span>{w.label}</span>
                    <span className="week-option-dates">{formatRange(w.startDate, w.endDate)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  </div>
);

export default WeekMenu;
