// Parlay legs for the NBA, MLB and UFC pages, in the same shape the NFL page
// uses, so one DraftKings slip can hold picks from every sport (the slip is
// saved in the browser and shared by all four pages).
// A leg: { id, market, gameId, matchup, label, detail, odds, link }.
import { fmtLine } from '../pages/NFLData/NFLDataApi/betting';

const LEAGUE_LABEL = { nba: 'NBA', mlb: 'MLB', ufc: 'UFC' };

// legs only for games that haven't finished
export const canBet = (game) => game?.status?.state !== 'post';

// Moneyline / spread (run line) / total legs for a team game.
export const teamGameLegs = (lg, game, odds) => {
  const links = odds?.links || {};
  const abbr = (side) => game[side]?.team?.abbreviation;
  const base = {
    gameId: `${lg}:${game.id}`,
    matchup: `${LEAGUE_LABEL[lg]} · ${abbr('away')} @ ${abbr('home')}`,
  };
  const id = (rest) => `${lg}:${game.id}:${rest}`;
  return {
    ml: (side) => ({
      ...base,
      id: id(`ml:${side}`),
      market: id('ml'),
      label: `${abbr(side)} ML`,
      detail: 'Moneyline',
      odds: odds?.[side]?.moneyLine ?? null,
      link: links[`${side}Ml`] || null,
    }),
    spread: (side) => ({
      ...base,
      id: id(`spread:${side}`),
      market: id('spread'),
      label: `${abbr(side)} ${fmtLine(odds?.[side]?.spreadLine)}`,
      detail: lg === 'mlb' ? 'Run line' : 'Spread',
      odds: odds?.[side]?.spreadOdds ?? null,
      link: links[`${side}Spread`] || null,
    }),
    total: (ou) => ({
      ...base,
      id: id(`total:${ou}`),
      market: id('total'),
      label: `${ou === 'over' ? 'Over' : 'Under'} ${odds?.total?.line}`,
      detail: lg === 'mlb' ? 'Total runs' : 'Total points',
      odds: (ou === 'over' ? odds?.total?.overOdds : odds?.total?.underOdds) ?? null,
      link: links[ou] || null,
    }),
  };
};

// The leg a team pick card stands for.
export const pickLeg = (legs, pick) => {
  if (!pick) return null;
  if (pick.key === 'winner') return legs.ml(pick.side);
  if (pick.key === 'spread') return legs.spread(pick.side);
  return legs.total(pick.side);
};

// UFC: one moneyline leg per fighter.
export const fightLeg = (eventId, fight, fighter, odds) =>
  fighter
    ? {
        id: `ufc:${fight.id}:ml:${fighter.id}`,
        market: `ufc:${fight.id}:ml`,
        gameId: `ufc:${eventId}:${fight.id}`,
        matchup: `UFC · ${fight.red?.lastName || fight.red?.name} vs ${fight.blue?.lastName || fight.blue?.name}`,
        label: `${fighter.name} ML`,
        detail: 'Moneyline',
        odds: odds?.byId?.[fighter.id] ?? null,
        link: odds?.linksById?.[fighter.id] || null,
      }
    : null;
