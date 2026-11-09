import {
  parseEventOdds,
  parsePredictor,
  gradeGame,
  computeTeamTrends,
  impliedProbability,
  fmtLine,
  parlayOdds,
  americanToDecimal,
} from './betting';
import {
  parseSgoEvent,
  findSgoEvent,
  normalizeName,
  playerMarketsFor,
  parseBetslipLink,
  parlayUrl,
} from './sportsbookOdds';
import { parseOddsLinks } from './betting';
import {
  buildLinePicks,
  buildPlayerPicks,
  pickWinner,
  pickSpread,
  pickTotal,
  marginFromProbability,
  weatherEffect,
} from './picks';
import { parseStartingQb, parseTeamLeaders, parseCoreAthlete } from './espnParsers';
import { isUnavailable } from './espnService';
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

describe('betting wiring', () => {
  test('core API goes through the same-origin proxy', () => {
    expect(toProxyUrl('https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/events/1/competitions/1/odds')).toBe(
      '/espn/core/v2/sports/football/leagues/nfl/events/1/competitions/1/odds'
    );
  });
});

describe('schedule, depth chart and leaders parsers', () => {
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

  test('team leaders, athlete records and injury filter', () => {
    const leaders = parseTeamLeaders({
      categories: [
        {
          name: 'rushingLeader',
          leaders: [{ displayValue: '141 CAR, 770 YDS', value: 770, athlete: { $ref: 'http://x/athletes/4567048?lang=en' } }],
        },
      ],
    });
    expect(leaders.rushing).toEqual([{ athleteId: '4567048', statLine: '141 CAR, 770 YDS', value: 770 }]);
    expect(
      parseCoreAthlete({ id: 1, displayName: 'A B', position: { abbreviation: 'WR' }, injuries: [{ status: 'Out' }] })
    ).toMatchObject({ id: '1', name: 'A B', position: 'WR', injuryStatus: 'Out' });
    expect(isUnavailable('Injured Reserve')).toBe(true);
    expect(isUnavailable('Questionable')).toBe(false);
  });

});

describe('picks', () => {
  const team = (id, abbreviation, displayName) => ({ id, abbreviation, displayName, name: displayName.split(' ').pop() });
  const g = {
    id: '9',
    season: 2026,
    date: '2026-11-08T18:00Z',
    status: { state: 'pre' },
    indoor: false,
    weather: { text: 'Sunny', temperature: 60 },
    away: { teamId: 'A', team: team('A', 'NYJ', 'New York Jets') },
    home: { teamId: 'H', team: team('H', 'KC', 'Kansas City Chiefs') },
  };
  const odds = parseEventOdds(oddsJson); // KC -9.5, total 48.5
  const trend = (games, { ats = 'W', ou = 'O', su = 'W', pf = 27, pa = 20, line = -3 } = {}) =>
    computeTeamTrends(
      Array.from({ length: games }, () => ({ ats, ou, su, line, isHome: true, pointsFor: pf, pointsAgainst: pa, coverMargin: 1 }))
    );

  test('FPI margin conversion is close to real lines', () => {
    expect(Math.round(marginFromProbability(80))).toBe(9);
    expect(marginFromProbability(50)).toBeCloseTo(0);
  });

  test('winner follows FPI and explains why', () => {
    const w = pickWinner({
      game: g,
      odds,
      predictor: { away: 20, home: 80 },
      awayTrends: trend(8, { su: 'L', pf: 17, pa: 26 }),
      homeTrends: trend(8, { pf: 28, pa: 18 }),
    });
    expect(w.pick).toBe('Kansas City Chiefs');
    expect(w.odds).toBe('ML -535');
    expect(w.reasons[0]).toBe("ESPN's FPI gives KC an 80% chance to win.");
    expect(w.reasons.length).toBeLessThanOrEqual(4);
    expect(w.reasons.join(' ')).toContain('KC is 8-0 this season');
  });

  test('spread takes the points when the favorite is overpriced', () => {
    // FPI 60% ~ KC by 2.6 and scoring averages ~ even, but KC is -9.5
    const s = pickSpread({
      game: g,
      odds,
      predictor: { away: 40, home: 60 },
      awayTrends: trend(6, { pf: 22, pa: 22 }),
      homeTrends: trend(6, { pf: 23, pa: 22 }),
    });
    expect(s.pick).toBe('NYJ +9.5');
    expect(s.odds).toBe('-102');
    expect(s.reasons.length).toBeGreaterThan(0);
  });

  test('total leans over when scoring and history point over, and reports weather', () => {
    const t = pickTotal({
      game: g,
      odds,
      predictor: null,
      awayTrends: trend(6, { pf: 30, pa: 28, ou: 'O' }),
      homeTrends: trend(6, { pf: 31, pa: 27, ou: 'O' }),
    });
    expect(t.pick).toBe('OVER 48.5');
    expect(t.odds).toBe('-102');
    expect(t.reasons.join(' ')).toContain('Sunny, 60°F');
  });

  test('weather adjustments', () => {
    expect(weatherEffect({ indoor: true }).adj).toBeGreaterThan(0);
    expect(weatherEffect({ weather: { text: 'Snow', temperature: 25 } }).adj).toBeLessThan(0);
    expect(weatherEffect({ weather: { text: 'Cloudy', temperature: 30 } }).adj).toBeLessThan(0);
  });

  test('line picks: one-line headline and reason, gold flag when FPI beats the moneyline', () => {
    const picks = buildLinePicks({
      game: g,
      odds,
      predictor: { away: 35, home: 65 }, // NYJ +400 implies 20%
      awayTrends: trend(6),
      homeTrends: trend(6),
    });
    expect(picks.winner.headline).toBe('CHIEFS TO WIN');
    expect(picks.winner.summary).toContain("ESPN's model likes the Chiefs here, 65% to win.");
    expect(picks.winner.strong).toBe(false); // KC -535 implies 84% > 65%
    expect(picks.spread.headline).toBe('JETS TO COVER +9.5');
    expect(picks.spread.summary).toBe(
      "Getting 9.5 points is a lot of cushion. We only see the Jets losing by about 2. They've covered 6 of 6 games this year."
    );
    expect(picks.spread.strong).toBe(true);
    expect(picks.total.headline).toMatch(/^(OVER|UNDER) 48.5$/);

    const underdog = buildLinePicks({ game: g, odds, predictor: { away: 55, home: 45 }, awayTrends: null, homeTrends: null });
    expect(underdog.winner.headline).toBe('JETS TO WIN');
    expect(underdog.winner.strong).toBe(true); // 55% vs 20% implied
  });

  test("player picks are touchdown calls with the book's anytime TD odds", () => {
    const back = (id, name, tds) => ({
      id,
      name,
      position: 'RB',
      games: tds.map((t) => ({ season: 2026, stats: { rushingTouchdowns: t, receivingTouchdowns: 0 } })),
    });
    const picks = buildPlayerPicks({
      game: g,
      players: {
        away: { qb: [], rb: [back('1', 'Busy Back', [1, 1, 2, 1, 0, 1])], wr: [] },
        home: { qb: [], rb: [back('2', 'Quiet Back', [0, 0, 0, 0, 0, 0])], wr: [] },
      },
      bookOdds: { players: { 'busy back': { anytimeTd: { yes: { price: 200, link: { url: 'u', marketId: 'm', selectionId: 's' } } } } } },
      rankings: null,
      odds,
    });
    expect(picks.rb.map((p) => p.player.name)).toEqual(['Busy Back', 'Quiet Back']);
    const busy = picks.rb[0].td;
    expect(busy).toMatchObject({ price: 200, opinion: 'BET YES', verdict: 'Should score' });
    expect(busy.link.selectionId).toBe('s');
    expect(busy.reason).toContain("DraftKings' +200");
    expect(busy.reason).toMatch(/^Should score: 6 TDs in 6 games this season/);
    expect(busy.reason).toContain('better than the 33.3%');
    const quiet = picks.rb[1].td;
    expect(quiet.price).toBeNull();
    expect(quiet.verdict).toBe('Unlikely to score');
    expect(picks.rb[0].markets).toBeUndefined();
  });
});

describe('parlays', () => {
  test('combined odds', () => {
    expect(americanToDecimal(-110)).toBeCloseTo(1.909, 3);
    // two -110 legs pay about +264
    expect(parlayOdds([{ odds: -110 }, { odds: -110 }])).toBe(264);
    expect(parlayOdds([{ odds: 150 }, { odds: null }])).toBe(150);
    expect(parlayOdds([{ odds: null }])).toBeNull();
  });

  test('DraftKings bet-slip links, from ESPN odds links, joined into one parlay link', () => {
    const gateway = (outcome) =>
      `https://sportsbook.draftkings.com/gateway?s=__s__&wpsrc=413&preurl=${encodeURIComponent(
        `https://sportsbook.draftkings.com/event/34118128?outcomes=${outcome}`
      )}`;
    const links = parseOddsLinks([
      { rel: ['home', 'desktop', 'bets', 'draftkings'], href: gateway('0ML84695561_1') },
      { rel: ['away', 'desktop', 'bets', 'draftkings'], href: gateway('0ML84695561_3') },
      { rel: ['under', 'desktop', 'bets'], href: gateway('0OU84695561U5250_3') },
      { rel: ['game', 'desktop', 'bets'], href: 'https://sportsbook.draftkings.com/gateway?s=1' },
    ]);
    expect(links.awayMl).toEqual({
      url: 'https://sportsbook.draftkings.com/event/34118128?outcomes=0ML84695561_3',
      eventId: '34118128',
      outcome: '0ML84695561_3',
    });
    expect(links.under.outcome).toBe('0OU84695561U5250_3');
    expect(links.game).toBeUndefined();

    const td = parseBetslipLink('https://sportsbook.draftkings.com/event/34118128?outcomes=0QA1%232_13L88808Q1-9Q20');
    expect(td.outcome).toBe('0QA1#2_13L88808Q1-9Q20');
    expect(parseBetslipLink('https://example.com/nope')).toBeNull();

    // '#' in an id is escaped so the link doesn't stop there
    expect(parlayUrl([{ link: links.awayMl }, { link: null }, { link: links.under }, { link: td }])).toBe(
      'https://sportsbook.draftkings.com/event/34118128?outcomes=0ML84695561_3+0OU84695561U5250_3+0QA1%232_13L88808Q1-9Q20'
    );
    expect(parlayUrl([{ link: null }])).toBeNull();
  });
});

describe('touchdown chance', () => {
  // eslint-disable-next-line global-require
  const { touchdownChance, impliedTeamPoints } = require('./picks');
  const g = (season, rushTd, recTd = 0) => ({ season, stats: { rushingTouchdowns: rushTd, receivingTouchdowns: recTd } });

  test('a back who scores often is likely; a quiet one is a long shot', () => {
    const hot = touchdownChance({
      games: [g(2026, 1), g(2026, 2), g(2026, 1), g(2026, 0), g(2026, 1), g(2026, 1)],
      position: 'RB',
      season: 2026,
      name: 'Hot Back',
      oppAbbr: 'OPP',
    });
    const cold = touchdownChance({
      games: [g(2026, 0), g(2026, 0), g(2026, 0), g(2026, 0), g(2026, 0), g(2026, 0)],
      position: 'WR',
      season: 2026,
      name: 'Cold Receiver',
      oppAbbr: 'OPP',
    });
    expect(hot.probability).toBeGreaterThan(45);
    expect(hot.opinion).toBe('LIKELY');
    expect(cold.probability).toBeLessThan(20);
    expect(hot.reason).toContain('6 TDs in 6 games this season');
  });

  test('QBs only count rushing scores; implied points and prices move the call', () => {
    const qb = touchdownChance({ games: [g(2026, 0, 3), g(2026, 0, 2)], position: 'QB', season: 2026, name: 'QB', oppAbbr: 'X' });
    expect(qb.reason).toContain('0 rushing TDs');
    const base = { games: [g(2026, 1), g(2026, 1), g(2026, 0), g(2026, 1)], position: 'RB', season: 2026, name: 'RB', oppAbbr: 'X' };
    expect(touchdownChance({ ...base, teamPoints: 30 }).probability).toBeGreaterThan(touchdownChance({ ...base, teamPoints: 15 }).probability);
    const link = { url: 'u', marketId: 'm', selectionId: 's' };
    const value = touchdownChance({ ...base, bookTd: { price: 250, link } }); // +250 implies 28.6%
    expect(value.opinion).toBe('BET YES');
    expect(value.strong).toBe(true);
    expect(value.link).toBe(link);
    expect(touchdownChance({ ...base, bookTd: { price: -300, link: null } }).opinion).toBe('PASS');
    expect(impliedTeamPoints({ total: { line: 52.5 }, home: { spreadLine: -3 } }, 'home')).toBe(27.75);
  });
});

describe('player names', () => {
  test('names normalize across sources', () => {
    expect(normalizeName('Kenneth Walker III')).toBe('kenneth walker');
    expect(normalizeName("Ja'Marr Chase")).toBe('jamarr chase');
    expect(normalizeName('Kyle Pitts Sr.')).toBe('kyle pitts');
    expect(normalizeName('PATRICK_MAHOMES_1_NFL')).toBe('patrick mahomes');
  });
});

describe('DraftKings anytime TD prices from SportsGameOdds', () => {
  const dk = (odds, extra = {}, outcome = `0QA${Math.floor(Math.random() * 1e9)}`) => ({
    draftkings: {
      available: true,
      odds,
      deeplink: `https://sportsbook.draftkings.com/event/34118128?outcomes=${outcome}`,
      ...extra,
    },
  });
  const td = (playerID, betTypeID, sideID, book) => ({
    oddID: `touchdowns-${playerID}-game-${betTypeID}-${sideID}`,
    statID: 'touchdowns',
    statEntityID: playerID,
    playerID,
    periodID: 'game',
    betTypeID,
    sideID,
    byBookmaker: book,
  });

  const event = {
    teams: { home: { names: { long: 'Atlanta Falcons' } }, away: { names: { long: 'Cincinnati Bengals' } } },
    status: { startsAt: '2026-11-08T14:30:00.000Z' },
    players: { BIJAN_ROBINSON_1_NFL: { name: 'Bijan Robinson' } },
    odds: {
      a: td('BIJAN_ROBINSON_1_NFL', 'yn', 'yes', dk('-320', {}, 'UNIQUE1')),
      b: td('BIJAN_ROBINSON_1_NFL', 'ou', 'over', dk('+170', { overUnder: '1.5' })), // 2+ TDs, ignored
      c: td('TEE_HIGGINS_1_NFL', 'ou', 'over', dk('+115', { overUnder: '0.5' }, 'UNIQUE2')), // over 0.5 = anytime
      d: td('CHASE_BROWN_1_NFL', 'yn', 'yes', { draftkings: { available: false, odds: '-180' } }),
    },
  };

  test('anytime TD prices per player', () => {
    const odds = parseSgoEvent(event);
    expect(playerMarketsFor(odds, 'Bijan Robinson').anytimeTd.yes).toMatchObject({ price: -320, link: { outcome: 'UNIQUE1' } });
    expect(playerMarketsFor(odds, 'Tee Higgins').anytimeTd.yes.price).toBe(115);
    expect(playerMarketsFor(odds, 'Chase Brown')).toBeNull(); // not offered right now
    expect(odds.lines).toBeUndefined(); // lines come from ESPN's DraftKings feed
  });

  test("DraftKings' shared TD links are dropped", () => {
    const shared = dk('+200', {}, 'SAME');
    const odds = parseSgoEvent({
      odds: {
        a: td('A_ONE_1_NFL', 'yn', 'yes', shared),
        b: td('B_TWO_1_NFL', 'yn', 'yes', shared),
        c: td('C_THREE_1_NFL', 'yn', 'yes', dk('+300', {}, 'MINE')),
      },
    });
    expect(playerMarketsFor(odds, 'A One').anytimeTd.yes).toEqual({ price: 200, link: null });
    expect(playerMarketsFor(odds, 'C Three').anytimeTd.yes.link.outcome).toBe('MINE');
  });

  test('finds the SportsGameOdds event for a game', () => {
    const game = {
      date: '2026-11-08T14:30Z',
      away: { team: { displayName: 'Cincinnati Bengals' } },
      home: { team: { displayName: 'Atlanta Falcons' } },
    };
    expect(findSgoEvent([event], game)).toBe(event);
    expect(findSgoEvent([event], { ...game, home: { team: { displayName: 'Other' } } })).toBeNull();
  });
});

describe('touchdown breakdown rows', () => {
  // eslint-disable-next-line global-require
  const { touchdownChance } = require('./picks');
  const g = (season, rushTd) => ({ season, stats: { rushingTouchdowns: rushTd, receivingTouchdowns: 0 } });

  test('labelled, coloured evidence for the card', () => {
    const td = touchdownChance({
      games: [g(2026, 1), g(2026, 1), g(2026, 0), g(2026, 1), g(2026, 1), g(2025, 1), g(2025, 0)],
      position: 'RB',
      season: 2026,
      oppId: 'O',
      oppAbbr: 'OPP',
      rankings: { teamCount: 32, ranks: { oppPpg: { O: 30 } } },
      teamPoints: 27,
      bookTd: { price: 150, link: null },
    });
    const rows = Object.fromEntries(td.factors.map((f) => [f.label, f]));
    expect(rows['This season']).toMatchObject({ value: '4 TDs in 5 games', tone: 'good' });
    expect(rows['Last 5']).toBeUndefined(); // recent form shows in the history bar instead
    expect(rows['Last season'].value).toBe('1 TD in 2 games');
    // team total and opponent defense still shape the chance but aren't listed
    expect(rows['Team total']).toBeUndefined();
    expect(rows['OPP defense']).toBeUndefined();
    expect(td.chance).toBe('LIKELY');
    expect(td.strong).toBe(true);
    expect(rows['DraftKings +150'].value).toMatch(/% vs 40% implied: (value|about fair|too short)$/);
  });
});

describe('kickoff conditions', () => {
  // eslint-disable-next-line global-require
  const { conditionsAtKickoff, compass, describeWeatherCode } = require('./gameConditions');

  test('reads the forecast hour nearest kickoff', () => {
    const json = {
      hourly: {
        time: ['2026-11-08T17:00', '2026-11-08T18:00', '2026-11-08T19:00'],
        temperature_2m: [55.1, 58.6, 60.2],
        wind_speed_10m: [6.2, 11.7, 14],
        wind_direction_10m: [180, 225, 270],
        weather_code: [3, 1, 61],
      },
    };
    expect(conditionsAtKickoff(json, '2026-11-08T18:05Z')).toEqual({
      temperature: 58.6,
      wind: 11.7,
      windFrom: 'SW',
      sky: 'Partly cloudy',
      icon: '⛅',
    });
    expect(conditionsAtKickoff({ hourly: { time: [] } }, '2026-11-08T18:00Z')).toBeNull();
  });

  test('compass points and weather codes', () => {
    expect(compass(0)).toBe('N');
    expect(compass(350)).toBe('N');
    expect(compass(90)).toBe('E');
    expect(describeWeatherCode(71).text).toBe('Snow');
    expect(describeWeatherCode(95).text).toBe('Storms');
    expect(describeWeatherCode(null)).toBeNull();
  });
});

describe('player card extras', () => {
  // eslint-disable-next-line global-require
  const { chanceLabel, seasonStatLine, touchdownChance } = require('./picks');

  test('likelihood labels and the 25% gold border', () => {
    expect(chanceLabel(52)).toBe('LIKELY');
    expect(chanceLabel(31)).toBe('GOOD CHANCE');
    expect(chanceLabel(20)).toBe('LONG SHOT');
    expect(chanceLabel(8)).toBe('UNLIKELY');
    const none = touchdownChance({ games: [{ season: 2026, stats: { receivingTouchdowns: 0 } }], position: 'WR', season: 2026 });
    expect(none.strong).toBe(false);
  });

  test('season stat line by position, falling back to last season', () => {
    const qbGames = [
      { season: 2026, stats: { completions: 20, passingAttempts: 30, passingYards: 250, passingTouchdowns: 2, interceptions: 1, rushingYards: 10 } },
      { season: 2026, stats: { completions: 25, passingAttempts: 35, passingYards: 300, passingTouchdowns: 3, interceptions: 0, rushingYards: 5 } },
    ];
    const qb = seasonStatLine(qbGames, 'QB', 2026);
    expect(qb.season).toBe('2026');
    expect(Object.fromEntries(qb.items.map((i) => [i.label, i.value]))).toMatchObject({
      GP: 2,
      'CMP%': '69.2',
      'PASS YDS': 550,
      'PASS TD': 5,
      INT: 1,
      'RUSH YDS': 15,
    });
    const rookie = seasonStatLine([{ season: 2025, stats: { receptions: 4, receivingYards: 50 } }], 'TE', 2026);
    expect(rookie.season).toBe('2025');
    expect(rookie.items.find((i) => i.label === 'Y/R').value).toBe('12.5');
    expect(seasonStatLine([], 'RB', 2026)).toBeNull();
  });
});

describe('touchdown history', () => {
  // eslint-disable-next-line global-require
  const { touchdownHistory } = require('./picks');

  test("only this season's games, last 10 at most, oldest first, with date and opponent", () => {
    const games = [
      ...Array.from({ length: 12 }, (_, i) => ({
        eventId: `g${i}`,
        season: 2026,
        date: `2026-${String(12 - Math.floor(i / 4)).padStart(2, '0')}-${String(28 - i).padStart(2, '0')}T18:00Z`,
        atVs: i % 2 ? '@' : 'vs',
        opponentAbbr: 'KC',
        stats: { rushingTouchdowns: i === 0 ? 2 : 0, receivingTouchdowns: i === 3 ? 1 : 0 },
      })),
      { eventId: 'old', season: 2025, date: '2025-12-01T18:00Z', stats: { rushingTouchdowns: 1 } },
    ];
    const history = touchdownHistory(games, 'RB', 2026);
    expect(history).toHaveLength(10);
    expect(history.map((g) => g.id)).not.toContain('old');
    const newest = history[history.length - 1];
    expect(newest).toMatchObject({ id: 'g0', tds: 2, scored: true, opp: 'vs KC' });
    expect(newest.date).toMatch(/^\d{1,2}\/\d{1,2}$/);
    expect(history.find((g) => g.id === 'g3')).toMatchObject({ scored: true, opp: '@ KC' });
    expect(touchdownHistory(games, 'QB', 2026).find((g) => g.id === 'g3').scored).toBe(false); // QBs: rushing only
    expect(touchdownHistory([], 'WR', 2026)).toEqual([]);
  });
});

describe('gradeLinePick', () => {
  // eslint-disable-next-line global-require
  const { gradeLinePick } = require('./picks');
  const game = { status: { state: 'post' }, away: { score: '20' }, home: { score: '24' } };
  const odds = { away: { spreadLine: 3.5 }, home: { spreadLine: -3.5 }, total: { line: 44 } };

  it('grades the winner pick on the final score', () => {
    expect(gradeLinePick({ key: 'winner', side: 'home' }, game, odds)).toBe('W');
    expect(gradeLinePick({ key: 'winner', side: 'away' }, game, odds)).toBe('L');
  });

  it('grades the spread pick with the picked side line', () => {
    expect(gradeLinePick({ key: 'spread', side: 'home' }, game, odds)).toBe('W'); // 4 > 3.5
    expect(gradeLinePick({ key: 'spread', side: 'away' }, game, odds)).toBe('L');
    expect(gradeLinePick({ key: 'spread', side: 'home' }, game, { home: { spreadLine: -4 } })).toBe('P');
  });

  it('grades over/under against the total', () => {
    expect(gradeLinePick({ key: 'total', side: 'under' }, game, odds)).toBe('P'); // 44 on a 44 line
    expect(gradeLinePick({ key: 'total', side: 'over' }, game, { total: { line: 43.5 } })).toBe('W');
    expect(gradeLinePick({ key: 'total', side: 'under' }, game, { total: { line: 43.5 } })).toBe('L');
  });

  it('returns null before the game is final', () => {
    expect(gradeLinePick({ key: 'winner', side: 'home' }, { ...game, status: { state: 'in' } }, odds)).toBeNull();
  });
});

describe('flat-stake bets', () => {
  // eslint-disable-next-line global-require
  const { betReturn, linePickBets } = require('./picks');

  it('pays American odds back with the stake', () => {
    expect(betReturn(10, -170, 'W')).toBe(15.88);
    expect(betReturn(10, 150, 'W')).toBe(25);
    expect(betReturn(10, -110, 'L')).toBe(0);
    expect(betReturn(10, -110, 'P')).toBe(10);
  });

  it('lists moneyline, spread and total bets with their pregame prices', () => {
    const game = {
      status: { state: 'post' },
      away: { score: '20', team: { abbreviation: 'BUF' } },
      home: { score: '24', team: { abbreviation: 'KC' } },
    };
    const odds = {
      away: { moneyLine: 140, spreadLine: 3.5, spreadOdds: -105 },
      home: { moneyLine: -170, spreadLine: -3.5, spreadOdds: null },
      total: { line: 47.5, overOdds: -110, underOdds: -110 },
    };
    const picks = {
      winner: { key: 'winner', side: 'home' },
      spread: { key: 'spread', side: 'home' },
      total: { key: 'total', side: 'under' },
    };
    expect(linePickBets(picks, game, odds)).toEqual([
      { key: 'winner', label: 'KC ML', price: -170, result: 'W' },
      { key: 'spread', label: 'KC -3.5', price: -110, result: 'W' },
      { key: 'total', label: 'UNDER 47.5', price: -110, result: 'W' },
    ]);
  });
});

describe('teamResultHistory', () => {
  // eslint-disable-next-line global-require
  const { teamResultHistory } = require('./picks');
  const g = (id, date, away, home, as, hs, state = 'post') => ({
    id,
    date,
    status: { state },
    away: { teamId: away, score: as, team: { abbreviation: away } },
    home: { teamId: home, score: hs, team: { abbreviation: home } },
  });
  it('lists finished games before this one, oldest first, from the team side', () => {
    const schedule = [
      g('2', '2026-09-20T17:00:00Z', 'KC', 'BUF', '20', '24'),
      g('1', '2026-09-13T17:00:00Z', 'BUF', 'MIA', '30', '10'),
      g('3', '2026-09-27T17:00:00Z', 'BUF', 'NYJ', '17', '17'),
      g('4', '2026-10-04T17:00:00Z', 'NE', 'BUF', '0', '0', 'pre'),
    ];
    const rows = teamResultHistory(schedule, 'BUF', { id: '4', date: '2026-10-04T17:00:00Z' });
    expect(rows.map((r) => [r.opp, r.result])).toEqual([
      ['@ MIA', 'W'],
      ['vs KC', 'W'],
      ['@ NYJ', 'T'],
    ]);
  });
});

describe('teamResultHistory byes', () => {
  // eslint-disable-next-line global-require
  const { teamResultHistory } = require('./picks');
  const g = (id, week, away, home, as, hs) => ({
    id,
    week,
    seasonType: 2,
    date: `2026-09-${10 + week}T17:00:00Z`,
    status: { state: 'post' },
    away: { teamId: away, score: as, team: { abbreviation: away } },
    home: { teamId: home, score: hs, team: { abbreviation: home } },
  });
  it('adds a BYE cell for a regular-season week with no game', () => {
    const schedule = [g('1', 1, 'BUF', 'MIA', '30', '10'), g('3', 3, 'KC', 'BUF', '20', '24')];
    const rows = teamResultHistory(schedule, 'BUF', { id: '4', week: 4, seasonType: 2, date: '2026-09-30T17:00:00Z' });
    expect(rows.map((r) => r.result)).toEqual(['W', 'BYE', 'W']);
    expect(rows[1]).toMatchObject({ bye: true, week: 2 });
  });
});

describe('odds frozen at kickoff', () => {
  // eslint-disable-next-line global-require
  const { saveOddsSnapshot, frozenOdds, hasStarted } = require('./oddsSnapshots');
  const kickoff = Date.parse('2026-11-08T18:00:00Z');
  const game = { id: 'g1', date: '2026-11-08T18:00:00Z', status: { state: 'pre' } };
  const min = 60 * 1000;
  beforeEach(() => window.localStorage.clear());

  it('keeps the last copy from 30+ minutes before kickoff', () => {
    saveOddsSnapshot(game, 'lines', { homeSpread: -3 }, kickoff - 120 * min);
    saveOddsSnapshot(game, 'lines', { homeSpread: -3.5 }, kickoff - 40 * min);
    saveOddsSnapshot(game, 'lines', { homeSpread: -6 }, kickoff - 10 * min); // last half hour: ignored
    expect(frozenOdds(game, 'lines')).toEqual({ homeSpread: -3.5 });
  });

  it('falls back to the first copy inside the last half hour', () => {
    saveOddsSnapshot(game, 'td', { players: { a: 1 } }, kickoff - 20 * min);
    saveOddsSnapshot(game, 'td', { players: { a: 2 } }, kickoff - 5 * min);
    expect(frozenOdds(game, 'td')).toEqual({ players: { a: 1 } });
  });

  it('saves nothing once the game has started', () => {
    saveOddsSnapshot({ ...game, status: { state: 'in' } }, 'lines', { homeSpread: -9 }, kickoff - 60 * min);
    saveOddsSnapshot(game, 'lines', { homeSpread: -9 }, kickoff + min);
    expect(frozenOdds(game, 'lines')).toBeNull();
    expect(hasStarted(game, kickoff + min)).toBe(true);
    expect(hasStarted(game, kickoff - min)).toBe(false);
  });
});

describe('live down & distance', () => {
  // eslint-disable-next-line global-require
  const { situationText } = require('../../../components/NFLDataComponents/ScoreBug/ScoreBugs');
  const status = { shortDetail: '8:23 - 2nd', isHalftime: false };
  it('shows a real down', () => {
    expect(situationText({ down: 3, distance: 7, shortDownDistanceText: '3rd & 7' }, status)).toBe('3rd & 7');
    expect(situationText({ down: 2, distance: 4 }, status)).toBe('2nd & 4');
  });
  it('never shows the between-plays -1 / 0 placeholder', () => {
    expect(situationText({ down: -1, distance: 0 }, status)).toBe('8:23 - 2nd');
    expect(situationText({ down: -1, distance: 0, downDistanceText: '-1th and 0' }, status)).toBe('8:23 - 2nd');
    expect(situationText({ down: 1, distance: 10, shortDownDistanceText: '-1th & 0' }, status)).toBe('1st & 10');
    expect(situationText({ down: 0, distance: 0 }, { isHalftime: true })).toBe('Halftime');
  });
});

describe('live stoppages', () => {
  // eslint-disable-next-line global-require
  const { isStoppage } = require('../../../components/NFLDataComponents/ScoreBug/ScoreBugs');
  it('spots timeouts and breaks, not real plays', () => {
    expect(isStoppage({ lastPlayType: 'Official Timeout', lastPlay: 'Official Timeout at 01:02.' })).toBe(true);
    expect(isStoppage({ lastPlayType: 'Timeout', lastPlay: 'Timeout #1 by KC at 08:12.' })).toBe(true);
    expect(isStoppage({ lastPlayType: 'End Period', lastPlay: 'END QUARTER 1' })).toBe(true);
    expect(isStoppage({ lastPlayType: 'Two-minute warning', lastPlay: 'Two-Minute Warning' })).toBe(true);
    expect(isStoppage({ lastPlayType: 'Pass Reception', lastPlay: 'D.Prescott pass short left to R.Flournoy' })).toBe(false);
    expect(isStoppage(null)).toBe(false);
  });
});
