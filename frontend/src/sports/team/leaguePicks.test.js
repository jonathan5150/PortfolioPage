import { buildLeaguePicks, winChance } from './leaguePicks';
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

describe('league picks (NBA / MLB)', () => {
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
    expect(picks.total).toMatchObject({ side: 'under', bet: false });
    expect(buildLeaguePicks({ lg: 'mlb', game: game(), odds, predictor: null }).spread.title).toBe('RUN LINE');
  });

  it('grades with the shared grader once the game is final', () => {
    const final = game('post', 100, 110);
    const picks = buildLeaguePicks({ lg: 'nba', game: final, odds, predictor: null });
    expect(gradeLinePicks(picks, final, odds).winner).toBe('W');
    expect(linePickBets(picks, final, odds)).toHaveLength(3);
  });
});
