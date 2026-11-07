// nflverse historical season data (regular season summaries).
import { fetchText } from './http';
import { nflverseUrls } from './endpoints';
import { parsePlayerSeasonCsv, parseTeamSeasonCsv } from './nflverseParsers';

const HOUR = 60 * 60 * 1000;

// Try the same-origin copy first (no CORS issues), then GitHub releases.
const loadCsv = async (tag, file) => {
  const attempts = [nflverseUrls.local(file), nflverseUrls.remote(tag, file)];
  let lastError = null;

  for (const url of attempts) {
    try {
      const text = await fetchText(url, { ttlMs: 6 * HOUR, timeoutMs: 20000 });
      // CRA dev server answers unknown paths with index.html; make sure this is a CSV.
      if (text && !/^\s*</.test(text) && text.includes(',')) return text;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error(`nflverse file unavailable: ${file}`);
};

export const getNflversePlayerSeasonStats = async (season) =>
  parsePlayerSeasonCsv(await loadCsv('stats_player', nflverseUrls.playerSeasonFile(season)));

export const getNflverseTeamSeasonStats = async (season) =>
  parseTeamSeasonCsv(await loadCsv('stats_team', nflverseUrls.teamSeasonFile(season)));
