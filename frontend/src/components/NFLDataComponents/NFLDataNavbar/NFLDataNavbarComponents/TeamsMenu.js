import React from 'react';

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

    <ul>
      {teams.map((team) => (
        <li key={team.id}>
          <label>
            <input
              type="checkbox"
              checked={selectedTeams.includes(team.id)}
              onChange={() => onTeamChange(team.id)}
            />
            {team.logo && <img src={team.logo} alt="" className="menu-team-logo" />}
            {team.abbreviation} {team.name}
          </label>
        </li>
      ))}
    </ul>
  </div>
);

export default TeamsMenu;
