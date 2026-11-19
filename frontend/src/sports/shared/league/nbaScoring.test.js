import { fitScoring, projectTotal } from './nbaScoring';

const game = (homeId, awayId, hs, as) => ({ homeId, awayId, home: { score: hs }, away: { score: as } });

describe('NBA scoring ratings', () => {
  test('a high-scoring team and a leaky defence project a higher total', () => {
    const games = [];
    for (let i = 0; i < 12; i += 1) {
      games.push(game('A', 'B', 130, 125)); // A and B: lots of points
      games.push(game('C', 'D', 100, 98)); // C and D: few
      games.push(game('B', 'C', 120, 104));
      games.push(game('D', 'A', 108, 126));
    }
    const fit = fitScoring(games, null);
    const high = projectTotal(fit, 'A', 'B');
    const low = projectTotal(fit, 'C', 'D');
    expect(high).toBeGreaterThan(low + 20);
    expect(projectTotal(fit, 'A', 'Z')).toBeNull();
  });

  test("with no games yet, a team's projection is half of last season's rating", () => {
    const prior = { teams: { A: [6, 0], B: [4, 0] } };
    const fit = fitScoring([], prior);
    // mu ~110 a side; A and B score 3 and 2 above it
    expect(projectTotal(fit, 'A', 'B')).toBeCloseTo(225, 0);
  });
});
