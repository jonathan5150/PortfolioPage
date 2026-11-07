// Which ESPN box score columns to show per category (a subset that fits on a phone).
// `keys` are ESPN stat keys; `labels` are fallbacks if ESPN renames a key.
export const BOX_SCORE_SECTIONS = [
  {
    category: 'passing',
    title: 'PASSING',
    columns: [
      { key: 'completions/passingAttempts', label: 'C/ATT', labels: ['C/ATT'] },
      { key: 'passingYards', label: 'YDS', labels: ['YDS'] },
      { key: 'passingTouchdowns', label: 'TD', labels: ['TD'] },
      { key: 'interceptions', label: 'INT', labels: ['INT'] },
      { key: 'sacks-sackYardsLost', label: 'SCK', labels: ['SACKS'] },
      { key: 'QBRating', label: 'RTG', labels: ['RTG'] },
    ],
  },
  {
    category: 'rushing',
    title: 'RUSHING',
    columns: [
      { key: 'rushingAttempts', label: 'CAR', labels: ['CAR'] },
      { key: 'rushingYards', label: 'YDS', labels: ['YDS'] },
      { key: 'yardsPerRushAttempt', label: 'AVG', labels: ['AVG'] },
      { key: 'rushingTouchdowns', label: 'TD', labels: ['TD'] },
      { key: 'longRushing', label: 'LNG', labels: ['LONG'] },
    ],
  },
  {
    category: 'receiving',
    title: 'RECEIVING',
    columns: [
      { key: 'receptions', label: 'REC', labels: ['REC'] },
      { key: 'receivingTargets', label: 'TGT', labels: ['TGTS'] },
      { key: 'receivingYards', label: 'YDS', labels: ['YDS'] },
      { key: 'yardsPerReception', label: 'AVG', labels: ['AVG'] },
      { key: 'receivingTouchdowns', label: 'TD', labels: ['TD'] },
      { key: 'longReception', label: 'LNG', labels: ['LONG'] },
    ],
  },
  {
    category: 'defensive',
    title: 'DEFENSE',
    columns: [
      { key: 'totalTackles', label: 'TOT', labels: ['TOT'] },
      { key: 'soloTackles', label: 'SOLO', labels: ['SOLO'] },
      { key: 'sacks', label: 'SACK', labels: ['SACKS'] },
      { key: 'tacklesForLoss', label: 'TFL', labels: ['TFL'] },
      { key: 'passesDefended', label: 'PD', labels: ['PD'] },
      { key: 'QBHits', label: 'QBH', labels: ['QB HTS', 'QBH'] },
    ],
    limit: 8,
  },
  {
    category: 'interceptions',
    title: 'INTERCEPTIONS',
    columns: [
      { key: 'interceptions', label: 'INT', labels: ['INT'] },
      { key: 'interceptionYards', label: 'YDS', labels: ['YDS'] },
      { key: 'interceptionTouchdowns', label: 'TD', labels: ['TD'] },
    ],
  },
  {
    category: 'kicking',
    title: 'KICKING',
    columns: [
      { key: 'fieldGoalsMade/fieldGoalAttempts', label: 'FG', labels: ['FG'] },
      { key: 'fieldGoalPct', label: 'PCT', labels: ['PCT'] },
      { key: 'longFieldGoalMade', label: 'LNG', labels: ['LONG'] },
      { key: 'extraPointsMade/extraPointAttempts', label: 'XP', labels: ['XP'] },
      { key: 'totalKickingPoints', label: 'PTS', labels: ['PTS'] },
    ],
  },
];

// Returns the index into ESPN's stats array for a configured column, or -1.
export const resolveColumnIndex = (category, column) => {
  const byKey = category.keys.indexOf(column.key);
  if (byKey >= 0) return byKey;
  return category.labels.findIndex((l) => column.labels.includes(String(l).toUpperCase()));
};

// Turn an ESPN category + our config into StatTable columns and rows.
export const buildCategoryTable = (category, section) => {
  let columns = section.columns
    .map((c) => ({ ...c, index: resolveColumnIndex(category, c) }))
    .filter((c) => c.index >= 0);

  // ESPN changed its keys/labels beyond recognition: show whatever it sent.
  if (columns.length === 0) {
    columns = category.labels.map((label, index) => ({ key: `col${index}`, label, index }));
  }

  const tableColumns = [
    { key: 'name', label: section.title, width: '34%' },
    ...columns.map((c) => ({ key: c.key, label: c.label, render: (row) => row.values[c.index] })),
  ];

  const athletes = section.limit ? category.athletes.slice(0, section.limit) : category.athletes;
  const rows = athletes.map((a) => ({ id: a.id || a.name, name: a.shortName || a.name, values: a.values }));

  const totals = category.totals?.length
    ? Object.fromEntries(columns.map((c) => [c.key, category.totals[c.index] ?? '']))
    : null;

  return { columns: tableColumns, rows, totals };
};

// Team comparison rows shown above the player tables.
export const TEAM_STAT_ROWS = [
  { name: 'firstDowns', label: '1ST DOWNS' },
  { name: 'totalYards', label: 'TOTAL YDS' },
  { name: 'netPassingYards', label: 'PASS YDS' },
  { name: 'rushingYards', label: 'RUSH YDS' },
  { name: 'thirdDownEff', label: '3RD DOWN' },
  { name: 'redZoneAttempts', label: 'RED ZONE' },
  { name: 'turnovers', label: 'TURNOVERS', lowerIsBetter: true },
  { name: 'totalPenaltiesYards', label: 'PENALTIES', lowerIsBetter: true },
  { name: 'possessionTime', label: 'POSSESSION' },
];
