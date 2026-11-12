// Picks for the daily leagues (NBA, MLB). Unlike the NFL engine these haven't
// been backtested yet, so every pick is a LEAN (`bet: false`), never a BET.
// Win chance: a 25/75 blend of ESPN's model and the betting market (the
// blend the NFL backtest liked), or the market alone when ESPN has no model.
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

export const buildLeaguePicks = ({ lg, game, odds, predictor }) => {
  const league = LEAGUES[lg];
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
      summary: `Lean ${name(team)}: about ${p}% to win (${parts.join(', ')}). Not backtested yet, so a lean, not a bet.`,
      odds: `ML ${fmtOdds(odds[side].moneyLine)}`,
      pick: team?.displayName || team?.abbreviation,
      pickAbbr: team?.abbreviation,
    };
  }

  // spread / run line: the win chance turned into an expected margin, against the line
  if (chance && odds.homeSpread !== null && odds.homeSpread !== undefined) {
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

  // total: no scoring model for these leagues yet, so a default lean
  if (odds.total?.line !== null && odds.total?.line !== undefined) {
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
