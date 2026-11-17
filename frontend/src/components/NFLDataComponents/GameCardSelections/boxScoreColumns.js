// Which ESPN box score columns to show per category (a subset that fits on a phone).
// `keys` are ESPN stat keys; `labels` are fallbacks if ESPN renames a key.
// Every section has six columns so they all line up under each other; where
// ESPN sends only five, `derive(values, at)` works one out from the others
// (at(key) -> the index of one of ESPN's columns, or -1).

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
// '3/4' -> [3, 4]
const madeOf = (v) => {
  const [made, att] = String(v ?? '').split('/').map(Number);
  return Number.isFinite(made) && Number.isFinite(att) ? [made, att] : null;
};
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
      // SHR: the share of the team's carries he had
      {
        key: 'carryShare',
        label: 'SHR',
        derive: (values, at, totals) => {
          const i = at('rushingAttempts');
          const mine = num(values[i]);
          const team = num(totals?.[i]);
          return mine !== null && team ? `${Math.round((mine / team) * 100)}%` : null;
        },
      },
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
    category: 'kicking',
    title: 'KICKING',
    columns: [
      { key: 'fieldGoalsMade/fieldGoalAttempts', label: 'FG', labels: ['FG'] },
      { key: 'fieldGoalPct', label: 'PCT', labels: ['PCT'] },
      { key: 'longFieldGoalMade', label: 'LNG', labels: ['LONG'] },
      { key: 'extraPointsMade/extraPointAttempts', label: 'XP', labels: ['XP'] },
      // field goals and extra points missed
      {
        key: 'kicksMissed',
        label: 'MISS',
        derive: (values, at) => {
          const fg = madeOf(values[at('fieldGoalsMade/fieldGoalAttempts')]);
          const xp = madeOf(values[at('extraPointsMade/extraPointAttempts')]);
          if (!fg && !xp) return null;
          return (fg ? fg[1] - fg[0] : 0) + (xp ? xp[1] - xp[0] : 0);
        },
      },
      { key: 'totalKickingPoints', label: 'PTS', labels: ['PTS'] },
    ],
  },
];

// Returns the index into ESPN's stats array for a configured column, or -1.
export const resolveColumnIndex = (category, column) => {
  if (column.derive) return -1;
  const byKey = category.keys.indexOf(column.key);
  if (byKey >= 0) return byKey;
  return category.labels.findIndex((l) => column.labels.includes(String(l).toUpperCase()));
};

// Turn an ESPN category + our config into StatTable columns and rows.
export const buildCategoryTable = (category, section) => {
  const at = (key) => category.keys.indexOf(key);
  // the team's line: ESPN's, or the players' counts added up
  const teamTotals = category.totals?.length
    ? category.totals
    : category.keys.map((_, i) =>
        category.athletes.reduce((sum, a) => (num(a.values[i]) === null ? sum : sum + num(a.values[i])), 0),
      );
  let columns = section.columns
    .map((c) => ({ ...c, index: resolveColumnIndex(category, c) }))
    .filter((c) => c.index >= 0 || c.derive);

  // ESPN changed its keys/labels beyond recognition: show whatever it sent.
  if (!columns.some((c) => c.index >= 0)) {
    columns = category.labels.map((label, index) => ({ key: `col${index}`, label, index }));
  }
  const valueOf = (c, values) => (c.derive ? c.derive(values, at, teamTotals) : values[c.index]);

  const tableColumns = [
    { key: 'name', label: section.title, width: '34%' },
    ...columns.map((c) => ({ key: c.key, label: c.label, render: (row) => valueOf(c, row.values) })),
  ];

  const athletes = section.limit ? category.athletes.slice(0, section.limit) : category.athletes;
  const rows = athletes.map((a) => ({ id: a.id || a.name, name: a.shortName || a.name, values: a.values }));

  const totals = category.totals?.length
    ? Object.fromEntries(columns.map((c) => [c.key, valueOf(c, category.totals) ?? '']))
    : null;

  return { columns: tableColumns, rows, totals };
};
