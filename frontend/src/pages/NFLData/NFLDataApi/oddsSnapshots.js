// Odds are shown live until kickoff, then frozen at what they were about 30
// minutes before the game. While a game hasn't started, every lines / TD odds
// load is saved here (on this device); once it starts, the panels read the
// saved copy instead of whatever the feeds show mid-game.

const KEY = 'nflStatsWizard:oddsSnapshots:v1';
const MINUTE = 60 * 1000;
export const FREEZE_BEFORE_KICKOFF = 30 * MINUTE;
const KEEP_FOR = 10 * 24 * 60 * MINUTE; // drop games that kicked off 10+ days ago

const read = () => {
  try {
    return JSON.parse(window.localStorage.getItem(KEY) || '{}') || {};
  } catch {
    return {};
  }
};

const write = (all) => {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // storage full or blocked: odds just won't be frozen on this device
  }
};

const kickoffOf = (game) => (game?.date ? Date.parse(game.date) : NaN);

// Started (or past its kickoff time): show frozen odds from here on.
export const hasStarted = (game, now = Date.now()) =>
  game?.status?.state === 'in' || game?.status?.state === 'post' || now >= kickoffOf(game);

// kind: 'lines' (ESPN / DraftKings game lines), 'td' (anytime TD prices) or
// PICKS_SNAPSHOT (the engine's winner / spread / total picks, as shown on LINES).
// Keeps two copies per game: the latest one taken 30+ minutes before kickoff
// ("anchor"), and the first one taken inside that last half hour ("late", only
// used if this device never saw the game earlier).
export const saveOddsSnapshot = (game, kind, odds, now = Date.now()) => {
  const kickoff = kickoffOf(game);
  if (!odds || !Number.isFinite(kickoff) || hasStarted(game, now)) return;
  const all = read();
  Object.keys(all).forEach((id) => {
    if (!(all[id]?.kickoff > now - KEEP_FOR)) delete all[id];
  });
  const entry = all[game.id] || { kickoff };
  const saved = { ...(entry[kind] || {}) };
  if (now <= kickoff - FREEZE_BEFORE_KICKOFF) saved.anchor = { t: now, odds };
  else if (!saved.late) saved.late = { t: now, odds };
  all[game.id] = { ...entry, kickoff, [kind]: saved };
  write(all);
};

export const frozenOdds = (game, kind) => {
  const saved = read()[game?.id]?.[kind];
  return saved?.anchor?.odds || saved?.late?.odds || null;
};

// Snapshot kind for the engine's line picks. Versioned: picks saved by an older
// engine are ignored instead of shown and graded as if the current one made them.
export const PICKS_SNAPSHOT = 'picks:v4';
