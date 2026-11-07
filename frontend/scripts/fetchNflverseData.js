#!/usr/bin/env node
/*
 * Downloads nflverse season summary files into public/nfl-data so the NFL Stats
 * Wizard can load historical stats from your own domain (no GitHub/CORS dependency).
 *
 * Usage (from the frontend folder):
 *   node scripts/fetchNflverseData.js            # last 6 completed seasons
 *   node scripts/fetchNflverseData.js 2022 2025  # specific seasons
 *
 * Requires Node 18+ (built-in fetch).
 */
const fs = require('fs');
const path = require('path');

const BASE = 'https://github.com/nflverse/nflverse-data/releases/download';
const OUT_DIR = path.join(__dirname, '..', 'public', 'nfl-data');

// Only keep the columns the app reads, to keep the files small.
const KEEP = {
  stats_player: [
    'player_id', 'player_name', 'player_display_name', 'position', 'position_group', 'season',
    'season_type', 'recent_team', 'team', 'games', 'completions', 'attempts', 'passing_yards',
    'passing_tds', 'passing_interceptions', 'sacks_suffered', 'carries', 'rushing_yards',
    'rushing_tds', 'receptions', 'targets', 'receiving_yards', 'receiving_tds',
    'rushing_fumbles_lost', 'receiving_fumbles_lost', 'sack_fumbles_lost',
  ],
  stats_team: [
    'season', 'team', 'season_type', 'games', 'passing_yards', 'rushing_yards', 'passing_tds',
    'rushing_tds', 'passing_interceptions', 'rushing_fumbles_lost', 'receiving_fumbles_lost',
    'sack_fumbles_lost', 'sacks_suffered', 'def_sacks', 'def_interceptions', 'def_fumbles_forced',
    'def_tackles_for_loss', 'def_tds',
  ],
};

const splitCsvLine = (line) => {
  const out = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { field += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { out.push(field); field = ''; }
    else field += ch;
  }
  out.push(field);
  return out;
};

const quote = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

const trimCsv = (text, keep) => {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const header = splitCsvLine(lines[0]);
  const idx = keep.map((c) => header.indexOf(c)).filter((i) => i >= 0);
  return [idx.map((i) => header[i]).join(','),
    ...lines.slice(1).map((l) => { const f = splitCsvLine(l); return idx.map((i) => quote(f[i] ?? '')).join(','); })]
    .join('\n');
};

const download = async (tag, season) => {
  const kind = tag.replace('stats_', '');
  const file = `stats_${kind}_reg_${season}.csv`;
  const res = await fetch(`${BASE}/${tag}/${file}`);
  if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
  const trimmed = trimCsv(await res.text(), KEEP[tag]);
  fs.writeFileSync(path.join(OUT_DIR, file), trimmed);
  console.log(`saved ${file} (${Math.round(trimmed.length / 1024)} KB)`);
};

(async () => {
  // The current season comes live from ESPN, so default to the last completed season and earlier.
  const latest = new Date().getFullYear() - 1;
  const args = process.argv.slice(2).map(Number).filter(Boolean);
  const seasons = args.length === 2 && args[1] > args[0]
    ? Array.from({ length: args[1] - args[0] + 1 }, (_, i) => args[0] + i)
    : args.length ? args : Array.from({ length: 6 }, (_, i) => latest - i);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const season of seasons) {
    for (const tag of ['stats_player', 'stats_team']) {
      try {
        await download(tag, season);
      } catch (error) {
        console.warn(`skipped ${tag} ${season}: ${error.message}`);
      }
    }
  }
})();
