import { buildLeaguePicks, restDays, winChance } from './leaguePicks';
import { gradeLinePicks, linePickBets } from '../api/picks';

const team = (abbreviation, name) => ({ abbreviation, name, displayName: name, league: 'nba' });
const game = (state = 'pre', awayScore = null, homeScore = null) => ({
  status: { state },
  away: { team: team('MIL', 'Bucks'), score: awayScore },
  home: { team: team('NY', 'Knicks'), score: homeScore },
});
const odds = {
  homeSpread: -6.5,
  home: { moneyLine: -250, spreadLine: -6.5, spreadOdds: -110 },
  away: { moneyLine: 205, spreadLine: 6.5, spreadOdds: -110 },
  total: { line: 221.5, overOdds: -110, underOdds: -110 },
};

describe('league picks (NBA / MLB)', () => {
  const seasoned = { total: 221.5, homeGames: 12, awayGames: 12 };
  // the same prices with the opening line and moneyline saved: bets are made at the opener
  const opening = {
    ...odds,
    home: { ...odds.home, openSpreadLine: -6.5, openSpreadOdds: -110, openMoneyLine: -250 },
    away: { ...odds.away, openSpreadLine: 6.5, openSpreadOdds: -110, openMoneyLine: 205 },
  };

  it('NBA: the moneyline and the spread go on the same team: the favourite, or the better-rested side', () => {
    const even = buildLeaguePicks({ lg: 'nba', game: game(), odds: opening, predictor: null, rest: { home: 2, away: 2 }, scoring: seasoned });
    expect(even.winner).toMatchObject({ side: 'home', headline: 'KNICKS TO WIN', odds: 'ML -250', bet: false });
    expect(even.spread).toMatchObject({ side: 'home', bet: false });
    // the Bucks have had 3 more days off: both picks move to them, and both are bets
    const rested = buildLeaguePicks({ lg: 'nba', game: game(), odds: opening, predictor: null, rest: { home: 1, away: 4 }, scoring: seasoned });
    // no opener saved for the game: the same side, but only a lean
    const noOpener = buildLeaguePicks({ lg: 'nba', game: game(), odds, predictor: null, rest: { home: 1, away: 4 }, scoring: seasoned });
    expect(noOpener.spread).toMatchObject({ side: 'away', bet: false, atOpen: false });
    expect(rested.winner).toMatchObject({ side: 'away', upset: true, headline: 'BUCKS TO WIN', odds: 'ML +205', bet: true });
    expect(rested.spread).toMatchObject({ side: 'away', bet: true });
  });

  it('blends ESPN and the market 25/75, or uses the market alone', () => {
    const both = winChance({ odds, predictor: { home: 80, away: 20 } });
    expect(both.home).toBeCloseTo(0.25 * 80 + 0.75 * both.market, 5);
    expect(winChance({ odds, predictor: null }).home).toBeCloseTo(both.market, 5);
  });

  it('NBA picks all three markets (leans unless a spot applies); MLB leans', () => {
    const picks = buildLeaguePicks({ lg: 'nba', game: game(), odds, predictor: { home: 70, away: 30 } });
    expect(picks.winner).toMatchObject({ side: 'home', bet: false, headline: 'KNICKS TO WIN', odds: 'ML -250' });
    expect(picks.spread).toMatchObject({ side: 'home', bet: false, title: 'SPREAD' });
    expect(picks.total).toMatchObject({ side: 'over', bet: false });
    const mlb = buildLeaguePicks({ lg: 'mlb', game: game(), odds, predictor: null });
    expect(mlb.winner.bet).toBe(false);
    expect(mlb.spread).toMatchObject({ title: 'RUN LINE', bet: false });
    expect(mlb.total).toMatchObject({ side: 'under', bet: false });
  });

  it('NBA: the better-rested side (2+ more days, both teams 10+ games in), else the opening favourite', () => {
    const pick = (rest, scoring = seasoned, o = opening) => buildLeaguePicks({ lg: 'nba', game: game(), odds: o, predictor: null, rest, scoring });
    expect(pick({ home: 3, away: 1 }).spread).toMatchObject({ side: 'home', bet: true });
    expect(pick({ home: 1, away: 4 }).spread).toMatchObject({ side: 'away', bet: true });
    expect(pick({ home: 2, away: 1 }).spread).toMatchObject({ side: 'home', bet: false });
    // early in the season (a team under 10 games in) the rest days aren't trusted: the favourite, a lean
    const early = pick({ home: 1, away: 4 }, { total: 221.5, homeGames: 12, awayGames: 9 });
    expect(early.spread).toMatchObject({ side: 'home', bet: false });
    expect(early.winner).toMatchObject({ side: 'home', bet: false });
    expect(pick({ home: 1, away: 4 }, null).spread).toMatchObject({ side: 'home', bet: false });
    // the Knicks are favoured now, but the Bucks opened as the favourite
    const flipped = {
      ...odds,
      home: { ...odds.home, openSpreadLine: 1.5, openMoneyLine: 110 },
      away: { ...odds.away, openSpreadLine: -1.5, openMoneyLine: -130 },
    };
    const opener = pick({ home: 2, away: 2 }, seasoned, flipped);
    expect(opener.winner).toMatchObject({ side: 'away', bet: false, atOpen: true, odds: 'ML -130' });
    expect(opener.spread).toMatchObject({ side: 'away', headline: 'BUCKS -1.5', atOpen: true });
  });

  it('NBA totals: a bet 6+ points off the opener (10+ games in), else the under lean 2+ under, else the over', () => {
    const opened = { ...odds, total: { ...odds.total, openLine: 219.5, openOverOdds: -112, openUnderOdds: -108 } };
    const pick = (scoring) => buildLeaguePicks({ lg: 'nba', game: game(), odds: opened, predictor: null, scoring }).total;
    expect(pick({ total: 227, homeGames: 12, awayGames: 11 })).toMatchObject({ side: 'over', bet: true, atOpen: true, headline: 'OVER 219.5', odds: '-112' });
    expect(pick({ total: 212, homeGames: 12, awayGames: 11 })).toMatchObject({ side: 'under', bet: true, odds: '-108' });
    // only 5 points off: a lean, the same direction rules as before
    expect(pick({ total: 224.5, homeGames: 12, awayGames: 11 })).toMatchObject({ side: 'over', bet: false });
    expect(pick({ total: 214.5, homeGames: 12, awayGames: 11 })).toMatchObject({ side: 'under', bet: false });
    expect(pick({ total: 218, homeGames: 12, awayGames: 11 })).toMatchObject({ side: 'over', bet: false });
    // too early in the season (a team under 10 games in): never a bet
    expect(pick({ total: 230, homeGames: 12, awayGames: 9 })).toMatchObject({ side: 'over', bet: false });
    expect(pick({ total: 205, homeGames: 3, awayGames: 4 })).toMatchObject({ side: 'under', bet: false, headline: 'UNDER 219.5' });
    expect(pick(null)).toMatchObject({ side: 'over', bet: false });
    // no opener saved: the current total
    expect(buildLeaguePicks({ lg: 'nba', game: game(), odds, predictor: null, scoring: { total: 215, homeGames: 12, awayGames: 12 } }).total).toMatchObject({ side: 'under', atOpen: false, bet: false, headline: 'UNDER 221.5' }); // 6.5 under, but only an opener can be bet
    // graded at the opening total: 220 points is over 219.5 (but under the 221.5 close)
    const ticket = linePickBets(
      buildLeaguePicks({ lg: 'nba', game: game(), odds: opened, predictor: null, scoring: { total: 227, homeGames: 12, awayGames: 12 } }),
      game('post', 108, 112),
      opened,
    ).find((t) => t.key === 'total');
    expect(ticket).toMatchObject({ label: 'OVER 219.5', price: -112, result: 'W', bet: true });
  });

  it('NBA: the moneyline is priced at the opener', () => {
    const opened = { ...odds, home: { ...odds.home, openMoneyLine: -220, openSpreadLine: -5.5 }, away: { ...odds.away, openMoneyLine: 180, openSpreadLine: 5.5 } };
    const picks = buildLeaguePicks({ lg: 'nba', game: game(), odds: opened, predictor: null });
    const ticket = linePickBets(picks, game('post', 100, 110), opened).find((t) => t.key === 'winner');
    expect(ticket).toMatchObject({ label: 'NY ML', price: -220, result: 'W', bet: false });
  });

  it('NBA: the rest bet is made and graded at the opening line and price', () => {
    const opened = {
      ...odds,
      home: { ...odds.home, openSpreadLine: -4.5, openSpreadOdds: -105 },
      away: { ...odds.away, openSpreadLine: 4.5, openSpreadOdds: -115 },
    };
    const picks = buildLeaguePicks({ lg: 'nba', game: game(), odds: opened, predictor: null, rest: { home: 3, away: 1 }, scoring: seasoned });
    expect(picks.spread).toMatchObject({ side: 'home', bet: true, atOpen: true, headline: 'KNICKS -4.5', odds: '-105' });
    // Knicks by 5: a cover at the opener (-4.5), a loss at the close (-6.5)
    const final = game('post', 100, 105);
    const ticket = linePickBets(picks, final, opened).find((t) => t.key === 'spread');
    expect(ticket).toMatchObject({ label: 'NY -4.5', price: -105, result: 'W', bet: true });
  });

  it('rest days come from the earlier games', () => {
    const g = { date: '2026-11-10T00:00Z', home: { teamId: '1' }, away: { teamId: '2' } };
    const earlier = [
      { date: '2026-11-07T00:00Z', homeId: '1', awayId: '9' },
      { date: '2026-11-09T00:00Z', homeId: '8', awayId: '2' },
    ];
    expect(restDays(g, earlier)).toEqual({ home: 3, away: 1 });
  });

  it('grades with the shared grader once the game is final', () => {
    const final = game('post', 100, 110);
    const picks = buildLeaguePicks({ lg: 'nba', game: final, odds, predictor: null });
    expect(gradeLinePicks(picks, final, odds).winner).toBe('W');
    expect(linePickBets(picks, final, odds)).toHaveLength(3);
  });
});
