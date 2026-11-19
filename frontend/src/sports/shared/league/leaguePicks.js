// Picks for the daily leagues (NBA, MLB). Every market of every game gets a
// pick; a BET is a rule that made money in the backtest, anything else is a
// LEAN (`bet: false`). Win chance: a 25/75 blend of ESPN's model and the
// betting market, or the market alone when ESPN has no model.
//
// NBA (scripts/backtest/nba, re-run November 2026): every regular-season game
// of 2022-23 through 2025-26 at closing prices, 2026-27 to date as the check.
// Every market is close to efficient: no rule makes money on every game, so
// the picks are the combination that lost least, with the moneyline and the
// spread always on the same team:
//   winner - the team with 2+ more days of rest than its opponent (won 58.0%,
//            +3.5% at the price), otherwise the favourite (68.3%).
//   spread - the same team: the better-rested side (2+ days), otherwise the
//            favourite. (The old default, the home team, did as well before
//            but lost 15.8% a pick in 2026-27.)
//   total  - follow a 3+ point move in the total since it opened, either way
//            (51.6%); otherwise the under at 235+ (52.0%), else the over (52.4%).
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
export const NBA_TOTAL_MOVE = 3;
export const NBA_HIGH_TOTAL = 235;

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

export const buildLeaguePicks = ({ lg, game, odds, predictor, rest = null, teamModel = null }) => {
  const league = LEAGUES[lg];
  const nba = lg === 'nba';
  const chance = winChance({ odds, predictor });
  const out = { winner: null, spread: null, total: null };
  if (!odds) return out;

  // NBA winner: the better-rested team, else the favourite (and the spread
  // pick below goes on the same team)
  const nbaSide = nba ? restedSide(rest) || favouriteSide(odds) : null;
  if (nbaSide) {
    const side = nbaSide;
    const other = side === 'home' ? 'away' : 'home';
    const team = game[side]?.team;
    const rested = restedSide(rest) === side;
    const dog = odds[side].moneyLine > odds[other].moneyLine;
    out.winner = {
      key: 'winner',
      title: 'WINNER',
      side,
      bet: false,
      upset: dog,
      headline: `${nick(team)} TO WIN`,
      summary: rested
        ? `${dog ? 'Upset lean' : 'Lean'} ${name(team)}: they've had ${rest[side]} days off to their opponent's ${rest[other]}. A team with 2+ more days of rest won 58% of the time from 2022 to 2026, more than its prices said.`
        : `Lean ${name(team)}: the favourite (${fmtOdds(odds[side].moneyLine)}) won 68% of NBA games from 2022 to 2026. Taking the underdog lost more.`,
      odds: `ML ${fmtOdds(odds[side].moneyLine)}`,
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

  // NBA spread: the rest rules (the better-rested side), else the favourite:
  // always the same team as the moneyline pick
  if (nba && odds.homeSpread !== null && odds.homeSpread !== undefined) {
    const edge = rest ? rest.home - rest.away : null;
    const homeRested = edge !== null && edge >= NBA_REST_EDGE;
    const awayRested = edge !== null && edge <= -NBA_REST_EDGE;
    // the moneyline favourite, so the spread is always on the moneyline pick's team
    const fav = favouriteSide(odds) || (odds.homeSpread <= 0 ? 'home' : 'away');
    const side = awayRested ? 'away' : homeRested ? 'home' : fav;
    const other = side === 'home' ? 'away' : 'home';
    const team = game[side]?.team;
    const line = odds[side]?.spreadLine ?? (side === 'home' ? odds.homeSpread : -odds.homeSpread);
    const isBet = homeRested || awayRested;
    out.spread = {
      key: 'spread',
      title: league.lineLabel,
      side,
      bet: isBet,
      headline: `${nick(team)} ${fmtLine(line)}`,
      summary: homeRested
        ? `Bet ${name(team)} ${fmtLine(line)}: they've had ${rest.home} days off to their visitor's ${rest.away}. A home team with 2+ more days of rest covered 57.5% of the time from 2022 to 2026.`
        : awayRested
          ? `Bet ${name(team)} ${fmtLine(line)}: they've had ${rest[side]} days off to their hosts' ${rest[other]}. A road team with 2+ more days of rest covered 52.5-53.5% of the time in every stretch we tested, 2007 to 2026.`
          : `Lean ${name(team)} ${fmtLine(line)}: the same team as the moneyline pick. No rest edge here, and favourites and underdogs cover about equally often, so it's a lean, not a bet.`,
      odds: real(odds[side]?.spreadOdds) ? fmtOdds(odds[side].spreadOdds) : null,
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

  // NBA total: follow a big move in the total, otherwise the over
  if (nba && odds.total?.line !== null && odds.total?.line !== undefined) {
    const open = odds.total.openLine;
    const move = open !== null && open !== undefined ? odds.total.line - open : null;
    const bigMove = move !== null && Math.abs(move) >= NBA_TOTAL_MOVE;
    const side = bigMove ? (move > 0 ? 'over' : 'under') : odds.total.line >= NBA_HIGH_TOTAL ? 'under' : 'over';
    const word = side === 'under' ? 'UNDER' : 'OVER';
    out.total = {
      key: 'total',
      title: 'OVER/UNDER',
      side,
      bet: false,
      headline: `${word} ${odds.total.line}`,
      summary:
        side === 'under' && !bigMove
          ? `Lean under ${odds.total.line}: totals of ${NBA_HIGH_TOTAL}+ that haven't moved much went under 52.0% of the time from 2022 to 2026. A lean, not a bet.`
          : side === 'under'
            ? `Lean under ${odds.total.line}: the total has dropped ${Math.abs(move)} points since it opened at ${open}, and big drops kept going under. A lean, not a bet.`
            : move !== null && move >= NBA_TOTAL_MOVE
              ? `Lean over ${odds.total.line}: the total has climbed ${move} points since it opened at ${open}, and big climbs kept going over. A lean, not a bet.`
              : `Lean over ${odds.total.line}: totals under ${NBA_HIGH_TOTAL} that haven't moved much went over 52.4% of the time from 2022 to 2026. A lean, not a bet.`,
      odds: real(side === 'under' ? odds.total.underOdds : odds.total.overOdds)
        ? fmtOdds(side === 'under' ? odds.total.underOdds : odds.total.overOdds)
        : null,
      pick: `${word} ${odds.total.line}`,
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
