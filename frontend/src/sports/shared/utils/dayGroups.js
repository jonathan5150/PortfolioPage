// Games grouped by day, then by start time within the day:
// [{ key, label: 'SUN 11/15', when: 'TODAY', slots: [{ label: '8:30AM', games }] }]
// Starts within `mergeWindowMs` of the one before share a time label
// ("3:05PM / 3:25PM"). Postponed / undated games get a group of their own.
import { relativeDay } from './relativeDay';

export const clockLabel = (d) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).replace(/\s+/g, '');
// One game's own start time (7:15PM), shown in gold at its top left; a
// postponed or undated game gets `fallback` (its group's label) instead.
export const startLabel = (game, fallback = '') =>
  game?.date && !game.status?.isPostponed ? clockLabel(new Date(game.date)) : fallback;

export const dayHeading = (d) =>
  `${d.toLocaleDateString([], { weekday: 'short' }).toUpperCase()} ${d.getMonth() + 1}/${d.getDate()}`;

export const groupByDay = (games, { mergeWindowMs = 0 } = {}) => {
  const days = [];
  const other = new Map(); // postponed / TBD, by their status text
  [...games]
    .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0))
    .forEach((game) => {
      if (game.status?.isPostponed || !game.date) {
        const label = game.status?.isPostponed ? game.status.shortDetail || 'Postponed' : 'TBD';
        if (!other.has(label)) other.set(label, []);
        other.get(label).push(game);
        return;
      }
      const start = new Date(game.date);
      const key = start.toDateString();
      let day = days[days.length - 1];
      if (!day || day.key !== key) {
        day = { key, label: dayHeading(start), when: relativeDay(start), slots: [] };
        days.push(day);
      }
      const slot = day.slots[day.slots.length - 1];
      if (slot && start - slot.lastStart <= mergeWindowMs) {
        if (start.getTime() !== slot.lastStart.getTime()) slot.label = `${slot.label} / ${clockLabel(start)}`;
        slot.games.push(game);
        slot.lastStart = start;
      } else {
        day.slots.push({ label: clockLabel(start), games: [game], lastStart: start });
      }
    });
  other.forEach((list, label) =>
    days.push({ key: `other:${label}`, label, when: null, slots: [{ label: '', games: list }] }),
  );
  return days;
};
