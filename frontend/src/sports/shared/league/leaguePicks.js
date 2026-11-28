// Picks for the daily leagues (NBA, MLB). Every market of every game gets a
// pick; a BET is a rule that made money in the backtest, anything else is a
// LEAN (`bet: false`). Win chance: a 25/75 blend of ESPN's model and the
// betting market, or the market alone when ESPN has no model.
//
// NBA (scripts/backtest/nba/opening, re-run November 2026): every game gets
// all three picks, made and graded at the opening line and price (atOpen), and
// the record counts them all. Against the closing line nothing beat the market
// over 12 seasons, and no every-game rule beat it at the opener either (the
// best lost about 1.8% a bet). A few spots did, over the six seasons with saved
// openers (2016-17, 2024-2027), and those are the BETs (only when ESPN kept the
// opening line to bet at); the rest are LEANs:
//   spread    - the side with 2+ more days of rest, both teams 10+ games in:
//               +7.4% over 485 bets (-14% in the first 10 games, where the
//               rest days aren't reliable, so those games get no rest pick).
//   moneyline - the same rested side: +10.0% over 267 bets (swings by season).
//   total     - our scoring ratings (nbaScoring.js) 6+ points off the opening
//               total, both teams 10+ games in: 524-401, +6.7%.
// Leans: the spread and moneyline go on the opening favourite (-2.2%, -2.7%)
// and the total on the under when our ratings are 2+ points below the opener,
// else the over (-1.5%), so the two sides of a game agree.
// MLB hasn't been backtested yet: all leans.
import { fmtLine, fmtOdds } from '../api/betting';
import { marketHomeProbability } from '../api/picks';
import { LEAGUES } from './leagueApi';

const real = (n) => n !== null && n !== undefined && Math.abs(n) >= 100;
const clamp = (p) => Math.min(Math.max(p, 1), 99);
const nick = (team) => (team?.name || team?.abbreviation || '').toUpperCase();
const name = (team) => team?.name || team?.abbreviation || '';

export const winChance = ({ odds, predictor }) => {
  const market = marketHomeProbability(odds);
  const model = predictor?.home ?? null;
  if (market === null && model === null) return null;
  if (market === null) return { home: model, model, market };
  if (model === null) return { home: market, model, market };
  return { home: 0.25 * model + 0.75 * market, model, market };
};

// NBA rule thresholds (see above)
export const NBA_REST_EDGE = 2;
export const NBA_UNDER_EDGE = 2; // points our projection must be below the opening total for the under lean
export const NBA_TOTAL_EDGE = 6; // points between our projection and the opening total for the totals bet
export const NBA_MIN_GAMES = 10; // games each team has played before the rest and totals bets apply

// Days since each team's last game before `game` (7 when there wasn't one
// this season), from a list of earlier games: [{ date, homeId, awayId }].
export const restDays = (game, earlier) => {
  const at = new Date(game.date).getTime();
  const last = (teamId) => {
    let best = null;
    earlier.forEach((g) => {
      const t = new Date(g.date).getTime();
      if (t < at - 3600000 && (g.homeId === teamId || g.awayId === teamId) && (best === null || t > best)) best = t;
    });
    return best === null ? 7 : Math.round((at - best) / 86400000);
  };
  return { home: last(game.home?.teamId), away: last(game.away?.teamId) };
};

// A team schedule (parseTeamSchedule) as the earlier-games list restDays reads.
export const scheduleGames = (schedule) =>
  (schedule || []).map((g) => ({
    date: g.date,
    homeId: g.home?.teamId,
    awayId: g.away?.teamId,
  }));

// NBA: the side with 2+ more days of rest, or null.
const restedSide = (rest) => {
  if (!rest) return null;
  const edge = rest.home - rest.away;
  return edge >= NBA_REST_EDGE ? 'home' : edge <= -NBA_REST_EDGE ? 'away' : null;
};

// NBA: both teams have played enough games for the rest and totals bets
const seasoned = (scoring) => !!scoring && scoring.homeGames >= NBA_MIN_GAMES && scoring.awayGames >= NBA_MIN_GAMES;

// NBA: the moneyline favourite (by price), or null without prices.
const favouriteSide = (odds) =>
  real(odds?.home?.moneyLine) && real(odds?.away?.moneyLine)
    ? odds.home.moneyLine <= odds.away.moneyLine
      ? 'home'
      : 'away'
    : null;

// NBA: the favourite at the opening line (by the home team's opening spread,
// a pick'em counting as the away side, as the backtest did), else by the
// current prices or line.
const openFavourite = (odds) => {
  const open = odds?.home?.openSpreadLine;
  if (open !== null && open !== undefined) return open < 0 ? 'home' : 'away';
  if (favouriteSide(odds)) return favouriteSide(odds);
  return odds?.homeSpread !== null && odds?.homeSpread !== undefined ? (odds.homeSpread <= 0 ? 'home' : 'away') : null;
};

// scoring: the NBA projected total and games played (nbaScoring.js scoringFor), or null
export const buildLeaguePicks = ({ lg, game, odds, predictor, rest = null, scoring = null }) => {
  const league = LEAGUES[lg];
  const nba = lg === 'nba';
  const chance = winChance({ odds, predictor });
  const out = { winner: null, spread: null, total: null };
  if (!odds) return out;

  // NBA winner at the opening price: the better-rested team (a BET once both
  // teams are 10+ games in), else the opening favourite (a lean); the spread
  // pick below goes on the same team
  const ready = nba && seasoned(scoring);
  const restSide = ready ? restedSide(rest) : null;
  const nbaSide = nba ? restSide || openFavourite(odds) : null;
  if (nbaSide) {
    const side = nbaSide;
    const other = side === 'home' ? 'away' : 'home';
    const team = game[side]?.team;
    const rested = restSide === side;
    const atOpen = real(odds[side]?.openMoneyLine);
    const price = (s) => (atOpen && real(odds[s]?.openMoneyLine) ? odds[s].openMoneyLine : odds[s]?.moneyLine);
    const dog = real(price(side)) && real(price(other)) && price(side) > price(other);
    const at = real(price(side)) ? ` at ${atOpen ? 'the opening price, ' : ''}${fmtOdds(price(side))}` : '';
    out.winner = {
      key: 'winner',
      title: 'WINNER',
      side,
      bet: rested && atOpen,
      atOpen,
      upset: dog,
      headline: `${nick(team)} TO WIN`,
      summary: rested && atOpen
        ? `Bet ${name(team)}${at}: they've had ${rest[side]} days off to their opponent's ${rest[other]}. A team with 2+ more days of rest, once both were 10+ games in, won at prices that paid +10.0% over 267 games from 2024 to 2027, though it swings from season to season. The earlier the better.`
        : `Lean ${name(team)}${at}: the opening favourite, the same team as the spread pick. Favourites won 68% of NBA games from 2024 to 2027 but not often enough for what their prices cost (-2.7%), so it's a lean.`,
      odds: real(price(side)) ? `ML ${fmtOdds(price(side))}` : null,
      pick: team?.displayName || team?.abbreviation,
      pickAbbr: team?.abbreviation,
    };
  }

  // winner: the likelier side
  if (!out.winner && chance && real(odds.home?.moneyLine) && real(odds.away?.moneyLine)) {
    const side = chance.home >= 50 ? 'home' : 'away';
    const team = game[side]?.team;
    const p = Math.round(side === 'home' ? chance.home : 100 - chance.home);
    const parts = [];
    if (chance.model !== null)
      parts.push(`ESPN's model ${Math.round(side === 'home' ? chance.model : 100 - chance.model)}%`);
    if (chance.market !== null)
      parts.push(`the market ${Math.round(side === 'home' ? chance.market : 100 - chance.market)}%`);
    out.winner = {
      key: 'winner',
      title: 'WINNER',
      side,
      bet: false,
      headline: `${nick(team)} TO WIN`,
      summary: nba
        ? `Lean ${name(team)}: about ${p}% to win (${parts.join(', ')}). The favourite won 68% of NBA games since 2022, but no moneyline rule beat the prices, so it's a lean.`
        : `Lean ${name(team)}: about ${p}% to win (${parts.join(', ')}). Not backtested yet, so a lean, not a bet.`,
      odds: `ML ${fmtOdds(odds[side].moneyLine)}`,
      pick: team?.displayName || team?.abbreviation,
      pickAbbr: team?.abbreviation,
    };
  }

  // NBA spread at the opening line: the better-rested side (a BET once both
  // teams are 10+ games in), else the opening favourite (a lean): always the
  // moneyline pick's team
  if (nba && odds.homeSpread !== null && odds.homeSpread !== undefined) {
    const side = nbaSide || (odds.homeSpread <= 0 ? 'home' : 'away');
    const other = side === 'home' ? 'away' : 'home';
    const team = game[side]?.team;
    const rested = restSide === side;
    const current = odds[side]?.spreadLine ?? (side === 'home' ? odds.homeSpread : -odds.homeSpread);
    // the pick is at the opening line (and price) when ESPN kept it
    const opener = odds[side]?.openSpreadLine;
    const atOpen = opener !== null && opener !== undefined;
    const line = atOpen ? opener : current;
    const price = atOpen && real(odds[side]?.openSpreadOdds) ? odds[side].openSpreadOdds : odds[side]?.spreadOdds;
    const nowText = atOpen && opener !== current ? ` (opened ${fmtLine(opener)}, now ${fmtLine(current)})` : '';
    out.spread = {
      key: 'spread',
      title: league.lineLabel,
      side,
      bet: rested && atOpen,
      atOpen,
      headline: `${nick(team)} ${fmtLine(line)}`,
      summary: rested && atOpen
        ? `Bet ${name(team)} ${fmtLine(line)}${atOpen ? ' at the opening line' : ''}${nowText}: they've had ${rest[side]} days off to their opponent's ${rest[other]}. At the opening line the better-rested side covered +7.4% over 485 games once both teams were 10+ games in (2016-17 and 2024-2027), and the line moved toward them 67% of the time, so the earlier the better.`
        : `Lean ${name(team)} ${fmtLine(line)}${atOpen ? ' at the opening line' : ''}${nowText}: the opening favourite, the same team as the moneyline pick. No rest edge here (or it's early in the season), and favourites covered 51% over the six seasons with saved openers, just short of beating the prices (-2.2%), so it's a lean.`,
      odds: real(price) ? fmtOdds(price) : null,
      pick: `${team?.abbreviation} ${fmtLine(line)}`,
      pickAbbr: team?.abbreviation,
    };
  }

  // spread / run line / puck line: the win chance turned into an expected margin, against the line
  if (!nba && chance && odds.homeSpread !== null && odds.homeSpread !== undefined) {
    const p = clamp(chance.home) / 100;
    const homeMargin = league.marginScale * Math.log(p / (1 - p));
    const edge = homeMargin + odds.homeSpread;
    const side = edge > 0 ? 'home' : 'away';
    const team = game[side]?.team;
    const line = odds[side]?.spreadLine;
    const pickMargin = side === 'home' ? homeMargin : -homeMargin;
    out.spread = {
      key: 'spread',
      title: league.lineLabel,
      side,
      bet: false,
      headline: `${nick(team)} ${fmtLine(line)}`,
      summary: `Lean ${name(team)} ${fmtLine(line)}: the win chances point to ${
        pickMargin >= 0
          ? `them by about ${Math.abs(pickMargin).toFixed(1)}`
          : `a loss by only about ${Math.abs(pickMargin).toFixed(1)}`
      }. Not backtested yet.`,
      odds: real(odds[side]?.spreadOdds) ? fmtOdds(odds[side].spreadOdds) : null,
      pick: `${team?.abbreviation} ${fmtLine(line)}`,
      pickAbbr: team?.abbreviation,
    };
  }

  // NBA total at the opening total: a BET when our scoring ratings are 6+ points
  // off it (both teams 10+ games in); otherwise a lean on the under when they're
  // 2+ points below it, else the over
  const tl = odds.total;
  const atOpenTotal = tl?.openLine !== null && tl?.openLine !== undefined;
  const totalLine = atOpenTotal ? tl.openLine : tl?.line;
  if (nba && totalLine !== null && totalLine !== undefined) {
    const projected = scoring && Number.isFinite(scoring.total) ? scoring.total : null;
    const gap = projected !== null ? projected - totalLine : 0;
    const isBet = ready && atOpenTotal && Math.abs(gap) >= NBA_TOTAL_EDGE;
    const side = isBet ? (gap > 0 ? 'over' : 'under') : gap <= -NBA_UNDER_EDGE ? 'under' : 'over';
    const word = side === 'under' ? 'UNDER' : 'OVER';
    const openPrice = side === 'under' ? tl.openUnderOdds : tl.openOverOdds;
    const price = atOpenTotal && real(openPrice) ? openPrice : side === 'under' ? tl.underOdds : tl.overOdds;
    const now = tl.line;
    const at = `${atOpenTotal ? 'at the opening total of ' : ''}${totalLine}${atOpenTotal && now !== null && now !== undefined && now !== totalLine ? ` (now ${now})` : ''}`;
    const proj = projected !== null ? `our scoring ratings project about ${Math.round(projected)} points` : null;
    out.total = {
      key: 'total',
      title: 'OVER/UNDER',
      side,
      bet: isBet,
      atOpen: atOpenTotal,
      headline: `${word} ${totalLine}`,
      summary: isBet
        ? `Bet the ${side} ${at}: ${proj}, ${Math.round(Math.abs(gap))} ${gap > 0 ? 'over' : 'under'} it. When our ratings were 6+ points off the opener (both teams 10+ games in), the total went our way 524-401 (+6.7% at the opening prices) over the six seasons with saved openers, and the line moved toward our side 69% of the time, so the earlier the better.`
        : side === 'under'
          ? `Lean under ${at}: ${proj}, ${Math.round(Math.abs(gap))} under it, not far enough to bet. Games our ratings put 2+ points under the opener went under 1148-1018 (+0.5% at the opening prices).`
          : `Lean over ${at}: ${proj ? `${proj}, not 2+ under it` : 'there are no scoring ratings for this game'}. Without a clear gap the over went 2070-1970 (51%) at the opening prices, short of beating them (-2.6%), so it's a lean.`,
      odds: real(price) ? fmtOdds(price) : null,
      pick: `${word} ${totalLine}`,
    };
  }

  // total: no scoring model for these leagues yet, so a default lean
  if (!nba && odds.total?.line !== null && odds.total?.line !== undefined) {
    out.total = {
      key: 'total',
      title: 'OVER/UNDER',
      side: 'under',
      bet: false,
      headline: `UNDER ${odds.total.line}`,
      summary: `Lean under ${odds.total.line}: there's no ${league.label} scoring model yet, so this is a default lean.`,
      odds: real(odds.total.underOdds) ? fmtOdds(odds.total.underOdds) : null,
      pick: `UNDER ${odds.total.line}`,
    };
  }
  return out;
};
