import React from 'react';
import { getTeamColor, washOut } from '../shared/teamColors';

// Quarter-by-quarter scoreboard (the NFL version of the MLB inning grid).

const periodLabel = (i) => (i < 4 ? String(i + 1) : i === 4 ? 'OT' : `OT${i - 3}`);

const accent = (team) => washOut(getTeamColor(team) || 'rgba(120,120,120,0.6)', 0.15).replace(/[\d.]+\)$/, '1)');

const Linescore = ({ game }) => {
  const away = game.away;
  const home = game.home;
  const periods = Math.max(4, away?.linescores?.length || 0, home?.linescores?.length || 0);
  const labels = Array.from({ length: periods }, (_, i) => periodLabel(i));
  const state = game.status.state;
  const started = state !== 'pre';
  const currentIndex = state === 'in' ? (game.status.period || 1) - 1 : -1;
  const columns = `minmax(64px, 1.6fr) repeat(${periods}, minmax(0, 1fr)) minmax(40px, 1.1fr)`;

  const row = (competitor, other) => {
    const leading = started && (competitor?.score ?? 0) > (other?.score ?? 0);
    const won = state === 'post' ? competitor?.winner : leading;
    return (
      <div className={`linescore-row ${won ? 'leading' : ''}`} style={{ gridTemplateColumns: columns }}>
        <div className="linescore-team" style={{ '--team-accent': accent(competitor?.team) }}>
          {competitor?.team?.logo && <img src={competitor.team.logo} alt="" className="linescore-logo" draggable={false} />}
          <span>{competitor?.team?.abbreviation}</span>
        </div>
        {labels.map((label, i) => {
          const value = competitor?.linescores?.[i];
          const played = value !== undefined && value !== null;
          return (
            <div
              key={label}
              className={`linescore-cell ${i === currentIndex ? 'current' : ''} ${played && value > 0 ? 'scored' : ''}`}
            >
              {played ? value : '–'}
            </div>
          );
        })}
        <div className="linescore-total">{started ? competitor?.score ?? 0 : '–'}</div>
      </div>
    );
  };

  return (
    <div className="linescore">
      <div className="linescore-row linescore-head" style={{ gridTemplateColumns: columns }}>
        <div className="linescore-team" />
        {labels.map((label, i) => (
          <div key={label} className={`linescore-cell ${i === currentIndex ? 'current' : ''}`}>
            {label}
          </div>
        ))}
        <div className="linescore-total">T</div>
      </div>
      {row(away, home)}
      {row(home, away)}
    </div>
  );
};

export default Linescore;
