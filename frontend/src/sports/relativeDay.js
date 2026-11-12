// "TODAY", "TOMORROW", "2 DAYS FROM NOW"... for a date on or after today
// (calendar days, local time); null for anything in the past.
export const relativeDay = (date, now = new Date()) => {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const b = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const days = Math.round((b - a) / 86400000);
  if (days < 0) return null;
  if (days === 0) return 'TODAY';
  if (days === 1) return 'TOMORROW';
  return `${days} DAYS FROM NOW`;
};

export default relativeDay;
