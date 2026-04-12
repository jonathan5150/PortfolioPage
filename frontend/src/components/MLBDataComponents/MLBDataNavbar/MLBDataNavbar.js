import React from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import TeamsButton from './MLBDataNavbarComponents/TeamsButton';
import TeamsMenu from './MLBDataNavbarComponents/TeamsMenu';

const MLBDataNavbar = ({
  selectedDate,
  setSelectedDate,
  isCalendarOpen,
  setIsCalendarOpen,
  isTeamsMenuOpen,
  setIsTeamsMenuOpen,
  mlbTeams,
  selectedTeams,
  handleTeamChange,
  handleSelectAll,
  handleDeselectAll,
  teamsMenuRef,
}) => {
  const calendarRef = React.useRef(null);

  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target)) {
        setIsCalendarOpen(false);
      }
    };

    if (isCalendarOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isCalendarOpen, setIsCalendarOpen]);

  const formattedDate = selectedDate
    ? `${selectedDate.getMonth() + 1}/${selectedDate.getDate()}/${selectedDate.getFullYear()}`
    : '';

  return (
    <div className="mlbDataNavbar">
      <div className="logo-text-overlay">MLB Stats Guide</div>

      <div className="controls">
        <div className="teams-dropdown-wrapper" ref={teamsMenuRef}>
          <TeamsButton
            onClick={() => {
              setIsTeamsMenuOpen((prev) => !prev);
              setIsCalendarOpen(false);
            }}
            isOpen={isTeamsMenuOpen}
            setIsCalendarOpen={setIsCalendarOpen}
          />

          {isTeamsMenuOpen && (
            <div className="teams-dropdown-menu">
              <TeamsMenu
                teams={mlbTeams}
                selectedTeams={selectedTeams}
                onTeamChange={handleTeamChange}
                onSelectAll={handleSelectAll}
                onDeselectAll={handleDeselectAll}
              />
            </div>
          )}
        </div>

        <div
          className="datepicker-wrapper"
          ref={calendarRef}
          style={{ position: 'relative' }}
        >
          <button
            className="custom-datepicker-input"
            type="button"
            onClick={() => {
              setIsTeamsMenuOpen(false);
              setIsCalendarOpen((prev) => !prev);
            }}
          >
            {formattedDate}{' '}
            <span className={`arrow ${isCalendarOpen ? 'open' : 'closed'}`}>▼</span>
          </button>

          {isCalendarOpen && (
            <div
              className="calendar-popup"
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                left: -110,
                zIndex: 1000,
              }}
            >
              <DatePicker
                selected={selectedDate}
                onChange={(date) => {
                  setSelectedDate(date);
                  setIsCalendarOpen(false);
                }}
                inline
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MLBDataNavbar;