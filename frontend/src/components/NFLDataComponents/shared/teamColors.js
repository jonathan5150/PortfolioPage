// Team color helpers. Same visual treatment as the MLB app (soft gradient wash
// behind each team cell), keyed by ESPN abbreviation.

const TEAM_OPACITY = 0.6;
const rgba = (r, g, b, a = TEAM_OPACITY) => `rgba(${r}, ${g}, ${b}, ${a})`;

// Mid-tone versions of each club's primary color; very dark official colors
// (navy, black) are lifted so they still read on the dark background.
const NFL_TEAM_COLORS = {
  ARI: rgba(170, 40, 70),
  ATL: rgba(185, 35, 55),
  BAL: rgba(75, 50, 145),
  BUF: rgba(30, 85, 170),
  CAR: rgba(0, 135, 200),
  CHI: rgba(60, 70, 120),
  CIN: rgba(235, 90, 30),
  CLE: rgba(200, 85, 40),
  DAL: rgba(40, 75, 140),
  DEN: rgba(235, 105, 40),
  DET: rgba(0, 120, 185),
  GB: rgba(40, 95, 70),
  HOU: rgba(50, 65, 110),
  IND: rgba(20, 80, 160),
  JAX: rgba(0, 105, 120),
  KC: rgba(215, 30, 55),
  LV: rgba(170, 176, 183), // silver, lifted so it doesn't look washed out
  LAC: rgba(0, 130, 200),
  LAR: rgba(25, 75, 160),
  MIA: rgba(0, 140, 150),
  MIN: rgba(95, 50, 140),
  NE: rgba(40, 60, 110),
  NO: rgba(180, 155, 100),
  NYG: rgba(20, 70, 160),
  NYJ: rgba(35, 100, 75),
  PHI: rgba(0, 95, 100),
  PIT: rgba(230, 180, 30),
  SF: rgba(175, 30, 40),
  SEA: rgba(60, 90, 120),
  TB: rgba(205, 40, 45),
  TEN: rgba(70, 135, 200),
  WSH: rgba(120, 30, 45),
};

const hexToRgba = (hex, alpha = TEAM_OPACITY) => {
  const clean = String(hex || '').replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return rgba(r, g, b, alpha);
};

export const washOut = (rgbaColor, amount = 0.4) => {
  if (!rgbaColor) return rgbaColor;
  const values = rgbaColor.match(/[\d.]+/g).map(Number);
  let [r, g, b] = values;
  const a = values[3] ?? 1;
  r = Math.round(r + (255 - r) * amount);
  g = Math.round(g + (255 - g) * amount);
  b = Math.round(b + (255 - b) * amount);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

export const getTeamColor = (team) => {
  if (!team) return null;
  return NFL_TEAM_COLORS[team.abbreviation] || hexToRgba(team.color) || null;
};

export const getTeamBackgroundStyle = (teamColor) => {
  if (!teamColor) return { display: 'none' };
  const washed = washOut(teamColor, 0.1);

  return {
    position: 'absolute',
    inset: 0,
    zIndex: 1,
    pointerEvents: 'none',
    borderRadius: '8px',
    background: `
      linear-gradient(150deg, ${washed} 1%, transparent 90%),
      linear-gradient(150deg, rgba(70,70,70,1), ${washed.replace(/[\d.]+\)$/, '0.2)')} 100%)
    `,
  };
};

// Teams whose border needs extra pop (their colours are greys).
const BORDER_OVERRIDES = {
  LV: 'rgba(190, 196, 202, 0.5)',
};

export const getTeamBorderColor = (team) => {
  if (team && BORDER_OVERRIDES[team.abbreviation]) return BORDER_OVERRIDES[team.abbreviation];
  const color = getTeamColor(team);
  return color ? washOut(color, 0.2) : 'rgb(85, 85, 85)';
};

// Solid team colour plus a lighter shade of it, for the swirling ring around an open game.
export const getTeamRingColors = (team) => {
  const base = getTeamColor(team) || 'rgba(140, 140, 140, 1)';
  const solid = base.replace(/[\d.]+\)$/, '1)');
  return [solid, washOut(solid, 0.45)];
};
