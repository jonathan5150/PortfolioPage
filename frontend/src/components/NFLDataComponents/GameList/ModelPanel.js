import React, { useState } from 'react';
import SlideOpen from '../shared/SlideOpen';
import { Filters, UNITS } from './modelFilters';

// The MODEL dropdown under each sport's games: one gold box with the filters
// always across its top (a row of small dropdowns: unit size, market,
// moneyline limit) and, under them, collapsible sections that
// are all shut when it opens.
//
// children(settings) renders the sections; settings is
// { unit, scope, filter, minOdds }. They're mounted only while the dropdown is
// open, so nothing is loaded or graded until it's opened.
// pickFilters: false shows just the unit size (UFC has no markets to filter).
export { UNITS };

const ModelPanel = ({ children, spreadLabel = 'Spread', pickFilters = true }) => {
  const [open, setOpen] = useState(false);
  const [unit, setUnit] = useState(UNITS[0]);
  const [filter, setFilter] = useState('all');
  const [minOdds, setMinOdds] = useState(null);
  return (
    <div className="gold-box prediction-record-outer model-panel">
      <div className="prediction-record">
        <button
          type="button"
          className={`bet-results-toggle gold-box-text ${open ? 'open' : ''}`}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <span className="game-section-name">
            MODEL
            <span className="gold-caret" aria-hidden="true" />
          </span>
        </button>
        <SlideOpen open={open} className="model-results-body">
          <div className="model-results-content">
            <Filters
              unit={unit}
              setUnit={setUnit}
              filter={filter}
              setFilter={setFilter}
              minOdds={minOdds}
              setMinOdds={setMinOdds}
              spreadLabel={spreadLabel}
              pickFilters={pickFilters}
            />
            {children({ unit, scope: 'all', filter, minOdds })}
          </div>
        </SlideOpen>
      </div>
    </div>
  );
};

export default ModelPanel;
