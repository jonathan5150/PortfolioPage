import React from 'react';

// LINES tab, only while a game is live: PREGAME or LIVE odds (LIVE first).
// Switches the moneyline / spread / total table and the win probability bar.
const LinesModeToggle = ({ mode, onChange }) => (
  <div className="bet-subtabs lines-mode-toggle" role="tablist" aria-label="Odds">
    {[
      { key: 'pregame', label: 'PREGAME' },
      { key: 'live', label: 'LIVE' },
    ].map((m) => (
      <button
        key={m.key}
        type="button"
        role="tab"
        aria-selected={mode === m.key}
        className={mode === m.key ? 'active' : ''}
        onClick={() => onChange(m.key)}
      >
        {m.label}
      </button>
    ))}
  </div>
);

export default LinesModeToggle;
