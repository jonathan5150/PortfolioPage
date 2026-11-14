import { headToHead, teamModelChance, finishChance, valueSide, h2hSentence, dataAbbr } from './teamModels';

// a made-up model: the market, plus a strong head-to-head term
const model = (lg) => ({
  lg,
  model: {
    winner: {
      features: lg === 'nfl' ? ['mkt', 'h2h_win', 'away_bye'] : ['mkt', 'h2h_win', 'away_b2b'],
      coef: [1, 3, -0.4],
      intercept: 0,
      min_edge: 0,
      max_price: 4.5,
    },
  },
  history: {
    h2h: {
      // [season, home, winner, margin, cover, over, date]: GSW won 5 of 6, then the game being graded
      'BOS|GSW': [
        [2024, 'GSW', 'GSW', 8, 'GSW', 1, '2024-11-06'],
        [2024, 'BOS', 'GSW', 3, 'GSW', 0, '2025-03-03'],
        [2025, 'GSW', 'BOS', 12, 'BOS', 1, '2025-11-01'],
        [2025, 'BOS', 'GSW', 20, 'GSW', 1, '2026-01-10'],
        [2025, 'GSW', 'GSW', 6, 'GSW', 0, '2026-02-20'],
        [2025, 'BOS', 'GSW', 1, 'GSW', 0, '2026-03-30'],
        [2026, 'BOS', 'BOS', 30, 'BOS', 1, '2026-11-14'],
      ],
    },
  },
});

const game = {
  date: '2026-11-15T00:30Z', // 7:30 PM Eastern on Nov 14
  home: { team: { abbreviation: 'BOS', name: 'Celtics' } },
  away: { team: { abbreviation: 'GS', name: 'Warriors' } },
};
const odds = { home: { moneyLine: -200 }, away: { moneyLine: 170 } };

describe('teamModels', () => {
  test('maps ESPN abbreviations to the data', () => {
    expect(dataAbbr('nba', 'GS')).toBe('GSW');
    expect(dataAbbr('nfl', 'LAR')).toBe('LA');
    expect(dataAbbr('nfl', 'KC')).toBe('KC');
  });

  test('head-to-head only counts meetings before the game', () => {
    const h = headToHead(model('nba'), 'BOS', 'GS', game.date);
    expect(h.n).toBe(6);
    expect(h.awayWins).toBe(5);
    expect(h.homeWins).toBe(1);
    expect(h.last.winner).toBe('GSW');
  });

  test('a team that owns the matchup becomes the value side, even as the underdog', () => {
    const tm = model('nba');
    const ctx = teamModelChance(tm, { game, odds, rest: { home: 2, away: 2 } });
    const pHome = finishChance(tm, ctx);
    expect(pHome < ctx.market).toBe(true);
    const v = valueSide(tm, pHome, odds);
    expect(v.side).toBe('away');
    expect(v.ev > 0).toBe(true);
  });

  test('no value side when the model agrees with the price', () => {
    const tm = model('nba');
    tm.history.h2h = {};
    const ctx = teamModelChance(tm, { game, odds, rest: { home: 2, away: 2 } });
    expect(valueSide(tm, finishChance(tm, ctx), odds)).toBeNull();
  });

  test('describes a lopsided head-to-head', () => {
    const h = headToHead(model('nba'), 'BOS', 'GS', game.date);
    expect(h2hSentence(h, game, 'away')).toMatch(/Warriors have won 5 of the last 6 meetings with the Celtics/);
  });

  test('no model without real prices', () => {
    expect(teamModelChance(model('nba'), { game, odds: { home: { moneyLine: null }, away: {} } })).toBeNull();
  });
});
