// ESPN data for the daily-schedule leagues (NBA, MLB). Same proxy, cache and
// parsers as the NFL page wherever ESPN's shapes match; league-specific bits
// (box scores, MLB's count and bases) are parsed here.
import { fetchJson } from '../../pages/NFLData/NFLDataApi/http';
import { parseEvent, parseTeam, parseTeamSchedule, parseStatus } from '../../pages/NFLData/NFLDataApi/espnParsers';
import { parseEventOdds, parsePredictor } from '../../pages/NFLData/NFLDataApi/betting';

export const LEAGUES = {
  nba: {
    key: 'nba',
    label: 'NBA',
    path: 'basketball/nba',
    lineLabel: 'SPREAD',
    regulationPeriods: 4,
    // ESPN's win probability -> points: an NBA point is worth less than an NFL one
    marginScale: 9,
  },
  mlb: {
    key: 'mlb',
    label: 'MLB',
    path: 'baseball/mlb',
    lineLabel: 'RUN LINE',
    regulationPeriods: 9,
    marginScale: 2.6,
  },
};

const SITE = (lg) => `https://site.api.espn.com/apis/site/v2/sports/${LEAGUES[lg].path}`;
const WEB = (lg) => `https://site.web.api.espn.com/apis/common/v3/sports/${LEAGUES[lg].path}`;
const CORE = (lg) => `https://sports.core.api.espn.com/v2/sports/${LEAGUES[lg].path.replace('/', '/leagues/')}`;

const MIN = 60 * 1000;
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// every team object carries its league, so shared colour / logo helpers keep
// NFL-only tweaks off other leagues' teams
const tag = (lg) => (competitor) =>
  competitor ? { ...competitor, team: competitor.team ? { ...competitor.team, league: lg } : null } : competitor;

// ---------- schedule ----------

// "20261111" for a local Date
export const dayKey = (date) =>
  `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
export const dayFromKey = (key) =>
  new Date(Number(key.slice(0, 4)), Number(key.slice(4, 6)) - 1, Number(key.slice(6, 8)));

// MLB's live count, outs and runners; both leagues' latest play
const parseLeagueSituation = (s) =>
  s
    ? {
        balls: num(s.balls),
        strikes: num(s.strikes),
        outs: num(s.outs),
        onFirst: Boolean(s.onFirst),
        onSecond: Boolean(s.onSecond),
        onThird: Boolean(s.onThird),
        batter: s.batter?.athlete?.shortName || s.batter?.athlete?.displayName || '',
        pitcher: s.pitcher?.athlete?.shortName || s.pitcher?.athlete?.displayName || '',
        lastPlay: s.lastPlay?.text || '',
        winProbability:
          s.lastPlay?.probability && num(s.lastPlay.probability.homeWinPercentage) !== null
            ? {
                home: num(s.lastPlay.probability.homeWinPercentage) * 100,
                away: num(s.lastPlay.probability.awayWinPercentage) * 100,
              }
            : null,
      }
    : null;

// MLB probable starters with their season line (ERA, W-L) when ESPN lists them
const parseProbables = (competitor) =>
  (competitor?.probables || []).map((p) => ({
    id: p.athlete?.id ? String(p.athlete.id) : null,
    name: p.athlete?.displayName || p.athlete?.fullName || '',
    shortName: p.athlete?.shortName || '',
    headshot: p.athlete?.headshot?.href || p.athlete?.headshot || null,
    // "8-10 · 3.53 ERA"
    line: (() => {
      const stat = (abbr) => (p.statistics || []).find((st) => st.abbreviation === abbr)?.displayValue;
      const w = stat('W');
      const l = stat('L');
      const era = stat('ERA');
      return [w !== undefined && l !== undefined ? `${w}-${l}` : null, era ? `${era} ERA` : null]
        .filter(Boolean)
        .join(' · ');
    })(),
  }))[0] || null;

export const parseLeagueScoreboard = (json, lg) => {
  const events = (json?.events || []).map((event) => {
    const game = parseEvent(event);
    const comp = event?.competitions?.[0] || {};
    const raw = (side) => (comp.competitors || []).find((c) => c.homeAway === side);
    return {
      ...game,
      league: lg,
      away: tag(lg)(game.away && { ...game.away, probable: parseProbables(raw('away')) }),
      home: tag(lg)(game.home && { ...game.home, probable: parseProbables(raw('home')) }),
      situation: game.status.state === 'in' ? parseLeagueSituation(comp.situation) : null,
      periodPrefix: comp.status?.periodPrefix || event?.status?.periodPrefix || '',
    };
  });
  events.sort((a, b) => new Date(a.date) - new Date(b.date));
  return {
    day: json?.day?.date ? json.day.date.replace(/-/g, '') : null,
    // the league's game days this season (YYYYMMDD), for jumping between them
    calendar: (json?.leagues?.[0]?.calendar || [])
      .map((d) => (typeof d === 'string' ? d : d?.startDate))
      .filter(Boolean)
      .map((d) => dayKey(new Date(d))),
    events,
  };
};

// With no day, ESPN returns the current (or next) day with games.
export const getLeagueScoreboard = async (lg, day, { live = false } = {}) =>
  parseLeagueScoreboard(
    await fetchJson(`${SITE(lg)}/scoreboard?limit=50${day ? `&dates=${day}` : ''}`, { ttlMs: live ? 0 : 30 * 1000 }),
    lg,
  );

// The nearest day with games before (dir -1) or after (dir 1) `fromDay`.
// ESPN's calendar only lists a few dates a season and rejects date ranges, so:
// check the next few days one by one, then whole months (offseason gaps, e.g.
// the World Series -> spring training in February).
const etKey = (iso) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(iso))
    .replace(/-/g, '');
const shift = (key, days) => {
  const d = dayFromKey(key);
  d.setDate(d.getDate() + days);
  return dayKey(d);
};
const firstEvent = async (lg, dates) => {
  const json = await fetchJson(`${SITE(lg)}/scoreboard?dates=${dates}&limit=1`, { ttlMs: 10 * MIN }).catch(() => null);
  return json?.events?.[0] || null;
};
const hasGames = async (lg, key) => Boolean(await firstEvent(lg, key));
/* eslint-disable no-await-in-loop */
export const findGameDay = async (lg, fromDay, dir) => {
  for (let i = 1; i <= 7; i += 1) {
    const key = shift(fromDay, dir * i);
    if (await hasGames(lg, key)) return key;
  }
  const from = dayFromKey(shift(fromDay, dir * 7));
  for (let m = 0; m < 12; m += 1) {
    const month = new Date(from.getFullYear(), from.getMonth() + dir * m, 1);
    const ym = `${month.getFullYear()}${String(month.getMonth() + 1).padStart(2, '0')}`;
    const first = await firstEvent(lg, ym);
    if (first) {
      if (dir > 0) {
        const key = etKey(first.date);
        if (key > shift(fromDay, 7)) return key;
        // games this month, but only before where the day-by-day search stopped
        for (let d = 8; d <= 40; d += 1) {
          const k = shift(fromDay, d);
          if (await hasGames(lg, k)) return k;
        }
      } else {
        // walk back from the month's end (or from where the day search stopped)
        const monthEnd = dayKey(new Date(month.getFullYear(), month.getMonth() + 1, 0));
        const stop = shift(fromDay, -7);
        let k = monthEnd < stop ? monthEnd : shift(fromDay, -8);
        const firstDay = `${ym}01`;
        while (k >= firstDay) {
          if (await hasGames(lg, k)) return k;
          k = shift(k, -1);
        }
      }
    }
  }
  return null;
};
/* eslint-enable no-await-in-loop */

export const getLeagueTeams = async (lg) => {
  const json = await fetchJson(`${SITE(lg)}/teams?limit=40`, { ttlMs: 24 * 60 * MIN });
  return (json?.sports?.[0]?.leagues?.[0]?.teams || [])
    .map(parseTeam)
    .filter(Boolean)
    .map((t) => ({ ...t, league: lg }))
    .sort((a, b) => a.abbreviation.localeCompare(b.abbreviation));
};

// ---------- one game ----------

const parseBoxScore = (json, lg) =>
  (json?.boxscore?.players || []).map((p) => ({
    teamId: String(p?.team?.id ?? ''),
    team: p?.team ? { ...parseTeam(p.team), league: lg } : null,
    groups: (p?.statistics || []).map((cat) => ({
      name: cat.type || cat.name || '',
      title:
        cat.text || cat.displayName || (cat.type === 'pitching' ? 'Pitching' : cat.type === 'batting' ? 'Batting' : ''),
      labels: cat.labels || cat.names || [],
      totals: cat.totals || [],
      players: (cat.athletes || [])
        .filter((a) => (a.stats || []).length)
        .map((a) => ({
          id: a.athlete?.id ? String(a.athlete.id) : null,
          name: a.athlete?.shortName || a.athlete?.displayName || '',
          position: a.athlete?.position?.abbreviation || a.position?.abbreviation || '',
          starter: Boolean(a.starter),
          stats: a.stats || [],
        })),
    })),
  }));

export const getLeagueSummary = async (lg, eventId, { live = false } = {}) => {
  const json = await fetchJson(`${SITE(lg)}/summary?event=${eventId}`, { ttlMs: live ? 0 : 5 * MIN });
  return {
    status: parseStatus(json?.header?.competitions?.[0]?.status),
    box: parseBoxScore(json, lg),
  };
};

export const getLeagueOdds = async (lg, eventId, { final = false } = {}) => {
  const json = await fetchJson(`${CORE(lg)}/events/${eventId}/competitions/${eventId}/odds`, {
    ttlMs: final ? 24 * 60 * MIN : 5 * MIN,
  });
  return parseEventOdds(json);
};

export const getLeaguePredictor = async (lg, eventId) => {
  const json = await fetchJson(`${CORE(lg)}/events/${eventId}/competitions/${eventId}/predictor`, {
    ttlMs: 60 * MIN,
  }).catch(() => null);
  return parsePredictor(json);
};

// ---------- teams and players ----------

export const getLeagueTeamSchedule = async (lg, teamId, season) =>
  parseTeamSchedule(
    await fetchJson(`${SITE(lg)}/teams/${teamId}/schedule${season ? `?season=${season}` : ''}`, { ttlMs: 30 * MIN }),
  ).map((g) => ({ ...g, away: tag(lg)(g.away), home: tag(lg)(g.home) }));

export const getLeagueRoster = async (lg, teamId) => {
  const json = await fetchJson(`${SITE(lg)}/teams/${teamId}/roster`, { ttlMs: 6 * 60 * MIN });
  const groups = json?.athletes || [];
  // NBA: a flat list; MLB: grouped by position
  const flat = groups.flatMap((g) => (g?.items ? g.items : [g]));
  return flat
    .filter((a) => a?.id)
    .map((a) => ({
      id: String(a.id),
      name: a.displayName || a.fullName || '',
      shortName: a.shortName || a.displayName || '',
      position: a.position?.abbreviation || '',
      jersey: a.jersey || '',
      headshot: a.headshot?.href || null,
      injured: (a.injuries || []).some((i) => /out|injur|day-to-day/i.test(i.status || i.type?.description || '')),
    }));
};

// A player's recent games, stats kept as ESPN shows them ("1-4" stays "1-4").
export const getLeagueGameLog = async (lg, athleteId) => {
  const json = await fetchJson(`${WEB(lg)}/athletes/${athleteId}/gamelog`, { ttlMs: 30 * MIN });
  const meta = json?.events || {};
  const games = [];
  const seen = new Set();
  (json?.seasonTypes || []).forEach((st) =>
    (st?.categories || []).forEach((cat) =>
      (cat?.events || []).forEach((ev) => {
        const id = String(ev?.eventId ?? '');
        if (!id || seen.has(id)) return;
        seen.add(id);
        const m = meta[id] || {};
        games.push({
          id,
          date: m.gameDate || null,
          opp: `${m.atVs === '@' ? '@' : 'vs'} ${m.opponent?.abbreviation || ''}`.trim(),
          result: m.gameResult || '',
          score: m.score || '',
          stats: ev.stats || [],
        });
      }),
    ),
  );
  games.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  return { labels: json?.labels || [], games };
};
