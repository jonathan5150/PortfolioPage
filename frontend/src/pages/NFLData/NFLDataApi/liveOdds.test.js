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
