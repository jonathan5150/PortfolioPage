// teamPrimaryColors.js
export const TEAM_SATURATION = 0.8;

const TEAM_OPACITY = 0.3;

const rgba = (r, g, b) => `rgba(${r}, ${g}, ${b}, ${TEAM_OPACITY})`;

export const getFadedBackgroundStyle = (teamColor) => ({
  position: 'absolute',
  inset: 0,
  zIndex: 1,
  pointerEvents: 'none',
  border: `1px solid #555555`,
  borderRadius: '5px',
  background: `
    linear-gradient(to right, ${teamColor} 25%, transparent),
    ${teamColor}
  `,
  backgroundBlendMode: 'normal', // 👈 IMPORTANT (no more washed gray look)
});

const teamPrimaryColors = {
  'Arizona Diamondbacks': rgba(170, 45, 65),
  'Atlanta Braves': rgba(55, 65, 125),
  'Baltimore Orioles': rgba(230, 95, 40),
  'Boston Red Sox': rgba(195, 70, 80),
  'Chicago White Sox': rgba(165, 165, 165),
  'Chicago Cubs': rgba(40, 70, 155),
  'Cincinnati Reds': rgba(185, 40, 40),
  'Cleveland Guardians': rgba(40, 60, 85),
  'Colorado Rockies': rgba(70, 40, 125),
  'Detroit Tigers': rgba(40, 60, 85),
  'Houston Astros': rgba(40, 65, 115),
  'Kansas City Royals': rgba(40, 85, 145),
  'Los Angeles Angels': rgba(205, 60, 80),
  'Los Angeles Dodgers': rgba(40, 105, 165),
  'Miami Marlins': rgba(40, 170, 220),
  'Milwaukee Brewers': rgba(40, 60, 95),
  'Minnesota Twins': rgba(40, 65, 105),
  'New York Yankees': rgba(40, 60, 85),
  'New York Mets': rgba(40, 75, 135),
  Athletics: rgba(40, 75, 65),
  'Philadelphia Phillies': rgba(235, 60, 70),
  'Pittsburgh Pirates': rgba(245, 195, 60),
  'San Diego Padres': rgba(245, 205, 70),
  'San Francisco Giants': rgba(245, 105, 50),
  'Seattle Mariners': rgba(40, 105, 105),
  'St. Louis Cardinals': rgba(205, 60, 80),
  'Tampa Bay Rays': rgba(40, 65, 105),
  'Texas Rangers': rgba(40, 75, 130),
  'Toronto Blue Jays': rgba(40, 90, 150),
  'Washington Nationals': rgba(185, 40, 40),
};

export default teamPrimaryColors;