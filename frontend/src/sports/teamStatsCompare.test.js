import {
  parseTeamStatsTable,
  parseStandings,
  buildStatRows,
  STAT_ROWS,
} from '../components/NFLDataComponents/shared/TeamStatsCompare';

// ESPN's "stats by team" shape: a category listed twice for a team is its own
// numbers, then its opponents'; the second listing's names may be left empty.
const nbaJson = {
  categories: [
    { name: 'offensive', names: ['avgPoints', 'fieldGoalPct'] },
    { name: 'offensive', names: [] },
  ],
  teams: [
    {
      team: { id: '1' },
      categories: [
        { name: 'offensive', values: [120, 48] },
        { name: 'offensive', values: [110, 45] },
      ],
    },
    {
      team: { id: '2' },
      categories: [
        { name: 'offensive', values: [105, 44] },
        { name: 'offensive', values: [100, 43] },
      ],
    },
    {
      team: { id: '3' },
      categories: [
        { name: 'offensive', values: [112, 46] },
        { name: 'offensive', values: [115, 47] },
      ],
    },
  ],
};

test('reads own and opponent numbers for every team', () => {
  const table = parseTeamStatsTable(nbaJson);
  expect(table.size).toBe(3);
  expect(table.get('1').own.offensive).toEqual({ avgPoints: 120, fieldGoalPct: 48 });
  expect(table.get('1').opp.offensive).toEqual({ avgPoints: 110, fieldGoalPct: 45 });
});

test('ranks each stat the right way round and picks the better side', () => {
  const table = parseTeamStatsTable(nbaJson);
  const rows = buildStatRows('nba', table, '1', '2', { away: '8-3', home: '2-9' });
  const pts = rows.find((r) => r.label === 'PTS');
  expect(pts.away).toMatchObject({ text: '120.0', rank: 1 });
  expect(pts.home).toMatchObject({ text: '105.0', rank: 3 });
  expect(pts.winner).toBe('away');
  // points allowed: fewer is better
  const allowed = rows.find((r) => r.label === 'OPP PTS');
  expect(allowed.away.rank).toBe(2);
  expect(allowed.home.rank).toBe(1);
  expect(allowed.winner).toBe('home');
  // stats ESPN didn't send show a dash and no rank
  const reb = rows.find((r) => r.label === 'REB');
  expect(reb.away).toMatchObject({ text: '—', rank: null });
  const record = rows.find((r) => r.record);
  expect(record.away.text).toBe('8-3');
  expect(record.winner).toBe('away');
});

test('baseball rates drop the leading zero and ERA ranks low to high', () => {
  const json = {
    categories: [
      { name: 'batting', names: ['avg'] },
      { name: 'pitching', names: ['ERA'] },
    ],
    teams: [
      {
        team: { id: '10' },
        categories: [
          { name: 'batting', values: [0.261] },
          { name: 'pitching', values: [3.5] },
        ],
      },
      {
        team: { id: '11' },
        categories: [
          { name: 'batting', values: [0.244] },
          { name: 'pitching', values: [4.25] },
        ],
      },
    ],
  };
  const rows = buildStatRows('mlb', parseTeamStatsTable(json), '10', '11');
  expect(rows.find((r) => r.label === 'AVG').away.text).toBe('.261');
  const era = rows.find((r) => r.label === 'ERA');
  expect(era.away).toMatchObject({ text: '3.50', rank: 1 });
  expect(era.winner).toBe('away');
});

test('every sport has stats to show', () => {
  ['nfl', 'nba', 'mlb'].forEach((lg) => expect(STAT_ROWS[lg].length).toBeGreaterThan(8));
});

test('NFL overall: division and conference standing, no turnover difference', () => {
  const entry = (id, seed, home, road) => ({
    team: { id },
    stats: [
      { name: 'playoffSeed', value: seed },
      { name: 'pointDifferential', value: 10 - seed },
      { name: 'streak', value: 1, displayValue: 'W1' },
      { name: 'Home', type: 'home', displayValue: home },
      { name: 'Road', type: 'road', displayValue: road },
    ],
  });
  const standings = parseStandings({
    children: [
      {
        abbreviation: 'AFC',
        children: [
          { name: 'AFC West', standings: { entries: [entry('24', 9, '2-2', '1-4'), entry('12', 2, '4-0', '3-2')] } },
        ],
      },
    ],
  });
  expect(standings.get('12')).toMatchObject({ divRank: 1, division: 'AFC West', confSeed: 2 });
  const rows = buildStatRows('nfl', new Map(), '24', '12', { away: '3-6', home: '7-2' }, standings);
  const labels = rows.map((r) => r.label);
  expect(labels).not.toContain('TO DIFF');
  const division = rows.find((r) => r.label === 'DIVISION');
  expect(division.away).toMatchObject({ text: 'AFC West', rank: 2, tone: 'bottom' });
  expect(division.home).toMatchObject({ rank: 1, tone: 'top' });
  expect(division.winner).toBe('home');
  const venue = rows.find((r) => r.venue);
  expect([venue.away.text, venue.home.text]).toEqual(['1-4', '4-0']);
  // without standings, those rows are left out
  expect(buildStatRows('nfl', new Map(), '24', '12').map((r) => r.label)).not.toContain('DIVISION');
});
