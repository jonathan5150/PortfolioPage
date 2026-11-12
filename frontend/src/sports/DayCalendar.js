import React, { useEffect, useState } from 'react';
import useAsyncData from '../components/NFLDataComponents/shared/useAsyncData';
import './DayCalendar.scss';

// A black-and-gold month calendar for picking a day. Days with games / events
// are lit gold (loadEventDays(year, monthIndex) -> Set of 'YYYYMMDD'); the
// chosen day is solid gold; TODAY jumps back to the current day.
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const pad = (n) => String(n).padStart(2, '0');
const keyOf = (y, m, d) => `${y}${pad(m + 1)}${pad(d)}`;
const fromKey = (k) => (k ? { y: Number(k.slice(0, 4)), m: Number(k.slice(4, 6)) - 1 } : null);

// selectedDays (optional): a set of days to show as chosen instead of value, e.g. an
// NFL week; only its days with games light up, and value then just picks the month.
const DayCalendar = ({ value, selectedDays, onPick, onToday, loadEventDays }) => {
  const now = new Date();
  const todayKey = keyOf(now.getFullYear(), now.getMonth(), now.getDate());
  const start = fromKey(value) || { y: now.getFullYear(), m: now.getMonth() };
  const [view, setView] = useState(start);
  // follow the chosen day when it changes from outside (arrows, TODAY)
  useEffect(() => {
    const v = fromKey(value);
    if (v) setView(v);
  }, [value]);

  const events = useAsyncData(() => loadEventDays(view.y, view.m), [view.y, view.m]);
  const lit = events.data || new Set();

  const shift = (dir) =>
    setView((v) => {
      const d = new Date(v.y, v.m + dir, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });

  const firstWeekday = new Date(view.y, view.m, 1).getDay();
  const days = new Date(view.y, view.m + 1, 0).getDate();
  const cells = [
    ...Array.from({ length: firstWeekday }, (_, i) => ({ blank: true, id: `b${i}` })),
    ...Array.from({ length: days }, (_, i) => ({ d: i + 1, key: keyOf(view.y, view.m, i + 1) })),
  ];
  const monthName = new Date(view.y, view.m, 1).toLocaleString([], { month: 'long' }).toUpperCase();

  return (
    <div className="day-calendar" role="dialog" aria-label="Pick a day">
      <div className="day-calendar-head">
        <button type="button" className="day-calendar-nav" aria-label="Previous month" onClick={() => shift(-1)}>
          ◀
        </button>
        <span className="day-calendar-title">
          {monthName} <span className="day-calendar-year">{view.y}</span>
        </span>
        <button type="button" className="day-calendar-nav" aria-label="Next month" onClick={() => shift(1)}>
          ▶
        </button>
      </div>

      <div className="day-calendar-grid">
        {WEEKDAYS.map((w, i) => (
          // eslint-disable-next-line react/no-array-index-key
          <span key={`w${i}`} className="day-calendar-weekday">
            {w}
          </span>
        ))}
        {cells.map((c) =>
          c.blank ? (
            <span key={c.id} />
          ) : (
            <button
              type="button"
              key={c.key}
              className={[
                'day-calendar-day',
                lit.has(c.key) ? 'has-events' : '',
                (selectedDays ? selectedDays.has(c.key) && lit.has(c.key) : c.key === value) ? 'selected' : '',
                c.key === todayKey ? 'today' : '',
              ].join(' ')}
              onClick={() => onPick(c.key)}
            >
              {c.d}
            </button>
          ),
        )}
      </div>

      <div className="day-calendar-foot">
        <span className={`day-calendar-status ${events.loading ? 'loading' : ''}`}>
          {events.loading
            ? 'Finding game days…'
            : lit.size
              ? `${lit.size} day${lit.size === 1 ? '' : 's'} with games`
              : 'No games this month'}
        </span>
        <button type="button" className="day-calendar-today" onClick={onToday}>
          TODAY
        </button>
      </div>
    </div>
  );
};

export default DayCalendar;
