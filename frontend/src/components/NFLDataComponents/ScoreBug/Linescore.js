import React from 'react';

// Quarter-by-quarter scoreboard (the NFL version of the MLB inning grid).
const Linescore = ({ game }) => {
  const away = game.away;
  const home = game.home;
  const periods = Math.max(4, away?.linescores?.length || 0, home?.linescores?.length || 0);
  const labels = Array.from({ length: periods }, (_, i) => (i < 4 ? String(i + 1) : i === 4 ? 'OT' : `OT${i - 3}`));
  const started = game.status.state !== 'pre';

  const row = (competitor, rowIndex) => (
    <div className="scoreboard-row" key={competitor?.teamId || rowIndex}>
      <div className="scoreboard-cell team-abbr" style={{ animationDelay: '0.1s' }}>
        {competitor?.team?.abbreviation}
      </div>
      {labels.map((_, i) => (
        <div key={i} className="scoreboard-cell inning" style={{ animationDelay: `${(i + 1) * 0.1}s` }}>
          {competitor?.linescores?.[i] ?? '-'}
        </div>
      ))}
      <div className="scoreboard-cell runs" style={{ fontWeight: 'bold', animationDelay: '0.8s' }}>
        {started ? competitor?.score ?? 0 : '-'}
      </div>
    </div>
  );

  return (
    <div className="scoreboard">
      <div className="scoreboard-row scoreboard-header">
        <div className="scoreboard-cell team-abbr" />
        {labels.map((label, i) => (
          <div key={label} className="scoreboard-cell inning" style={{ animationDelay: `${i * 0.1}s` }}>
            {label}
          </div>
        ))}
        <div className="scoreboard-cell runs" style={{ animationDelay: '0.8s' }}>
          T
        </div>
      </div>
      {row(away, 0)}
      {row(home, 1)}
    </div>
  );
};

export default Linescore;
