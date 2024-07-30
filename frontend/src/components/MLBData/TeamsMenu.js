import React from 'react';

const TeamsMenu = ({ teams, selectedTeams, onTeamChange, onSelectAll, onDeselectAll }) => {
  return (
    <div className="teams-menu">
      <div className="menu-buttons">
        <button className="select-button" onClick={onSelectAll}>ALL</button>
        <button className="select-button" onClick={onDeselectAll}>NONE</button>
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
              {team.abbreviation} {team.name}
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TeamsMenu;
