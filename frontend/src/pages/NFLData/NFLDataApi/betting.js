// Pure betting helpers: parse ESPN sportsbook data, grade past games against
// their closing lines, and turn the numbers into readable "highlights".
// No network or React in here, so everything is unit tested with fixtures.

import { parseBetslipLink } from './sportsbookOdds';

const num = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (/^even$/i.test(String(value).trim())) return 100;
  const n = Number(String(value).replace(/[,+]/g, ''));
  return Number.isFinite(n) ? n : null;
};


// ---------- formatting ----------

export const fmtLine = (n) => {
  if (n === null || n === undefined) return '—';
  if (n === 0) return 'PK';
  return n > 0 ? `+${n}` : String(n);
};

export const fmtOdds = (n) => {
  if (n === null || n === undefined) return '—';
  return n > 0 ? `+${n}` : String(n);
};

// Moneyline -> implied win probability (0-100), ignoring the book's vig.
export const impliedProbability = (moneyLine) => {
  if (moneyLine === null || moneyLine === undefined || moneyLine === 0) return null;
  return moneyLine < 0 ? (-moneyLine / (-moneyLine + 100)) * 100 : (100 / (moneyLine + 100)) * 100;
};

const recordText = (r, keys = ['W', 'L', 'P']) =>
  keys
    .filter((k, i) => i < 2 || r[k])
    .map((k) => r[k] || 0)
    .join('-');

// ---------- parsers ----------

const parseOddsSide = (t, fallbackSpread) => ({
  favorite: Boolean(t?.favorite),
  moneyLine: num(t?.moneyLine ?? t?.current?.moneyLine?.american),
  openMoneyLine: num(t?.open?.moneyLine?.american),
  spreadLine: num(t?.current?.pointSpread?.american) ?? fallbackSpread,
  openSpreadLine: num(t?.open?.pointSpread?.american),
  spreadOdds: num(t?.spreadOdds ?? t?.current?.spread?.american),
});

// DraftKings bet-slip links in ESPN's odds item, keyed by their rel.
const LINK_RELS = { home: 'homeMl', away: 'awayMl', homeSpread: 'homeSpread', awaySpread: 'awaySpread', over: 'over', under: 'under' };

export const parseOddsLinks = (links = []) => {
  const out = {};
  links.forEach((link) => {
    const rel = (link?.rel || []).find((r) => LINK_RELS[r]);
    const parsed = rel && parseBetslipLink(link.href);
    if (parsed) out[LINK_RELS[rel]] = parsed;
  });
  return out;
};

// core API: events/{id}/competitions/{id}/odds. `spread` is the HOME team's line.
export const parseEventOdds = (json) => {
  const items = (json?.items || [])
    .filter((i) => i && (i.details || i.overUnder !== undefined || i.spread !== undefined))
    .sort((a, b) => (a.provider?.priority ?? 99) - (b.provider?.priority ?? 99));
  const item = items[0];
  if (!item) return null;

  const homeSpread = num(item.spread) ?? num(item.homeTeamOdds?.current?.pointSpread?.american);

  return {
    provider: item.provider?.name || 'Sportsbook',
    details: item.details || '',
    homeSpread,
    away: parseOddsSide(item.awayTeamOdds, homeSpread === null ? null : -homeSpread),
    home: parseOddsSide(item.homeTeamOdds, homeSpread),
    total: {
      line: num(item.overUnder ?? item.current?.total?.american),
      openLine: num(item.open?.total?.american),
      overOdds: num(item.overOdds ?? item.current?.over?.american),
      underOdds: num(item.underOdds ?? item.current?.under?.american),
    },
    links: parseOddsLinks(item.links),
  };
};

// core API: events/{id}/competitions/{id}/predictor (ESPN FPI).
export const parsePredictor = (json) => {
  const pick = (side) => num(json?.[side]?.statistics?.find((s) => s.name === 'gameProjection')?.value);
  const home = pick('homeTeam');
  const away = pick('awayTeam');
  if (home === null && away === null) return null;
  return { home: home ?? (away !== null ? 100 - away : null), away: away ?? 100 - home };
};

// ---------- grading past games ----------

// Grades one completed game for `teamId` against its closing line and total.
export const gradeGame = (teamId, game, odds) => {
  const isHome = game.home?.teamId === teamId;
  const self = isHome ? game.home : game.away;
  const opp = isHome ? game.away : game.home;
  if (self?.score === null || self?.score === undefined || opp?.score === null || opp?.score === undefined) {
    return null;
  }

  const margin = self.score - opp.score;
  const line = odds?.homeSpread === null || odds?.homeSpread === undefined ? null : isHome ? odds.homeSpread : -odds.homeSpread;
  const cover = line === null ? null : margin + line;
  const total = self.score + opp.score;
  const overUnder = odds?.total?.line ?? null;

  return {
    gameId: game.id,
    date: game.date,
    week: game.week,
    isHome,
    oppAbbr: opp.team?.abbreviation || '',
    pointsFor: self.score,
    pointsAgainst: opp.score,
    margin,
    su: margin > 0 ? 'W' : margin < 0 ? 'L' : 'T',
    line,
    ats: cover === null ? null : cover > 0 ? 'W' : cover < 0 ? 'L' : 'P',
    coverMargin: cover,
    total,
    overUnder,
    ou: overUnder === null ? null : total > overUnder ? 'O' : total < overUnder ? 'U' : 'P',
  };
};

const tally = (list, key) =>
  list.reduce((acc, g) => {
    if (g[key]) acc[g[key]] = (acc[g[key]] || 0) + 1;
    return acc;
  }, {});

const streak = (list, key) => {
  const results = list.map((g) => g[key]).filter((r) => r && r !== 'P');
  if (!results.length) return null;
  const last = results[results.length - 1];
  let count = 0;
  for (let i = results.length - 1; i >= 0 && results[i] === last; i -= 1) count += 1;
  return { type: last, count };
};

const avg = (values) => {
  const v = values.filter((x) => x !== null && x !== undefined && Number.isFinite(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

// `graded` must be in chronological order.
export const computeTeamTrends = (graded) => {
  const games = graded.filter(Boolean);
  const withLine = games.filter((g) => g.ats);
  return {
    games: games.length,
    su: tally(games, 'su'),
    ats: tally(withLine, 'ats'),
    atsFav: tally(withLine.filter((g) => g.line < 0), 'ats'),
    atsDog: tally(withLine.filter((g) => g.line > 0), 'ats'),
    atsHome: tally(withLine.filter((g) => g.isHome), 'ats'),
    atsAway: tally(withLine.filter((g) => !g.isHome), 'ats'),
    ou: tally(games.filter((g) => g.ou), 'ou'),
    ppg: avg(games.map((g) => g.pointsFor)),
    papg: avg(games.map((g) => g.pointsAgainst)),
    avgCover: avg(withLine.map((g) => g.coverMargin)),
    suStreak: streak(games, 'su'),
    atsStreak: streak(withLine, 'ats'),
    last5: games.slice(-5),
  };
};

// ---------- parlays ----------

export const americanToDecimal = (american) => {
  if (american === null || american === undefined || american === 0) return null;
  return american > 0 ? 1 + american / 100 : 1 + 100 / -american;
};

export const decimalToAmerican = (decimal) => {
  if (!decimal || decimal <= 1) return null;
  return decimal >= 2 ? Math.round((decimal - 1) * 100) : Math.round(-100 / (decimal - 1));
};

// Combined American odds for the legs that have a price.
export const parlayOdds = (legs) => {
  const priced = legs.filter((l) => americanToDecimal(l.odds) !== null);
  if (!priced.length) return null;
  return decimalToAmerican(priced.reduce((acc, l) => acc * americanToDecimal(l.odds), 1));
};

export { recordText };
