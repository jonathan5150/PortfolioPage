// NFL (node replay.js): replay the app's own picks (buildLinePicks) over 2019-2026 regular
// seasons from saved ESPN odds + predictor, then try tweaks on top.
const fs = require('fs');
const path = require('path');
// The app's own pick code, bundled for Node on the fly (webpack comes with react-scripts).
const os = require('os');
const appFile = path.join(os.tmpdir(), 'nfl-replay-app.cjs');
const bundleApp = () =>
  new Promise((resolve, reject) => {
    const webpack = require('webpack'); // eslint-disable-line global-require, import/no-extraneous-dependencies
    const entry = path.join(os.tmpdir(), 'nfl-replay-entry.js');
    const src = path.join(__dirname, '../../../src/sports/shared').split(path.sep).join('/');
    fs.writeFileSync(entry, [
      `export { buildLinePicks, isPrimetime } from '${src}/api/picks';`,
      `export { parseEventOdds, parsePredictor, gradeGame, computeTeamTrends } from '${src}/api/betting';`,
    ].join('\n'));
    webpack({ mode: 'none', target: 'node', entry, output: { path: os.tmpdir(), filename: 'nfl-replay-app.cjs', library: { type: 'commonjs2' } },
      resolve: { extensions: ['.js', '.json'] }, module: { rules: [{ test: /\.m?js$/, resolve: { fullySpecified: false } }] },
      devtool: false, optimization: { minimize: false } },
      (e, res) => (e || res.hasErrors() ? reject(e || new Error(res.toString({ all: false, errors: true }))) : resolve()));
  });
(async () => {
await bundleApp();
const app = require(appFile);

const DATA = path.join(__dirname, '../data'); // <season>/games.json, odds/, predictor/
const MODELS = path.join(__dirname, '../../../public/models');
const SEASONS = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
const TRAIN = [2019, 2020, 2021, 2022, 2023, 2024, 2025];
const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const teamModel = { lg: 'nfl', model: read(`${MODELS}/nfl-model.json`), history: read(`${MODELS}/nfl-history.json`) };

const payout = (p) => (p > 0 ? p / 100 : 100 / -p);
const rows = [];
const allGames = [];
for (const y of SEASONS) {
  const games = read(`${DATA}/${y}/games.json`).sort((a, b) => new Date(a.date) - new Date(b.date));
  const odds = {};
  const pred = {};
  games.forEach((g) => {
    try { odds[g.id] = app.parseEventOdds(read(`${DATA}/${y}/odds/${g.id}.json`)); } catch { odds[g.id] = null; }
    try { pred[g.id] = app.parsePredictor(read(`${DATA}/${y}/predictor/${g.id}.json`)); } catch { pred[g.id] = null; }
  });
  const trendsFor = (teamId, game) => {
    const at = new Date(game.date).getTime();
    const prior = games.filter(
      (g) => g.id !== game.id && new Date(g.date).getTime() < at && (g.home.teamId === teamId || g.away.teamId === teamId),
    );
    return app.computeTeamTrends(prior.map((g) => app.gradeGame(teamId, g, odds[g.id])));
  };
  for (const g of games) {
    const o = odds[g.id];
    if (!o) continue;
    const picks = app.buildLinePicks({
      game: g, odds: o, predictor: pred[g.id],
      awayTrends: trendsFor(g.away.teamId, g), homeTrends: trendsFor(g.home.teamId, g), teamModel,
    });
    rows.push({ season: y, g, o, pred: pred[g.id], picks, prime: app.isPrimetime(g) });
    allGames.push(g);
  }
}

// head-to-head: earlier regular-season meetings (any season in the data) before this game
const meetings = (g) => {
  const at = new Date(g.date).getTime();
  const ids = [g.home.teamId, g.away.teamId];
  return allGames.filter(
    (x) => new Date(x.date).getTime() < at && ids.includes(x.home.teamId) && ids.includes(x.away.teamId),
  );
};
const h2hEdge = (g, n = 4) => {
  // home wins minus away wins in the last n meetings
  const m = meetings(g).slice(-n);
  let e = 0;
  m.forEach((x) => {
    const hs = Number(x.home.score);
    const as = Number(x.away.score);
    const winner = hs > as ? x.home.teamId : as > hs ? x.away.teamId : null;
    if (winner === g.home.teamId) e += 1;
    else if (winner === g.away.teamId) e -= 1;
  });
  return { e, n: m.length };
};
const division = (g) => {
  // same division: the data's team groups aren't saved, so use the 2002+ alignment by abbreviation
  const D = [['BUF','MIA','NE','NYJ'],['BAL','CIN','CLE','PIT'],['HOU','IND','JAX','TEN'],['DEN','KC','LV','OAK','LAC'],
    ['DAL','NYG','PHI','WSH'],['CHI','DET','GB','MIN'],['ATL','CAR','NO','TB'],['ARI','LAR','SF','SEA']];
  const a = g.away.team.abbreviation; const h = g.home.team.abbreviation;
  return D.some((d) => d.includes(a) && d.includes(h));
};

// ---------- settle ----------
const settle = (r, mk, side) => {
  const hs = Number(r.g.home.score); const as = Number(r.g.away.score);
  const o = r.o;
  if (mk === 'winner') {
    if (hs === as) return 0;
    const won = side === 'home' ? hs > as : as > hs;
    const p = o[side]?.moneyLine;
    if (!p) return null;
    return won ? payout(p) : -1;
  }
  if (mk === 'spread') {
    if (o.homeSpread === null || o.homeSpread === undefined) return null;
    const m = hs - as + o.homeSpread;
    if (m === 0) return 0;
    const won = side === 'home' ? m > 0 : m < 0;
    return won ? payout(o[side]?.spreadOdds || -110) : -1;
  }
  const line = o.total?.line;
  if (line === null || line === undefined) return null;
  const t = hs + as;
  if (t === line) return 0;
  const won = side === 'over' ? t > line : t < line;
  return won ? payout((side === 'over' ? o.total.overOdds : o.total.underOdds) || -110) : -1;
};

const fav = (r) => ((r.o.home.moneyLine ?? 0) <= (r.o.away.moneyLine ?? 0) ? 'home' : 'away');
const dogOf = (r) => (fav(r) === 'home' ? 'away' : 'home');
const absLine = (r) => Math.abs(r.o.homeSpread ?? 99);
const base = (r) => ({ winner: r.picks?.winner?.side, spread: r.picks?.spread?.side, total: r.picks?.total?.side });

// ---------- variants: (r) -> { winner, spread, total } ----------
const V = {
  'CURRENT': base,
  'spread follows winner when line <= 3': (r) => {
    const b = base(r);
    return absLine(r) <= 3 && b.winner ? { ...b, spread: b.winner } : b;
  },
  'spread follows winner when line <= 3.5': (r) => {
    const b = base(r);
    return absLine(r) <= 3.5 && b.winner ? { ...b, spread: b.winner } : b;
  },
  'winner follows spread when line <= 3': (r) => {
    const b = base(r);
    return absLine(r) <= 3 && b.spread ? { ...b, winner: b.spread } : b;
  },
  'winner follows spread when line <= 3.5': (r) => {
    const b = base(r);
    return absLine(r) <= 3.5 && b.spread ? { ...b, winner: b.spread } : b;
  },
  'winner follows spread when line <= 2.5': (r) => {
    const b = base(r);
    return absLine(r) <= 2.5 && b.spread ? { ...b, winner: b.spread } : b;
  },
  'winner follows spread when spread is a BET & line<=3.5': (r) => {
    const b = base(r);
    return absLine(r) <= 3.5 && r.picks?.spread?.bet !== false && b.spread ? { ...b, winner: b.spread } : b;
  },
  'primetime: winner = dog (<= +200)': (r) => {
    const b = base(r);
    const d = dogOf(r);
    return r.prime && (r.o[d].moneyLine ?? 999) <= 200 ? { ...b, winner: d } : b;
  },
  'primetime: winner = dog (<= +150)': (r) => {
    const b = base(r);
    const d = dogOf(r);
    return r.prime && (r.o[d].moneyLine ?? 999) <= 150 ? { ...b, winner: d } : b;
  },
  'primetime: under': (r) => (r.prime ? { ...base(r), total: 'under' } : base(r)),
  'h2h 3+ of last 4: winner = that team': (r) => {
    const b = base(r);
    const { e, n } = h2hEdge(r.g, 4);
    if (n < 3 || Math.abs(e) < 3) return b;
    return { ...b, winner: e > 0 ? 'home' : 'away' };
  },
  'h2h 3+ of last 4: spread = that team': (r) => {
    const b = base(r);
    const { e, n } = h2hEdge(r.g, 4);
    if (n < 3 || Math.abs(e) < 3) return b;
    return { ...b, spread: e > 0 ? 'home' : 'away' };
  },
  'h2h: fade the team that won 3+ of last 4 (spread)': (r) => {
    const b = base(r);
    const { e, n } = h2hEdge(r.g, 4);
    if (n < 3 || Math.abs(e) < 3) return b;
    return { ...b, spread: e > 0 ? 'away' : 'home' };
  },
  'division game: spread = dog': (r) => (division(r.g) ? { ...base(r), spread: dogOf(r) } : base(r)),
  'division game: under': (r) => (division(r.g) ? { ...base(r), total: 'under' } : base(r)),
};

const tweak = {
  close: (k) => (r, b) => (absLine(r) <= k && b.spread ? { ...b, winner: b.spread } : b),
  primeDog: (max) => (r, b) => { const d = dogOf(r); return r.prime && (r.o[d].moneyLine ?? 999) <= max ? { ...b, winner: d } : b; },
  divDog: (r, b) => (division(r.g) ? { ...b, spread: dogOf(r) } : b),
  primeUnder: (r, b) => (r.prime ? { ...b, total: 'under' } : b),
};
const combo = (...fs) => (r) => fs.reduce((b, f) => f(r, b), base(r));
Object.assign(V, {
  'A: close<=3 + primeDog150': combo(tweak.close(3), tweak.primeDog(150)),
  'B: divDog + close<=3': combo(tweak.divDog, tweak.close(3)),
  'C: divDog + close<=3 + primeDog150': combo(tweak.divDog, tweak.close(3), tweak.primeDog(150)),
  'D: divDog + primeDog150 + close<=3': combo(tweak.divDog, tweak.primeDog(150), tweak.close(3)),
  'E: divDog + close<=2.5 + primeDog150': combo(tweak.divDog, tweak.close(2.5), tweak.primeDog(150)),
  'F: C + primeUnder': combo(tweak.divDog, tweak.close(3), tweak.primeDog(150), tweak.primeUnder),
  'G: divDog + close<=3 + primeDog130': combo(tweak.divDog, tweak.close(3), tweak.primeDog(130)),
  'H: divDog + close<=3 + primeDog180': combo(tweak.divDog, tweak.close(3), tweak.primeDog(180)),
});

{
  const stat = (label, list, mk, sideFn) => {
    let w = 0, l = 0, p = 0, u = 0;
    list.forEach((r) => { const s = sideFn(r); const x = settle(r, mk, s); if (x === null) return; if (x > 0) w++; else if (x < 0) l++; else p++; u += x; });
    console.log(`${label}: ${w}-${l}-${p}  win ${(100*w/(w+l)).toFixed(1)}%  ROI ${(100*u/(w+l+p)).toFixed(1)}%  (${w+l+p})`);
  };
  const tr = rows.filter((r) => TRAIN.includes(r.season));
  stat('division games, dog ATS 2019-25', tr.filter((r) => division(r.g) && r.o.homeSpread), 'spread', dogOf);
  stat('division games, road ATS 2019-25', tr.filter((r) => division(r.g) && r.o.homeSpread), 'spread', () => 'away');
  const close = tr.filter((r) => absLine(r) <= 3 && r.picks?.spread?.side);
  stat('line<=3: ML on the spread pick 2019-25', close, 'winner', (r) => r.picks.spread.side);
  stat('line<=3: ML on the model winner 2019-25', close, 'winner', (r) => r.picks.winner.side);
  stat('line<=3: spread pick ATS 2019-25', close, 'spread', (r) => r.picks.spread.side);
  const pd = tr.filter((r) => r.prime && (r.o[dogOf(r)].moneyLine ?? 999) <= 150);
  stat('primetime dog <=+150 ML 2019-25', pd, 'winner', dogOf);
  stat('primetime fav (dog <=+150) ML 2019-25', pd, 'winner', fav);
}
const out = [];
for (const [name, fn] of Object.entries(V)) {
  const by = {};
  SEASONS.forEach((y) => (by[y] = { winner: [0, 0], spread: [0, 0], total: [0, 0] }));
  rows.forEach((r) => {
    const s = fn(r);
    for (const mk of ['winner', 'spread', 'total']) {
      if (!s[mk]) continue;
      const p = settle(r, mk, s[mk]);
      if (p === null) continue;
      by[r.season][mk][0] += 1;
      by[r.season][mk][1] += p;
    }
  });
  const agg = (ys, mk) => ys.reduce((a, y) => [a[0] + by[y][mk][0], a[1] + by[y][mk][1]], [0, 0]);
  const tot = (ys) => ['winner', 'spread', 'total'].map((mk) => agg(ys, mk)).reduce((a, b) => [a[0] + b[0], a[1] + b[1]], [0, 0]);
  const pct = ([n, p]) => (n ? (100 * p) / n : 0);
  out.push({ name, train: tot(TRAIN), test: tot([2026]), mk: ['winner', 'spread', 'total'].map((mk) => [pct(agg(TRAIN, mk)), pct(agg([2026], mk))]),
    seasons: SEASONS.map((y) => tot([y])[1]) });
}
const b0 = out[0];
console.log(`NFL games: ${rows.length}  (${SEASONS.map((y) => `${y}:${rows.filter((r) => r.season === y).length}`).join(' ')})`);
console.log('units profit per season (all three markets), then train total / 2026 / ROI by market train|2026 (W, S, T)');
out.forEach((x) => {
  console.log(
    `${x.name.slice(0, 46).padEnd(46)} ${x.seasons.map((v) => v.toFixed(1).padStart(6)).join('')} | train ${x.train[1].toFixed(1).padStart(6)} (${(x.train[1] - b0.train[1] >= 0 ? '+' : '') + (x.train[1] - b0.train[1]).toFixed(1)}) | 2026 ${x.test[1].toFixed(1).padStart(5)} (${(x.test[1] - b0.test[1] >= 0 ? '+' : '') + (x.test[1] - b0.test[1]).toFixed(1)}) | ${x.mk.map(([a, b]) => `${a.toFixed(1)}|${b.toFixed(1)}`).join('  ')}`,
  );
});
})();
