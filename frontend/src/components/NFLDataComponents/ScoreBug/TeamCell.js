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

// Per-team tweaks for the faded background logo. --wm-opacity is the logo's
// resting opacity (it brightens from there while the game is open).
const WATERMARK_STYLE = {
  NYJ: { filter: 'grayscale(1) brightness(2.8)', '--wm-opacity': 0.5 },
  LAR: { filter: 'grayscale(1) brightness(2.6) sepia(1) saturate(4.5) hue-rotate(12deg)', '--wm-opacity': 0.42 },
};

// A team that lost a final game goes fully gray (color wash, border and logo).
const LOSER_WATERMARK = { filter: 'grayscale(1) brightness(0.8)', '--wm-opacity': 0.3 };

// While a game's card is open its logos grow and brighten; they settle back when it closes.
const LOSER_BORDER = 'rgb(110, 110, 110)';

const TeamCell = ({
  competitor,
  side,
  score,
  scoreIsSpread,
  subScore,
  isStarred,
  hasPossession,
  isWinner,
  dimmed,
  corner = 'top',
  longPress,
  expanded = false,
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
      className={`team-cell ${expanded ? 'expanded' : ''}`}
      onPointerDown={() => longPress?.start(competitor?.teamId)}
      onPointerUp={() => longPress?.clear()}
      onPointerLeave={() => longPress?.clear()}
      onPointerCancel={() => longPress?.clear()}
      onContextMenu={(e) => e.preventDefault()}
      style={{ display: 'flex', position: 'relative', margin: '2px' }}
    >
      <div
        style={{
          ...getTeamBackgroundStyle(getTeamColor(team)),
          borderRadius: radius,
          ...(dimmed ? { filter: 'grayscale(1)' } : null),
        }}
      />

      <div
        className="team-info-container"
        style={{
          border: isStarred
            ? '2px solid #c49410'
            : `2px solid ${dimmed ? LOSER_BORDER : getTeamBorderColor(team)}`,
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
            style={dimmed ? LOSER_WATERMARK : WATERMARK_STYLE[team.abbreviation]}
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

        <div className={`team-score ${isWinner ? 'winner' : ''} ${scoreIsSpread ? 'spread' : ''}`}>
          {score}
          {subScore && <div className="team-moneyline">{subScore}</div>}
        </div>
      </div>
    </div>
  );
};

export default TeamCell;
