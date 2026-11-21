import { betFilters, inScope } from './modelFilters';

describe('model filters', () => {
  test('BETS ONLY is offered only when asked for (the NBA)', () => {
    expect(betFilters('Spread').map((o) => o.key)).toEqual(['all', 'winner', 'spread', 'total']);
    expect(betFilters('Spread', true).map((o) => o.key)).toEqual(['all', 'bets', 'winner', 'spread', 'total']);
  });

  test("a 'bets' scope counts only the picks marked as bets", () => {
    const bets = [
      { key: 'spread', bet: true },
      { key: 'total', bet: false },
      { key: 'winner', bet: true },
    ];
    expect(inScope(bets, 'all')).toHaveLength(3);
    expect(inScope(bets, 'bets').map((b) => b.key)).toEqual(['spread', 'winner']);
    expect(inScope(undefined, 'bets')).toEqual([]);
  });
});
