import React, { useCallback, useEffect, useRef } from 'react';

import { getTeamBackgroundStyle, getTeamColor, getTeamBorderColor } from '../utils/teamColors';

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
  LV: { filter: 'brightness(1.7) contrast(1.1)', '--wm-y': '-3px' },

  LAR: { filter: 'grayscale(1) brightness(2.6) sepia(1) saturate(4.5) hue-rotate(12deg)' },

  // whitish grey (about #eee from its solid green), open or closed; it's more
  // solid than the rest (--wm-closed-opacity / --wm-open-opacity), so the
  // green cell behind it doesn't tint it green again
  NYJ: {
    filter: 'grayscale(1) brightness(3.6)',
    '--wm-closed-opacity': 0.62,
    '--wm-open-opacity': 0.97,
    '--wm-y': '-14px',
  },

  // --wm-y: logos that sit off-centre in their image, nudged up (-) or down (+)
  // while the game is closed; an open game's logo is dead centre
  CAR: { '--wm-y': '10px' },
  PHI: { '--wm-y': '-10px' },
  DAL: { '--wm-y': '-7px' },
  MIA: { '--wm-y': '10px' },
  ATL: { '--wm-y': '15px' },
  JAX: { '--wm-y': '10px' },
  DET: { '--wm-y': '10px' },
  CHI: { '--wm-y': '5px' },
  TEN: { '--wm-y': '-5px' },
  ARI: { '--wm-y': '-10px' },
  HOU: { '--wm-y': '-4px' },
  TB: { '--wm-y': '5px' },
  LAC: { '--wm-y': '6px' },
  NE: { '--wm-y': '3px' },
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

  TEN: 0.75,

  PIT: 0.75,
};

// Size used only while the game is closed (open games use WATERMARK_SIZE).

const WATERMARK_CLOSED_SIZE = {
  DAL: 0.82,

  IND: 0.7,
};

// Other leagues' logos read big next to NFL ones: a scale per league, with

// per-team tweaks on top (size multiplier, or a style such as a brighter filter).

// NBA / MLB closed-game logos are zoomed in less than NFL ones, so more of the logo

// shows and it's easier to tell whose it is

const NON_NFL_FADED_ZOOM = 0.8;

const LEAGUE_LOGOS = {
  nba: {
    // an opened game's logos shrink well down, out of the way of its details

    open: 0.72,

    closed: 0.77,

    teams: {
      NO: { size: 1.5 },

      OKC: { size: 1.25 },

      UTAH: { style: { filter: 'contrast(0.9) brightness(1.9)' } },
    },
  },

  mlb: {
    open: 0.7,

    closed: 0.7,

    teams: {},
  },

  nhl: {
    open: 0.7,

    closed: 0.74,

    teams: {},
  },
};

// Before a game: just the moneyline, on one row, centred in the cell.

const fmtMoneyLine = (n) => (n > 0 ? `+${n}` : String(n));

const hasPrice = (n) => n !== null && n !== undefined && Math.abs(n) >= 100;

const OddsStack = ({ moneyLine }) => (
  <div className="team-odds-stack">
    <span className="team-odds-value">{fmtMoneyLine(moneyLine)}</span>
  </div>
);

const TeamCell = ({
  competitor,

  side,

  score,

  scoreIsSpread,

  subScore,

  showOdds = false,

  moneyLine,

  isWinner,

  corner = 'top',

  expanded = false,
}) => {
  const team = competitor?.team;

  // the per-team logo tweaks above are for NFL teams; other leagues share abbreviations

  const nflTuned = !team?.league || team.league === 'nfl';

  const leagueLogo = LEAGUE_LOGOS[team?.league] || null;

  const teamTweak = leagueLogo?.teams[team?.abbreviation] || null;

  const leagueScale = leagueLogo
    ? { open: leagueLogo.open * (teamTweak?.size ?? 1), closed: leagueLogo.closed * (teamTweak?.size ?? 1) }
    : null;

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

          // only opacity and filter ease, which the phone's GPU does on its own;

          // the corners switch at once (easing them made the browser redraw

          // the cell every frame, and run its fade on the main thread too)

          transition: 'opacity 0.6s ease, filter 0.6s ease',
        }}
      />

      <div
        className="team-info-container"

        style={{
          '--cell-border': getTeamBorderColor(team), // border drawn in CSS

          borderRadius: radius,

          // the border eases between its closed and open colours with the rest

          // of the cell, rather than switching at once

          transition: 'opacity 0.6s ease, border-color 0.6s ease',

          overflow: 'hidden',
        }}
      >
        {team?.logo && (
          <img
            src={team.logo}

            alt=""

            aria-hidden="true"

            className={`team-logo-watermark ${side}`}

            style={{
              ...(nflTuned ? WATERMARK_STYLE[team.abbreviation] : teamTweak?.style),

              '--wm-size': nflTuned ? (WATERMARK_SIZE[team.abbreviation] ?? 1) : (leagueScale?.open ?? 1),

              '--wm-closed-size': nflTuned
                ? (WATERMARK_CLOSED_SIZE[team.abbreviation] ?? WATERMARK_SIZE[team.abbreviation] ?? 1)
                : (leagueScale?.closed ?? 1),

              // Poster's zoomed-in closed logo: the same zoom for every league

              // (the league sizes above shrink logos to sit inside the cell).

              // One plain variable: nested var() fallbacks inside calc() trip

              // the production CSS minifier.

              '--wm-poster-closed': nflTuned
                ? (WATERMARK_CLOSED_SIZE[team.abbreviation] ?? WATERMARK_SIZE[team.abbreviation] ?? 1)
                : (teamTweak?.size ?? 1) * NON_NFL_FADED_ZOOM,
            }}

            draggable={false}
          />
        )}

        {/* name, record and score share one layer, so dimming a cell fades a

            single element instead of each piece of text */}

        <div className="team-text">
          <div className="team-abbr-block" title={team?.displayName}>
            <div className="abbreviation">{team?.abbreviation}</div>

            {team?.name && <div className="team-full-name">{team.name}</div>}

            <div className="team-record">{competitor?.record || '0-0'}</div>
          </div>

          {showOdds && hasPrice(moneyLine) ? (
            <OddsStack moneyLine={moneyLine} />
          ) : (
            <div className={`team-score ${isWinner ? 'winner' : ''} ${scoreIsSpread ? 'spread' : ''}`}>
              {score}

              {subScore && <div className="team-moneyline">{subScore}</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeamCell;
