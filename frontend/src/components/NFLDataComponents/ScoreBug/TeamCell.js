import React, { useCallback, useEffect, useRef } from 'react';
import { getTeamBackgroundStyle, getTeamColor, getTeamBorderColor } from '../shared/teamColors';

// Press-and-hold helper (used by the parlay slip's Holdable picks).
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
    [clear, delay, onLongPress],
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

// Per-team colour tweaks for the background logo.
const WATERMARK_STYLE = {
  NYJ: { filter: 'grayscale(1) brightness(4.5)', '--wm-opacity': 0.85 }, // near-white
  LV: { filter: 'brightness(1.7) contrast(1.1)' },
  LAR: { filter: 'grayscale(1) brightness(2.6) sepia(1) saturate(4.5) hue-rotate(12deg)' },
};

// Some logos read bigger or smaller than the rest at the same size; this
// scales each one so they look even.
const WATERMARK_SIZE = {
  IND: 0.68,
  NO: 0.77,
  ATL: 0.85,
  MIN: 0.83,
  NYG: 0.85,
  CIN: 0.85,
  LV: 0.77,
  ARI: 0.77,
  CHI: 0.77,
  BAL: 1.18,
  DAL: 0.9,
  TB: 0.9,
  HOU: 0.9,
  CLE: 0.9,
  DET: 0.9,
  MIA: 0.9,
};

// Size used only while the game is closed (open games use WATERMARK_SIZE).
const WATERMARK_CLOSED_SIZE = {
  DAL: 0.82,
  IND: 0.7,
};

// A team that lost a final game goes fully gray (color wash, border and logo).
const LOSER_WATERMARK = { filter: 'grayscale(1) brightness(0.8)', '--wm-opacity': 0.35 };
// The Jets' logo is pushed near-white above; greyed out after a loss it needs
// to sit darker to match the other losing logos.
const LOSER_WATERMARK_BY_TEAM = { NYJ: { filter: 'grayscale(1) brightness(0.45)', '--wm-opacity': 0.35 } };

// While a game's card is open its logos grow and brighten; they settle back when it closes.
const LOSER_BORDER = 'rgb(110, 110, 110)';

const TeamCell = ({
  competitor,
  side,
  score,
  scoreIsSpread,
  subScore,
  isWinner,
  dimmed,
  corner = 'top',
  expanded = false,
}) => {
  const team = competitor?.team;
  // A finished game's losing side is greyed out, but opening the game brings
  // it back to full colour; closing it greys it out again.
  const grayed = dimmed && !expanded;
  const radius =
    corner === 'all' ? (side === 'away' ? '6px 0 0 6px' : '0 6px 6px 0') : side === 'away' ? '6px 0 0 0' : '0 6px 0 0';

  return (
    <div
      className={`team-cell ${expanded ? 'expanded' : ''}`}
      onContextMenu={(e) => e.preventDefault()}
      style={{ display: 'flex', position: 'relative', margin: '1px 2px' }}
    >
      <div
        className="team-cell-bg"
        style={{
          ...getTeamBackgroundStyle(getTeamColor(team)),
          borderRadius: radius,
          transition: 'border-radius 0.3s ease, opacity 0.5s ease, filter 0.5s ease',
          filter: grayed ? 'grayscale(1)' : 'grayscale(0)',
        }}
      />

      <div
        className="team-info-container"
        style={{
          '--cell-border': grayed ? LOSER_BORDER : getTeamBorderColor(team), // border drawn in CSS
          borderRadius: radius,
          transition: 'border-radius 0.3s ease, opacity 0.5s ease',
          overflow: 'hidden',
          opacity: grayed ? 0.6 : 1,
        }}
      >
        {team?.logo && (
          <img
            src={team.logo}
            alt=""
            aria-hidden="true"
            className={`team-logo-watermark ${side}`}
            style={{
              ...(grayed
                ? LOSER_WATERMARK_BY_TEAM[team.abbreviation] || LOSER_WATERMARK
                : WATERMARK_STYLE[team.abbreviation]),
              '--wm-size': WATERMARK_SIZE[team.abbreviation] ?? 1,
              '--wm-closed-size': WATERMARK_CLOSED_SIZE[team.abbreviation] ?? WATERMARK_SIZE[team.abbreviation] ?? 1,
            }}
            draggable={false}
          />
        )}

        {/* name, record and score share one layer, so dimming a cell fades a
            single element instead of each piece of text */}
        <div className="team-text">
          <div className="team-abbr-block" title={team?.displayName}>
            <div className="abbreviation">{team?.abbreviation}</div>
            <div className="team-record">{competitor?.record || '0-0'}</div>
          </div>

          <div className={`team-score ${isWinner ? 'winner' : ''} ${scoreIsSpread ? 'spread' : ''}`}>
            {score}
            {subScore && <div className="team-moneyline">{subScore}</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeamCell;
