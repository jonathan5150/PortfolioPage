// NBA strategy search (node strategies.js): every game gets a moneyline, spread and total pick
// (like the app's season record); which side-choosing rules lose least / win most?
// Walk-forward features only. Seasons 2023..2026 to choose, 2027 (to date) to check.
const fs = require('fs');
const path = require('path');
const DIR = __dirname; // games-<season>.json from collect.js
const SEASONS = [2023, 2024, 2025, 2026, 2027];
const TRAIN = [2023, 2024, 2025, 2026];

const load = (yr) => JSON.parse(fs.readFileSync(path.join(DIR, `games-${yr}.json`), 'utf8')).map((g) => ({ ...g, season: yr }));
const payout = (p) => (p > 0 ? p / 100 : 100 / -p);
const implied = (p) => (p > 0 ? 100 / (p + 100) : -p / (-p + 100));
const DAY = 86400000;

const withFeatures = (games) => {
  const teams = new Map();
  const st = (id) => (teams.has(id) ? teams.get(id) : (teams.set(id, { g: [], last: null }), teams.get(id)));
  const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  const sum = (s, at) => ({
    n: s.g.length,
    rest: s.last ? Math.round((at - s.last) / DAY) : 7,
    b2b: s.last ? at - s.last < 1.6 * DAY : false,
    pf: avg(s.g.map((x) => x.pf)),
    pa: avg(s.g.map((x) => x.pa)),
    net: avg(s.g.map((x) => x.pf - x.pa)),
    net10: avg(s.g.slice(-10).map((x) => x.pf - x.pa)),
    ats: avg(s.g.map((x) => x.ats)), // avg cover margin
    ou: avg(s.g.slice(-10).map((x) => x.ou)), // avg total vs line, last 10
  });
  return [...games]
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map((g) => {
      const at = new Date(g.date).getTime();
      const H = st(`${g.season}:${g.home}`);
      const A = st(`${g.season}:${g.away}`);
      const f = { ...g, h: sum(H, at), a: sum(A, at) };
      const m = g.homeScore - g.awayScore;
      const ok = Number.isFinite(g.spread) && Number.isFinite(g.total);
      H.g.push({ pf: g.homeScore, pa: g.awayScore, ats: ok ? m + g.spread : 0, ou: ok ? g.homeScore + g.awayScore - g.total : 0 });
      A.g.push({ pf: g.awayScore, pa: g.homeScore, ats: ok ? -m - g.spread : 0, ou: ok ? g.homeScore + g.awayScore - g.total : 0 });
      H.last = at;
      A.last = at;
      return f;
    });
};

const games = SEASONS.flatMap((y) => withFeatures(load(y))).filter(
  (g) =>
    Number.isFinite(g.homeScore) && g.homeScore + g.awayScore > 0 &&
    Number.isFinite(g.awayScore) &&
    Math.abs(g.homeML) >= 100 &&
    Math.abs(g.awayML) >= 100 &&
    Number.isFinite(g.spread) &&
    Number.isFinite(g.total),
);

const margin = (g) => g.homeScore - g.awayScore;
const settle = {
  ml: (g, s) => (s === 'home' ? margin(g) > 0 : margin(g) < 0),
  spread: (g, s) => {
    const m = margin(g) + g.spread;
    if (m === 0) return null;
    return s === 'home' ? m > 0 : m < 0;
  },
  total: (g, s) => {
    const t = g.homeScore + g.awayScore;
    if (t === g.total) return null;
    return s === 'over' ? t > g.total : t < g.total;
  },
};
const price = {
  ml: (g, s) => (s === 'home' ? g.homeML : g.awayML),
  spread: (g, s) => (s === 'home' ? g.homeSpreadOdds : g.awaySpreadOdds) || -110,
  total: (g, s) => (s === 'over' ? g.overOdds : g.underOdds) || -110,
};
const profit = (mk, g, s) => {
  const w = settle[mk](g, s);
  if (w === null) return 0;
  return w ? payout(price[mk](g, s)) : -1;
};

// ---------- pieces ----------
const fav = (g) => (g.homeML <= g.awayML ? 'home' : 'away');
const dog = (g) => (fav(g) === 'home' ? 'away' : 'home');
const other = (s) => (s === 'home' ? 'away' : 'home');
const restEdge = (g) => g.h.rest - g.a.rest;
const HCA = 2.2;
const expMargin = (g, shrink = 12) => {
  const k = (n) => n / (n + shrink);
  return ((g.h.net ?? 0) * k(g.h.n) - (g.a.net ?? 0) * k(g.a.n)) / 2 + HCA + (g.h.b2b ? -1.5 : 0) + (g.a.b2b ? 1.5 : 0);
};
const expTotal = (g) => (g.h.n && g.a.n ? (g.h.pf + g.a.pa) / 2 + (g.a.pf + g.h.pa) / 2 : null);
const sMove = (g) => (Number.isFinite(g.openSpread) ? g.openSpread - g.spread : 0); // >0: moved toward home
const tMove = (g) => (Number.isFinite(g.openTotal) ? g.total - g.openTotal : 0);
const favSpread = (g) => -Math.abs(g.spread); // the favourite's line

// ---------- strategies ----------
const ML = {
  favourite: fav,
  underdog: dog,
  home: () => 'home',
  'model fav (net rating)': (g) => (expMargin(g) >= 0 ? 'home' : 'away'),
  'value side approx (model edge 4%)': (g) => {
    if (g.h.n < 10 || g.a.n < 10) return fav(g);
    const cdf = (x) => 0.5 * (1 + Math.tanh(0.7978845608 * (x + 0.044715 * x ** 3)));
    const pm = cdf(expMargin(g) / 12.5);
    const pmkt = implied(g.homeML) / (implied(g.homeML) + implied(g.awayML));
    const p = 0.4 * pm + 0.6 * pmkt;
    const eh = p * (1 + payout(g.homeML)) - 1;
    const ea = (1 - p) * (1 + payout(g.awayML)) - 1;
    if (eh >= 0.04 && eh >= ea) return 'home';
    if (ea >= 0.04) return 'away';
    return fav(g);
  },
  'fav unless rest edge 2+ for dog': (g) => {
    const e = restEdge(g);
    if (e >= 2) return 'home';
    if (e <= -2) return 'away';
    return fav(g);
  },
};
const restRule = (g) => (restEdge(g) >= 2 ? 'home' : restEdge(g) <= -2 ? 'away' : null);
const SP = {
  home: () => 'home',
  road: () => 'away',
  favourite: fav,
  underdog: dog,
  'current: rest rule, else home': (g) => restRule(g) || 'home',
  'rest rule, else favourite': (g) => restRule(g) || fav(g),
  'rest rule, else underdog': (g) => restRule(g) || dog(g),
  'rest rule, else fade line move': (g) => restRule(g) || (sMove(g) >= 1 ? 'away' : sMove(g) <= -1 ? 'home' : 'home'),
  'model side vs line': (g) => (expMargin(g) + g.spread >= 0 ? 'home' : 'away'),
  'fade model side vs line': (g) => (expMargin(g) + g.spread >= 0 ? 'away' : 'home'),
  'follow line move, else home': (g) => (sMove(g) >= 1 ? 'home' : sMove(g) <= -1 ? 'away' : 'home'),
  'fade line move, else home': (g) => (sMove(g) >= 1 ? 'away' : sMove(g) <= -1 ? 'home' : 'home'),
  'fade line move, else fav': (g) => (sMove(g) >= 1 ? 'away' : sMove(g) <= -1 ? 'home' : fav(g)),
};
// correlated: the moneyline team also on the spread when the spread is close
for (const k of [2.5, 3.5, 4.5, 5.5]) {
  SP[`fav when line <= ${k}, else rest/home`] = (g) => (Math.abs(g.spread) <= k ? fav(g) : restRule(g) || 'home');
  SP[`fav when line <= ${k}, else dog`] = (g) => (Math.abs(g.spread) <= k ? fav(g) : dog(g));
  SP[`fav when line <= ${k}, else rest/dog`] = (g) => (Math.abs(g.spread) <= k ? fav(g) : restRule(g) || dog(g));
}
SP['rest rule, else fav; dog when line 10+'] = (g) => restRule(g) || (Math.abs(g.spread) >= 10 ? dog(g) : fav(g));
SP['rest rule, else fav; dog when line 13+'] = (g) => restRule(g) || (Math.abs(g.spread) >= 13 ? dog(g) : fav(g));
SP['rest rule, else fav; home dog 6+'] = (g) => restRule(g) || (dog(g) === 'home' && Math.abs(g.spread) >= 6 ? 'home' : fav(g));
SP['rest (home only), else fav'] = (g) => (restEdge(g) >= 2 ? 'home' : fav(g));
SP['ML pick (fav unless rested dog)'] = (g) => restRule(g) || fav(g);
SP['rest rule, else fav unless b2b fav'] = (g) => restRule(g) || ((fav(g) === 'home' ? g.h.b2b : g.a.b2b) ? dog(g) : fav(g));
const TOT = {
  over: () => 'over',
  under: () => 'under',
  'current: follow move 3+, else over': (g) => (tMove(g) <= -3 ? 'under' : 'over'),
  'follow move 2+, else over': (g) => (tMove(g) <= -2 ? 'under' : 'over'),
  'follow move 1+, else under': (g) => (tMove(g) >= 1 ? 'over' : 'under'),
  'follow move 2+, else under': (g) => (tMove(g) >= 2 ? 'over' : 'under'),
  'follow move (any), else under': (g) => (tMove(g) > 0 ? 'over' : 'under'),
  'follow move (any), else over': (g) => (tMove(g) < 0 ? 'under' : 'over'),
  'under 235+, else over': (g) => (g.total >= 235 ? 'under' : 'over'),
  'under 230+, else over': (g) => (g.total >= 230 ? 'under' : 'over'),
  'model total vs line': (g) => {
    const e = expTotal(g);
    return e === null ? 'over' : e >= g.total ? 'over' : 'under';
  },
  'fade model total vs line': (g) => {
    const e = expTotal(g);
    return e === null ? 'under' : e >= g.total ? 'under' : 'over';
  },
  'fade last-10 o/u trend': (g) => ((g.h.ou ?? 0) + (g.a.ou ?? 0) > 0 ? 'under' : 'over'),
  'follow last-10 o/u trend': (g) => ((g.h.ou ?? 0) + (g.a.ou ?? 0) > 0 ? 'over' : 'under'),
  'b2b under, else follow move': (g) => (g.h.b2b || g.a.b2b ? 'under' : tMove(g) <= -2 ? 'under' : 'over'),
};

TOT['move 3+ follow, else under 235+, else over'] = (g) => (tMove(g) <= -3 ? 'under' : tMove(g) >= 3 ? 'over' : g.total >= 235 ? 'under' : 'over');
TOT['move 3+ follow, else under 240+, else over'] = (g) => (tMove(g) <= -3 ? 'under' : tMove(g) >= 3 ? 'over' : g.total >= 240 ? 'under' : 'over');
TOT['move 2.5+ follow, else over'] = (g) => (tMove(g) <= -2.5 ? 'under' : 'over');
TOT['move 3.5+ follow, else over'] = (g) => (tMove(g) <= -3.5 ? 'under' : 'over');
TOT['move 4+ follow, else over'] = (g) => (tMove(g) <= -4 ? 'under' : 'over');
const run = (mk, rules) => {
  const rows = [];
  for (const [name, fn] of Object.entries(rules)) {
    const by = {};
    SEASONS.forEach((y) => (by[y] = { n: 0, p: 0 }));
    games.forEach((g) => {
      const s = fn(g);
      if (!s) return;
      by[g.season].n += 1;
      by[g.season].p += profit(mk, g, s);
    });
    const tr = TRAIN.reduce((a, y) => ({ n: a.n + by[y].n, p: a.p + by[y].p }), { n: 0, p: 0 });
    rows.push({
      name,
      train: (100 * tr.p) / tr.n,
      seasons: SEASONS.map((y) => ((100 * by[y].p) / Math.max(1, by[y].n)).toFixed(1).padStart(6)),
      test: (100 * by[2027].p) / by[2027].n,
      testN: by[2027].n,
      worst: Math.min(...TRAIN.map((y) => (100 * by[y].p) / by[y].n)),
    });
  }
  rows.sort((a, b) => b.train - a.train);
  console.log(`\n=== ${mk.toUpperCase()} (ROI % per pick)  seasons ${SEASONS.join(' ')}  | train | test (n)`);
  rows.forEach((r) =>
    console.log(`${r.name.slice(0, 40).padEnd(40)} ${r.seasons.join('')} | ${r.train.toFixed(1).padStart(5)} | ${r.test.toFixed(1).padStart(6)} (${r.testN})`),
  );
};
console.log('games', games.length, SEASONS.map((y) => `${y}:${games.filter((g) => g.season === y).length}`).join(' '));
run('ml', ML);
run('spread', SP);
run('total', TOT);

{
  const tr = games.filter((g) => TRAIN.includes(g.season));
  const stat = (label, mk, list, fn) => {
    let w = 0, l = 0, p = 0, u = 0;
    list.forEach((g) => { const s = fn(g); if (!s) return; const st = settle[mk](g, s); if (st === null) { p++; return; } if (st) w++; else l++; u += profit(mk, g, s); });
    console.log(`${label}: ${w}-${l}-${p} ${(100*w/(w+l)).toFixed(1)}% ROI ${(100*u/(w+l+p)).toFixed(1)}%`);
  };
  stat('ML favourite (no rest edge)', 'ml', tr.filter((g) => !restRule(g)), fav);
  stat('ML rested side', 'ml', tr.filter((g) => restRule(g)), restRule);
  stat('spread favourite (no rest edge)', 'spread', tr.filter((g) => !restRule(g)), fav);
  stat('spread home (no rest edge, old)', 'spread', tr.filter((g) => !restRule(g)), () => 'home');
  stat('total: follow 3+ move', 'total', tr.filter((g) => Math.abs(tMove(g)) >= 3), (g) => (tMove(g) > 0 ? 'over' : 'under'));
  stat('total: under 235+ (no move)', 'total', tr.filter((g) => Math.abs(tMove(g)) < 3 && g.total >= 235), () => 'under');
  stat('total: over <235 (no move)', 'total', tr.filter((g) => Math.abs(tMove(g)) < 3 && g.total < 235), () => 'over');
}
