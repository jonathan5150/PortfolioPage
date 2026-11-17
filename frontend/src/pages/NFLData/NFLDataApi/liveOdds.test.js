import { parseLiveOdds, parsePregameOdds } from './betting';

// ESPN core odds item shape: open / close / current snapshots per side
const snap = (ml, spread, spreadOdds) => ({
  moneyLine: { american: ml },
  pointSpread: { american: spread },
  spread: { american: spreadOdds },
});
const book = (overrides = {}) => ({
  provider: { id: '100', name: 'DraftKings', priority: 1 },
  details: 'HOME -3.5',
  spread: -6.5, // the "now" line at the top level
  overUnder: 230.5,
  overOdds: -110,
  underOdds: -110,
  awayTeamOdds: {
    moneyLine: 240,
    open: snap('+140', '+3.5', '-110'),
    close: snap('+150', '+3.5', '-108'),
    current: snap('+240', '+6.5', '-112'),
  },
  homeTeamOdds: {
    moneyLine: -300,
    open: snap('-165', '-3.5', '-110'),
    close: snap('-180', '-3.5', '-112'),
    current: snap('-300', '-6.5', '-108'),
  },
  open: { total: { american: '226.5' } },
  close: { total: { american: '227.5' }, over: { american: '-105' }, under: { american: '-115' } },
  current: { total: { american: '230.5' }, over: { american: '-110' }, under: { american: '-110' } },
  links: [],
  ...overrides,
});

describe('PREGAME / LIVE odds', () => {
  test('pregame reads the closing snapshot', () => {
    const o = parsePregameOdds({ items: [book()] });
    expect(o.home.moneyLine).toBe(-180);
    expect(o.away.moneyLine).toBe(150);
    expect(o.home.spreadLine).toBe(-3.5);
    expect(o.total.line).toBe(227.5);
    expect(o.total.overOdds).toBe(-105);
  });

  test('live falls back to the main book current snapshot', () => {
    const o = parseLiveOdds({ items: [book()] });
    expect(o.home.moneyLine).toBe(-300);
    expect(o.home.spreadLine).toBe(-6.5);
    expect(o.total.line).toBe(230.5);
  });

  test('a current line that never moved off the close is not live', () => {
    const frozen = book({
      awayTeamOdds: { moneyLine: 150, close: snap('+150', '+3.5', '-108'), current: snap('+150', '+3.5', '-108') },
      homeTeamOdds: { moneyLine: -180, close: snap('-180', '-3.5', '-112'), current: snap('-180', '-3.5', '-112') },
      current: { total: { american: '227.5' }, over: { american: '-105' }, under: { american: '-115' } },
    });
    expect(parseLiveOdds({ items: [frozen] })).toBeNull();
  });

  test('a posted Live Odds book wins for live', () => {
    const live = book({
      provider: { id: '59', name: 'ESPN BET - Live Odds', priority: 2 },
      spread: -9.5,
      overUnder: 233.5,
      awayTeamOdds: { moneyLine: 380 },
      homeTeamOdds: { moneyLine: -500 },
    });
    const o = parseLiveOdds({ items: [book(), live] });
    expect(o.home.moneyLine).toBe(-500);
    expect(o.homeSpread).toBe(-9.5);
    expect(o.total.line).toBe(233.5);
    // and it never leaks into the pregame line
    expect(parsePregameOdds({ items: [book(), live] }).home.moneyLine).toBe(-180);
  });

  test('no odds at all: null', () => {
    expect(parseLiveOdds({ items: [] })).toBeNull();
    expect(parsePregameOdds({ items: [] })).toBeNull();
  });
});

describe('LIVE backup: SportsGameOdds main lines', () => {
  // eslint-disable-next-line global-require
  const { parseSgoMainLines } = require('./sportsbookOdds');
  const dk = (fields) => ({ byBookmaker: { draftkings: { available: true, ...fields } } });
  const event = {
    eventID: 'abc',
    odds: {
      'points-away-game-ml-away': dk({ odds: '-251', deeplink: 'https://sportsbook.draftkings.com/event/1?outcomes=0ML1_3' }),
      'points-home-game-ml-home': dk({ odds: '+184' }),
      'points-away-game-sp-away': dk({ odds: '-113', spread: '-4.5' }),
      'points-home-game-sp-home': dk({ odds: '-117', spread: '+4.5' }),
      'points-all-game-ou-over': dk({ odds: '-118', overUnder: '46.5' }),
      'points-all-game-ou-under': dk({ odds: '-112', overUnder: '46.5' }),
    },
  };

  test('reads DraftKings live moneyline, spread and total', () => {
    const o = parseSgoMainLines(event);
    expect(o.away).toMatchObject({ moneyLine: -251, spreadLine: -4.5, spreadOdds: -113, favorite: true });
    expect(o.home).toMatchObject({ moneyLine: 184, spreadLine: 4.5, spreadOdds: -117, favorite: false });
    expect(o.homeSpread).toBe(4.5);
    expect(o.total).toMatchObject({ line: 46.5, overOdds: -118, underOdds: -112 });
    expect(o.links.awayMl.outcome).toBe('0ML1_3');
  });

  test('nothing open: null', () => {
    expect(parseSgoMainLines({ odds: {} })).toBeNull();
  });
});
