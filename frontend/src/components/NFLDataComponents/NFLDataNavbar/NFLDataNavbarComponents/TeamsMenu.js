import React from 'react';
import { getTeamBackgroundStyle, getTeamBorderColor, getTeamColor } from '../../shared/teamColors';

// The TEAMS picker: each team as a small team cell (its colour wash and
// border), checkbox and abbreviation on the left, logo on the right. Teams
// that aren't picked are greyed out.
const TeamsMenu = ({ teams, selectedTeams, onTeamChange, onSelectAll, onDeselectAll }) => (
  <div className="nfl-menu teams-menu">
    <div className="menu-buttons">
      <button type="button" className="select-button" onClick={onSelectAll}>
        ALL
      </button>
      <button type="button" className="select-button" onClick={onDeselectAll}>
        NONE
      </button>
    </div>

    <ul className="teams-menu-grid">
      {teams.map((team) => {
        const picked = selectedTeams.includes(team.id);
        const { background } = getTeamBackgroundStyle(getTeamColor(team) || 'rgba(120, 120, 120, 1)');
        return (
          <li key={team.id}>
            <label
              className={`teams-menu-cell ${picked ? '' : 'off'}`}
              style={{ '--cell-wash': background, borderColor: picked ? getTeamBorderColor(team) : undefined }}
              title={team.displayName || team.name}
            >
              <input type="checkbox" checked={picked} onChange={() => onTeamChange(team.id)} />
              <span className="teams-menu-abbr">{team.abbreviation}</span>
              {team.logo && <img src={team.logo} alt="" className="teams-menu-logo" draggable={false} />}
            </label>
          </li>
        );
      })}
    </ul>
  </div>
);

export default TeamsMenu;
