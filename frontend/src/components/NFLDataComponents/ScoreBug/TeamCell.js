import React, { useCallback, useEffect, useRef } from 'react';
import { getTeamBackgroundStyle, getTeamColor, getTeamBorderColor } from '../shared/teamColors';

// Long-press a team to "star" it (your pick), same gesture as the MLB app.
export const useLongPress = (onLongPress, delay = 600) => {
  const timerRef = useRef(null);
  const triggeredRef = useRef(false);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => clear, [clear]);

  const start = useCallback(
    (payload) => {
      clear();
      triggeredRef.current = false;
      timerRef.current = setTimeout(() => {
        triggeredRef.current = true;
        timerRef.current = null;
        onLongPress?.(payload);
      }, delay);
    },
    [clear, delay, onLongPress]
  );

  // Swallow the click that follows a long press so the card doesn't toggle.
  const suppressClick = useCallback((e) => {
    if (triggeredRef.current) {
      e.preventDefault();
      e.stopPropagation();
      triggeredRef.current = false;
    }
  }, []);

  return { start, clear, suppressClick };
};

const TeamCell = ({
  competitor,
  side,
  score,
  isStarred,
  hasPossession,
  isWinner,
  dimmed,
  corner = 'top',
  longPress,
}) => {
  const team = competitor?.team;
  const radius =
    corner === 'all'
      ? side === 'away'
        ? '6px 0 0 6px'
        : '0 6px 6px 0'
      : side === 'away'
        ? '6px 0 0 0'
        : '0 6px 0 0';

  return (
    <div
      className="team-cell"
      onPointerDown={() => longPress?.start(competitor?.teamId)}
      onPointerUp={() => longPress?.clear()}
      onPointerLeave={() => longPress?.clear()}
      onPointerCancel={() => longPress?.clear()}
      onContextMenu={(e) => e.preventDefault()}
      style={{ display: 'flex', position: 'relative', margin: '2px' }}
    >
      <div style={{ ...getTeamBackgroundStyle(getTeamColor(team)), borderRadius: radius }} />

      <div
        className="team-info-container"
        style={{
          border: isStarred ? '2px solid #c49410' : `2px solid ${getTeamBorderColor(team)}`,
          borderRadius: radius,
          overflow: 'hidden',
          opacity: dimmed ? 0.6 : 1,
        }}
      >
        {team?.logo && (
          <img
            src={team.logo}
            alt=""
            aria-hidden="true"
            className={`team-logo-watermark ${side}`}
            draggable={false}
          />
        )}

        <div className="team-abbr-block" title={team?.displayName}>
          <div className="abbreviation">
            {team?.abbreviation}
            {hasPossession && <span className="possession-ball" title="Possession">●</span>}
          </div>
          <div className="team-record">{competitor?.record || '0-0'}</div>
        </div>

        <div className={`team-score ${isWinner ? 'winner' : ''}`}>{score}</div>
      </div>
    </div>
  );
};

export default TeamCell;
