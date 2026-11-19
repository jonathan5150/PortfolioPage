// Picks for the daily leagues (NBA, MLB). Every market of every game gets a
// pick; a BET is a rule that made money in the backtest, anything else is a
// LEAN (`bet: false`). Win chance: a 25/75 blend of ESPN's model and the
// betting market, or the market alone when ESPN has no model.
//
// NBA (scripts/backtest/nba/opening, re-run November 2026): all three markets
// are BETs on every game, made and graded at the opening line and price
// (atOpen). Against the closing line nothing beat the market over 12 seasons;
// at the opener these rules lost the least over the six seasons with saved
// openers (2016-17, 2024-2027; moneylines 2024 on):
//   spread    - the side with 2+ more days of rest (319-266, +4.3%), else the
//               opening favourite (2850-2742, -2.2%).
//   moneyline - the same team as the spread pick (rest 185-150, +1.7%;
//               favourite 2385-1101, -2.7%).
//   total     - the under when our scoring ratings (nbaScoring.js) project 2+
//               points below the opening total (1148-1018, +0.5%), else the
//               over (2070-1970, -2.6%).
// All together: -1.8% a bet over 16,000, against about -4.5% for betting
// sides blindly, and +0.2% this season so far.
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
export const NBA_UNDER_EDGE = 2; // points our projection must be below the opening total for the under

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

  // NBA winner BET: the better-rested team, else the opening favourite, at the
  // opening price (and the spread bet below goes on the same team)
  const nbaSide = nba ? restedSide(rest) || openFavourite(odds) : null;
  if (nbaSide) {
    const side = nbaSide;
    const other = side === 'home' ? 'away' : 'home';
    const team = game[side]?.team;
    const rested = restedSide(rest) === side;
    const atOpen = real(odds[side]?.openMoneyLine);
    const price = (s) => (atOpen && real(odds[s]?.openMoneyLine) ? odds[s].openMoneyLine : odds[s]?.moneyLine);
    const dog = real(price(side)) && real(price(other)) && price(side) > price(other);
    const at = real(price(side)) ? ` at ${atOpen ? 'the opening price, ' : ''}${fmtOdds(price(side))}` : '';
    out.winner = {
      key: 'winner',
      title: 'WINNER',
      side,
      bet: true,
      atOpen,
      upset: dog,
      headline: `${nick(team)} TO WIN`,
      summary: rested
        ? `Bet ${name(team)}${at}: they've had ${rest[side]} days off to their opponent's ${rest[other]}. The better-rested side won 185-150 (+1.7%) at the opening prices from 2024 to 2027, so the earlier the better.`
        : `Bet ${name(team)}${at}: the opening favourite, the same team as the spread pick. Favourites won 68% of NBA games at the opening prices from 2024 to 2027 (2385-1101), just short of what those prices cost (-2.7%).`,
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

  // NBA spread BET at the opening line: the better-rested side, else the
  // opening favourite (always the moneyline pick's team)
  if (nba && odds.homeSpread !== null && odds.homeSpread !== undefined) {
    const side = nbaSide || (odds.homeSpread <= 0 ? 'home' : 'away');
    const other = side === 'home' ? 'away' : 'home';
    const team = game[side]?.team;
    const rested = restedSide(rest) === side;
    const current = odds[side]?.spreadLine ?? (side === 'home' ? odds.homeSpread : -odds.homeSpread);
    // the bet is at the opening line (and price) when ESPN kept it
    const opener = odds[side]?.openSpreadLine;
    const atOpen = opener !== null && opener !== undefined;
    const line = atOpen ? opener : current;
    const price = atOpen && real(odds[side]?.openSpreadOdds) ? odds[side].openSpreadOdds : odds[side]?.spreadOdds;
    const nowText = atOpen && opener !== current ? ` (opened ${fmtLine(opener)}, now ${fmtLine(current)})` : '';
    out.spread = {
      key: 'spread',
      title: league.lineLabel,
      side,
      bet: true,
      atOpen,
      headline: `${nick(team)} ${fmtLine(line)}`,
      summary: rested
        ? `Bet ${name(team)} ${fmtLine(line)}${atOpen ? ' at the opening line' : ''}${nowText}: they've had ${rest[side]} days off to their opponent's ${rest[other]}. At the opening line the better-rested side covered 319-266 (+4.3%) over the six seasons with saved openers, and the line moved toward them 67% of the time, so the earlier the better.`
        : `Bet ${name(team)} ${fmtLine(line)}${atOpen ? ' at the opening line' : ''}${nowText}: the opening favourite, the same team as the moneyline pick. Opening favourites covered 2850-2742 (51%) over the six seasons with saved openers, just short of beating the prices (-2.2%), and better than the underdogs (-6.7%).`,
      odds: real(price) ? fmtOdds(price) : null,
      pick: `${team?.abbreviation} ${fmtLine(line)}`,
      pickAbbr: team?.abbreviation,
    };
  }

  // spread / run line: the win chance turned into an expected margin, against the line
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

  // NBA total BET at the opening total: the under when our scoring ratings
  // project 2+ points below it, else the over
  const tl = odds.total;
  const atOpenTotal = tl?.openLine !== null && tl?.openLine !== undefined;
  const totalLine = atOpenTotal ? tl.openLine : tl?.line;
  if (nba && totalLine !== null && totalLine !== undefined) {
    const projected = scoring && Number.isFinite(scoring.total) ? scoring.total : null;
    const side = projected !== null && projected - totalLine <= -NBA_UNDER_EDGE ? 'under' : 'over';
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
      bet: true,
      atOpen: atOpenTotal,
      headline: `${word} ${totalLine}`,
      summary:
        side === 'under'
          ? `Bet the under ${at}: ${proj}, ${Math.round(totalLine - projected)} under it. Games our ratings put 2+ points under the opener went under 1148-1018 (+0.5% at the opening prices) over the six seasons with saved openers.`
          : `Bet the over ${at}: ${proj ? `${proj}, not 2+ under it` : "there are no scoring ratings for this game"}. In those games the over went 2070-1970 (51%) at the opening prices over the six seasons with saved openers, the better side but short of beating the prices (-2.6%).`,
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
