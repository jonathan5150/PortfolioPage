import React from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import TeamsButton from './TeamsButton';
import TeamsMenu from './TeamsMenu';

const CustomInput = React.forwardRef(({ value, onClick, isCalendarOpen, setIsCalendarOpen, setIsTeamsMenuOpen }, ref) => {
  return (
    <button className="custom-datepicker-input" onClick={() => {
      onClick();
      setIsCalendarOpen(!isCalendarOpen);
      setIsTeamsMenuOpen(false);
    }} ref={ref}>
      {value} <span className={`arrow ${isCalendarOpen ? 'open' : 'closed'}`}>▼</span>
    </button>
  );
});

const MLBDataNavbar = ({ selectedDate, setSelectedDate, isCalendarOpen, setIsCalendarOpen, isTeamsMenuOpen, setIsTeamsMenuOpen, mlbTeams, selectedTeams, handleTeamChange, handleSelectAll, handleDeselectAll, teamsMenuRef }) => {
  return (
    <div className="mlbDataNavbar">
      <h2>MLB DATA PROJECT</h2>
      <div className="controls">
        <TeamsButton onClick={() => setIsTeamsMenuOpen(!isTeamsMenuOpen)} isOpen={isTeamsMenuOpen} setIsCalendarOpen={setIsCalendarOpen} />
        {isTeamsMenuOpen && (
          <div ref={teamsMenuRef}>
            <TeamsMenu
              teams={mlbTeams}
              selectedTeams={selectedTeams}
              onTeamChange={handleTeamChange}
              onSelectAll={handleSelectAll}
              onDeselectAll={handleDeselectAll}
            />
          </div>
        )}
        <div className="custom-datepicker-input">
          <DatePicker
            selected={selectedDate}
            onChange={(date) => {
              setSelectedDate(date);
              setIsCalendarOpen(false);
            }}
            dateFormat="M/d/yyyy"
            customInput={<CustomInput isCalendarOpen={isCalendarOpen} setIsCalendarOpen={setIsCalendarOpen} setIsTeamsMenuOpen={setIsTeamsMenuOpen} />}
            onCalendarOpen={() => setIsCalendarOpen(true)}
            onCalendarClose={() => setIsCalendarOpen(false)}
            preventOpenOnFocus
          />
        </div>
      </div>
    </div>
  );
};

export default MLBDataNavbar;
