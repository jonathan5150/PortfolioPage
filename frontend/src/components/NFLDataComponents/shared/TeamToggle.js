import React from 'react';
import { getTeamColor, washOut } from './teamColors';

const teamAccent = (team) => washOut(getTeamColor(team) || 'rgba(120,120,120,0.6)', 0.15).replace(/[\d.]+\)$/, '1)');

// Sideways away | home picker with team logos (PLAYERS and BOX SCORE).
// `below` adds a full-width option as its own button under the two teams, e.g.
// { key: 'scoring', label: 'SCORING PLAYS' } in the box score.
const TeamToggle = ({ game, teamSide, onChange, dimmed = false, below = null }) => {
  const row = (
    <div className="search-team-toggle" role="tablist" aria-label="Team">
      {['away', 'home'].map((side) => {
        const team = game[side]?.team;
        const active = teamSide === side && !dimmed;
        return (
          <button
            key={side}
            type="button"
            role="tab"
            aria-selected={teamSide === side}
            className={active ? 'active' : ''}
            onClick={() => onChange(side)}
            // only the selected button is outlined (team colour)
            style={active ? { borderColor: teamAccent(team) } : undefined}
          >
            {team?.logo && <img src={team.logo} alt="" draggable={false} />}
            {team?.abbreviation}
          </button>
        );
      })}
    </div>
  );
  if (!below) return row;

  const active = teamSide === below.key && !dimmed;
  return (
    <div className="team-toggle-stack">
      {row}
      <button
        type="button"
        role="tab"
        aria-selected={teamSide === below.key}
        className={`team-toggle-below ${active ? 'active' : ''}`}
        onClick={() => onChange(below.key)}
      >
        {below.label}
      </button>
    </div>
  );
};

export default TeamToggle;
