import { GRADES_KEYS, cachedGrader, precomputedInfo } from './modelGrading';

// the build's precomputed file for the NBA
const file = {
  key: GRADES_KEYS.nba,
  builtAt: '2026-11-14T18:00:00Z',
  grades: { g1: { winner: 'W', spread: 'L', total: 'W', bets: [] } },
};

describe('model grading', () => {
  beforeEach(() => {
    window.localStorage.clear();
    global.fetch = async (url) => ({
      ok: url.endsWith('/model-results/nba.json'),
      status: url.endsWith('/model-results/nba.json') ? 200 : 404,
      text: async () => JSON.stringify(file),
    });
  });

  test('a finished game graded at build time is used without grading it again', async () => {
    let graded = 0;
    const grade = cachedGrader('test:nba', async () => {
      graded += 1;
      return { winner: 'L' };
    }, 'nba');
    expect(await grade({ id: 'g1', status: { state: 'post' } })).toMatchObject({ winner: 'W', spread: 'L' });
    expect(graded).toBe(0);
    // a game newer than the file is graded (and remembered)
    expect(await grade({ id: 'g2', status: { state: 'post' } })).toEqual({ winner: 'L' });
    expect(await grade({ id: 'g2', status: { state: 'post' } })).toEqual({ winner: 'L' });
    expect(graded).toBe(1);
  });

  test('reports what the build precomputed', async () => {
    expect(await precomputedInfo('nba')).toEqual({ games: 1, builtAt: '2026-11-14T18:00:00Z' });
  });
});
