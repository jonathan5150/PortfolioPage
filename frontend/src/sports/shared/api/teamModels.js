// Backtested winner models for the NFL and NBA (scripts/backtest/nfl, /nba),
// plus each matchup's recent head-to-head history.
//
// What the backtests found (every feature built only from earlier games):
// both markets are very efficient, but two things the odds under-weight held
// up in both sports - a team that has owned a matchup lately keeps winning it
// a little more than the price says, and teams that have been beating the
// market's expectations get over-bet. A rested team against one on a short
// week or a back-to-back, a visitor off a bye, division games and revenge
// spots are in the model too.
//
// The pick is the model's VALUE side: the team whose chance beats what its
// price needs. That is an underdog most of the time it fires. In the
// walk-forward tests (2015-2024) it lost 0.7% per NFL pick (always taking
// the favourite: -3.6%; the 2025-26 holdout: -1.7%), and about as much as
// favourites in the NBA (2012-2022: -4.7% vs -4.4%), while picking upsets
// on 60% / 54% of those picks.
import { fetchJson } from './http';
import { impliedProbability } from './betting';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const base = () => `${process.env.PUBLIC_URL || ''}/models`;

const loads = {};
export const loadTeamModel = (lg) => {
  if (!['nfl', 'nba'].includes(lg)) return Promise.resolve(null);
  if (!loads[lg]) {
    loads[lg] = Promise.all([
      fetchJson(`${base()}/${lg}-model.json`, { ttlMs: 12 * HOUR }),
      fetchJson(`${base()}/${lg}-history.json`, { ttlMs: 12 * HOUR }),
    ])
      .then(([model, history]) => ({ lg, model, history }))
      .catch((error) => {
        delete loads[lg];
        throw error;
      });
  }
  return loads[lg];
};

// ESPN abbreviations -> the data's
const ABBR = {
  nfl: { LAR: 'LA', WSH: 'WAS' },
  nba: { GS: 'GSW', NO: 'NOP', NY: 'NYK', SA: 'SAS', UTAH: 'UTA', WSH: 'WAS' },
};
export const dataAbbr = (lg, abbr) => ABBR[lg]?.[abbr] || abbr;

const NFL_DIVISIONS = [
  ['BUF', 'MIA', 'NE', 'NYJ'], ['BAL', 'CIN', 'CLE', 'PIT'], ['HOU', 'IND', 'JAX', 'TEN'], ['DEN', 'KC', 'LV', 'LAC'],
  ['DAL', 'NYG', 'PHI', 'WAS'], ['CHI', 'DET', 'GB', 'MIN'], ['ATL', 'CAR', 'NO', 'TB'], ['ARI', 'LA', 'SF', 'SEA'],
];
const sameDivision = (a, b) => NFL_DIVISIONS.some((d) => d.includes(a) && d.includes(b));

const sigmoid = (x) => 1 / (1 + Math.exp(-x));
const logit = (p) => {
  const q = Math.min(Math.max(p, 1e-4), 1 - 1e-4);
  return Math.log(q / (1 - q));
};
const decimal = (american) => (american > 0 ? 1 + american / 100 : 1 + 100 / -american);
const real = (n) => n !== null && n !== undefined && Math.abs(n) >= 100;
const shrink = (hits, n, k) => (hits + k * 0.5) / (n + k);

// ---------- head-to-head ----------
// rows: [season, homeTeam, winner, margin, coverTeam, over(1)/under(0)/-1, 'YYYY-MM-DD']
// Only meetings before `date` count, so a finished game graded later never
// sees its own result.
const H2H_N = 6;
export const headToHead = (tm, homeAbbr, awayAbbr, date = null) => {
  if (!tm?.history?.h2h) return null;
  const h = dataAbbr(tm.lg, homeAbbr);
  const a = dataAbbr(tm.lg, awayAbbr);
  const day = date ? new Date(new Date(date).getTime() - 12 * HOUR).toISOString().slice(0, 10) : null;
  const rows = (tm.history.h2h[[h, a].sort().join('|')] || []).filter((r) => !day || !r[6] || r[6] < day).slice(-H2H_N);
  if (!rows.length) return { n: 0, home: h, away: a, homeWins: 0, awayWins: 0, homeCovers: 0, atsN: 0, overs: 0, ouN: 0, last: null };
  const atsRows = rows.filter((r) => r[4]);
  const ouRows = rows.filter((r) => r[5] === 0 || r[5] === 1);
  const last = rows[rows.length - 1];
  return {
    n: rows.length,
    home: h,
    away: a,
    homeWins: rows.filter((r) => r[2] === h).length,
    awayWins: rows.filter((r) => r[2] === a).length,
    homeCovers: atsRows.filter((r) => r[4] === h).length,
    atsN: atsRows.length,
    overs: ouRows.filter((r) => r[5] === 1).length,
    ouN: ouRows.length,
    last: { season: last[0], winner: last[2], margin: last[3] },
  };
};

// ---------- rest / form from each team's earlier games ----------

// days since the team's last game before `date` (7 when there wasn't one)
export const restBefore = (games, date) => {
  const at = new Date(date).getTime();
  const prior = (games || []).map((g) => new Date(g.date).getTime()).filter((t) => t < at - 3 * HOUR);
  if (!prior.length) return 7;
  return Math.min(Math.round((at - Math.max(...prior)) / DAY), 21);
};

// last N results against the spread (+1 covered, -1 didn't, 0 push) / N
// (NFL: 3 games, NBA: 5)
const atsForm = (games, n) => {
  const graded = (games || []).filter((g) => g.ats).slice(-n);
  return graded.reduce((sum, g) => sum + (g.ats === 'W' ? 1 : g.ats === 'L' ? -1 : 0), 0) / n;
};

// ---------- the model's chance for the home team ----------
// ctx: { game, odds, awayGames, homeGames, rest: { home, away } (days) }
export const teamModelChance = (tm, { game, odds, awayGames, homeGames, rest }) => {
  if (!tm || !real(odds?.home?.moneyLine) || !real(odds?.away?.moneyLine)) return null;
  const ph = impliedProbability(odds.home.moneyLine);
  const pa = impliedProbability(odds.away.moneyLine);
  const market = ph / (ph + pa);
  const homeAbbr = game.home?.team?.abbreviation;
  const awayAbbr = game.away?.team?.abbreviation;
  const h2h = headToHead(tm, homeAbbr, awayAbbr, game.date);
  const lastWinner = h2h?.last?.winner;
  const bigLast = (h2h?.last?.margin || 0) >= (tm.lg === 'nfl' ? 14 : 15);
  const hr = rest?.home ?? restBefore(homeGames, game.date);
  const ar = rest?.away ?? restBefore(awayGames, game.date);

  const x = { mkt: logit(market) };
  x.h2h_win = h2h && h2h.n ? shrink(h2h.homeWins, h2h.n, tm.lg === 'nfl' ? 4 : 3) - 0.5 : 0;
  x.revenge_home = h2h && lastWinner === h2h.away && bigLast ? 1 : 0;
  x.revenge_away = h2h && lastWinner === h2h.home && bigLast ? 1 : 0;
  const formN = tm.lg === 'nfl' ? 3 : 5;
  x.form_home = atsForm(homeGames, formN);
  x.form_away = atsForm(awayGames, formN);
  if (tm.lg === 'nfl') {
    const hd = dataAbbr('nfl', homeAbbr);
    const ad = dataAbbr('nfl', awayAbbr);
    x.rest = Math.max(Math.min((hr - ar) / 7, 1.5), -1.5);
    x.away_short = ar <= 4 ? 1 : 0;
    x.home_short = hr <= 4 ? 1 : 0;
    x.home_bye = hr >= 13 ? 1 : 0;
    x.away_bye = ar >= 13 ? 1 : 0;
    x.div = sameDivision(hd, ad) ? 1 : 0;
    x.prime = 0; // set by the caller (isPrimetime lives in picks.js)
    x.playoff = game.seasonType === 3 ? 1 : 0;
    x.ref_home = 0; // the referee isn't known before kickoff in ESPN's feed
  } else {
    x.rest_diff = Math.max(Math.min(hr - ar, 3), -3) / 3;
    x.home_b2b = hr === 1 ? 1 : 0;
    x.away_b2b = ar === 1 ? 1 : 0;
    x.home_3in4 = 0;
    x.away_3in4 = 0;
    x.surprise_home = 0;
    x.surprise_away = 0;
  }
  return { market, x, h2h, rest: { home: hr, away: ar } };
};

export const finishChance = (tm, ctx) => {
  const W = tm.model.winner;
  const z = W.intercept + W.features.reduce((s, f, i) => s + W.coef[i] * (ctx.x[f] ?? 0), 0);
  return sigmoid(z);
};

// The value side: the team whose model chance beats its price the most
// (expected value >= 0), or null when neither does.
export const valueSide = (tm, pHome, odds) => {
  const W = tm.model.winner;
  const sides = ['home', 'away'].map((side) => {
    const price = odds[side].moneyLine;
    const p = side === 'home' ? pHome : 1 - pHome;
    return { side, price, p, ev: p * decimal(price) - 1 };
  });
  const best = sides.sort((a, b) => b.ev - a.ev)[0];
  return best.ev >= 0 && decimal(best.price) <= W.max_price ? best : null;
};

// ---------- words ----------

export const h2hSentence = (h2h, game, side) => {
  if (!h2h || h2h.n < 3) return null;
  const me = side === 'home' ? h2h.home : h2h.away;
  const meWins = side === 'home' ? h2h.homeWins : h2h.awayWins;
  const them = side === 'home' ? h2h.away : h2h.home;
  const name = game[side]?.team?.name || me;
  const opp = game[side === 'home' ? 'away' : 'home']?.team?.name || them;
  if (meWins / h2h.n >= 0.7) return `${name} have won ${meWins} of the last ${h2h.n} meetings with the ${opp}, and teams that own a matchup like that keep winning it a little more often than the odds expect.`;
  if (meWins / h2h.n <= 0.3) return `${name} have lost ${h2h.n - meWins} of the last ${h2h.n} meetings with the ${opp}.`;
  return null;
};

export const situationBits = (ctx, side) => {
  const bits = [];
  const other = side === 'home' ? 'away' : 'home';
  const r = ctx.rest;
  if (ctx.x.away_bye && side === 'home') bits.push('the visitors are off a bye (those teams have won less than priced)');
  if (r && r[side] - r[other] >= 2 && (ctx.x.rest_diff !== undefined || ctx.x.rest !== undefined))
    bits.push(`${r[side]} days of rest to their opponent's ${r[other]}`);
  if ((side === 'home' && ctx.x.revenge_home) || (side === 'away' && ctx.x.revenge_away)) bits.push('a revenge spot after a blowout loss last time');
  if (side === 'home' && ctx.x.away_b2b) bits.push('the visitors on the second night of a back-to-back');
  if (side === 'away' && ctx.x.home_b2b) bits.push('the home team on the second night of a back-to-back');
  return bits;
};
