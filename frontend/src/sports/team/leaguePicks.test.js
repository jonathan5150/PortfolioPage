import { buildLeaguePicks, restDays, winChance } from './leaguePicks';
import { gradeLinePicks, linePickBets } from '../../pages/NFLData/NFLDataApi/picks';

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

// a made-up model where the Bucks own the matchup
const teamModel = {
  lg: 'nba',
  model: { winner: { features: ['mkt', 'h2h_win'], coef: [1, 3], intercept: 0, min_edge: 0, max_price: 4.5 } },
  history: {
    h2h: {
      'MIL|NYK': [
        [2025, 'MIL', 'MIL', 9, 'MIL', 1, '2025-11-02'],
        [2025, 'NYK', 'MIL', 4, 'MIL', 0, '2025-12-12'],
        [2025, 'MIL', 'MIL', 11, 'MIL', 1, '2026-02-01'],
        [2025, 'NYK', 'MIL', 2, 'MIL', 0, '2026-03-15'],
      ],
    },
  },
};

describe('league picks (NBA / MLB)', () => {
  it("picks the model's value side, an underdog here, as an upset lean", () => {
    const g = { ...game(), date: '2026-11-14T00:30Z' };
    const picks = buildLeaguePicks({ lg: 'nba', game: g, odds, predictor: null, rest: { home: 2, away: 2 }, teamModel });
    expect(picks.winner).toMatchObject({ side: 'away', bet: false, upset: true, headline: 'BUCKS TO WIN', odds: 'ML +205' });
    expect(picks.winner.summary).toMatch(/Bucks have won 4 of the last 4 meetings with the Knicks/);
    // without the model it's the favourite again
    expect(buildLeaguePicks({ lg: 'nba', game: g, odds, predictor: null, rest: { home: 2, away: 2 } }).winner.side).toBe('home');
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
    const even = buildLeaguePicks({ lg: 'nba', game: game(), odds, predictor: null, rest: { home: 2, away: 1 } });
    expect(even.spread).toMatchObject({ side: 'home', bet: false });
  });

  it('NBA: the total lean follows a 3+ point drop to the under', () => {
    const moved = { ...odds, total: { ...odds.total, openLine: 225.5 } };
    expect(buildLeaguePicks({ lg: 'nba', game: game(), odds: moved, predictor: null }).total.side).toBe('under');
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
