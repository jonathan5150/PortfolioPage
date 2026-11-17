// Parsers for nflverse season CSVs (stats_player_reg_YYYY.csv / stats_team_reg_YYYY.csv).
// Column names come from nflfastR::calculate_stats().

export const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }

  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }

  const [header = [], ...body] = rows.filter((r) => r.length > 1 || (r.length === 1 && r[0] !== ''));
  return body.map((r) => {
    const obj = {};
    header.forEach((col, i) => {
      obj[col] = r[i];
    });
    return obj;
  });
};

const num = (v) => {
  if (v === undefined || v === null || v === '' || v === 'NA') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// nflverse and ESPN disagree on a few abbreviations.
const NFLVERSE_TO_ESPN_ABBR = { LA: 'LAR', WAS: 'WSH', OAK: 'LV', SD: 'LAC', STL: 'LAR' };
export const toEspnAbbr = (abbr) => NFLVERSE_TO_ESPN_ABBR[abbr] || abbr;

export const normalizePlayerSeasonRow = (row) => ({
  id: row.player_id,
  name: row.player_display_name || row.player_name,
  position: row.position || row.position_group || '',
  team: toEspnAbbr(row.recent_team || row.team || ''),
  games: num(row.games),
  passing: {
    completions: num(row.completions),
    attempts: num(row.attempts),
    yards: num(row.passing_yards),
    touchdowns: num(row.passing_tds),
    interceptions: num(row.passing_interceptions ?? row.interceptions),
    sacks: num(row.sacks_suffered ?? row.sacks),
  },
  rushing: {
    attempts: num(row.carries),
    yards: num(row.rushing_yards),
    touchdowns: num(row.rushing_tds),
  },
  receiving: {
    receptions: num(row.receptions),
    targets: num(row.targets),
    yards: num(row.receiving_yards),
    touchdowns: num(row.receiving_tds),
  },
  fumblesLost:
    num(row.rushing_fumbles_lost) + num(row.receiving_fumbles_lost) + num(row.sack_fumbles_lost),
});

export const parsePlayerSeasonCsv = (text) =>
  parseCsv(text)
    .filter((r) => !r.season_type || r.season_type === 'REG')
    .map(normalizePlayerSeasonRow);

// Team file is offense-centric, plus def_* columns for the defense's own counting stats.
export const normalizeTeamSeasonRow = (row) => {
  const passingYards = num(row.passing_yards);
  const rushingYards = num(row.rushing_yards);
  const games = num(row.games) || 1;

  return {
    team: toEspnAbbr(row.team || row.recent_team || ''),
    games,
    offense: {
      passingYards,
      rushingYards,
      totalYards: passingYards + rushingYards,
      passingTouchdowns: num(row.passing_tds),
      rushingTouchdowns: num(row.rushing_tds),
      giveaways:
        num(row.passing_interceptions) +
        num(row.rushing_fumbles_lost) +
        num(row.receiving_fumbles_lost) +
        num(row.sack_fumbles_lost),
      sacksAllowed: num(row.sacks_suffered),
    },
    defense: {
      sacks: num(row.def_sacks),
      interceptions: num(row.def_interceptions),
      fumblesForced: num(row.def_fumbles_forced),
      tacklesForLoss: num(row.def_tackles_for_loss),
      touchdowns: num(row.def_tds),
    },
  };
};

export const parseTeamSeasonCsv = (text) =>
  parseCsv(text)
    .filter((r) => !r.season_type || r.season_type === 'REG')
    .map(normalizeTeamSeasonRow);
