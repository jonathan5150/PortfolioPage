// Pick engine for the Betting tab. Pure functions: given lines, ESPN FPI,
// each team's graded season results, weather, defensive rankings and player
// game logs + prop lines, it returns a pick and short reasons for each market.
import { fmtLine, fmtOdds, impliedProbability } from './betting';
import { playerMarketsFor, BOOK } from './sportsbookOdds';

const round1 = (n) => Math.round(n * 10) / 10;
const fmt1 = (n) => (n === null || n === undefined ? '—' : round1(n).toFixed(1).replace(/\.0$/, ''));

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

// ---------- betting rules ----------
// Backtested on every regular-season game from 2019-2025 at closing prices,
// then checked on 2026, which played no part in choosing them (see
// scripts/backtest). Betting every market of every game lost money in all
// three markets, so the engine now bets only the spots that paid over that
// history and passes on the rest:
//   moneyline - "value": a 25/75 blend of ESPN FPI and the market's own odds
//               beats the price's implied chance by 1+ point (no dogs past +200)
//   spread    - home underdogs of 6.5+ that FPI has within a point of covering,
//               and underdogs in primetime games (public money pads favourites)
//   total     - fade the obvious: when season scoring averages sit 5+ points
//               off the total (week 4 on), or both teams' games keep going over
//               (or under), bet the other way.

const VALUE_BLEND = 0.25;
const VALUE_EDGE = 1;
const VALUE_MAX_DOG = 200;
const HOME_DOG_LINE = 6.5;
const HOME_DOG_FPI = 1;
const TOTAL_FADE_POINTS = 5;
const TOTAL_FADE_WEEK = 4;
const TOTAL_FORM = 0.2;

const realPrice = (n) => n !== null && n !== undefined && Math.abs(n) >= 100;

// The market's win chance for the home team with the bookmaker's margin removed.
export const marketHomeProbability = (odds) => {
  const h = odds?.home?.moneyLine;
  const a = odds?.away?.moneyLine;
  if (!realPrice(h) || !realPrice(a)) return null;
  const ph = impliedProbability(h);
  const pa = impliedProbability(a);
  return (ph / (ph + pa)) * 100;
};

// The moneyline side worth betting, or null.
export const moneylineValue = ({ odds, predictor }) => {
  const market = marketHomeProbability(odds);
  if (market === null || !predictor || predictor.home === null || predictor.home === undefined) return null;
  const pHome = VALUE_BLEND * predictor.home + (1 - VALUE_BLEND) * market;
  const best = ['home', 'away']
    .map((side) => {
      const ml = odds[side].moneyLine;
      const chance = side === 'home' ? pHome : 100 - pHome;
      const implied = impliedProbability(ml);
      return { side, ml, chance, implied, edge: chance - implied };
    })
    .sort((x, y) => y.edge - x.edge)[0];
  return best.edge >= VALUE_EDGE && best.ml <= VALUE_MAX_DOG ? best : null;
};

// Night games, Monday and Thursday games (US Eastern time).
export const isPrimetime = (game) => {
  if (!game?.date) return false;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    hour: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(new Date(game.date));
  const hour = Number(parts.find((p) => p.type === 'hour')?.value);
  const day = parts.find((p) => p.type === 'weekday')?.value;
  return hour >= 19 || day === 'Mon' || day === 'Thu';
};

const clampP = (p) => Math.min(Math.max(p, 1), 99);

// The spread side worth betting, or null.
export const spreadBet = ({ game, odds, predictor }) => {
  const s = odds?.homeSpread;
  if (s === null || s === undefined) return null;
  const fpiHomeMargin =
    predictor?.home !== null && predictor?.home !== undefined ? marginFromProbability(clampP(predictor.home)) : null;
  if (s >= HOME_DOG_LINE && fpiHomeMargin !== null && fpiHomeMargin + s >= HOME_DOG_FPI) {
    return { side: 'home', reason: 'homeDog', fpiHomeMargin };
  }
  if (s !== 0 && isPrimetime(game)) return { side: s > 0 ? 'home' : 'away', reason: 'primetime', fpiHomeMargin };
  return null;
};

// Both teams' over / under record so far, combined.
const ouForm = (awayTrends, homeTrends) => {
  const O = (awayTrends?.ou?.O || 0) + (homeTrends?.ou?.O || 0);
  const U = (awayTrends?.ou?.U || 0) + (homeTrends?.ou?.U || 0);
  return { O, U, rate: O + U >= 6 ? O / (O + U) : null };
};

// The total side worth betting, or null.
export const totalBet = ({ game, odds, awayTrends, homeTrends }) => {
  const line = odds?.total?.line;
  if (line === null || line === undefined) return null;
  const proj = projectScores(awayTrends, homeTrends);
  const enoughGames = awayTrends?.games >= 3 && homeTrends?.games >= 3;
  const lateEnough = game?.seasonType === 3 || (game?.week || 0) >= TOTAL_FADE_WEEK;
  let byProjection = null;
  if (proj && enoughGames && lateEnough && Math.abs(proj.total - line) >= TOTAL_FADE_POINTS) {
    byProjection = proj.total > line ? 'under' : 'over';
  }
  const form = ouForm(awayTrends, homeTrends);
  let byForm = null;
  if (form.rate !== null && Math.abs(form.rate - 0.5) >= TOTAL_FORM) byForm = form.rate > 0.5 ? 'under' : 'over';
  if (byProjection && byForm && byProjection !== byForm) return null;
  const side = byProjection || byForm;
  if (!side) return null;
  return { side, byProjection, byForm, proj, form };
};

// A market the engine sits out.
const pass = (key, title, headline, summary) => ({
  key,
  title,
  pass: true,
  headline,
  summary,
  side: null,
  strong: false,
  odds: null,
  pick: null,
  confidence: 0,
  reasons: [],
});

// ---------- winner ----------

export const pickWinner = (ctx) => {
  const [away, home] = sides(ctx);
  if (away.ml === null || home.ml === null) return null;
  const value = moneylineValue(ctx);
  const market = marketHomeProbability(ctx.odds);

  if (!value) {
    const fav = home.ml <= away.ml ? home : away;
    const favChance = market === null ? null : Math.round(fav === home ? market : 100 - market);
    return pass(
      'winner',
      'WINNER',
      'NO MONEYLINE BET',
      `No value on either side. The ${fav.name} are ${fmtOdds(fav.ml)}${
        favChance !== null ? ` (about ${favChance}% to win)` : ''
      }, and our numbers agree with that price.`,
    );
  }

  const pick = value.side === 'home' ? home : away;
  const chance = Math.round(value.chance);
  const implied = Math.round(value.implied);
  const sentences = [
    `We give the ${pick.name} a ${chance}% chance to win; at ${fmtOdds(value.ml)} the price only needs ${implied}%.`,
  ];
  if (pick.prob !== null && market !== null) {
    const mk = Math.round(pick === home ? market : 100 - market);
    sentences.push(`ESPN's FPI has them at ${Math.round(pick.prob)}%, the betting market at ${mk}%.`);
  }

  return {
    headline: `${pick.nickname} TO WIN`,
    side: pick.side,
    summary: sentences.join(' '),
    strong: value.edge >= 5,
    key: 'winner',
    title: 'WINNER',
    pick: pick.team?.displayName || pick.abbr,
    pickAbbr: pick.abbr,
    odds: `ML ${fmtOdds(value.ml)}`,
    confidence: value.chance,
    reasons: sentences,
  };
};

// ---------- spread ----------

export const pickSpread = (ctx) => {
  const homeSpread = ctx.odds?.homeSpread;
  if (homeSpread === null || homeSpread === undefined) return null;
  const [away, home] = sides(ctx);
  const bet = spreadBet(ctx);

  if (!bet) {
    const fav = homeSpread < 0 ? home : away;
    return pass(
      'spread',
      'SPREAD',
      'NO SPREAD BET',
      homeSpread === 0
        ? 'No spread bet on a pick-em line.'
        : `No edge on ${fav.abbr} ${fmtLine(fav.line)}. We only bet big home underdogs and primetime underdogs, the spots that have paid over time.`,
    );
  }

  const pick = bet.side === 'home' ? home : away;
  const fpiMargin = bet.fpiHomeMargin === null ? null : pick === home ? bet.fpiHomeMargin : -bet.fpiHomeMargin;
  const sentences = [];
  if (bet.reason === 'homeDog') {
    sentences.push(
      `Big home underdogs that ESPN's model has close have covered 56% of the time since 2019.`,
      fpiMargin >= 0
        ? `FPI even has the ${pick.name} winning, and they're getting ${spreadWords(pick.line)}.`
        : `FPI only has the ${pick.name} losing by about ${pts(-fpiMargin)}, inside ${spreadWords(pick.line)}.`,
    );
  } else {
    sentences.push(
      `Primetime underdogs have covered 54% of the time since 2019: national TV games pull public money onto the favorite, which pads the line.`,
      `Taking ${spreadWords(pick.line)} with the ${pick.name}.`,
    );
  }

  return {
    headline: `${pick.nickname} TO COVER ${fmtLine(pick.line)}`,
    side: pick.side,
    summary: sentences.join(' '),
    strong: bet.reason === 'homeDog',
    key: 'spread',
    title: 'SPREAD',
    pick: `${pick.abbr} ${fmtLine(pick.line)}`,
    pickAbbr: pick.abbr,
    odds: realPrice(pick.spreadOdds) ? fmtOdds(pick.spreadOdds) : null,
    confidence: bet.reason === 'homeDog' ? 56 : 54,
    reasons: sentences,
  };
};

// ---------- over / under ----------

export const weatherEffect = (game) => {
  if (game.indoor) return { adj: 0.5, text: 'Played indoors, so weather is not a factor.' };
  const w = game.weather;
  if (!w) return { adj: 0, text: null };
  const temp = w.temperature;
  const where = `${w.text || 'Forecast'}${temp !== null && temp !== undefined ? `, ${temp}°F` : ''}`;
  if (/snow|sleet|ice|storm|thunder/i.test(w.text || ''))
    return { adj: -3, text: `${where}: bad weather usually keeps scoring down.` };
  if (/rain|shower/i.test(w.text || '')) return { adj: -2, text: `${where}: a wet ball tends to slow offenses.` };
  if (temp !== null && temp !== undefined && temp <= 32)
    return { adj: -2, text: `${where}: freezing temperatures tend to lower scoring.` };
  if (temp !== null && temp !== undefined && temp <= 40)
    return { adj: -1, text: `${where}: cold weather can slow scoring a little.` };
  return { adj: 0, text: `${where}: no weather concerns.` };
};

export const pickTotal = (ctx) => {
  const { odds } = ctx;
  const line = odds?.total?.line;
  if (line === null || line === undefined) return null;
  const bet = totalBet(ctx);
  const proj = projectScores(ctx.awayTrends, ctx.homeTrends);

  if (!bet) {
    return pass(
      'total',
      'OVER/UNDER',
      'NO TOTAL BET',
      proj
        ? `Scoring averages put this around ${Math.round(proj.total)} against ${line}: not far enough off to fade either way.`
        : `Not enough games yet to find an edge on ${line}.`,
    );
  }

  const over = bet.side === 'over';
  const sentences = [];
  if (bet.byProjection) {
    sentences.push(
      `Season scoring averages say about ${Math.round(bet.proj.total)} points against a total of ${line}. Gaps that big usually close, so we take the ${bet.side}.`,
    );
  }
  if (bet.byForm) {
    const streakSide = over ? 'under' : 'over';
    const hits = over ? bet.form.U : bet.form.O;
    sentences.push(
      `These teams' games have gone ${streakSide} ${hits} of ${bet.form.O + bet.form.U} times. The market overreacts to runs like that, so we fade it.`,
    );
  }

  return {
    headline: `${over ? 'OVER' : 'UNDER'} ${line}`,
    side: bet.side,
    summary: sentences.join(' '),
    strong: Boolean(bet.byProjection && bet.byForm),
    key: 'total',
    title: 'OVER/UNDER',
    pick: `${over ? 'OVER' : 'UNDER'} ${line}`,
    odds: fmtOdds(over ? odds.total.overOdds : odds.total.underOdds),
    confidence: bet.byProjection && bet.byForm ? 60 : 57,
    reasons: sentences,
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
  'completions',
  'passingAttempts',
  'passingYards',
  'passingTouchdowns',
  'interceptions',
  'rushingAttempts',
  'rushingYards',
  'rushingTouchdowns',
  'receivingTargets',
  'receptions',
  'receivingYards',
  'receivingTouchdowns',
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

// A team's results before `game` this season, oldest to newest, shaped like a
// player's touchdown history: date and opponent over a W / L / T block.
export const teamResultHistory = (schedule, teamId, game) => {
  const cutoff = game?.date ? new Date(game.date).getTime() : Infinity;
  const rows = (schedule || [])
    .filter((g) => g.status?.state === 'post' && g.id !== game?.id && new Date(g.date).getTime() < cutoff)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map((g) => {
      const home = g.home?.teamId === teamId;
      const us = home ? g.home : g.away;
      const them = home ? g.away : g.home;
      const ours = Number(us?.score);
      const theirs = Number(them?.score);
      const result = ours > theirs ? 'W' : ours < theirs ? 'L' : 'T';
      const date = g.date ? new Date(g.date).toLocaleDateString([], { month: 'numeric', day: 'numeric' }) : '';
      const opp = `${home ? 'vs' : '@'} ${them?.team?.abbreviation || ''}`.trim();
      return {
        id: g.id,
        week: g.seasonType === 2 ? g.week : null,
        result,
        date,
        opp,
        label: `${date} ${opp}: ${result} ${ours}-${theirs}`.trim(),
      };
    });

  // A regular-season week before this game with no game in it was the bye:
  // it gets its own cell, in its week's place.
  const lastWeek = game?.seasonType === 2 ? (game.week || 1) - 1 : game?.seasonType === 3 ? 18 : 0;
  const played = new Set(rows.map((r) => r.week).filter(Boolean));
  if (!played.size) return rows;
  for (let week = 1; week <= lastWeek; week += 1) {
    if (!played.has(week)) {
      const bye = {
        id: `bye-${week}`,
        week,
        result: 'BYE',
        bye: true,
        date: `WK ${week}`,
        opp: 'BYE',
        label: `Week ${week}: bye`,
      };
      const at = rows.findIndex((r) => r.week && r.week > week);
      if (at < 0) rows.push(bye);
      else rows.splice(at, 0, bye);
    }
  }
  return rows;
};

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
  else
    opinion =
      probability >= 45 ? 'LIKELY' : probability >= 30 ? 'GOOD CHANCE' : probability >= 15 ? 'LONG SHOT' : 'UNLIKELY';

  const recent = thisSeason.slice(0, 5);
  const recentScored = recent.filter((g) => tdsIn(g, position) > 0).length;
  const bits = [];
  if (thisSeason.length) {
    bits.push(
      `${tdThis} ${position === 'QB' ? 'rushing ' : ''}TD${tdThis === 1 ? '' : 's'} in ${thisSeason.length} games this season`,
    );
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
  if (lastSeason.length)
    factors.push({ label: 'Last season', value: `${tdWord(tdLast)} in ${lastSeason.length} games`, tone: null });
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

// How a line pick did once the game is final: 'W', 'L', 'P' (push) or null
// when there's no score or line to grade it against.
export const gradeLinePick = (pick, game, odds) => {
  if (!pick || pick.pass || !pick.side || game?.status?.state !== 'post') return null;
  const score = { away: Number(game.away?.score), home: Number(game.home?.score) };
  if (!Number.isFinite(score.away) || !Number.isFinite(score.home)) return null;
  const result = (n) => (n > 0 ? 'W' : n < 0 ? 'L' : 'P');

  if (pick.key === 'winner') {
    const other = pick.side === 'away' ? 'home' : 'away';
    return result(score[pick.side] - score[other]);
  }
  if (pick.key === 'spread') {
    const line = odds?.[pick.side]?.spreadLine;
    if (line === null || line === undefined) return null;
    const other = pick.side === 'away' ? 'home' : 'away';
    return result(score[pick.side] - score[other] + Number(line));
  }
  if (pick.key === 'total') {
    const line = odds?.total?.line;
    if (line === null || line === undefined) return null;
    const diff = score.away + score.home - Number(line);
    return result(pick.side === 'over' ? diff : -diff);
  }
  return null;
};

export const gradeLinePicks = (linePicks, game, odds) =>
  linePicks
    ? {
        winner: gradeLinePick(linePicks.winner, game, odds),
        spread: gradeLinePick(linePicks.spread, game, odds),
        total: gradeLinePick(linePicks.total, game, odds),
      }
    : null;

// ---------- flat-stake bets ----------

// Spread and total bets without a posted price are assumed to be the
// standard -110.
const STANDARD_PRICE = -110;

// What a `stake` bet at American odds `price` pays back (stake included):
// a win returns stake + profit, a push returns the stake, a loss nothing.
export const betReturn = (stake, price, result) => {
  if (result === 'P') return stake;
  if (result !== 'W') return 0;
  const profit = price > 0 ? (stake * price) / 100 : (stake * 100) / -price;
  return Math.round((stake + profit) * 100) / 100;
};

// The three line picks as bets, in moneyline, spread, over/under order:
// what was bet, the pregame price and how it graded. Bets with no price
// (a moneyline with no posted odds) are left out.
export const linePickBets = (linePicks, game, odds) => {
  if (!linePicks) return [];
  const abbr = (side) => game?.[side]?.team?.abbreviation || side.toUpperCase();
  const bet = (key, label, price) => {
    const pick = linePicks[key];
    const result = gradeLinePick(pick, game, odds);
    if (!pick || !result || price === null || price === undefined) return null;
    return { key, label, price, result };
  };
  // markets the engine passed on aren't bets
  const live = (pick) => (pick && !pick.pass && pick.side ? pick : null);
  const winner = live(linePicks.winner);
  const spread = live(linePicks.spread);
  const total = live(linePicks.total);
  const real = (n) => n !== null && n !== undefined && Math.abs(n) >= 100;
  const priceOr = (n) => (real(n) ? n : STANDARD_PRICE);
  return [
    winner &&
      real(odds?.[winner.side]?.moneyLine) &&
      bet('winner', `${abbr(winner.side)} ML`, odds[winner.side].moneyLine),
    spread &&
      bet(
        'spread',
        `${abbr(spread.side)} ${fmtLine(odds?.[spread.side]?.spreadLine)}`,
        priceOr(odds?.[spread.side]?.spreadOdds),
      ),
    total &&
      bet(
        'total',
        `${total.side === 'over' ? 'OVER' : 'UNDER'} ${odds?.total?.line ?? ''}`.trim(),
        priceOr(total.side === 'over' ? odds?.total?.overOdds : odds?.total?.underOdds),
      ),
  ].filter(Boolean);
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
          }),
        )
        .filter(Boolean);
    });
  return { qb: group('qb'), rb: group('rb'), wr: group('wr') };
};
