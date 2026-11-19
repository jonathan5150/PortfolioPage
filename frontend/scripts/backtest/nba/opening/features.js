// NBA walk-forward features. For every game, only what was known before tip-off:
// ratings fitted to earlier results this season (performance) and to earlier
// closing lines (the market's view), rest, travel, line moves, recent ATS / O-U form.
// Writes rows.json next to this file.
const fs = require('fs');
const path = require('path');

const OLD = path.join(__dirname, 'data'); // collect.js here (opening prices)
const NEW = path.join(__dirname, 'data');
// the season being bet next: its starting ratings are written from the season before
const SEASONS = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027];

const loadSeason = (yr) => {
  const f = fs.existsSync(path.join(NEW, `games-${yr}.json`))
    ? path.join(NEW, `games-${yr}.json`)
    : path.join(OLD, `games-${yr}.json`);
  if (!fs.existsSync(f)) return [];
  return JSON.parse(fs.readFileSync(f, 'utf8'))
    .map((g) => ({ ...g, season: yr }))
    .filter(
      (g) =>
        Number.isFinite(g.homeScore) &&
        Number.isFinite(g.awayScore) &&
        g.homeScore + g.awayScore > 0 &&
        Number.isFinite(g.spread) &&
        Number.isFinite(g.total) &&
        Math.abs(g.homeML) >= 100 &&
        Math.abs(g.awayML) >= 100,
    )
    .sort((a, b) => new Date(a.date) - new Date(b.date));
};

// arena locations (lat, lon), standard-time UTC offset, altitude flag
const CITY = {
  ATL: [33.757, -84.396, -5], BOS: [42.366, -71.062, -5], BKN: [40.683, -73.975, -5], CHA: [35.225, -80.839, -5],
  CHI: [41.881, -87.674, -6], CLE: [41.496, -81.688, -5], DAL: [32.79, -96.81, -6], DEN: [39.749, -105.008, -7, 1],
  DET: [42.341, -83.055, -5], GS: [37.768, -122.388, -8], HOU: [29.751, -95.362, -6], IND: [39.764, -86.155, -5],
  LAC: [34.043, -118.267, -8], LAL: [34.043, -118.267, -8], MEM: [35.138, -90.051, -6], MIA: [25.781, -80.188, -5],
  MIL: [43.045, -87.917, -6], MIN: [44.979, -93.276, -6], NO: [29.949, -90.082, -6], NY: [40.751, -73.993, -5],
  OKC: [35.463, -97.515, -6], ORL: [28.539, -81.384, -5], PHI: [39.901, -75.172, -5], PHX: [33.446, -112.071, -7],
  POR: [45.532, -122.667, -8], SAC: [38.58, -121.5, -8], SA: [29.427, -98.438, -6], TOR: [43.643, -79.379, -5],
  UTAH: [40.768, -111.901, -7, 1], UTA: [40.768, -111.901, -7, 1], WSH: [38.898, -77.021, -5], NOP: [29.949, -90.082, -6],
  NYK: [40.751, -73.993, -5], GSW: [37.768, -122.388, -8], SAS: [29.427, -98.438, -6], PHO: [33.446, -112.071, -7],
  BRK: [40.683, -73.975, -5], CHO: [35.225, -80.839, -5], WAS: [38.898, -77.021, -5], NJ: [40.683, -73.975, -5],
};
const km = (a, b) => {
  if (!a || !b) return 0;
  const R = 6371;
  const toR = (d) => (d * Math.PI) / 180;
  const dLat = toR(b[0] - a[0]);
  const dLon = toR(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a[0])) * Math.cos(toR(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

// ---------- small linear algebra ----------
const solve = (A, b) => {
  // Gaussian elimination with partial pivoting (A is n x n, modified in place)
  const n = b.length;
  for (let c = 0; c < n; c += 1) {
    let p = c;
    for (let r = c + 1; r < n; r += 1) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    [b[c], b[p]] = [b[p], b[c]];
    const d = A[c][c] || 1e-12;
    for (let r = c + 1; r < n; r += 1) {
      const f = A[r][c] / d;
      if (!f) continue;
      for (let k = c; k < n; k += 1) A[r][k] -= f * A[c][k];
      b[r] -= f * b[c];
    }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r -= 1) {
    let s = b[r];
    for (let k = r + 1; k < n; k += 1) s -= A[r][k] * x[k];
    x[r] = s / (A[r][r] || 1e-12);
  }
  return x;
};

// ratings r (per team) + home edge h, fitted to y = r_home - r_away + h (weighted,
// ridge-shrunk toward `prior`). games: [{ hi, ai, y, w, neutral }]
const fitRatings = (nTeams, games, lambda, prior) => {
  const n = nTeams + 1;
  const A = Array.from({ length: n }, () => new Array(n).fill(0));
  const b = new Array(n).fill(0);
  for (const g of games) {
    const x = new Map([[g.hi, 1], [g.ai, -1]]);
    if (!g.neutral) x.set(nTeams, 1);
    for (const [i, xi] of x) {
      b[i] += g.w * xi * g.y;
      for (const [j, xj] of x) A[i][j] += g.w * xi * xj;
    }
  }
  for (let i = 0; i < nTeams; i += 1) {
    A[i][i] += lambda;
    b[i] += lambda * (prior ? prior[i] : 0);
  }
  A[nTeams][nTeams] += 1; // keep the home edge sane early on
  b[nTeams] += 1 * 2.5;
  return solve(A, b);
};

// offence / defence: points_home = mu + o_h - d_a + hp/2 ; points_away = mu + o_a - d_h - hp/2
const fitOD = (nTeams, games, lambda, prior) => {
  const n = 2 * nTeams + 2; // o's, d's, mu, hp
  const A = Array.from({ length: n }, () => new Array(n).fill(0));
  const b = new Array(n).fill(0);
  const add = (x, y, w) => {
    for (const [i, xi] of x) {
      b[i] += w * xi * y;
      for (const [j, xj] of x) A[i][j] += w * xi * xj;
    }
  };
  const MU = 2 * nTeams;
  const HP = 2 * nTeams + 1;
  for (const g of games) {
    const hp = g.neutral ? 0 : 0.5;
    add(new Map([[g.hi, 1], [nTeams + g.ai, -1], [MU, 1], [HP, hp]]), g.ph, g.w);
    add(new Map([[g.ai, 1], [nTeams + g.hi, -1], [MU, 1], [HP, -hp]]), g.pa, g.w);
  }
  for (let i = 0; i < 2 * nTeams; i += 1) {
    A[i][i] += lambda;
    b[i] += lambda * (prior ? prior[i] : 0);
  }
  A[MU][MU] += 0.01;
  b[MU] += 0.01 * 110;
  A[HP][HP] += 1;
  b[HP] += 1 * 2.5;
  return solve(A, b);
};

const DAY = 864e5;
const rows = [];
let prevFinal = null; // last season's final ratings by team id, as priors
for (const season of SEASONS) {
  const games = loadSeason(season);
  if (!games.length) continue;
  const teamIds = [...new Set(games.flatMap((g) => [g.home, g.away]))].sort();
  const idx = new Map(teamIds.map((t, i) => [t, i]));
  const T = teamIds.length;
  const abbr = new Map();
  games.forEach((g) => {
    abbr.set(g.home, g.homeAbbr);
    abbr.set(g.away, g.awayAbbr);
  });
  const prior = (key, scale) => teamIds.map((t) => (prevFinal?.[key]?.[t] ?? 0) * scale);
  const priorOD = () =>
    prevFinal?.od ? [...teamIds.map((t) => (prevFinal.od[t]?.[0] ?? 0) * 0.5), ...teamIds.map((t) => (prevFinal.od[t]?.[1] ?? 0) * 0.5)] : null;

  // per-team running state
  const st = teamIds.map(() => ({ last: null, lastLoc: null, log: [], roadStreak: 0, homeStreak: 0 }));
  const done = []; // finished games this season, for the fits
  let cache = { day: null };

  const fitsFor = (day) => {
    if (cache.day === day) return cache;
    const now = new Date(day).getTime();
    const wRecent = (t) => 0.5 ** ((now - t) / (30 * DAY)); // 30-day half-life
    const perf = done.map((g) => ({ ...g, y: g.margin, w: 1 }));
    const perfR = done.map((g) => ({ ...g, y: g.margin, w: wRecent(g.t) }));
    const mkt = done.map((g) => ({ ...g, y: -g.spread, w: 1 }));
    const mktR = done.map((g) => ({ ...g, y: -g.spread, w: wRecent(g.t) }));
    const od = done.map((g) => ({ ...g, w: 1 }));
    const mt = done.map((g) => ({ ...g, ph: g.total / 2 + -g.spread / 2, pa: g.total / 2 - -g.spread / 2, w: wRecent(g.t) }));
    cache = {
      day,
      perf: fitRatings(T, perf, 8, prior('perf', 0.5)),
      perfR: fitRatings(T, perfR, 6, prior('perf', 0.5)),
      mkt: fitRatings(T, mkt, 4, prior('mkt', 0.6)),
      mktR: fitRatings(T, mktR, 3, prior('mkt', 0.6)),
      od: fitOD(T, od, 10, priorOD()),
      mt: fitOD(T, mt, 6, priorOD()), // the market's pace / scoring view, from earlier totals + lines
    };
    return cache;
  };

  for (const g of games) {
    const t = new Date(g.date).getTime();
    const day = g.date.slice(0, 10);
    const f = fitsFor(day);
    const hi = idx.get(g.home);
    const ai = idx.get(g.away);
    const H = st[hi];
    const A = st[ai];
    const loc = g.neutral ? null : CITY[g.homeAbbr];
    const restOf = (s) => (s.last ? Math.min(Math.round((t - s.last) / DAY), 7) : 7);
    const gamesIn = (s, days) => s.log.filter((x) => t - x.t < days * DAY).length;
    const travel = (s) => (s.lastLoc && loc ? km(s.lastLoc, loc) : 0);
    const tz = (s) => (s.lastLoc && loc ? loc[2] - s.lastLoc[2] : 0);
    const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
    const last = (s, n, key) => avg(s.log.slice(-n).map((x) => x[key]));
    const nH = H.log.length;
    const nA = A.log.length;
    const pr = (r) => r[hi] - r[ai] + (g.neutral ? 0 : r[T]);
    const odH = f.od[hi] - f.od[T + ai];
    const odA = f.od[ai] - f.od[T + hi];
    const perfTotal = 2 * f.od[2 * T] + odH + odA;
    const mtTotal = 2 * f.mt[2 * T] + (f.mt[hi] - f.mt[T + ai]) + (f.mt[ai] - f.mt[T + hi]);
    const impl = (p) => (p > 0 ? 100 / (p + 100) : -p / (-p + 100));
    const pH = impl(g.homeML);
    const pA = impl(g.awayML);
    rows.push({
      id: g.id,
      season,
      date: g.date,
      home: g.homeAbbr,
      away: g.awayAbbr,
      neutral: g.neutral ? 1 : 0,
      // market
      spread: g.spread,
      total: g.total,
      homeML: g.homeML,
      awayML: g.awayML,
      homeSpreadOdds: g.homeSpreadOdds ?? -110,
      awaySpreadOdds: g.awaySpreadOdds ?? -110,
      overOdds: g.overOdds ?? -110,
      underOdds: g.underOdds ?? -110,
      openSpread: Number.isFinite(g.openSpread) ? g.openSpread : null,
      openTotal: Number.isFinite(g.openTotal) ? g.openTotal : null,
      mlProbHome: pH / (pH + pA), // no-vig
      // results
      homeScore: g.homeScore,
      awayScore: g.awayScore,
      // ratings (home - away expected margin)
      nH,
      nA,
      perfMargin: pr(f.perf),
      perfMarginR: pr(f.perfR),
      mktMargin: pr(f.mkt),
      mktMarginR: pr(f.mktR),
      perfTotal,
      mtTotal,
      // situation
      restH: restOf(H),
      restA: restOf(A),
      in4H: gamesIn(H, 4),
      in4A: gamesIn(A, 4),
      in6H: gamesIn(H, 6),
      in6A: gamesIn(A, 6),
      travelH: travel(H),
      travelA: travel(A),
      tzA: tz(A),
      tzH: tz(H),
      roadStreakA: A.roadStreak,
      homeStreakH: H.homeStreak,
      altitude: loc && loc[3] ? 1 : 0,
      atsH: last(H, 10, 'ats'),
      atsA: last(A, 10, 'ats'),
      ouH: last(H, 10, 'ou'),
      ouA: last(A, 10, 'ou'),
      pfH: avg(H.log.map((x) => x.pf)),
      paH: avg(H.log.map((x) => x.pa)),
      pfA: avg(A.log.map((x) => x.pf)),
      paA: avg(A.log.map((x) => x.pa)),
      marginH10: last(H, 10, 'margin'),
      marginA10: last(A, 10, 'margin'),
      winH10: last(H, 10, 'win'),
      winA10: last(A, 10, 'win'),
      streakH: H.log.length ? H.log[H.log.length - 1].streak : 0,
      streakA: A.log.length ? A.log[A.log.length - 1].streak : 0,
      month: new Date(g.date).getUTCMonth(),
    });

    // update state after the game
    const margin = g.homeScore - g.awayScore;
    const total = g.homeScore + g.awayScore;
    const push = (s, isHome, m, ats) => {
      const win = m > 0 ? 1 : 0;
      const prevStreak = s.log.length ? s.log[s.log.length - 1].streak : 0;
      const streak = win ? (prevStreak > 0 ? prevStreak + 1 : 1) : prevStreak < 0 ? prevStreak - 1 : -1;
      s.log.push({ t, margin: m, ats, ou: total - g.total, win, streak, pf: isHome ? g.homeScore : g.awayScore, pa: isHome ? g.awayScore : g.homeScore });
      s.last = t;
      s.lastLoc = loc || s.lastLoc;
      if (isHome) {
        s.homeStreak += 1;
        s.roadStreak = 0;
      } else {
        s.roadStreak += 1;
        s.homeStreak = 0;
      }
    };
    push(H, true, margin, margin + g.spread);
    push(A, false, -margin, -margin - g.spread);
    done.push({ hi, ai, t, neutral: !!g.neutral, margin, spread: g.spread, total: g.total, ph: g.homeScore, pa: g.awayScore });
  }
  // final ratings for next season's priors
  const f = fitsFor('9999-12-31');
  prevFinal = {
    perf: Object.fromEntries(teamIds.map((tid, i) => [tid, f.perf[i]])),
    mkt: Object.fromEntries(teamIds.map((tid, i) => [tid, f.mkt[i]])),
    od: Object.fromEntries(teamIds.map((tid, i) => [tid, [f.od[i], f.od[T + i]]])),
  };
  if (season === 2026) {
    const r3 = (x) => Math.round(x * 1000) / 1000;
    fs.writeFileSync(
      path.join(__dirname, '..', '..', '..', '..', 'public', 'models', 'nba-od-prior.json'),
      JSON.stringify({
        note: 'NBA team offence / defence ratings at the end of 2025-26 (points per game above / below average), the starting point for 2026-27. From scripts/backtest/nba (features.js).',
        season: 2027,
        teams: Object.fromEntries(Object.entries(prevFinal.od).map(([id, [o, d]]) => [id, [r3(o), r3(d)]])),
        abbr: Object.fromEntries(teamIds.map((t) => [t, abbr.get(t)])),
      }),
    );
  }
  console.log(season, games.length, 'games');
}
fs.writeFileSync(path.join(__dirname, 'rows.json'), JSON.stringify(rows));
console.log('rows', rows.length);
