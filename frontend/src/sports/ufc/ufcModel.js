// UFC picks from the backtested model (scripts/backtest/ufc/backtest_ufc.py).
//
// The model was fit on every UFC fight 2015 - Oct 2026 (UFC Data by nlbair,
// CC BY 4.0) and tested on the last year of it, which it never saw:
//   winner - the betting market's chance plus each fighter's UFC history
//            (age, reach, KO power vs chin, striking, wrestling, layoff, ...).
//            A BET when that chance beats the price by 4%+ in expected value
//            (often an underdog); otherwise a lean on the likelier fighter.
//   rounds - chance the fight goes past the rounds line (60% right on the
//            held-out year vs 53% for always taking the commoner side).
//   method - KO/TKO, submission or decision (49% right vs 42% for always
//            picking a decision).
// The fitted numbers live in /public/models (refreshed by rerunning the script).
import { fetchJson } from '../../pages/NFLData/NFLDataApi/http';
import { impliedProbability } from '../../pages/NFLData/NFLDataApi/betting';

const HOUR = 60 * 60 * 1000;
const base = () => `${process.env.PUBLIC_URL || ''}/models`;

let loading = null;
export const loadUfcModel = () => {
  if (!loading) {
    loading = Promise.all([
      fetchJson(`${base()}/ufc-model.json`, { ttlMs: 12 * HOUR }),
      fetchJson(`${base()}/ufc-fighters.json`, { ttlMs: 12 * HOUR }),
    ])
      .then(([model, table]) => ({ model, fighters: table.fighters || {}, through: table.through }))
      .catch((error) => {
        loading = null;
        throw error;
      });
  }
  return loading;
};

// ---------- small helpers ----------

export const normName = (s) =>
  String(s || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const sigmoid = (x) => 1 / (1 + Math.exp(-x));
const logit = (p) => {
  const q = Math.min(Math.max(p, 1e-4), 1 - 1e-4);
  return Math.log(q / (1 - q));
};
const dot = (coef, features, x) => features.reduce((sum, name, i) => sum + coef[i] * (x[name] ?? 0), 0);
export const decimalPrice = (american) => (american > 0 ? 1 + american / 100 : 1 + 100 / -american);
const DAY = 86400000;

// "6' 4\"" -> cm, "77\"" -> cm
const heightCm = (text) => {
  const m = String(text || '').match(/(\d+)'\s*(\d+)?/);
  return m ? (Number(m[1]) * 12 + Number(m[2] || 0)) * 2.54 : null;
};
const reachCm = (text) => {
  const m = String(text || '').match(/([\d.]+)/);
  return m ? Number(m[1]) * 2.54 : null;
};

// pounds for the weight class ("Lightweight", "LW", "Women's Flyweight", "W-FLW" ...)
export const weightClassInfo = (label) => {
  const s = String(label || '').toLowerCase();
  const women = /women|wmn|^w[-\s]/.test(s);
  const t = s.replace(/women'?s?|wmn/g, '').replace(/^w[-\s]/, '');
  const has = (re) => re.test(t);
  let pounds = 165;
  if (has(/light\s*heavy|\blhw\b/)) pounds = 205;
  else if (has(/heavy|\bhw\b/)) pounds = 245;
  else if (has(/middle|\bmw\b/)) pounds = 185;
  else if (has(/welter|\bww\b/)) pounds = 170;
  else if (has(/light|\blw\b/)) pounds = 155;
  else if (has(/feather|\bfw\b|\bfew\b/)) pounds = 145;
  else if (has(/bantam|\bbw\b|\bbaw\b/)) pounds = 135;
  else if (has(/fly|\bflw\b|\bfw\b/)) pounds = 125;
  else if (has(/straw|\bsw\b/)) pounds = 115;
  else if (has(/catch/)) pounds = 160;
  return { pounds, women };
};

// A fighter with no UFC history (their debut), as the backtest scored them.
const NEWCOMER = { n: 0, elo: 1500, ko_w: 0.3, sub_w: 0.15, ko_l: 0.2, sub_l: 0.1, dec: 0.45, slpm: 3.5, sapm: 3.5, acc: 20 / 45, tdpm: 0.05, last: null, lko: 0, st: 0, am: 10, age: null, reach: null, height: null };

// One fighter's record from the table (by name), topped up from ESPN's tale of the tape.
export const fighterProfile = (fighters, espnFighter, name, date) => {
  const key = normName(name || espnFighter?.name);
  let row = fighters[key];
  if (!row && key) {
    // "Jose Aldo Junior" -> "jose aldo": try first + last name
    const parts = key.split(' ');
    if (parts.length > 2) row = fighters[`${parts[0]} ${parts[parts.length - 1]}`];
  }
  const p = { ...NEWCOMER, ...(row || {}), known: Boolean(row) };
  const when = date ? new Date(date).getTime() : Date.now();
  // age now = age at their last UFC fight + time since; else ESPN's age
  if (p.age !== null && p.age !== undefined && p.last) p.ageNow = p.age + (when - new Date(p.last).getTime()) / (365.25 * DAY);
  else if (espnFighter?.age) p.ageNow = Number(espnFighter.age);
  else p.ageNow = 30;
  p.reachCm = p.reach ?? reachCm(espnFighter?.reach);
  p.heightCm = p.height ?? heightCm(espnFighter?.height);
  p.layoff = p.last ? Math.min((when - new Date(p.last).getTime()) / DAY, 1500) : 365;
  return p;
};

const sideFeatures = (s, o, marketChance) => ({
  mkt: logit(marketChance),
  move: 0, // opening lines aren't in ESPN's feed; the backtest found almost no weight on it
  elo: (s.elo - o.elo) / 100,
  exp: Math.log1p(s.n) - Math.log1p(o.n),
  age: (s.ageNow - o.ageNow) / 5,
  age_old: Math.max(s.ageNow - 33, 0) / 3 - Math.max(o.ageNow - 33, 0) / 3,
  reach: s.reachCm && o.reachCm ? (s.reachCm - o.reachCm) / 10 : 0,
  height: s.heightCm && o.heightCm ? (s.heightCm - o.heightCm) / 10 : 0,
  strike: s.slpm - s.sapm - (o.slpm - o.sapm),
  acc: (s.acc - o.acc) * 10,
  td: (s.tdpm - o.tdpm) * 10,
  layoff: (s.layoff - o.layoff) / 365,
  ko_chin: o.ko_w * s.ko_l - s.ko_w * o.ko_l,
  streak: (Math.max(Math.min(s.st, 5), -5) - Math.max(Math.min(o.st, 5), -5)) / 5,
  last_ko: s.lko - o.lko,
});

const real = (n) => n !== null && n !== undefined && Math.abs(n) >= 100;

// ---------- the three picks for one fight ----------
// fight: parsed ESPN fight; odds: getUfcOdds(); tape: { red, blue } ESPN fighters (optional)
export const ufcPicks = ({ model, fighters }, fight, odds, tape = {}) => {
  const redPrice = odds?.byId?.[fight.red?.id];
  const bluePrice = odds?.byId?.[fight.blue?.id];
  if (!real(redPrice) || !real(bluePrice)) return null;
  const ir = impliedProbability(redPrice) / 100;
  const ib = impliedProbability(bluePrice) / 100;
  const marketRed = ir / (ir + ib);

  const red = fighterProfile(fighters, tape.red, fight.red?.name, fight.date);
  const blue = fighterProfile(fighters, tape.blue, fight.blue?.name, fight.date);

  // winner
  const W = model.winner;
  const rawRed = sigmoid(W.intercept + dot(W.coef, W.features, sideFeatures(red, blue, marketRed)));
  const rawBlue = sigmoid(W.intercept + dot(W.coef, W.features, sideFeatures(blue, red, 1 - marketRed)));
  const pRed = rawRed / (rawRed + rawBlue);
  const sides = [
    { corner: 'red', fighter: fight.red, p: pRed, market: marketRed, price: redPrice, profile: red, opp: blue },
    { corner: 'blue', fighter: fight.blue, p: 1 - pRed, market: 1 - marketRed, price: bluePrice, profile: blue, opp: red },
  ].map((s) => ({ ...s, ev: s.p * decimalPrice(s.price) - 1 }));
  const value = sides
    .filter((s) => s.ev >= W.min_edge && decimalPrice(s.price) <= W.max_price)
    .sort((a, b) => b.ev - a.ev)[0];
  const likelier = sides[0].p >= sides[1].p ? sides[0] : sides[1];
  const winPick = value || likelier;
  const isDog = winPick.market < 0.5;

  // rounds over / under
  const { pounds, women } = weightClassInfo(fight.weightClass);
  const rounds = fight.rounds || 3;
  const standardLine = rounds === 5 ? 4.5 : 2.5;
  const line = odds?.rounds ?? standardLine;
  const R = model.rounds;
  const lineModel = R.by_line?.[String(line)] || R.by_line?.[String(standardLine)] || R;
  const fightX = {
    five: rounds === 5 ? 1 : 0,
    weight: (pounds - 165) / 40,
    women: women ? 1 : 0,
    mismatch: Math.abs(marketRed - 0.5) * 2,
    ko_power: red.ko_w + blue.ko_w,
    chin: red.ko_l + blue.ko_l,
    sub_skill: red.sub_w + blue.sub_w,
    sub_def: red.sub_l + blue.sub_l,
    dec_hist: red.dec + blue.dec,
    avg_min: (red.am + blue.am) / 10,
    pace: (red.slpm + blue.slpm) / 5,
    td: (red.tdpm + blue.tdpm) * 10,
  };
  const pOver = sigmoid(lineModel.intercept + dot(lineModel.coef, R.features, fightX));

  // method
  const M = model.method;
  const scores = M.classes.map((c, k) => M.intercept[k] + dot(M.coef[k], M.features, fightX));
  const top = Math.max(...scores);
  const exps = scores.map((s) => Math.exp(s - top));
  const sum = exps.reduce((a, b) => a + b, 0);
  const methodProbs = Object.fromEntries(M.classes.map((c, k) => [c, exps[k] / sum]));
  const method = M.classes[scores.indexOf(top)];

  return {
    winner: {
      key: 'winner',
      bet: Boolean(value),
      underdog: isDog,
      corner: winPick.corner,
      fighter: winPick.fighter,
      chance: winPick.p,
      market: winPick.market,
      price: winPick.price,
      ev: winPick.ev,
      edgeFor: value ? sides.filter((s) => s !== value) : null,
      profile: winPick.profile,
      opp: winPick.opp,
    },
    rounds: { key: 'rounds', side: pOver >= 0.5 ? 'over' : 'under', chance: Math.max(pOver, 1 - pOver), pOver, line, posted: odds?.rounds !== null && odds?.rounds !== undefined, overOdds: odds?.overOdds ?? null, underOdds: odds?.underOdds ?? null },
    method: { key: 'method', method, chance: methodProbs[method], probs: methodProbs },
    profiles: { red, blue },
  };
};

// ---------- grading (finished fights) ----------

const clockSecs = (clock) => {
  const m = String(clock || '').match(/(\d+):(\d+)/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

export const resultMethod = (result) => {
  const t = `${result?.method || ''} ${result?.detail || ''}`.toLowerCase();
  if (/\bko\b|tko|knockout/.test(t)) return 'KO';
  if (/sub/.test(t)) return 'SUB';
  if (/dec/.test(t)) return 'DEC';
  return null; // DQ, no contest, overturned
};

// how long the fight lasted, in seconds (null if unknown)
export const fightSeconds = (fight, result) => {
  if (!result) return null;
  const m = resultMethod(result);
  if (m === 'DEC') return (fight.rounds || 3) * 300;
  const secs = clockSecs(result.clock);
  if (!result.round || secs === null) return null;
  return (result.round - 1) * 300 + secs;
};

export const gradeUfcPicks = (picks, fight, result) => {
  if (!picks || fight.status.state !== 'post') return null;
  const decided = fight.red?.winner || fight.blue?.winner;
  const winner = !decided ? 'P' : picks.winner.fighter?.winner ? 'W' : 'L';
  const secs = fightSeconds(fight, result);
  const rounds = secs === null ? null : (secs > picks.rounds.line * 300) === (picks.rounds.side === 'over') ? 'W' : 'L';
  const actual = resultMethod(result);
  const method = actual === null ? null : actual === picks.method.method ? 'W' : 'L';
  return { winner, rounds, method };
};

export const METHOD_LABEL = { KO: 'KO/TKO', SUB: 'SUBMISSION', DEC: 'DECISION' };
