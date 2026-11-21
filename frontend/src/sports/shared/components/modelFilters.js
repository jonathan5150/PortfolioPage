import React from 'react';

// The MODEL dropdown's filters (see ModelPanel): one row of small dropdowns at
// the top: the unit size, which market, and the moneyline limit. They change
// the results and the season totals.

export const UNITS = [10, 25, 50, 100];

// Every pick is a flat bet (the unit size) at its pregame price.
// betsOption adds BETS ONLY (the NBA: only the picks marked as bets, all markets).
export const betFilters = (spreadLabel, betsOption = false) => [
  { key: 'all', label: 'ALL' },
  ...(betsOption ? [{ key: 'bets', label: 'BETS ONLY' }] : []),
  { key: 'winner', label: 'MONEYLINE' },
  { key: 'spread', label: spreadLabel.toUpperCase() },
  { key: 'total', label: 'O/U' },
];

// Minimum moneyline odds: with -300 picked, a moneyline bet on a team priced
// worse than -300 (say -900) is skipped. Spreads and totals are unaffected.
export const MIN_ODDS = [null, -200, -300, -500];
export const allowed = (bet, minOdds) => !(minOdds && bet.key === 'winner' && bet.price < minOdds);

// Which picks a record counts: 'all' (every pick) or 'bets' (only the picks
// marked as bets: the NBA's edge bets, chosen with the BETS ONLY market)
export const inScope = (bets, scope = 'all') => (bets || []).filter((b) => scope === 'all' || b.bet);

// One filter: its title above a gold box showing the current choice; tapping
// the box opens the phone's own list to pick from. Values are kept as strings
// in the <select> and turned back into the option's key.
const FilterSelect = ({ title, options, value, onChange }) => (
  <label className="model-filter">
    <span className="model-filter-title">{title}</span>
    <span className="model-filter-box">
      <select
        value={String(value)}
        onChange={(e) => onChange(options.find((o) => String(o.key) === e.target.value).key)}
      >
        {options.map((o) => (
          <option key={String(o.key)} value={String(o.key)}>
            {o.label}
          </option>
        ))}
      </select>
      <span className="bet-results-caret" aria-hidden="true" />
    </span>
  </label>
);

// The row of filters. pickFilters: false shows just the unit size (UFC).
export const Filters = ({
  unit,
  setUnit,
  filter,
  setFilter,
  minOdds,
  setMinOdds,
  spreadLabel,
  pickFilters = true,
  betsOption = false,
}) => (
  <div className={`model-filters ${pickFilters ? '' : 'unit-only'}`}>
    <FilterSelect
      title="UNIT"
      options={UNITS.map((u) => ({ key: u, label: `$${u}` }))}
      value={unit}
      onChange={setUnit}
    />
    {pickFilters && (
      <>
        <FilterSelect title="MARKET" options={betFilters(spreadLabel, betsOption)} value={filter} onChange={setFilter} />
        <FilterSelect
          title="ML LIMIT"
          options={MIN_ODDS.map((odds) => ({ key: odds, label: odds === null ? 'OFF' : String(odds) }))}
          value={minOdds}
          onChange={setMinOdds}
        />
      </>
    )}
  </div>
);
