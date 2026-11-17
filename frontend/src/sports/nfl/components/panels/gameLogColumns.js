// Game log columns per position. `stat` names are ESPN game log stat names.

const dateColumn = {
  key: 'date',
  label: 'DATE',
  width: '15%',
  render: (g) => (g.date ? new Date(g.date).toLocaleDateString([], { month: 'numeric', day: 'numeric' }) : `W${g.week ?? ''}`),
};
const oppColumn = {
  key: 'opp',
  label: 'OPP',
  width: '13%',
  render: (g) => `${g.atVs === '@' ? '@' : ''}${g.opponentAbbr}`,
};
const resultColumn = {
  key: 'res',
  label: 'RES',
  width: '9%',
  render: (g) => g.result || '',
};

const stat = (key, label, statName, opts = {}) => ({ key, label, stat: statName, ...opts });

export const GAME_LOG_COLUMNS = {
  QB: [
    stat('cmpAtt', 'C/A', null, {
      width: '56px',
      render: (g) =>
        g.stats.completions === null && g.stats.passingAttempts === null
          ? '—'
          : `${g.stats.completions ?? 0}/${g.stats.passingAttempts ?? 0}`,
      average: (games) => {
        const c = games.reduce((t, g) => t + (g.stats.completions ?? 0), 0);
        const a = games.reduce((t, g) => t + (g.stats.passingAttempts ?? 0), 0);
        // whole numbers keep the column narrow on phones
        return `${Math.round(c / games.length)}/${Math.round(a / games.length)}`;
      },
    }),
    stat('passYds', 'YDS', 'passingYards'),
    stat('passTd', 'TD', 'passingTouchdowns'),
    stat('int', 'INT', 'interceptions'),
    stat('rtg', 'RTG', 'QBRating', { decimals: 1 }),
    stat('car', 'CAR', 'rushingAttempts'),
    stat('rushYds', 'RYDS', 'rushingYards'),
  ],
  RB: [
    stat('car', 'CAR', 'rushingAttempts'),
    stat('rushYds', 'YDS', 'rushingYards'),
    stat('ypc', 'AVG', 'yardsPerRushAttempt', { decimals: 1 }),
    stat('rushTd', 'TD', 'rushingTouchdowns'),
    stat('rec', 'REC', 'receptions'),
    stat('recYds', 'RECY', 'receivingYards'),
    stat('tgt', 'TGT', 'receivingTargets'),
  ],
  WR: [
    stat('tgt', 'TGT', 'receivingTargets'),
    stat('rec', 'REC', 'receptions'),
    stat('recYds', 'YDS', 'receivingYards'),
    stat('ypr', 'AVG', 'yardsPerReception', { decimals: 1 }),
    stat('recTd', 'TD', 'receivingTouchdowns'),
    stat('lng', 'LNG', 'longReception'),
  ],
};
GAME_LOG_COLUMNS.FB = GAME_LOG_COLUMNS.RB;
GAME_LOG_COLUMNS.TE = GAME_LOG_COLUMNS.WR;

const fmt = (value, decimals) => {
  if (value === null || value === undefined) return '—';
  return decimals ? Number(value).toFixed(decimals) : value;
};

// Builds StatTable columns (date/opp/result + position stats) and an average row.
export const buildGameLogTable = (position, games) => {
  const statColumns = GAME_LOG_COLUMNS[position] || GAME_LOG_COLUMNS.WR;

  const columns = [
    dateColumn,
    oppColumn,
    resultColumn,
    ...statColumns.map((c) => ({
      key: c.key,
      label: c.label,
      width: c.width,
      render: c.render || ((g) => fmt(g.stats[c.stat], c.decimals)),
    })),
  ];

  const averages = { date: 'AVG' };
  if (games.length) {
    statColumns.forEach((c) => {
      if (c.average) {
        averages[c.key] = c.average(games);
        return;
      }
      const values = games.map((g) => g.stats[c.stat]).filter((v) => v !== null && v !== undefined);
      averages[c.key] = values.length ? (values.reduce((t, v) => t + v, 0) / values.length).toFixed(1) : '—';
    });
  }

  return { columns, averages, minWidth: position === 'QB' ? 470 : 430 };
};
