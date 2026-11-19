// NBA scoring ratings for the totals bet (scripts/backtest/nba, November 2026).
//
// Every team gets an offence and a defence rating, fitted to this season's
// finished games before the day of the game being picked:
//   home points = mu + offence(home) - defence(away) + homeEdge/2
//   away points = mu + offence(away) - defence(home) - homeEdge/2
// shrunk toward half of last season's final ratings (public/models/
// nba-od-prior.json), so a team's first weeks lean on last season. The game's
// projected total is the two projected scores added up.
//
// At the OPENING line, a total our projection beat by 6+ points (both teams 10+
// games in) went our way 524-401 (+6.7% at the opening prices) over the six
// seasons with saved openers, positive in every one, and the line moved toward
// our side 69% of the time before tip-off. Against the closing line the same
// gap is worth nothing: the market has caught up by then.
import { fetchJson } from '../api/http';
import { getSeasonFinished } from './leagueApi';

export const NBA_TOTAL_EDGE = 6; // points between our projection and the opening total
export const NBA_MIN_GAMES = 10; // games each team has played before we trust the ratings

const LAMBDA = 10;
const PRIOR_SHARE = 0.5;

// Gaussian elimination with partial pivoting (A is n x n and is overwritten)
const solve = (A, b) => {
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

const score = (v) => {
  const n = Number(v?.value ?? v);
  return Number.isFinite(n) ? n : null;
};

// Offence / defence ratings from finished games ({ homeId, awayId, home: { score },
// away: { score } }), shrunk toward prior.teams (scaled by PRIOR_SHARE).
export const fitScoring = (games, prior) => {
  const played = games.filter((g) => g.homeId && g.awayId && score(g.home?.score) !== null && score(g.away?.score) !== null);
  const ids = [...new Set([...played.flatMap((g) => [g.homeId, g.awayId]), ...Object.keys(prior?.teams || {})])].sort();
  const at = new Map(ids.map((id, i) => [id, i]));
  const T = ids.length;
  const n = 2 * T + 2; // offences, defences, mu, home edge
  const MU = 2 * T;
  const HP = 2 * T + 1;
  const A = Array.from({ length: n }, () => new Array(n).fill(0));
  const b = new Array(n).fill(0);
  const add = (x, y) => {
    for (const [i, xi] of x) {
      b[i] += xi * y;
      for (const [j, xj] of x) A[i][j] += xi * xj;
    }
  };
  const count = new Map();
  played.forEach((g) => {
    const h = at.get(g.homeId);
    const a = at.get(g.awayId);
    add(
      new Map([
        [h, 1],
        [T + a, -1],
        [MU, 1],
        [HP, 0.5],
      ]),
      score(g.home.score),
    );
    add(
      new Map([
        [a, 1],
        [T + h, -1],
        [MU, 1],
        [HP, -0.5],
      ]),
      score(g.away.score),
    );
    count.set(g.homeId, (count.get(g.homeId) || 0) + 1);
    count.set(g.awayId, (count.get(g.awayId) || 0) + 1);
  });
  ids.forEach((id, i) => {
    const [o, d] = prior?.teams?.[id] || [0, 0];
    A[i][i] += LAMBDA;
    b[i] += LAMBDA * o * PRIOR_SHARE;
    A[T + i][T + i] += LAMBDA;
    b[T + i] += LAMBDA * d * PRIOR_SHARE;
  });
  A[MU][MU] += 0.01;
  b[MU] += 0.01 * 110;
  A[HP][HP] += 1;
  b[HP] += 2.5;
  const x = solve(A, b);
  return { at, x, T, count };
};

// The projected total for a game, or null when either team isn't rated
export const projectTotal = (fit, homeId, awayId) => {
  const h = fit.at.get(homeId);
  const a = fit.at.get(awayId);
  if (h === undefined || a === undefined) return null;
  const { x, T } = fit;
  return 2 * x[2 * T] + (x[h] - x[T + a]) + (x[a] - x[T + h]);
};

// ---------- loading ----------

let priorLoad = null;
const loadPrior = () => {
  if (!priorLoad) {
    priorLoad = fetchJson(`${process.env.PUBLIC_URL || ''}/models/nba-od-prior.json`, { ttlMs: 12 * 60 * 60 * 1000 }).catch(
      () => null,
    );
  }
  return priorLoad;
};

// { prior, games } once per page: last season's ratings and this season's finished games
let dataLoad = null;
export const loadNbaScoring = () => {
  if (!dataLoad) {
    dataLoad = Promise.all([loadPrior(), getSeasonFinished('nba')])
      .then(([prior, games]) => ({ prior, games: games.filter((g) => g.seasonType !== 3) }))
      .catch((error) => {
        dataLoad = null;
        throw error;
      });
  }
  return dataLoad;
};

// The day a game is on (UTC, as the backtest keyed it): a game's ratings use the
// games finished before that day.
const dayOf = (iso) => String(iso || '').slice(0, 10);
const fits = new Map(); // day -> fit
export const scoringFor = (data, game) => {
  if (!data || !game?.date) return null;
  const day = dayOf(game.date);
  if (!fits.has(day)) fits.set(day, fitScoring(data.games.filter((g) => dayOf(g.date) < day), data.prior));
  const fit = fits.get(day);
  const homeId = game.home?.teamId;
  const awayId = game.away?.teamId;
  const total = projectTotal(fit, homeId, awayId);
  if (total === null) return null;
  return { total, homeGames: fit.count.get(homeId) || 0, awayGames: fit.count.get(awayId) || 0 };
};
