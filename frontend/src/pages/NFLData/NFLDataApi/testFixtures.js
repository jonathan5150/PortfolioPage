// Trimmed fixtures shaped like real ESPN / nflverse responses.

export const teamsResponse = {
  sports: [
    {
      leagues: [
        {
          teams: [
            { team: { id: '12', abbreviation: 'KC', displayName: 'Kansas City Chiefs', name: 'Chiefs', location: 'Kansas City', color: 'e31837', alternateColor: 'ffb612', logos: [{ href: 'https://a.espncdn.com/i/teamlogos/nfl/500/kc.png', rel: ['full', 'default'] }] } },
            { team: { id: '2', abbreviation: 'BUF', displayName: 'Buffalo Bills', name: 'Bills', location: 'Buffalo', color: '00338d', logos: [{ href: 'buf.png', rel: ['full', 'default'] }] } },
          ],
        },
      ],
    },
  ],
};

const competitor = (id, abbr, homeAway, score, linescores, record, extra = {}) => ({
  id,
  homeAway,
  winner: extra.winner,
  team: { id, abbreviation: abbr, displayName: `${abbr} Team`, name: abbr, color: '112233', logo: `${abbr}.png` },
  score: String(score),
  linescores: linescores.map((value) => ({ value })),
  records: [
    { name: 'overall', type: 'total', summary: record },
    { name: 'Home', type: 'home', summary: '3-1' },
    { name: 'Road', type: 'road', summary: '3-1' },
  ],
  leaders: extra.leaders,
});

export const scoreboardResponse = {
  leagues: [
    {
      calendar: [
        { label: 'Preseason', value: '1', entries: [{ label: 'Hall of Fame Weekend', value: '1', startDate: '2026-08-01T07:00Z', endDate: '2026-08-07T06:59Z' }] },
        {
          label: 'Regular Season',
          value: '2',
          entries: [
            { label: 'Week 9', value: '9', startDate: '2026-10-28T07:00Z', endDate: '2026-11-04T07:59Z' },
            { label: 'Week 10', value: '10', startDate: '2026-11-04T08:00Z', endDate: '2026-11-11T07:59Z' },
          ],
        },
        { label: 'Off Season', value: '4', entries: [{ label: 'Offseason', value: '1' }] },
      ],
    },
  ],
  season: { type: 2, year: 2026 },
  week: { number: 10 },
  events: [
    {
      id: '401800002',
      date: '2026-11-08T18:00Z',
      name: 'Buffalo Bills at Kansas City Chiefs',
      shortName: 'BUF @ KC',
      season: { year: 2026, type: 2 },
      week: { number: 10 },
      competitions: [
        {
          id: '401800002',
          status: { clock: 512, displayClock: '8:32', period: 3, type: { id: '2', name: 'STATUS_IN_PROGRESS', state: 'in', completed: false, detail: '8:32 - 3rd Quarter', shortDetail: '8:32 - 3rd' } },
          venue: { fullName: 'GEHA Field at Arrowhead Stadium' },
          broadcasts: [{ market: 'national', names: ['CBS'] }],
          competitors: [
            competitor('12', 'KC', 'home', 17, [7, 3, 7], '6-2'),
            competitor('2', 'BUF', 'away', 20, [10, 7, 3], '7-1', {
              leaders: [{ name: 'passingYards', displayName: 'Passing Leader', leaders: [{ displayValue: '2,145 YDS, 15 TD', athlete: { id: '3918298', shortName: 'J. Allen' }, team: { id: '2' } }] }],
            }),
          ],
          situation: {
            down: 2,
            distance: 7,
            yardLine: 35,
            downDistanceText: '2nd & 7 at KC 35',
            shortDownDistanceText: '2nd & 7',
            possessionText: 'KC 35',
            possession: '2',
            isRedZone: false,
            homeTimeouts: 2,
            awayTimeouts: 3,
            lastPlay: { text: 'J.Allen pass short right to K.Shakir for 8 yards' },
          },
          leaders: [],
        },
      ],
    },
    {
      id: '401800001',
      date: '2026-11-06T01:15Z',
      name: 'Final game',
      shortName: 'NYJ @ NE',
      competitions: [
        {
          status: { period: 4, type: { name: 'STATUS_FINAL', state: 'post', completed: true, detail: 'Final', shortDetail: 'Final' } },
          competitors: [
            competitor('17', 'NE', 'home', 24, [7, 10, 0, 7], '5-4', { winner: true }),
            competitor('20', 'NYJ', 'away', 13, [0, 3, 3, 7], '2-7', { winner: false }),
          ],
        },
      ],
    },
  ],
};

export const summaryResponse = {
  header: {
    id: '401800002',
    competitions: [
      {
        status: { period: 3, displayClock: '8:32', type: { state: 'in', name: 'STATUS_IN_PROGRESS' } },
        competitors: [
          { id: '12', homeAway: 'home', score: '17', team: { id: '12', abbreviation: 'KC' }, record: [{ type: 'total', summary: '6-2' }], linescores: [{ displayValue: '7' }, { displayValue: '3' }, { displayValue: '7' }] },
          { id: '2', homeAway: 'away', score: '20', team: { id: '2', abbreviation: 'BUF' }, record: [{ type: 'total', summary: '7-1' }], linescores: [{ displayValue: '10' }, { displayValue: '7' }, { displayValue: '3' }] },
        ],
      },
    ],
  },
  boxscore: {
    teams: [
      { team: { id: '2', abbreviation: 'BUF' }, statistics: [{ name: 'firstDowns', displayValue: '18', label: '1st Downs' }, { name: 'thirdDownEff', displayValue: '5-9', label: '3rd down efficiency' }, { name: 'possessionTime', displayValue: '19:02', label: 'Possession' }] },
      { team: { id: '12', abbreviation: 'KC' }, statistics: [{ name: 'firstDowns', displayValue: '14', label: '1st Downs' }, { name: 'thirdDownEff', displayValue: '3-8', label: '3rd down efficiency' }, { name: 'possessionTime', displayValue: '18:26', label: 'Possession' }] },
    ],
    players: [
      {
        team: { id: '2', abbreviation: 'BUF' },
        statistics: [
          {
            name: 'passing',
            text: 'Buffalo Passing',
            keys: ['completions/passingAttempts', 'passingYards', 'yardsPerPassAttempt', 'passingTouchdowns', 'interceptions', 'sacks-sackYardsLost', 'adjQBR', 'QBRating'],
            labels: ['C/ATT', 'YDS', 'AVG', 'TD', 'INT', 'SACKS', 'QBR', 'RTG'],
            totals: ['18/26', '211', '8.1', '2', '0', '1-6', '--', '121.2'],
            athletes: [{ athlete: { id: '3918298', displayName: 'Josh Allen', shortName: 'J. Allen', jersey: '17' }, stats: ['18/26', '217', '8.3', '2', '0', '1-6', '78.4', '121.2'] }],
          },
          {
            name: 'receiving',
            keys: ['receptions', 'receivingYards', 'yardsPerReception', 'receivingTouchdowns', 'longReception', 'receivingTargets'],
            labels: ['REC', 'YDS', 'AVG', 'TD', 'LONG', 'TGTS'],
            totals: ['18', '217', '12.1', '2', '41', '25'],
            athletes: [{ athlete: { id: '4373678', displayName: 'Khalil Shakir', shortName: 'K. Shakir' }, stats: ['7', '88', '12.6', '1', '24', '8'] }],
          },
        ],
      },
      { team: { id: '12', abbreviation: 'KC' }, statistics: [] },
    ],
  },
  scoringPlays: [
    { id: '1', period: { number: 1 }, clock: { displayValue: '9:12' }, text: 'J.Cook 4 Yd Run (T.Bass Kick)', team: { id: '2' }, scoringType: { abbreviation: 'TD' }, awayScore: 7, homeScore: 0 },
  ],
  situation: { down: 2, distance: 7, possession: '2', possessionText: 'KC 35', shortDownDistanceText: '2nd & 7' },
};

export const gameLogResponse = {
  labels: ['CMP', 'ATT', 'YDS', 'CMP%', 'AVG', 'TD', 'INT', 'LNG', 'SACK', 'RTG', 'QBR', 'CAR', 'YDS', 'AVG', 'TD', 'LNG'],
  names: ['completions', 'passingAttempts', 'passingYards', 'completionPct', 'yardsPerPassAttempt', 'passingTouchdowns', 'interceptions', 'longPassing', 'sacks', 'QBRating', 'adjQBR', 'rushingAttempts', 'rushingYards', 'yardsPerRushAttempt', 'rushingTouchdowns', 'longRushing'],
  categories: [{ name: 'passing', count: 11 }, { name: 'rushing', count: 5 }],
  events: {
    401700010: { id: '401700010', week: 9, gameDate: '2026-11-02T18:00:00.000+00:00', atVs: 'vs', gameResult: 'W', score: '30-20', opponent: { id: '15', abbreviation: 'MIA' } },
    401700009: { id: '401700009', week: 8, gameDate: '2026-10-26T18:00:00.000+00:00', atVs: '@', gameResult: 'L', score: '17-24', opponent: { id: '4', abbreviation: 'CIN' } },
  },
  seasonTypes: [
    {
      displayName: '2026 Regular Season',
      categories: [
        {
          type: 'event',
          events: [
            { eventId: '401700009', stats: ['20', '33', '240', '60.6', '7.3', '1', '1', '41', '3', '84.0', '55.1', '6', '31', '5.2', '0', '12'] },
            { eventId: '401700010', stats: ['25', '34', '301', '73.5', '8.9', '3', '0', '52', '1', '125.1', '80.3', '4', '22', '5.5', '1', '9'] },
          ],
        },
      ],
      summary: { stats: [{ displayName: 'Regular Season Stats', stats: ['45', '67', '541', '67.2', '8.1', '4', '1', '52', '4', '104.4', '67.7', '10', '53', '5.3', '1', '12'] }] },
    },
  ],
};

export const byTeamResponse = {
  teams: [
    {
      team: { id: '12', abbreviation: 'KC' },
      categories: [
        { name: 'passing', displayName: 'Own Passing', splitId: '0', values: [380, 380.0, 260, 260.0, 220, 27.5], ranks: ['3', '3'] },
        { name: 'rushing', displayName: 'Own Rushing', splitId: '0', values: [960, 120.0] },
        { name: 'passing', displayName: 'Opponent Passing', splitId: '900', values: [300, 300.0, 200, 200.0, 152, 19.0] },
        { name: 'miscellaneous', displayName: 'Own Miscellaneous', splitId: '0', values: [0, 0, 0, 0, 0, 0, 45.5, 0, 0, 0, 0, 0, 4, 12, 8] },
      ],
    },
    {
      team: { id: '2', abbreviation: 'BUF' },
      categories: [
        { name: 'passing', displayName: 'Own Passing', splitId: '0', values: [400, 400.0, 270, 270.0, 240, 30.0] },
        { name: 'rushing', displayName: 'Own Rushing', splitId: '0', values: [1040, 130.0] },
        { name: 'passing', displayName: 'Opponent Passing', splitId: '900', values: [320, 320.0, 210, 210.0, 168, 21.0] },
      ],
    },
  ],
  categories: [
    { name: 'passing', names: ['totalYards', 'yardsPerGame', 'netPassingYards', 'netPassingYardsPerGame', 'totalPoints', 'totalPointsPerGame'] },
    { name: 'rushing', names: ['rushingYards', 'rushingYardsPerGame'] },
    { name: 'miscellaneous', names: ['firstDowns', 'firstDownsRushing', 'firstDownsPassing', 'firstDownsPenalty', 'thirdDownConvs', 'thirdDownAttempts', 'thirdDownConvPct', 'fourthDownConvs', 'fourthDownAttempts', 'fourthDownConvPct', 'totalPenalties', 'totalPenaltyYards', 'turnOverDifferential', 'totalTakeaways', 'totalGiveaways'] },
  ],
};

export const rosterResponse = {
  athletes: [
    { position: 'offense', items: [{ id: '3918298', displayName: 'Josh Allen', jersey: '17', position: { abbreviation: 'QB' }, headshot: { href: 'x.png' } }, { id: '4379399', displayName: 'James Cook', position: { abbreviation: 'RB' } }] },
    { position: 'defense', items: [{ id: '1', displayName: 'Def Guy', position: { abbreviation: 'LB' } }] },
  ],
};

export const nflversePlayerCsv = [
  'player_id,player_name,player_display_name,position,position_group,headshot_url,season,season_type,recent_team,games,completions,attempts,passing_yards,passing_tds,passing_interceptions,sacks_suffered,carries,rushing_yards,rushing_tds,receptions,targets,receiving_yards,receiving_tds,rushing_fumbles_lost,receiving_fumbles_lost,sack_fumbles_lost',
  '00-0034857,J.Allen,Josh Allen,QB,QB,"https://x.png",2025,REG,BUF,17,316,483,3668,25,10,40,102,579,14,0,0,0,0,1,0,2',
  '00-0039999,"Smith, Jr.",Ray Smith Jr.,WR,WR,,2025,REG,LA,16,0,0,0,0,0,0,2,10,0,80,120,1100,8,0,1,0',
].join('\n');
