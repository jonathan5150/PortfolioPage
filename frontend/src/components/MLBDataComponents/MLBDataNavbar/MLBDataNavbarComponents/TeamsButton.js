import React from 'react';

const TeamsButton = ({ onClick, isOpen, setIsCalendarOpen }) => {
  return (
    <button
      className="teams-button custom-datepicker-input"
      onClick={() => {
        onClick();
        setIsCalendarOpen(false);
      }}
      type="button"
    >
      TEAMS <span className={`arrow ${isOpen ? 'open' : 'closed'}`}>▼</span>
    </button>
  );
};

export default TeamsButton;