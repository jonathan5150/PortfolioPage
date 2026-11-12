// Picks for the daily leagues (NBA, MLB). Every market of every game gets a
// pick; a BET is a rule that made money in the backtest, anything else is a
// LEAN (`bet: false`). Win chance: a 25/75 blend of ESPN's model and the
// betting market, or the market alone when ESPN has no model.
//
// NBA (scripts/backtest/nba): every regular-season game of 2022-23 through
// 2025-26 at DraftKings / ESPN BET closing prices, 2026-27 held out. Betting
// every favourite, underdog, home or road side, over or under lost money in
// all of them. One rule paid in all four seasons:
//   spread - the home team when it's had 2+ more days of rest than the
//            visitor (58.1% over 260 games, +10.6% at the closing prices).
// No moneyline or total rule held up season after season, so those are leans:
//   winner - the blended favourite (right 68.4% of the time)
//   spread - the home side (50.4%) when the rest rule doesn't fire
//   total  - follow a 3+ point move in the total since it opened (down:
//            under), otherwise the over (51.5% together).
// MLB hasn't been backtested yet: all leans.
import { fmtLine, fmtOdds } from '../../pages/NFLData/NFLDataApi/betting';
import { marketHomeProbability } from '../../pages/NFLData/NFLDataApi/picks';
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
  (schedule || []).map((g) => ({ date: g.date, homeId: g.home?.teamId, awayId: g.away?.teamId }));

export const buildLeaguePicks = ({ lg, game, odds, predictor, rest = null }) => {
  const league = LEAGUES[lg];
  const nba = lg === 'nba';
  const chance = winChance({ odds, predictor });
  const out = { winner: null, spread: null, total: null };
  if (!odds) return out;

  // winner: the likelier side
  if (chance && real(odds.home?.moneyLine) && real(odds.away?.moneyLine)) {
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

  // NBA spread: the rest rule, else the home side
  if (nba && odds.homeSpread !== null && odds.homeSpread !== undefined) {
    const edge = rest ? rest.home - rest.away : null;
    const isBet = edge !== null && edge >= NBA_REST_EDGE;
    const team = game.home?.team;
    const line = odds.home?.spreadLine ?? odds.homeSpread;
    out.spread = {
      key: 'spread',
      title: league.lineLabel,
      side: 'home',
      bet: isBet,
      headline: `${nick(team)} ${fmtLine(line)}`,
      summary: isBet
        ? `Bet ${name(team)} ${fmtLine(line)}: they've had ${rest.home} days off to their visitor's ${rest.away}. A home team with 2+ more days of rest covered 58% of the time from 2022 to 2026.`
        : `Lean ${name(team)} ${fmtLine(line)}: home teams cover a little more often (50.4% since 2022). No rest edge here, so it's a lean, not a bet.`,
      odds: real(odds.home?.spreadOdds) ? fmtOdds(odds.home.spreadOdds) : null,
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
    const side = move !== null && move <= -NBA_TOTAL_MOVE ? 'under' : 'over';
    const word = side === 'under' ? 'UNDER' : 'OVER';
    out.total = {
      key: 'total',
      title: 'OVER/UNDER',
      side,
      bet: false,
      headline: `${word} ${odds.total.line}`,
      summary:
        side === 'under'
          ? `Lean under ${odds.total.line}: the total has dropped ${Math.abs(move)} points since it opened at ${open}, and big drops kept going under. A lean, not a bet.`
          : move !== null && move >= NBA_TOTAL_MOVE
            ? `Lean over ${odds.total.line}: the total has climbed ${move} points since it opened at ${open}, and big climbs kept going over. A lean, not a bet.`
            : `Lean over ${odds.total.line}: NBA games went over slightly more often (50.7% since 2022). A lean, not a bet.`,
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
