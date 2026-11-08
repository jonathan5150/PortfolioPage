// Pick engine for the Betting tab. Pure functions: given lines, ESPN FPI,
// each team's graded season results, weather, defensive rankings and player
// game logs + prop lines, it returns a pick and short reasons for each market.
import { fmtLine, fmtOdds, recordText, impliedProbability } from './betting';
import { playerMarketsFor, BOOK } from './sportsbookOdds';

const round1 = (n) => Math.round(n * 10) / 10;
const fmt1 = (n) => (n === null || n === undefined ? '—' : round1(n).toFixed(1).replace(/\.0$/, ''));

// "a 60%" / "an 80%" / "an 11%"
const article = (n) => (/^(8|11|18)/.test(String(Math.round(n))) ? 'an' : 'a');

const rate = (rec, a = 'W', b = 'L') => {
  const n = (rec?.[a] || 0) + (rec?.[b] || 0);
  return n ? { rate: (rec[a] || 0) / n, n } : null;
};

// Win probability (%) -> expected margin in points (logistic fit to NFL lines).
export const marginFromProbability = (p) => {
  const clamped = Math.min(Math.max(p, 1), 99) / 100;
  return 6.5 * Math.log(clamped / (1 - clamped));
};

const sides = ({ game, odds, predictor, awayTrends, homeTrends }) =>
  ['away', 'home'].map((side) => {
    const other = side === 'away' ? 'home' : 'away';
    return {
      side,
      isHome: side === 'home',
      team: game[side]?.team,
      abbr: game[side]?.team?.abbreviation || side.toUpperCase(),
      oppAbbr: game[other]?.team?.abbreviation || other.toUpperCase(),
      teamId: game[side]?.teamId,
      nickname: (game[side]?.team?.name || game[side]?.team?.abbreviation || side).toUpperCase(),
      name: game[side]?.team?.name || game[side]?.team?.abbreviation || side,
      oppId: game[other]?.teamId,
      trends: side === 'away' ? awayTrends : homeTrends,
      oppTrends: side === 'away' ? homeTrends : awayTrends,
      prob: predictor ? predictor[side] : null,
      ml: odds?.[side]?.moneyLine ?? null,
      line: odds?.[side]?.spreadLine ?? null,
      spreadOdds: odds?.[side]?.spreadOdds ?? null,
    };
  });

// Points each team should score, from its offense and the opponent's defense.
const projectScores = (awayTrends, homeTrends) => {
  if (!(awayTrends?.games >= 2 && homeTrends?.games >= 2)) return null;
  if ([awayTrends.ppg, awayTrends.papg, homeTrends.ppg, homeTrends.papg].some((v) => v === null)) return null;
  const away = (awayTrends.ppg + homeTrends.papg) / 2;
  const home = (homeTrends.ppg + awayTrends.papg) / 2;
  return { away, home, total: away + home, homeMargin: home - away };
};

const lastN = (trends, n = 5) => (trends?.last5 || []).slice(-n);

const pts = (n) => Math.round(Math.abs(n) * 2) / 2; // nearest half point
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// "3" -> "a field goal", "7" -> "a touchdown", otherwise "6.5 points"
const spreadWords = (line) => {
  const n = Math.abs(line);
  if (n === 3) return 'a field goal';
  if (n === 7) return 'a touchdown';
  if (n === 14) return 'two touchdowns';
  if (n >= 10) return `${n} points (double digits)`;
  return `${n} points`;
};

const joinClauses = (clauses) =>
  clauses.length <= 1 ? clauses.join('') : `${clauses.slice(0, -1).join(', ')} and ${clauses[clauses.length - 1]}`;
const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

// ---------- winner ----------

export const pickWinner = (ctx) => {
  const [away, home] = sides(ctx);
  let pick;
  if (away.prob !== null && home.prob !== null) pick = home.prob >= away.prob ? home : away;
  else if (away.ml !== null && home.ml !== null) pick = home.ml <= away.ml ? home : away;
  else if (away.trends && home.trends) pick = (home.trends.ppg - home.trends.papg) >= (away.trends.ppg - away.trends.papg) ? home : away;
  else return null;
  const opp = pick === home ? away : home;

  const reasons = [];
  if (pick.prob !== null) reasons.push(`ESPN's FPI gives ${pick.abbr} ${article(pick.prob)} ${fmt1(pick.prob)}% chance to win.`);
  if (pick.trends && opp.trends) {
    reasons.push(
      `${pick.abbr} is ${recordText(pick.trends.su, ['W', 'L', 'T'])} this season; ${opp.abbr} is ${recordText(opp.trends.su, ['W', 'L', 'T'])}.`
    );
    const pm = pick.trends.ppg - pick.trends.papg;
    const om = opp.trends.ppg - opp.trends.papg;
    if (Number.isFinite(pm) && Number.isFinite(om) && pm > om) {
      reasons.push(
        `${pick.abbr} has a ${pm >= 0 ? '+' : ''}${fmt1(pm)} point differential per game, vs ${om >= 0 ? '+' : ''}${fmt1(om)} for ${opp.abbr}.`
      );
    }
    const recent = lastN(pick.trends);
    const wins = recent.filter((g) => g.su === 'W').length;
    if (recent.length >= 3 && wins >= Math.ceil(recent.length * 0.6)) {
      reasons.push(`${pick.abbr} has won ${wins} of its last ${recent.length}.`);
    }
    const os = opp.trends.suStreak;
    if (os?.type === 'L' && os.count >= 2) reasons.push(`${opp.abbr} has lost ${os.count} straight.`);
  }
  if (pick.isHome) reasons.push(`${pick.abbr} has home-field advantage.`);

  // A short, readable case for the LINES tab.
  const sentences = [];
  if (pick.prob !== null) {
    const p = Math.round(pick.prob);
    if (p >= 75) sentences.push(`ESPN's model gives the ${pick.name} a ${p}% shot. This one shouldn't be close.`);
    else if (p >= 60) sentences.push(`ESPN's model likes the ${pick.name} here, ${p}% to win.`);
    else sentences.push(`Close to a coin flip, but ESPN's model leans ${pick.name} (${p}%).`);
  }
  const clauses = [];
  if (pick.trends && opp.trends) {
    const pm = pick.trends.ppg - pick.trends.papg;
    const om = opp.trends.ppg - opp.trends.papg;
    if (Number.isFinite(pm) && Number.isFinite(om) && pm > om) {
      if (pm > 0) clauses.push(`they're outscoring teams by ${fmt1(pm)} a game`);
      if (om < 0) clauses.push(`the ${opp.name} are getting outscored by ${fmt1(-om)}`);
    }
    const ps = pick.trends.suStreak;
    const os = opp.trends.suStreak;
    if (ps?.type === 'W' && ps.count >= 2) clauses.push(`they've won ${ps.count} straight`);
    else if (os?.type === 'L' && os.count >= 2) clauses.push(`the ${opp.name} have dropped ${os.count} in a row`);
  }
  if (pick.isHome) clauses.push('they get the home crowd');
  if (clauses.length) sentences.push(`${capitalize(joinClauses(clauses.slice(0, 3)))}.`);
  if (!sentences.length) sentences.push(`The betting market has the ${pick.name} as the favorite.`);

  // "Strong" when our win chance clearly beats what the moneyline implies.
  const implied = impliedProbability(pick.ml);
  const strong = pick.prob !== null && implied !== null && pick.prob - implied >= 5;

  return {
    headline: `${pick.nickname} TO WIN`,
    side: pick.side,
    summary: sentences.join(' '),
    strong,
    key: 'winner',
    title: 'WINNER',
    pick: pick.team?.displayName || pick.abbr,
    pickAbbr: pick.abbr,
    odds: pick.ml !== null ? `ML ${fmtOdds(pick.ml)}` : null,
    confidence: pick.prob,
    reasons: reasons.slice(0, 4),
  };
};

// ---------- spread ----------

export const pickSpread = (ctx) => {
  const { odds, awayTrends, homeTrends } = ctx;
  const homeSpread = odds?.homeSpread;
  if (homeSpread === null || homeSpread === undefined) return null;
  const [away, home] = sides(ctx);
  const proj = projectScores(awayTrends, homeTrends);

  // Each signal: points by which HOME beats the number (negative = away covers).
  const signals = [];
  if (home.prob !== null) signals.push(marginFromProbability(home.prob) + homeSpread);
  if (proj) signals.push(proj.homeMargin + homeSpread);
  let edge = signals.length ? signals.reduce((a, b) => a + b, 0) / signals.length : 0;
  const homeAts = rate(homeTrends?.ats);
  const awayAts = rate(awayTrends?.ats);
  if (homeAts?.n >= 3 && awayAts?.n >= 3) edge += (homeAts.rate - awayAts.rate) * 4;
  if (!signals.length && !(homeAts && awayAts)) edge = homeSpread; // no data: take the points

  const pick = edge > 0 ? home : away;
  const opp = pick === home ? away : home;
  const fav = homeSpread < 0 ? home : away;

  const reasons = [];
  if (home.prob !== null) {
    const m = marginFromProbability(home.prob);
    const favByFpi = m >= 0 ? home : away;
    reasons.push(
      `FPI's win odds point to ${favByFpi.abbr} by about ${fmt1(Math.abs(m))}; the line has ${fav.abbr} by ${Math.abs(homeSpread)}.`
    );
  }
  if (proj) {
    const leader = proj.homeMargin >= 0 ? home : away;
    reasons.push(`Season scoring averages project ${leader.abbr} by ${fmt1(Math.abs(proj.homeMargin))}.`);
  }
  // Only cite ATS records that support the pick.
  const pickAts = rate(pick.trends?.ats);
  if (pickAts?.n >= 3 && pickAts.rate >= 0.5) {
    const role = pick.line < 0 ? 'favorite' : pick.line > 0 ? 'underdog' : null;
    const roleRec = role ? (pick.line < 0 ? pick.trends.atsFav : pick.trends.atsDog) : null;
    const roleText = roleRec && rate(roleRec)?.n >= 2 ? ` (${recordText(roleRec)} as ${role === 'favorite' ? 'a favorite' : 'an underdog'})` : '';
    reasons.push(`${pick.abbr} is ${recordText(pick.trends.ats)} against the spread this season${roleText}.`);
  }
  const oppAts = rate(opp.trends?.ats);
  if (oppAts?.n >= 3 && oppAts.rate < 0.45) {
    reasons.push(`${opp.abbr} has covered only ${opp.trends.ats.W || 0} of ${oppAts.n} games.`);
  }

  // Expected margin for the picked team, from the same signals.
  const homeExpect = [];
  if (home.prob !== null) homeExpect.push(marginFromProbability(home.prob));
  if (proj) homeExpect.push(proj.homeMargin);
  const homeMargin = homeExpect.length ? homeExpect.reduce((a, b) => a + b, 0) / homeExpect.length : null;
  const pickMargin = homeMargin === null ? null : pick === home ? homeMargin : -homeMargin;
  const lines = [];
  if (pickMargin === null) {
    lines.push(pick.line > 0 ? `Taking ${spreadWords(pick.line)} in a game the numbers see as tight.` : `Laying ${spreadWords(pick.line)} with the better team.`);
  } else if (pick.line < 0) {
    const cushion = pickMargin - Math.abs(pick.line);
    lines.push(
      cushion >= 3
        ? `We have the ${pick.name} winning by about ${pts(pickMargin)}, comfortably more than ${spreadWords(pick.line)}.`
        : `We have the ${pick.name} winning by about ${pts(pickMargin)}, just enough to clear ${spreadWords(pick.line)}.`
    );
  } else if (pickMargin >= 0) {
    lines.push(`Upset alert: our numbers have the ${pick.name} winning this outright, so getting ${spreadWords(pick.line)} is a bonus.`);
  } else {
    lines.push(`Getting ${spreadWords(pick.line)} is a lot of cushion. We only see the ${pick.name} losing by about ${pts(-pickMargin)}.`);
  }
  if (pickAts?.n >= 3 && pickAts.rate >= 0.5) {
    lines.push(`They've covered ${pick.trends.ats.W || 0} of ${plural(pickAts.n, 'game')} this year.`);
  } else if (oppAts?.n >= 3 && oppAts.rate < 0.45) {
    lines.push(`The ${opp.name} have covered just ${opp.trends.ats.W || 0} of ${oppAts.n}.`);
  }
  const summary = lines.join(' ');

  return {
    headline: `${pick.nickname} TO COVER ${fmtLine(pick.line)}`,
    side: pick.side,
    summary,
    strong: Math.abs(edge) >= 4,
    key: 'spread',
    title: 'SPREAD',
    pick: `${pick.abbr} ${fmtLine(pick.line)}`,
    pickAbbr: pick.abbr,
    odds: pick.spreadOdds !== null ? fmtOdds(pick.spreadOdds) : null,
    confidence: Math.min(Math.abs(edge) / 7, 1) * 100,
    reasons: reasons.slice(0, 4),
  };
};

// ---------- over / under ----------

export const weatherEffect = (game) => {
  if (game.indoor) return { adj: 0.5, text: 'Played indoors, so weather is not a factor.' };
  const w = game.weather;
  if (!w) return { adj: 0, text: null };
  const temp = w.temperature;
  const where = `${w.text || 'Forecast'}${temp !== null && temp !== undefined ? `, ${temp}°F` : ''}`;
  if (/snow|sleet|ice|storm|thunder/i.test(w.text || '')) return { adj: -3, text: `${where}: bad weather usually keeps scoring down.` };
  if (/rain|shower/i.test(w.text || '')) return { adj: -2, text: `${where}: a wet ball tends to slow offenses.` };
  if (temp !== null && temp !== undefined && temp <= 32) return { adj: -2, text: `${where}: freezing temperatures tend to lower scoring.` };
  if (temp !== null && temp !== undefined && temp <= 40) return { adj: -1, text: `${where}: cold weather can slow scoring a little.` };
  return { adj: 0, text: `${where}: no weather concerns.` };
};

export const pickTotal = (ctx) => {
  const { game, odds, awayTrends, homeTrends } = ctx;
  const line = odds?.total?.line;
  if (line === null || line === undefined) return null;
  const [away, home] = sides(ctx);
  const proj = projectScores(awayTrends, homeTrends);
  const weather = weatherEffect(game);

  const O = (awayTrends?.ou?.O || 0) + (homeTrends?.ou?.O || 0);
  const U = (awayTrends?.ou?.U || 0) + (homeTrends?.ou?.U || 0);
  const overRate = O + U >= 4 ? O / (O + U) : 0.5;

  const score = (proj ? proj.total - line : 0) + (overRate - 0.5) * 8 + weather.adj;
  const over = score > 0;

  const reasons = [];
  if (proj) {
    reasons.push(
      `Scoring averages project about ${fmt1(proj.total)} points (${away.abbr} ${fmt1(proj.away)}, ${home.abbr} ${fmt1(proj.home)}) against a total of ${line}.`
    );
  }
  [away, home].forEach((s) => {
    if (s.trends?.games >= 2 && s.trends.ppg !== null) {
      const gameAvg = s.trends.ppg + s.trends.papg;
      const o = s.trends.ou.O || 0;
      const u = s.trends.ou.U || 0;
      const ouText = o + u ? ` (${o} over${o === 1 ? '' : 's'}, ${u} under${u === 1 ? '' : 's'})` : '';
      reasons.push(`${s.abbr} games average ${fmt1(gameAvg)} total points${ouText}.`);
    }
  });
  if (weather.text) reasons.push(weather.text);

  const lines = [];
  if (proj) {
    const diff = proj.total - line;
    if (over) {
      lines.push(
        diff >= 4
          ? `These offenses project for about ${Math.round(proj.total)} points, well clear of ${line}.`
          : `Scoring averages put this around ${Math.round(proj.total)}, a touch over ${line}.`
      );
    } else {
      lines.push(
        diff <= -4
          ? `We project about ${Math.round(proj.total)} total points, well short of ${line}.`
          : `We project about ${Math.round(proj.total)}, a little under ${line}.`
      );
    }
  }
  if (O + U >= 4) {
    const hits = over ? O : U;
    if (hits / (O + U) >= 0.55) lines.push(`The ${over ? 'over' : 'under'} has cashed in ${hits} of ${O + U} of these teams' games.`);
  }
  const w = game.weather;
  if (/snow|sleet|ice/i.test(w?.text || '')) lines.push('Snow in the forecast should turn this into a grind.');
  else if (/rain|shower|storm|thunder/i.test(w?.text || '')) lines.push('Rain means a slick ball and a lot more running.');
  else if (w?.temperature !== null && w?.temperature !== undefined && w.temperature <= 35)
    lines.push(`A ${Math.round(w.temperature)}° kickoff won't do the offenses any favors.`);
  else if (game.indoor && over) lines.push('Dome conditions: fast track, no weather excuses.');
  if (!lines.length) lines.push(over ? 'A slight lean to the over.' : 'A slight lean to the under.');
  const summary = lines.join(' ');

  return {
    headline: `${over ? 'OVER' : 'UNDER'} ${line}`,
    side: over ? 'over' : 'under',
    summary,
    strong: Math.abs(score) >= 5,
    key: 'total',
    title: 'OVER/UNDER',
    pick: `${over ? 'OVER' : 'UNDER'} ${line}`,
    odds: fmtOdds(over ? odds.total.overOdds : odds.total.underOdds),
    confidence: Math.min(Math.abs(score) / 8, 1) * 100,
    reasons: reasons.slice(0, 4),
  };
};

// ---------- players ----------

const ordinalRank = (r) => {
  const suffix = ['th', 'st', 'nd', 'rd'];
  const v = r % 100;
  return `${r}${suffix[(v - 20) % 10] || suffix[v] || suffix[0]}`;
};

// This season's totals for the player card (last season if they haven't played yet).
const STAT_SETS = {
  QB: [
    ['CMP%', (t) => (t.passingAttempts ? `${((t.completions / t.passingAttempts) * 100).toFixed(1)}` : '—')],
    ['PASS YDS', (t) => t.passingYards],
    ['PASS TD', (t) => t.passingTouchdowns],
    ['INT', (t) => t.interceptions],
    ['RUSH YDS', (t) => t.rushingYards],
    ['RUSH TD', (t) => t.rushingTouchdowns],
  ],
  RB: [
    ['CAR', (t) => t.rushingAttempts],
    ['RUSH YDS', (t) => t.rushingYards],
    ['YPC', (t) => (t.rushingAttempts ? (t.rushingYards / t.rushingAttempts).toFixed(1) : '—')],
    ['RUSH TD', (t) => t.rushingTouchdowns],
    ['REC', (t) => t.receptions],
    ['REC YDS', (t) => t.receivingYards],
  ],
  WR: [
    ['TGT', (t) => t.receivingTargets],
    ['REC', (t) => t.receptions],
    ['REC YDS', (t) => t.receivingYards],
    ['Y/R', (t) => (t.receptions ? (t.receivingYards / t.receptions).toFixed(1) : '—')],
    ['REC TD', (t) => t.receivingTouchdowns],
  ],
};
STAT_SETS.TE = STAT_SETS.WR;
STAT_SETS.FB = STAT_SETS.RB;

const STAT_NAMES = [
  'completions', 'passingAttempts', 'passingYards', 'passingTouchdowns', 'interceptions',
  'rushingAttempts', 'rushingYards', 'rushingTouchdowns',
  'receivingTargets', 'receptions', 'receivingYards', 'receivingTouchdowns',
];

export const seasonStatLine = (games, position, season) => {
  let sample = games.filter((g) => g.season === season);
  let label = String(season);
  if (!sample.length) {
    sample = games.filter((g) => g.season === season - 1);
    label = String(season - 1);
  }
  if (!sample.length) return null;
  const totals = Object.fromEntries(STAT_NAMES.map((n) => [n, sample.reduce((t, g) => t + (g.stats?.[n] || 0), 0)]));
  const set = STAT_SETS[position] || STAT_SETS.WR;
  return {
    season: label,
    items: [{ label: 'GP', value: sample.length }, ...set.map(([l, fn]) => ({ label: l, value: fn(totals) ?? 0 }))],
  };
};

// This season's games (the last 10 at most), oldest first, with whether they
// scored. QBs count rushing touchdowns only, like the anytime TD bet.
export const TD_HISTORY_GAMES = 10;
export const touchdownHistory = (games, position, season) =>
  games
    .filter((g) => g.season === season)
    .slice(0, TD_HISTORY_GAMES)
    .map((g) => {
      const tds = (g.stats?.rushingTouchdowns || 0) + (position === 'QB' ? 0 : g.stats?.receivingTouchdowns || 0);
      const date = g.date ? new Date(g.date).toLocaleDateString([], { month: 'numeric', day: 'numeric' }) : '';
      const opp = `${g.atVs === '@' ? '@' : 'vs'} ${g.opponentAbbr || ''}`.trim();
      return {
        id: g.eventId,
        tds,
        scored: tds > 0,
        date,
        opp,
        label: `${date} ${opp}: ${tds ? plural(tds, 'TD') : 'no TD'}`.trim(),
      };
    })
    .reverse();

// A player's pick is just their touchdown chance (and the book's anytime TD price).
export const pickPlayer = ({ player, position, season, oppId, oppAbbr, rankings, bookOdds, teamPoints }) => {
  if (!player) return null;
  const book = playerMarketsFor(bookOdds, player.name);
  const td = touchdownChance({
    games: player.games || [],
    position,
    season,
    oppId,
    oppAbbr,
    rankings,
    teamPoints,
    bookTd: book?.anytimeTd?.yes || null,
  });
  return {
    player,
    position,
    td,
    stats: seasonStatLine(player.games || [], position, season),
    tdHistory: touchdownHistory(player.games || [], position, season),
  };
};

// ---------- touchdown chance ----------

// Players at or above this chance get the flashing gold border.
export const STRONG_TD_CHANCE = 40;

export const chanceLabel = (probability) =>
  probability >= 45 ? 'LIKELY' : probability >= 30 ? 'GOOD CHANCE' : probability >= 15 ? 'LONG SHOT' : 'UNLIKELY';

// Typical touchdowns per game by position, used to steady small samples.
const TD_PRIOR = { QB: 0.12, RB: 0.38, FB: 0.15, WR: 0.3, TE: 0.22 };
const PRIOR_GAMES = 4;
const LEAGUE_TEAM_POINTS = 22.5;

const tdsIn = (g, position) =>
  (g.stats?.rushingTouchdowns || 0) + (position === 'QB' ? 0 : g.stats?.receivingTouchdowns || 0);

// Chance a player scores a rushing/receiving TD (QBs: rushing only), from
// their TD rate (this season weighted over last), the team's implied points
// from the spread and total, and the opponent's scoring defense. Poisson:
// P(at least one) = 1 - e^(-expected TDs).
export const touchdownChance = ({ games, position, season, oppId, oppAbbr, rankings, teamPoints, bookTd }) => {
  const played = games.filter((g) => g.stats && Object.keys(g.stats).length);
  const thisSeason = played.filter((g) => g.season === season);
  const lastSeason = played.filter((g) => g.season !== season);
  const prior = TD_PRIOR[position] ?? 0.25;

  const tdThis = thisSeason.reduce((t, g) => t + tdsIn(g, position), 0);
  const tdLast = lastSeason.reduce((t, g) => t + tdsIn(g, position), 0);
  // This season counts 3x, last season half; a few "prior" games steady tiny samples.
  const weightedGames = thisSeason.length * 3 + lastSeason.length * 0.5 + PRIOR_GAMES;
  let rate = (tdThis * 3 + tdLast * 0.5 + prior * PRIOR_GAMES) / weightedGames;

  if (teamPoints) rate *= Math.min(Math.max(teamPoints / LEAGUE_TEAM_POINTS, 0.6), 1.5);
  const defRank = rankings?.ranks?.oppPpg?.[oppId] ?? null;
  const teamCount = rankings?.teamCount || 32;
  if (defRank) rate *= 1 + ((defRank - (teamCount + 1) / 2) / (teamCount - 1)) * 0.24;

  const probability = Math.min(Math.max((1 - Math.exp(-rate)) * 100, 2), 85);
  const implied = bookTd?.price !== undefined && bookTd?.price !== null ? impliedProbability(bookTd.price) : null;
  const edge = implied === null ? null : probability - implied;

  let opinion;
  if (edge !== null) opinion = edge >= 6 ? 'BET YES' : edge <= -6 ? 'PASS' : 'FAIR PRICE';
  else opinion = probability >= 45 ? 'LIKELY' : probability >= 30 ? 'GOOD CHANCE' : probability >= 15 ? 'LONG SHOT' : 'UNLIKELY';

  const recent = thisSeason.slice(0, 5);
  const recentScored = recent.filter((g) => tdsIn(g, position) > 0).length;
  const bits = [];
  if (thisSeason.length) {
    bits.push(`${tdThis} ${position === 'QB' ? 'rushing ' : ''}TD${tdThis === 1 ? '' : 's'} in ${thisSeason.length} games this season`);
    if (recent.length >= 3) bits.push(`scored in ${recentScored} of the last ${recent.length}`);
  }
  if (lastSeason.length) bits.push(`${tdLast} in ${lastSeason.length} games last season`);
  if (teamPoints) bits.push(`team projected for ${fmt1(teamPoints)} points`);
  if (defRank) bits.push(`${oppAbbr} ranks ${ordinalRank(defRank)} in points allowed`);
  const verdict = probability >= 45 ? 'Should score' : probability >= 25 ? 'Could score' : 'Unlikely to score';
  let reason = `${verdict}: ${bits.join('; ')}.`;
  let priceNote = null;
  if (implied !== null) {
    const compare = edge >= 6 ? 'better than' : edge <= -6 ? 'worse than' : 'close to';
    priceNote = `${fmt1(probability)}% vs ${fmt1(implied)}% implied: ${compare === 'close to' ? 'about fair' : compare === 'better than' ? 'value' : 'too short'}`;
    reason += ` Our ${fmt1(probability)}% is ${compare} the ${fmt1(implied)}% ${BOOK.name}${BOOK.name.endsWith('s') ? "'" : "'s"} ${fmtOdds(bookTd.price)} implies.`;
  }

  // The same evidence as labelled rows, for the player card.
  const factors = [];
  const tdWord = (n) => `${n} ${position === 'QB' ? 'rush ' : ''}TD${n === 1 ? '' : 's'}`;
  if (thisSeason.length) {
    factors.push({
      label: 'This season',
      value: `${tdWord(tdThis)} in ${thisSeason.length} games`,
      tone: tdThis / thisSeason.length >= prior ? 'good' : 'bad',
    });
  }
  if (recent.length >= 3) {
    factors.push({
      label: `Last ${recent.length}`,
      value: `scored in ${recentScored}`,
      tone: recentScored / recent.length >= 0.4 ? 'good' : recentScored === 0 ? 'bad' : null,
    });
  }
  if (lastSeason.length) factors.push({ label: 'Last season', value: `${tdWord(tdLast)} in ${lastSeason.length} games`, tone: null });
  if (priceNote) {
    factors.push({
      label: `${BOOK.name} ${fmtOdds(bookTd.price)}`,
      value: priceNote,
      tone: edge >= 6 ? 'good' : edge <= -6 ? 'bad' : null,
    });
  }

  return {
    probability,
    opinion,
    reason,
    price: bookTd?.price ?? null,
    link: bookTd?.link || null,
    implied,
    strong: probability >= STRONG_TD_CHANCE,
    edge,
    verdict,
    chance: chanceLabel(probability),
    factors,
  };
};

// ---------- everything ----------

// Winner, spread and total for the LINES tab.
export const buildLinePicks = ({ game, odds, predictor, awayTrends, homeTrends }) => {
  const ctx = { game, odds, predictor, awayTrends, homeTrends };
  return { winner: pickWinner(ctx), spread: pickSpread(ctx), total: pickTotal(ctx) };
};

// QB / RB / WR-TE touchdown picks for the PLAYERS tab. `players` is
// { away: { qb: [...], rb: [...], wr: [...] }, home: { ... } }.
// Points a team is expected to score from the total and its spread.
export const impliedTeamPoints = (odds, side) => {
  const total = odds?.total?.line;
  const line = odds?.[side]?.spreadLine;
  if (total === null || total === undefined || line === null || line === undefined) return null;
  return total / 2 - line / 2;
};

export const buildPlayerPicks = ({ game, players, rankings, bookOdds, odds }) => {
  const group = (key) =>
    ['away', 'home'].flatMap((side) => {
      const other = side === 'away' ? 'home' : 'away';
      return (players?.[side]?.[key] || [])
        .map((player) =>
          pickPlayer({
            player: { ...player, teamSide: side },
            position: player.position || (key === 'qb' ? 'QB' : key === 'rb' ? 'RB' : 'WR'),
            season: game.season,
            oppId: game[other]?.teamId,
            oppAbbr: game[other]?.team?.abbreviation,
            rankings,
            bookOdds,
            teamPoints: impliedTeamPoints(odds, side),
          })
        )
        .filter(Boolean);
    });
  return { qb: group('qb'), rb: group('rb'), wr: group('wr') };
};
