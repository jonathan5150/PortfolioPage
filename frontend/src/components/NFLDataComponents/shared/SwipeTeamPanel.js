import React, { useRef } from 'react';
import { getTeamBackgroundStyle, getTeamColor } from './teamColors';
import { viewportStyle } from './tableStyles';

// Two side-by-side team panes (away / home). Tap the arrow or swipe to switch.
// Used by the box score, season stats and game log panels.
export const TeamHeader = ({ team, showing, onToggle, rounded = true }) => (
  <div style={{ position: 'relative', overflow: 'hidden' }}>
    <div
      style={{
        ...getTeamBackgroundStyle(getTeamColor(team)),
        borderRadius: rounded ? '8px 8px 0 0' : '0',
      }}
    />
    <h3
      style={{
        margin: 0,
        display: 'flex',
        padding: '5px 0',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        zIndex: 2,
        fontWeight: 300,
        fontSize: '14px',
        lineHeight: 1,
        color: '#fff',
        background: 'transparent',
      }}
    >
      {team?.displayName || team?.abbreviation || ''}
      {onToggle && (
        <button
          type="button"
          aria-label="Switch team"
          onClick={onToggle}
          style={{
            position: 'absolute',
            right: '0.5rem',
            fontSize: '0.6rem',
            background: 'transparent',
            color: 'white',
            transform: showing === 'away' ? 'scaleX(1)' : 'scaleX(-1)',
            transition: 'transform 0.3s',
            border: 'none',
            cursor: 'pointer',
            padding: '4px 6px',
          }}
        >
          ▶
        </button>
      )}
    </h3>
  </div>
);

const SwipeTeamPanel = ({ awayTeam, homeTeam, showing, onShowingChange, renderSide }) => {
  const touchStartX = useRef(null);

  const setShowing = (next) => {
    if (next !== showing) onShowingChange(next);
  };
  const toggle = () => setShowing(showing === 'away' ? 'home' : 'away');

  const handleTouchStart = (e) => {
    // Let wide tables scroll sideways without flipping teams.
    const scroller = e.target.closest?.('.stat-table-scroll');
    if (scroller && scroller.scrollWidth > scroller.clientWidth + 1) {
      touchStartX.current = null;
      return;
    }
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchMove = (e) => {
    if (touchStartX.current === null) return;
    const delta = e.touches[0].clientX - touchStartX.current;
    if (delta > 40 && showing === 'home') {
      setShowing('away');
      touchStartX.current = null;
    } else if (delta < -40 && showing === 'away') {
      setShowing('home');
      touchStartX.current = null;
    }
  };
  const handleTouchEnd = () => {
    touchStartX.current = null;
  };

  const pane = (side, team) => (
    <div style={{ flex: '0 0 50%', maxWidth: '50%', minWidth: 0 }} aria-hidden={showing !== side}>
      <TeamHeader team={team} showing={showing} onToggle={toggle} />
      {renderSide(side, team)}
    </div>
  );

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={viewportStyle}
    >
      <div
        style={{
          display: 'flex',
          width: '200%',
          alignItems: 'flex-start',
          transform: showing === 'away' ? 'translateX(0%)' : 'translateX(-50%)',
          transition: 'transform 0.4s ease',
        }}
      >
        {pane('away', awayTeam)}
        {pane('home', homeTeam)}
      </div>
    </div>
  );
};

export default SwipeTeamPanel;
