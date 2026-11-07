// Every external URL the NFL app uses lives here.
// ESPN's API is unofficial/undocumented, so keeping the URLs in one place makes it
// easy to patch if ESPN changes a path.

const SITE = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';
const SITE_WEB = 'https://site.web.api.espn.com/apis/common/v3/sports/football/nfl';
const STANDINGS = 'https://site.api.espn.com/apis/v2/sports/football/nfl/standings';

// nflverse publishes season files as GitHub release assets. Browsers can be blocked
// by CORS on github.com redirects, so we first look for a same-origin copy in
// /public/nfl-data (see scripts/fetchNflverseData.js), then try GitHub directly.
const NFLVERSE_RELEASES = 'https://github.com/nflverse/nflverse-data/releases/download';

const query = (params) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  });
  const str = search.toString();
  return str ? `?${str}` : '';
};

export const espnUrls = {
  teams: () => `${SITE}/teams${query({ limit: 40 })}`,

  // With no args ESPN returns the current week. With season/seasonType/week it returns that week.
  scoreboard: ({ season, seasonType, week } = {}) =>
    `${SITE}/scoreboard${query({
      dates: season,
      seasontype: seasonType,
      week,
      limit: 50,
    })}`,

  summary: (eventId) => `${SITE}/summary${query({ event: eventId })}`,

  roster: (teamId) => `${SITE}/teams/${teamId}/roster`,

  athleteGameLog: (athleteId, season) =>
    `${SITE_WEB}/athletes/${athleteId}/gamelog${query({ season })}`,

  teamStatsByTeam: ({ season, seasonType = 2 }) =>
    `${SITE_WEB}/statistics/byteam${query({
      region: 'us',
      lang: 'en',
      contentorigin: 'espn',
      season,
      seasontype: seasonType,
      limit: 32,
    })}`,

  standings: (season) => `${STANDINGS}${query({ season })}`,
};

export const nflverseUrls = {
  local: (file) => `${process.env.PUBLIC_URL || ''}/nfl-data/${file}`,
  remote: (tag, file) => `${NFLVERSE_RELEASES}/${tag}/${file}`,
  playerSeasonFile: (season) => `stats_player_reg_${season}.csv`,
  teamSeasonFile: (season) => `stats_team_reg_${season}.csv`,
};

export const headshotUrl = (athleteId) =>
  `https://a.espncdn.com/i/headshots/nfl/players/full/${athleteId}.png`;
