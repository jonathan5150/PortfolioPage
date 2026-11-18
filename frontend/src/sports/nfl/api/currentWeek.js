// Which NFL week the page opens on. ESPN's scoreboard calls a week "current"
// from Wednesday to Wednesday, so it keeps showing a finished week until
// midweek. Once every game of that week is final and the day of its last game
// has passed (on this device's calendar), the next week is the one to show:
// Tuesday after Monday night, say.

const dayKey = (d) => {
  const x = new Date(d);
  return x.getFullYear() * 10000 + (x.getMonth() + 1) * 100 + x.getDate();
};

const isOver = (g) => g?.status?.state === 'post' || g?.status?.isPostponed || g?.status?.isCanceled;

// The week after board's week on ESPN's calendar ({ season, seasonType, week }),
// or null when board's week isn't over yet, or there's no week after it.
export const weekAfterFinished = (board, now = new Date()) => {
  const games = board?.events || [];
  if (!games.length || !games.every(isOver)) return null;
  const lastKickoff = Math.max(...games.map((g) => new Date(g.date).getTime()).filter(Number.isFinite));
  if (!Number.isFinite(lastKickoff) || dayKey(now) <= dayKey(lastKickoff)) return null;

  // every week in order: preseason, regular season, postseason
  const weeks = (board.calendar || []).flatMap((section) =>
    (section.weeks || []).map((w) => ({ seasonType: section.seasonType, week: w.week })),
  );
  const at = weeks.findIndex((w) => w.seasonType === board.seasonType && w.week === board.week);
  const next = at >= 0 ? weeks[at + 1] : null;
  return next ? { season: board.season, seasonType: next.seasonType, week: next.week } : null;
};
