import { isDivisionGame, matchWinner, pickSpread } from './picks';

const team = (abbreviation, name) => ({ abbreviation, name, displayName: name });
const game = (away, home, date = '2026-11-15T18:00Z') => ({
  date,
  week: 10,
  seasonType: 2,
  away: { teamId: '1', team: team(...away) },
  home: { teamId: '2', team: team(...home) },
});
const odds = (homeSpread, homeMl, awayMl) => ({
  homeSpread,
  home: { moneyLine: homeMl, spreadLine: homeSpread, spreadOdds: -110 },
  away: { moneyLine: awayMl, spreadLine: -homeSpread, spreadOdds: -110 },
  total: { line: 44.5, overOdds: -110, underOdds: -110 },
});
const winnerOn = (side) => ({ key: 'winner', side, headline: 'X', summary: '' });

describe('NFL pick rules from the 2019-2026 replay', () => {
  test('division games', () => {
    expect(isDivisionGame(game(['DAL', 'Cowboys'], ['PHI', 'Eagles']))).toBe(true);
    expect(isDivisionGame(game(['DAL', 'Cowboys'], ['KC', 'Chiefs']))).toBe(false);
  });

  test('a division game with no spread bet leans to the underdog, not the road team', () => {
    // the Eagles are 2.5-point road favourites: the old lean (the road team) was the favourite
    const g = game(['PHI', 'Eagles'], ['DAL', 'Cowboys']);
    const pick = pickSpread({ game: g, odds: odds(2.5, 130, -150), predictor: null });
    expect(pick).toMatchObject({ side: 'home', bet: false }); // Cowboys +2.5
    expect(pick.summary).toMatch(/division/);
  });

  test('a line of 3 or less: the moneyline goes with the spread pick', () => {
    const ctx = { game: game(['DAL', 'Cowboys'], ['KC', 'Chiefs']), odds: odds(-3, -160, 135) };
    const w = matchWinner(ctx, winnerOn('home'), { side: 'away' });
    expect(w).toMatchObject({ side: 'away', upset: true, headline: 'COWBOYS TO WIN' });
    // a bigger line leaves the moneyline pick alone
    const big = { ...ctx, odds: odds(-7, -320, 260) };
    expect(matchWinner(big, winnerOn('home'), { side: 'away' }).side).toBe('home');
  });

  test('primetime: the underdog at +150 or shorter', () => {
    const night = { game: game(['DAL', 'Cowboys'], ['KC', 'Chiefs'], '2026-11-17T01:15Z'), odds: odds(-4.5, -190, 145) };
    expect(matchWinner(night, winnerOn('home'), { side: 'away' }).side).toBe('away');
    const longShot = { ...night, odds: odds(-4.5, -220, 180) };
    expect(matchWinner(longShot, winnerOn('home'), { side: 'away' }).side).toBe('home');
  });
});
