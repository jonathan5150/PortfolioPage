// Column definitions for the season stats tables, grouped by position view.
// Rows are the normalized season lines produced by the data layer.

const ratio = (a, b, digits = 1) => (b ? (a / b).toFixed(digits) : '—');
const pct = (a, b) => (b ? `${((a / b) * 100).toFixed(1)}` : '—');

// Official NFL passer rating.
export const passerRating = ({ completions, attempts, yards, touchdowns, interceptions }) => {
  if (!attempts) return null;
  const clamp = (x) => Math.max(0, Math.min(2.375, x));
  const a = clamp((completions / attempts - 0.3) * 5);
  const b = clamp((yards / attempts - 3) * 0.25);
  const c = clamp((touchdowns / attempts) * 20);
  const d = clamp(2.375 - (interceptions / attempts) * 25);
  return ((a + b + c + d) / 6) * 100;
};

const nameColumn = { key: 'name', label: 'PLAYER', width: '120px', render: (r) => `${r.name}`, sortValue: (r) => r.name.split(' ').slice(-1)[0] };

export const SEASON_VIEWS = {
  qb: {
    label: 'QB',
    filter: (r) =>
      (r.position === 'QB' && (r.passing.attempts > 0 || r.rushing.attempts > 0)) || r.passing.attempts >= 10,
    defaultSort: { key: 'passYds', direction: 'desc' },
    minWidth: 540,
    columns: [
      nameColumn,
      { key: 'games', label: 'G', render: (r) => r.games, sortValue: (r) => r.games },
      { key: 'cmpAtt', label: 'C/A', width: '64px', render: (r) => `${r.passing.completions}/${r.passing.attempts}`, sortValue: (r) => r.passing.completions / (r.passing.attempts || 1) },
      { key: 'passYds', label: 'YDS', render: (r) => r.passing.yards, sortValue: (r) => r.passing.yards },
      { key: 'passTd', label: 'TD', render: (r) => r.passing.touchdowns, sortValue: (r) => r.passing.touchdowns },
      { key: 'int', label: 'INT', render: (r) => r.passing.interceptions, sortValue: (r) => r.passing.interceptions },
      { key: 'rating', label: 'RTG', render: (r) => passerRating(r.passing)?.toFixed(1) ?? '—', sortValue: (r) => passerRating(r.passing) ?? -1 },
      { key: 'car', label: 'CAR', render: (r) => r.rushing.attempts, sortValue: (r) => r.rushing.attempts },
      { key: 'rushYds', label: 'RYDS', render: (r) => r.rushing.yards, sortValue: (r) => r.rushing.yards },
      { key: 'rushTd', label: 'RTD', render: (r) => r.rushing.touchdowns, sortValue: (r) => r.rushing.touchdowns },
    ],
  },
  rb: {
    label: 'RB',
    filter: (r) => ['RB', 'FB'].includes(r.position) && (r.rushing.attempts > 0 || r.receiving.receptions > 0),
    defaultSort: { key: 'rushYds', direction: 'desc' },
    minWidth: 520,
    columns: [
      nameColumn,
      { key: 'games', label: 'G', render: (r) => r.games, sortValue: (r) => r.games },
      { key: 'car', label: 'CAR', render: (r) => r.rushing.attempts, sortValue: (r) => r.rushing.attempts },
      { key: 'rushYds', label: 'YDS', render: (r) => r.rushing.yards, sortValue: (r) => r.rushing.yards },
      { key: 'ypc', label: 'AVG', render: (r) => ratio(r.rushing.yards, r.rushing.attempts), sortValue: (r) => (r.rushing.attempts ? r.rushing.yards / r.rushing.attempts : -1) },
      { key: 'rushTd', label: 'TD', render: (r) => r.rushing.touchdowns, sortValue: (r) => r.rushing.touchdowns },
      { key: 'rec', label: 'REC', render: (r) => r.receiving.receptions, sortValue: (r) => r.receiving.receptions },
      { key: 'recYds', label: 'RECY', render: (r) => r.receiving.yards, sortValue: (r) => r.receiving.yards },
      { key: 'recTd', label: 'RECTD', render: (r) => r.receiving.touchdowns, sortValue: (r) => r.receiving.touchdowns },
      { key: 'fum', label: 'FUM', render: (r) => r.fumblesLost, sortValue: (r) => r.fumblesLost },
    ],
  },
  wr: {
    label: 'WR / TE',
    filter: (r) => ['WR', 'TE'].includes(r.position) && (r.receiving.targets > 0 || r.receiving.receptions > 0),
    defaultSort: { key: 'recYds', direction: 'desc' },
    minWidth: 500,
    columns: [
      { ...nameColumn, render: (r) => `${r.name} (${r.position})` },
      { key: 'games', label: 'G', render: (r) => r.games, sortValue: (r) => r.games },
      { key: 'tgt', label: 'TGT', render: (r) => r.receiving.targets || '—', sortValue: (r) => r.receiving.targets },
      { key: 'rec', label: 'REC', render: (r) => r.receiving.receptions, sortValue: (r) => r.receiving.receptions },
      { key: 'recYds', label: 'YDS', render: (r) => r.receiving.yards, sortValue: (r) => r.receiving.yards },
      { key: 'ypr', label: 'AVG', render: (r) => ratio(r.receiving.yards, r.receiving.receptions), sortValue: (r) => (r.receiving.receptions ? r.receiving.yards / r.receiving.receptions : -1) },
      { key: 'recTd', label: 'TD', render: (r) => r.receiving.touchdowns, sortValue: (r) => r.receiving.touchdowns },
      { key: 'ypg', label: 'Y/G', render: (r) => ratio(r.receiving.yards, r.games), sortValue: (r) => (r.games ? r.receiving.yards / r.games : -1) },
      { key: 'catch', label: 'CTCH%', render: (r) => pct(r.receiving.receptions, r.receiving.targets), sortValue: (r) => (r.receiving.targets ? r.receiving.receptions / r.receiving.targets : -1) },
    ],
  },
};

export const sortRows = (rows, columns, sort) => {
  const column = columns.find((c) => c.key === sort?.key) || columns[1];
  const dir = sort?.direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = column.sortValue ? column.sortValue(a) : a[column.key];
    const bv = column.sortValue ? column.sortValue(b) : b[column.key];
    if (typeof av === 'string' || typeof bv === 'string') return String(av).localeCompare(String(bv)) * dir;
    return ((av ?? 0) - (bv ?? 0)) * dir;
  });
};
