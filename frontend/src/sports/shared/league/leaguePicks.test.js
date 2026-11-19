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
  it('NBA: the moneyline and the spread go on the same team: the favourite, or the better-rested side', () => {
    const even = buildLeaguePicks({ lg: 'nba', game: game(), odds, predictor: null, rest: { home: 2, away: 2 } });
    expect(even.winner).toMatchObject({ side: 'home', headline: 'KNICKS TO WIN', odds: 'ML -250' });
    expect(even.spread.side).toBe('home');
    // the Bucks have had 3 more days off: both picks move to them, an upset lean
    const rested = buildLeaguePicks({ lg: 'nba', game: game(), odds, predictor: null, rest: { home: 1, away: 4 } });
    expect(rested.winner).toMatchObject({ side: 'away', upset: true, headline: 'BUCKS TO WIN', odds: 'ML +205' });
    expect(rested.spread).toMatchObject({ side: 'away', bet: true });
  });

  it('blends ESPN and the market 25/75, or uses the market alone', () => {
    const both = winChance({ odds, predictor: { home: 80, away: 20 } });
    expect(both.home).toBeCloseTo(0.25 * 80 + 0.75 * both.market, 5);
    expect(winChance({ odds, predictor: null }).home).toBeCloseTo(both.market, 5);
  });

  it('makes a lean (never a bet) in all three markets', () => {
    const picks = buildLeaguePicks({ lg: 'nba', game: game(), odds, predictor: { home: 70, away: 30 } });
    expect(picks.winner).toMatchObject({ side: 'home', bet: false, headline: 'KNICKS TO WIN', odds: 'ML -250' });
    expect(picks.spread.bet).toBe(false);
    expect(picks.spread.title).toBe('SPREAD');
    expect(picks.total).toMatchObject({ side: 'over', bet: false });
    const mlb = buildLeaguePicks({ lg: 'mlb', game: game(), odds, predictor: null });
    expect(mlb.spread.title).toBe('RUN LINE');
    expect(mlb.total).toMatchObject({ side: 'under', bet: false });
  });

  it('NBA: bets the home team with 2+ more days of rest, else leans home', () => {
    const rested = buildLeaguePicks({ lg: 'nba', game: game(), odds, predictor: null, rest: { home: 3, away: 1 } });
    expect(rested.spread).toMatchObject({ side: 'home', bet: true });
    const awayRested = buildLeaguePicks({ lg: 'nba', game: game(), odds, predictor: null, rest: { home: 1, away: 4 } });
    expect(awayRested.spread).toMatchObject({ side: 'away', bet: true });
    const even = buildLeaguePicks({ lg: 'nba', game: game(), odds, predictor: null, rest: { home: 2, away: 1 } });
    expect(even.spread).toMatchObject({ side: 'home', bet: false });
  });

  it('NBA totals: follow a 3+ point move either way, else the under at 235+, else the over', () => {
    const total = (t) =>
      buildLeaguePicks({ lg: 'nba', game: game(), odds: { ...odds, total: { ...odds.total, ...t } }, predictor: null })
        .total.side;
    expect(total({ openLine: 225.5 })).toBe('under'); // dropped 4
    expect(total({ openLine: 217.5 })).toBe('over'); // climbed 4
    expect(total({ line: 238.5, openLine: 237.5 })).toBe('under'); // high, barely moved
    expect(total({ line: 238.5, openLine: 234.5 })).toBe('over'); // high, but climbed 4
    expect(total({ openLine: 221 })).toBe('over');
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
