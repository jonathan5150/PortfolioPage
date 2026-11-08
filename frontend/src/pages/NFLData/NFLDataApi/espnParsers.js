import { teamLogo, playerHeadshot } from './endpoints';

// Pure functions that turn raw ESPN JSON into the small, stable shapes the UI uses.
// Nothing in here touches the network or React, so it can be unit tested with fixtures.

const toNumber = (value) => {
  if (value === null || value === undefined || value === '' || value === '-' || value === '--') {
    return null;
  }
  const n = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
};

export const asHexColor = (value) => {
  if (!value) return null;
  const hex = String(value).replace('#', '').trim();
  return /^[0-9a-fA-F]{6}$/.test(hex) ? `#${hex}` : null;
};

const firstLogo = (team) =>
  team?.logo || team?.logos?.find((l) => (l.rel || []).includes('default'))?.href || team?.logos?.[0]?.href || '';

export const parseTeam = (raw) => {
  const team = raw?.team ?? raw;
  if (!team?.id) return null;

  return {
    id: String(team.id),
    abbreviation: team.abbreviation || '',
    name: team.name || team.shortDisplayName || '',
    displayName: team.displayName || `${team.location || ''} ${team.name || ''}`.trim(),
    shortDisplayName: team.shortDisplayName || team.name || '',
    location: team.location || '',
    color: asHexColor(team.color),
    alternateColor: asHexColor(team.alternateColor),
    logo: teamLogo(firstLogo(team)),
  };
};

export const parseTeamsResponse = (json) => {
  const teams = json?.sports?.[0]?.leagues?.[0]?.teams || [];
  return teams
    .map(parseTeam)
    .filter(Boolean)
    .filter((t) => t.abbreviation && !['AFC', 'NFC'].includes(t.abbreviation))
    .sort((a, b) => a.abbreviation.localeCompare(b.abbreviation));
};

// ---------- Status ----------

export const parseStatus = (rawStatus) => {
  const type = rawStatus?.type || {};
  const state = type.state || 'pre';
  const name = type.name || '';

  return {
    state, // 'pre' | 'in' | 'post'
    name,
    detail: type.detail || type.description || '',
    shortDetail: type.shortDetail || type.detail || '',
    completed: Boolean(type.completed),
    period: rawStatus?.period ?? 0,
    displayClock: rawStatus?.displayClock || '',
    isHalftime: name === 'STATUS_HALFTIME',
    isPostponed: name === 'STATUS_POSTPONED' || name === 'STATUS_CANCELED' || name === 'STATUS_DELAYED',
  };
};

export const isLiveStatus = (status) => status?.state === 'in';
export const isFinalStatus = (status) => status?.state === 'post';

// ---------- Scoreboard ----------

const pickRecord = (records = [], ...types) => {
  for (const t of types) {
    const rec = records.find(
      (r) => r.type === t || r.name === t || (t === 'total' && (r.name === 'overall' || r.name === 'All Splits'))
    );
    if (rec?.summary) return rec.summary;
  }
  return null;
};

const parseCompetitor = (c) => ({
  teamId: String(c?.team?.id ?? c?.id ?? ''),
  homeAway: c?.homeAway,
  team: parseTeam(c?.team),
  score: toNumber(c?.score?.value ?? c?.score?.displayValue ?? c?.score),
  linescores: (c?.linescores || []).map((l) => toNumber(l?.value ?? l?.displayValue) ?? 0),
  record: pickRecord(c?.records || c?.record || [], 'total') || null,
  homeRecord: pickRecord(c?.records || [], 'home'),
  awayRecord: pickRecord(c?.records || [], 'road', 'away'),
  winner: Boolean(c?.winner),
  leaders: parseLeaders(c?.leaders),
});

const parseSituation = (s, competitors) => {
  if (!s) return null;
  const possessionTeamId = s.possession ? String(s.possession) : null;
  return {
    down: s.down ?? null,
    distance: s.distance ?? null,
    yardLine: s.yardLine ?? null,
    downDistanceText: s.downDistanceText || s.shortDownDistanceText || '',
    shortDownDistanceText: s.shortDownDistanceText || '',
    possessionText: s.possessionText || '',
    possessionTeamId,
    possessionAbbr:
      competitors.find((c) => c.teamId === possessionTeamId)?.team?.abbreviation || null,
    isRedZone: Boolean(s.isRedZone),
    homeTimeouts: s.homeTimeouts ?? null,
    awayTimeouts: s.awayTimeouts ?? null,
    lastPlay: s.lastPlay?.text || '',
    lastPlayType: s.lastPlay?.type?.text || '',
  };
};

const parseLeaders = (leaders = []) =>
  leaders
    .map((group) => {
      const top = group?.leaders?.[0];
      if (!top) return null;
      return {
        category: group.name,
        label: group.shortDisplayName || group.displayName || group.name,
        athleteId: top.athlete?.id ? String(top.athlete.id) : null,
        athleteName: top.athlete?.shortName || top.athlete?.displayName || '',
        athleteFullName: top.athlete?.displayName || top.athlete?.fullName || top.athlete?.shortName || '',
        teamId: top.team?.id ? String(top.team.id) : top.athlete?.team?.id ? String(top.athlete.team.id) : null,
        value: top.displayValue || '',
      };
    })
    .filter(Boolean);

export const parseEvent = (event) => {
  const comp = event?.competitions?.[0] || {};
  const competitors = (comp.competitors || []).map(parseCompetitor);
  const away = competitors.find((c) => c.homeAway === 'away') || competitors[0] || null;
  const home = competitors.find((c) => c.homeAway === 'home') || competitors[1] || null;
  const status = parseStatus(comp.status || event?.status);

  return {
    id: String(event?.id ?? comp.id ?? ''),
    date: event?.date || comp.date || null,
    name: event?.name || '',
    shortName: event?.shortName || '',
    week: event?.week?.number ?? null,
    season: event?.season?.year ?? null,
    seasonType: event?.season?.type ?? event?.seasonType?.type ?? null,
    status,
    venue: comp.venue?.fullName || '',
    venueCity: comp.venue?.address?.city || '',
    venueState: comp.venue?.address?.state || '',
    broadcast: (comp.broadcasts || []).flatMap((b) => b.names || []).join(', '),
    odds: comp.odds?.[0]
      ? { details: comp.odds[0].details || '', overUnder: comp.odds[0].overUnder ?? null }
      : null,
    indoor: Boolean(comp.venue?.indoor),
    weather: event?.weather
      ? { text: event.weather.displayValue || '', temperature: toNumber(event.weather.temperature) }
      : null,
    away,
    home,
    situation: status.state === 'in' ? parseSituation(comp.situation, competitors) : null,
    leaders: parseLeaders(comp.leaders),
  };
};

const refId = (ref, kind) => String(ref || '').match(new RegExp(`${kind}/(\\d+)`))?.[1] || null;

// core API team leaders -> { rushing: [{ athleteId, statLine, value }], receiving: [...], passing: [...] }
export const parseTeamLeaders = (json) => {
  const pick = (name) =>
    (json?.categories?.find((c) => c.name === name)?.leaders || [])
      .map((l) => ({
        athleteId: l.athlete?.id ? String(l.athlete.id) : refId(l.athlete?.$ref, 'athletes'),
        statLine: l.displayValue || '',
        value: toNumber(l.value),
      }))
      .filter((l) => l.athleteId);
  return { passing: pick('passingLeader'), rushing: pick('rushingLeader'), receiving: pick('receivingLeader') };
};

// core API athlete -> the bits the betting tab needs.
export const parseCoreAthlete = (json) => {
  if (!json?.id) return null;
  return {
    id: String(json.id),
    name: json.displayName || json.fullName || '',
    position: json.position?.abbreviation || '',
    headshot: json.headshot?.href ? playerHeadshot(json.headshot.href) : null,
    injuryStatus: json.injuries?.[0]?.status || null,
  };
};

// core API depth chart -> athlete id of the QB listed first, or null.
export const parseStartingQb = (json) => {
  for (const chart of json?.items || []) {
    const qb = chart?.positions?.qb;
    if (!qb?.athletes?.length) continue;
    const starter = [...qb.athletes].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))[0];
    const id = starter?.athlete?.id ?? String(starter?.athlete?.$ref || '').match(/athletes\/(\d+)/)?.[1];
    if (id) return String(id);
  }
  return null;
};

// A team's schedule (teams/{id}/schedule) uses the same event shape as the scoreboard.
export const parseTeamSchedule = (json) =>
  (json?.events || [])
    .map(parseEvent)
    .filter((e) => e.id && e.away && e.home)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

// ESPN's calendar lists each season type (pre/regular/post) and the weeks inside it.
export const parseCalendar = (json) => {
  const calendar = json?.leagues?.[0]?.calendar || [];
  return calendar
    .filter((section) => Array.isArray(section?.entries) && section.entries.length > 0)
    .map((section) => ({
      seasonType: toNumber(section.value),
      label: section.label,
      weeks: section.entries.map((entry) => ({
        week: toNumber(entry.value),
        label: entry.label,
        detail: entry.detail || '',
        startDate: entry.startDate,
        endDate: entry.endDate,
      })),
    }))
    .filter((section) => section.seasonType && section.seasonType !== 4);
};

export const parseScoreboard = (json) => {
  const events = (json?.events || []).map(parseEvent).sort((a, b) => new Date(a.date) - new Date(b.date));

  return {
    season: json?.season?.year ?? events[0]?.season ?? null,
    seasonType: json?.season?.type ?? events[0]?.seasonType ?? null,
    week: json?.week?.number ?? events[0]?.week ?? null,
    calendar: parseCalendar(json),
    events,
  };
};

// ---------- Game summary / box score ----------

// ESPN keys look like "completions/passingAttempts" and the matching value "22/31".
// Expand them so the UI can ask for stats.completions directly.
const expandStatPairs = (keys = [], values = []) => {
  const stats = {};
  keys.forEach((key, i) => {
    const value = values[i];
    stats[key] = value;
    const keyParts = key.split(/[/-]/);
    if (keyParts.length === 2 && typeof value === 'string') {
      const valueParts = value.split(/[/-]/);
      if (valueParts.length === 2) {
        stats[keyParts[0]] = valueParts[0];
        stats[keyParts[1]] = valueParts[1];
      }
    }
  });
  return stats;
};

const parsePlayerCategory = (category) => {
  const keys = category?.keys || category?.names || [];
  return {
    name: category?.name,
    title: category?.text || category?.displayName || category?.name,
    keys,
    labels: category?.labels || keys,
    totals: category?.totals || [],
    athletes: (category?.athletes || []).map((a) => ({
      id: a?.athlete?.id ? String(a.athlete.id) : null,
      name: a?.athlete?.displayName || '',
      shortName: a?.athlete?.shortName || a?.athlete?.displayName || '',
      jersey: a?.athlete?.jersey || '',
      position: a?.athlete?.position?.abbreviation || '',
      values: a?.stats || [],
      stats: expandStatPairs(keys, a?.stats || []),
    })),
  };
};

export const parseScoringPlays = (plays = []) =>
  plays.map((p) => ({
    id: String(p.id ?? ''),
    period: p.period?.number ?? null,
    clock: p.clock?.displayValue || '',
    text: p.text || '',
    type: p.scoringType?.abbreviation || p.type?.abbreviation || '',
    teamId: p.team?.id ? String(p.team.id) : null,
    awayScore: p.awayScore ?? null,
    homeScore: p.homeScore ?? null,
  }));

export const parseSummary = (json) => {
  const headerComp = json?.header?.competitions?.[0] || {};
  const competitors = (headerComp.competitors || []).map(parseCompetitor);

  const teamStats = (json?.boxscore?.teams || []).map((t, idx) => ({
    teamId: String(t?.team?.id ?? ''),
    homeAway: t?.homeAway || (idx === 0 ? 'away' : 'home'),
    team: parseTeam(t?.team),
    stats: (t?.statistics || []).map((s) => ({
      name: s.name,
      label: s.label || s.name,
      displayValue: s.displayValue ?? String(s.value ?? ''),
    })),
  }));

  const players = {};
  (json?.boxscore?.players || []).forEach((p) => {
    const teamId = String(p?.team?.id ?? '');
    const categories = {};
    (p?.statistics || []).forEach((cat) => {
      const parsed = parsePlayerCategory(cat);
      if (parsed.name) categories[parsed.name] = parsed;
    });
    players[teamId] = { team: parseTeam(p?.team), categories };
  });

  const status = parseStatus(headerComp.status || json?.header?.status);

  return {
    gameId: String(json?.header?.id ?? ''),
    status,
    competitors,
    away: competitors.find((c) => c.homeAway === 'away') || null,
    home: competitors.find((c) => c.homeAway === 'home') || null,
    teamStats,
    players,
    hasPlayerStats: Object.values(players).some((p) => Object.keys(p.categories).length > 0),
    scoringPlays: parseScoringPlays(json?.scoringPlays),
    situation: status.state === 'in' ? parseSituation(json?.situation, competitors) : null,
  };
};

// Players who scored a touchdown themselves in a parsed summary, as
// { athleteId: touchdowns }: rushing, receiving, return and defensive scores
// count, a quarterback's passing touchdowns don't (same as an anytime TD bet).
export const touchdownScorers = (summary) => {
  const scorers = {};
  Object.values(summary?.players || {}).forEach(({ categories }) => {
    Object.values(categories || {}).forEach((cat) => {
      cat.athletes.forEach((a) => {
        if (!a.id) return;
        const tds = Object.entries(a.stats || {})
          .filter(([key]) => /Touchdowns$/.test(key) && key !== 'passingTouchdowns')
          .reduce((sum, [, value]) => sum + (Number(value) || 0), 0);
        if (tds > 0) scorers[a.id] = (scorers[a.id] || 0) + tds;
      });
    });
  });
  return scorers;
};

// ---------- Roster ----------

export const parseRoster = (json) => {
  const groups = json?.athletes || [];
  const players = [];

  groups.forEach((group) => {
    const items = Array.isArray(group?.items) ? group.items : group?.id ? [group] : [];
    items.forEach((a) => {
      players.push({
        id: String(a.id),
        name: a.displayName || a.fullName || '',
        shortName: a.shortName || a.displayName || '',
        jersey: a.jersey || '',
        position: a.position?.abbreviation || '',
        side: group?.position || '',
        headshot: a.headshot?.href ? playerHeadshot(a.headshot.href) : '',
        status: a.status?.type || a.status?.name || '',
        injuryStatus: a.injuries?.[0]?.status || null,
      });
    });
  });

  return players;
};

// ---------- Athlete game log ----------

export const parseGameLog = (json) => {
  const names = json?.names || [];
  const labels = json?.labels || names;
  const eventMeta = json?.events || {};
  const games = [];
  let seasonTotals = null;
  const seen = new Set();

  (json?.seasonTypes || []).forEach((seasonType) => {
    const typeName = seasonType?.displayName || '';
    const isPost = /post/i.test(typeName);

    (seasonType?.categories || []).forEach((category) => {
      if (category?.type && category.type !== 'event') return;

      (category?.events || []).forEach((ev) => {
        const id = String(ev?.eventId ?? '');
        if (!id || seen.has(id)) return;
        seen.add(id);

        const meta = eventMeta[id] || {};
        const stats = {};
        names.forEach((name, i) => {
          stats[name] = toNumber(ev?.stats?.[i]);
        });

        games.push({
          eventId: id,
          date: meta.gameDate || null,
          week: meta.week ?? null,
          isPostseason: isPost,
          opponentAbbr: meta.opponent?.abbreviation || '',
          opponentId: meta.opponent?.id ? String(meta.opponent.id) : null,
          atVs: meta.atVs || '',
          result: meta.gameResult || '',
          score: meta.score || '',
          stats,
        });
      });
    });

    if (!seasonTotals && /regular/i.test(typeName)) {
      const totalsRow = seasonType?.summary?.stats?.[0]?.stats;
      if (Array.isArray(totalsRow)) {
        seasonTotals = {};
        names.forEach((name, i) => {
          seasonTotals[name] = toNumber(totalsRow[i]);
        });
      }
    }
  });

  games.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

  return {
    names,
    labels,
    categories: (json?.categories || []).map((c) => ({ name: c.name, count: c.count })),
    games,
    seasonTotals,
  };
};

// ---------- Team statistics (byteam) ----------

// Returns { [teamId]: { own: {statName: value}, opp: {statName: value} } }.
// "own" (splitId 0) is the team's offense; "opp" (splitId 900) is what it allowed.
export const parseTeamStatsByTeam = (json) => {
  const definitions = {};
  (json?.categories || []).forEach((c) => {
    if (c?.name) definitions[c.name] = c.names || [];
  });

  const result = {};

  (json?.teams || []).forEach((entry) => {
    const teamId = String(entry?.team?.id ?? '');
    if (!teamId) return;
    const bucket = { own: {}, opp: {}, team: parseTeam(entry.team) };

    (entry?.categories || []).forEach((cat) => {
      const statNames = definitions[cat?.name] || [];
      const side = String(cat?.splitId) === '900' || /^opponent/i.test(cat?.displayName || '') ? 'opp' : 'own';
      statNames.forEach((statName, i) => {
        const value = toNumber(cat?.values?.[i] ?? cat?.totals?.[i]);
        // Some stat names repeat across categories (e.g. rushingYards); keep the first.
        if (value !== null && bucket[side][statName] === undefined) {
          bucket[side][statName] = value;
        }
      });
    });

    result[teamId] = bucket;
  });

  return result;
};

// ---------- Standings ----------

export const parseStandings = (json) => {
  const byTeam = {};

  const walk = (node, conferenceName) => {
    if (!node) return;
    const conf = node.abbreviation && ['AFC', 'NFC'].includes(node.abbreviation) ? node.abbreviation : conferenceName;
    (node.standings?.entries || []).forEach((entry) => {
      const teamId = String(entry?.team?.id ?? '');
      if (!teamId) return;
      const stats = {};
      (entry.stats || []).forEach((s) => {
        stats[s.name || s.type] = s.displayValue ?? s.value;
      });
      byTeam[teamId] = {
        conference: conf || null,
        wins: toNumber(stats.wins),
        losses: toNumber(stats.losses),
        ties: toNumber(stats.ties),
        winPercent: toNumber(stats.winPercent),
        pointsFor: toNumber(stats.pointsFor),
        pointsAgainst: toNumber(stats.pointsAgainst),
        differential: toNumber(stats.differential ?? stats.pointDifferential),
        streak: stats.streak ?? null,
        playoffSeed: toNumber(stats.playoffSeed),
      };
    });
    (node.children || []).forEach((child) => walk(child, conf));
  };

  walk(json, null);
  return byTeam;
};

export const _internal = { toNumber, expandStatPairs };
