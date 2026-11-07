import {
  parseEventOdds,
  parsePredictor,
  gradeGame,
  computeTeamTrends,
  computePlayerTrend,
  buildInsights,
  impliedProbability,
  fmtLine,
  gradeFinal,
} from './betting';
import { keyPlayersForGame } from './bettingService';
import { toProxyUrl } from './http';

const team = (id, abbreviation) => ({ id, abbreviation });
const competitor = (id, abbr, score, extra = {}) => ({ teamId: id, team: team(id, abbr), score, ...extra });
const game = (id, away, home, extra = {}) => ({
  id,
  date: '2026-10-01T17:00Z',
  status: { state: 'post' },
  away,
  home,
  ...extra,
});

// Trimmed from sports.core.api.espn.com .../competitions/{id}/odds
const oddsJson = {
  items: [
    {
      provider: { name: 'DraftKings', priority: 1 },
      details: 'KC -9.5',
      overUnder: 48.5,
      spread: -9.5,
      overOdds: -102,
      underOdds: -118,
      awayTeamOdds: {
        favorite: false,
        moneyLine: 400,
        spreadOdds: -102,
        open: { pointSpread: { american: '+9.5' }, moneyLine: { american: '+360' } },
        current: { pointSpread: { american: '+9.5' } },
      },
      homeTeamOdds: {
        favorite: true,
        moneyLine: -535,
        spreadOdds: -118,
        open: { pointSpread: { american: '-9.5' }, moneyLine: { american: '-470' } },
        current: { pointSpread: { american: '-9.5' } },
      },
      open: { total: { american: '41.5' } },
    },
  ],
};

describe('betting parsers', () => {
  test('odds: lines, moneylines, totals and opening values', () => {
    const odds = parseEventOdds(oddsJson);
    expect(odds.provider).toBe('DraftKings');
    expect(odds.homeSpread).toBe(-9.5);
    expect(odds.away).toMatchObject({ spreadLine: 9.5, moneyLine: 400, openMoneyLine: 360, favorite: false });
    expect(odds.home).toMatchObject({ spreadLine: -9.5, moneyLine: -535, spreadOdds: -118, favorite: true });
    expect(odds.total).toEqual({ line: 48.5, openLine: 41.5, overOdds: -102, underOdds: -118 });
    expect(parseEventOdds({ items: [] })).toBeNull();
  });

  test('predictor', () => {
    const json = {
      homeTeam: { statistics: [{ name: 'gameProjection', value: 80.2 }] },
      awayTeam: { statistics: [{ name: 'gameProjection', value: 19.8 }] },
    };
    expect(parsePredictor(json)).toEqual({ home: 80.2, away: 19.8 });
    expect(parsePredictor({})).toBeNull();
  });

  test('formatting and implied probability', () => {
    expect(fmtLine(3)).toBe('+3');
    expect(fmtLine(0)).toBe('PK');
    expect(Math.round(impliedProbability(-150))).toBe(60);
    expect(Math.round(impliedProbability(200))).toBe(33);
  });
});

describe('grading', () => {
  const odds = { homeSpread: -3.5, total: { line: 44.5 } };

  test('home favorite covers, over hits', () => {
    const g = game('1', competitor('A', 'AAA', 20), competitor('H', 'HHH', 27));
    const home = gradeGame('H', g, odds);
    expect(home).toMatchObject({ isHome: true, line: -3.5, su: 'W', ats: 'W', ou: 'O', total: 47 });
    const away = gradeGame('A', g, odds);
    expect(away).toMatchObject({ isHome: false, line: 3.5, su: 'L', ats: 'L' });
  });

  test('push and missing line', () => {
    const g = game('2', competitor('A', 'AAA', 21), competitor('H', 'HHH', 24));
    expect(gradeGame('H', g, { homeSpread: -3, total: { line: 45 } })).toMatchObject({ ats: 'P', ou: 'P' });
    expect(gradeGame('H', g, null)).toMatchObject({ ats: null, ou: null, su: 'W' });
  });

  test('final game result from home view', () => {
    const g = game('3', competitor('A', 'AAA', 10), competitor('H', 'HHH', 24));
    expect(gradeFinal(g, odds)).toEqual({ spread: 'HHH covered', total: 'U', points: 34 });
  });

  test('team trends: records, splits, streaks', () => {
    const graded = [
      { ats: 'L', su: 'L', ou: 'U', line: 3, isHome: false, pointsFor: 10, pointsAgainst: 20, coverMargin: -7 },
      { ats: 'W', su: 'W', ou: 'O', line: -2, isHome: true, pointsFor: 30, pointsAgainst: 20, coverMargin: 8 },
      { ats: 'W', su: 'W', ou: 'O', line: -6, isHome: true, pointsFor: 28, pointsAgainst: 14, coverMargin: 8 },
      { ats: 'W', su: 'W', ou: 'U', line: 1, isHome: false, pointsFor: 17, pointsAgainst: 13, coverMargin: 5 },
    ];
    const t = computeTeamTrends(graded);
    expect(t.ats).toEqual({ L: 1, W: 3 });
    expect(t.atsFav).toEqual({ W: 2 });
    expect(t.atsDog).toEqual({ L: 1, W: 1 });
    expect(t.atsHome).toEqual({ W: 2 });
    expect(t.ou).toEqual({ U: 2, O: 2 });
    expect(t.ppg).toBe(21.25);
    expect(t.atsStreak).toEqual({ type: 'W', count: 3 });
    expect(t.suStreak).toEqual({ type: 'W', count: 3 });
  });
});

describe('player trends', () => {
  const log = (season, opponentId, yards, tds = 0) => ({
    season,
    opponentId,
    stats: { receivingYards: yards, receivingTouchdowns: tds },
  });

  test('versus opponent, recent form and TD rate', () => {
    // newest first
    const games = [
      log(2026, 'X', 110, 1),
      log(2026, 'Y', 95, 1),
      log(2026, 'Z', 100, 0),
      log(2026, 'Y', 40, 1),
      log(2026, 'Z', 35, 1),
      log(2025, 'NYJ', 120, 1),
      log(2025, 'Z', 30),
      log(2024, 'NYJ', 140),
    ];
    const t = computePlayerTrend({ games, season: 2026, opponentId: 'NYJ', category: 'receiving' });
    expect(t.vsOppGames).toBe(2);
    expect(t.vsOppAvg).toBe(130);
    expect(t.seasonGames).toBe(5);
    expect(t.recentAvg).toBeCloseTo(101.67, 1);
    expect(t.tdGames).toBe(4);
    expect(t.firstSeason).toBe(2024);
  });
});

describe('insights', () => {
  const g = {
    id: '9',
    away: competitor('A', 'AAA', null),
    home: competitor('H', 'HHH', null),
    status: { state: 'pre' },
  };
  const odds = parseEventOdds(oddsJson);

  const hotTrends = computeTeamTrends(
    Array.from({ length: 10 }, (_, i) => ({
      ats: i < 8 ? 'W' : 'L',
      su: 'W',
      ou: 'O',
      line: -3,
      isHome: i % 2 === 0,
      pointsFor: 30,
      pointsAgainst: 20,
      coverMargin: 4,
    }))
  );
  const coldTrends = computeTeamTrends(
    Array.from({ length: 10 }, () => ({
      ats: 'L',
      su: 'L',
      ou: 'O',
      line: 3,
      isHome: false,
      pointsFor: 17,
      pointsAgainst: 27,
      coverMargin: -6,
    }))
  );

  test('flags a team that keeps covering and one that keeps failing', () => {
    const insights = buildInsights({ game: g, odds, predictor: null, awayTrends: coldTrends, homeTrends: hotTrends, players: [] });
    const ids = insights.map((i) => i.id);
    expect(ids).toContain('HHH-ats');
    expect(ids).toContain('AAA-ats');
    const hot = insights.find((i) => i.id === 'HHH-ats');
    expect(hot.text).toContain('8 of 10');
    expect(hot.lean).toBe('Consider HHH -9.5');
    expect(insights.length).toBeLessThanOrEqual(8);
    // sorted strongest first
    insights.slice(1).forEach((i, idx) => expect(insights[idx].strength).toBeGreaterThanOrEqual(i.strength));
  });

  test('flags combined overs and moneyline value from FPI', () => {
    const insights = buildInsights({
      game: g,
      odds,
      predictor: { away: 35, home: 65 },
      awayTrends: coldTrends,
      homeTrends: hotTrends,
      players: [],
      limit: 20,
    });
    const ids = insights.map((i) => i.id);
    expect(ids).toContain('combined-ou');
    expect(ids).toContain('AAA-value'); // +400 implies 20%, FPI says 35%
  });

  test('player matchup highlight', () => {
    const players = [
      {
        id: 'p1',
        name: 'Test Receiver',
        oppAbbr: 'HHH',
        trend: {
          category: 'receiving',
          label: 'rec yds',
          long: 'receiving yards',
          minDiff: 12,
          careerAvg: 60,
          careerGames: 30,
          firstSeason: 2024,
          vsOppAvg: 95,
          vsOppGames: 3,
          seasonAvg: 60,
          seasonGames: 8,
          recentAvg: 62,
          recentGames: 3,
          tdGames: 1,
          tdWindow: 5,
        },
      },
    ];
    const insights = buildInsights({ game: g, odds: null, predictor: null, awayTrends: null, homeTrends: null, players });
    expect(insights).toHaveLength(1);
    expect(insights[0].text).toContain('95 rec yds in 3 games vs HHH since 2024');
    expect(insights[0].lean).toBe('Consider Test Receiver over on receiving yards');
  });
});

describe('betting wiring', () => {
  test('key players come from team leaders', () => {
    const g = {
      away: competitor('A', 'AAA', null, {
        leaders: [
          { category: 'passingLeader', athleteId: '1', athleteName: 'P. Passer', athleteFullName: 'Pat Passer' },
          { category: 'receivingLeader', athleteId: '2', athleteName: 'R. Catch' },
        ],
      }),
      home: competitor('H', 'HHH', null, { leaders: [] }),
    };
    const players = keyPlayersForGame(g);
    expect(players).toHaveLength(2);
    expect(players[0]).toMatchObject({ name: 'Pat Passer', category: 'passing', oppId: 'H', oppAbbr: 'HHH' });
    expect(players[1]).toMatchObject({ name: 'R. Catch', category: 'receiving' });
  });

  test('core API goes through the same-origin proxy', () => {
    expect(toProxyUrl('https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/events/1/competitions/1/odds')).toBe(
      '/espn/core/v2/sports/football/leagues/nfl/events/1/competitions/1/odds'
    );
  });
});

describe('schedule and depth chart parsers', () => {
  // eslint-disable-next-line global-require
  const { parseStartingQb } = require('./espnParsers');

  test('starting QB is the rank-1 QB on the depth chart', () => {
    const json = {
      items: [
        { name: 'Base 4-3 D', positions: { lde: { athletes: [] } } },
        {
          name: '3WR 1TE',
          positions: {
            qb: {
              athletes: [
                { rank: 2, athlete: { $ref: 'http://x/seasons/2026/athletes/999?lang=en' } },
                { rank: 1, athlete: { $ref: 'http://x/seasons/2026/athletes/15864?lang=en' } },
              ],
            },
          },
        },
      ],
    };
    expect(parseStartingQb(json)).toBe('15864');
    expect(parseStartingQb({ items: [] })).toBeNull();
  });

  test('pre-game spread shown in place of the score', () => {
    // eslint-disable-next-line global-require
    const { spreadForTeam } = require('../../../components/NFLDataComponents/ScoreBug/ScoreBugs');
    expect(spreadForTeam('KC -9.5', 'KC')).toBe('-9.5');
    expect(spreadForTeam('KC -9.5', 'NYJ')).toBe('+9.5');
    expect(spreadForTeam('EVEN', 'KC')).toBe('PK');
    expect(spreadForTeam('', 'KC')).toBeNull();
  });
});
