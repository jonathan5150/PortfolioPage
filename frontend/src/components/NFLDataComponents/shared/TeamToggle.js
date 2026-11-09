import React from 'react';
import { getTeamBorderColor, getTeamColor, washOut } from './teamColors';

const teamAccent = (team) => washOut(getTeamColor(team) || 'rgba(120,120,120,0.6)', 0.15).replace(/[\d.]+\)$/, '1)');
// BOX SCORE (`filled`): the selected team gets its team-cell border and a
// slightly darker shade of the team colour inside.
const teamFill = (team) => {
  const [r, g, b] = (getTeamColor(team) || 'rgba(120,120,120,1)').match(/[\d.]+/g).map(Number);
  const dark = (v) => Math.round(v * 0.72);
  return `rgba(${dark(r)}, ${dark(g)}, ${dark(b)}, 0.92)`;
};

// Sideways away | home picker with team logos (TD ODDS and BOX SCORE).
// `below` adds a full-width option as its own button under the two teams, e.g.
// { key: 'scoring', label: 'SCORING PLAYS' } in the box score.
// `filled` (BOX SCORE): every button has a plain grey border; the selected one
// takes its colour (team-cell border and a darker team fill, or gold for the
// `below` one).
const TeamToggle = ({ game, teamSide, onChange, dimmed = false, below = null, filled = false }) => {
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
            // only the selected button is coloured
            style={
              active
                ? filled
                  ? { borderColor: getTeamBorderColor(team), background: teamFill(team) }
                  : { borderColor: teamAccent(team) }
                : undefined
            }
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
        className={`team-toggle-below ${filled ? 'filled' : ''} ${active ? 'active' : ''}`}
        onClick={() => onChange(below.key)}
      >
        {below.label}
      </button>
    </div>
  );
};

export default TeamToggle;
