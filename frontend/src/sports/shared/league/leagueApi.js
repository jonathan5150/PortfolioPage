// ESPN data for the daily-schedule leagues (NBA, MLB, NHL). Same proxy, cache and
// parsers as the NFL page wherever ESPN's shapes match; league-specific bits
// (box scores, MLB's count and bases) are parsed here.
import { fetchJson, runWithConcurrency } from '../api/http';
import { readPreference, writePreference } from '../hooks/usePersistentState';
import { parseEvent, parseTeam, parseTeamSchedule, parseStatus } from '../api/espnParsers';
import {
  parseEventOdds,
  parseLiveOdds,
  parsePregameOdds,
  parsePredictor,
} from '../api/betting';

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
  nhl: {
    key: 'nhl',
    label: 'NHL',
    path: 'hockey/nhl',
    lineLabel: 'PUCK LINE',
    regulationPeriods: 3,
    // a 60% favourite is worth about half a goal
    marginScale: 1.25,
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

// MLB probable starters with their season line (ERA, W-L) when ESPN lists them;
// NHL probable starting goalies (ESPN lists their names, seldom their numbers)
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
      const gaa = stat('GAA');
      const svPct = stat('SV%');
      return [
        w !== undefined && l !== undefined ? `${w}-${l}` : null,
        era ? `${era} ERA` : null,
        gaa ? `${gaa} GAA` : null,
        svPct ? `${svPct} SV%` : null,
      ]
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

// ---------- a day's games, small and remembered ----------
// Model results need every finished game's teams, start and score (for rest
// days and grading), not whole scoreboards. A finished day never changes, so
// its compact list is kept in localStorage and only downloaded once.
const compactSide = (c) =>
  c && {
    teamId: c.teamId,
    score: c.score,
    winner: c.winner,
    team: c.team && {
      id: c.team.id,
      abbreviation: c.team.abbreviation,
      name: c.team.name,
      displayName: c.team.displayName,
      league: c.team.league,
    },
  };
const compactGame = (g) => ({
  id: g.id,
  date: g.date,
  status: { state: g.status.state },
  seasonType: g.seasonType ?? null,
  homeId: g.home?.teamId,
  awayId: g.away?.teamId,
  away: compactSide(g.away),
  home: compactSide(g.home),
});
const dayStore = (lg) => `${lg}Days:v2`;
export const getDayGames = async (lg, key) => {
  const saved = readPreference(dayStore(lg), {});
  if (saved[key]) return saved[key];
  const board = await getLeagueScoreboard(lg, key);
  const games = board.events.map(compactGame);
  const today = dayKey(new Date());
  if (key < today && games.every((g) => g.status.state === 'post')) {
    writePreference(dayStore(lg), { ...readPreference(dayStore(lg), {}), [key]: games });
  }
  return games;
};

// The games in the week before `game` (for rest days).
export const getEarlierGames = async (lg, game) => {
  const d = new Date(game.date);
  const keys = Array.from({ length: 7 }, (_, i) => {
    const k = new Date(d.getFullYear(), d.getMonth(), d.getDate() - i);
    return dayKey(k);
  });
  const days = await runWithConcurrency(
    keys.map((k) => () => getDayGames(lg, k)),
    3,
  );
  return days.flatMap((r) => (r.ok ? r.value : []));
};

// Every finished regular-season (and playoff) game of the current season so far
// (ESPN's game days up to today; preseason games left out).
export const getSeasonFinished = async (lg) => {
  const today = dayKey(new Date());
  // eslint-disable-next-line no-use-before-define
  const keys = (await ondays(lg)).filter((k) => k <= today);
  const days = await runWithConcurrency(
    keys.map((k) => () => getDayGames(lg, k)),
    3,
  );
  const seen = new Set();
  return days
    .flatMap((r) => (r.ok ? r.value : []))
    .filter((g) => g.status.state === 'post' && g.seasonType !== 1 && !seen.has(g.id) && seen.add(g.id));
};

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
// ESPN's list of this season's game days (YYYYMMDD, sorted). Only the current
// season, and only what's scheduled so far.
const ondays = async (lg) => {
  const json = await fetchJson(`${CORE(lg)}/calendar/ondays`, { ttlMs: 6 * 60 * MIN }).catch(() => null);
  return (json?.eventDate?.dates || [])
    .map((d) => String(d).slice(0, 10).replace(/-/g, ''))
    .filter((k) => k.length === 8)
    .sort();
};

// The days in one month (year, monthIndex 0-11) that have games, as a Set of
// YYYYMMDD. Days inside ESPN's season list come from it; anything outside
// (offseason, a future or past season) is checked one day at a time.
export const getLeagueEventDays = async (lg, year, month) => {
  const count = new Date(year, month + 1, 0).getDate();
  const keys = Array.from({ length: count }, (_, i) => dayKey(new Date(year, month, i + 1)));
  const known = await ondays(lg);
  const lo = known[0];
  const hi = known[known.length - 1];
  const out = new Set(known.filter((k) => keys.includes(k)));
  let unknown = keys.filter((k) => !lo || k < lo || k > hi);
  // offseason months are usually empty: one month-wide request settles that
  // instead of checking every day
  if (unknown.length && !(await firstEvent(lg, `${year}${String(month + 1).padStart(2, '0')}`))) unknown = [];
  const probed = await runWithConcurrency(
    unknown.map((k) => async () => ((await hasGames(lg, k)) ? k : null)),
    6,
  );
  probed.forEach((r) => r.ok && r.value && out.add(r.value));
  return out;
};

/* eslint-disable no-await-in-loop */
export const findGameDay = async (lg, fromDay, dir) => {
  // inside the season ESPN has listed: its next / previous game day
  const known = await ondays(lg);
  if (known.length && fromDay >= known[0] && fromDay <= known[known.length - 1]) {
    const next = dir > 0 ? known.find((k) => k > fromDay) : [...known].reverse().find((k) => k < fromDay);
    if (next) return next;
  }
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

// NHL box scores: ESPN lists blocks, hits and takeaways first; skaters lead
// with goals, assists, shots, +/- and ice time instead, goalies with their
// save numbers, then whatever else ESPN lists
const NHL_LEAD = {
  goalies: ['SV%', 'SA', 'SV', 'GA', 'TOI'],
  skaters: ['G', 'A', 'SOG', '+/-', 'TOI'],
};
const NHL_TITLES = { forwards: 'Forwards', defenses: 'Defense', skaters: 'Skaters', goalies: 'Goalies' };
const leadFirst = (labels, lead) => {
  const all = labels.map((_, i) => i);
  const first = lead.map((l) => labels.indexOf(l)).filter((i) => i >= 0);
  return [...first, ...all.filter((i) => !first.includes(i))];
};
const pick = (list, order) => (list?.length ? order.map((i) => list[i]) : list || []);

const parseBoxScore = (json, lg) =>
  (json?.boxscore?.players || []).map((p) => ({
    teamId: String(p?.team?.id ?? ''),
    team: p?.team ? { ...parseTeam(p.team), league: lg } : null,
    groups: (p?.statistics || [])
      .map((cat) => {
        const kind = cat.type || cat.name || '';
        const labels = cat.labels || cat.names || [];
        const order =
          lg === 'nhl' ? leadFirst(labels, NHL_LEAD[kind === 'goalies' ? 'goalies' : 'skaters']) : labels.map((_, i) => i);
        return {
          name: kind,
          title:
            cat.text ||
            cat.displayName ||
            (lg === 'nhl' ? NHL_TITLES[kind] : '') ||
            (cat.type === 'pitching' ? 'Pitching' : cat.type === 'batting' ? 'Batting' : ''),
          labels: pick(labels, order),
          totals: pick(cat.totals, order),
          players: (cat.athletes || [])
            .filter((a) => (a.stats || []).length)
            .map((a) => ({
              id: a.athlete?.id ? String(a.athlete.id) : null,
              name: a.athlete?.shortName || a.athlete?.displayName || '',
              position: a.athlete?.position?.abbreviation || a.position?.abbreviation || '',
              starter: Boolean(a.starter),
              stats: pick(a.stats, order),
            })),
        };
      })
      // the NHL's "skaters" group comes empty (its players are under forwards and defense)
      .filter((g) => lg !== 'nhl' || g.players.length),
  }));

// A finished game's box score never changes, so it's kept for hours (and its
// parsed copy kept too, so an opened game can show it on its very first frame).
const finishedSummaries = new Map();
export const peekLeagueSummary = (lg, eventId) => finishedSummaries.get(`${lg}:${eventId}`);
export const getLeagueSummary = async (lg, eventId, { live = false, final = false } = {}) => {
  const json = await fetchJson(`${SITE(lg)}/summary?event=${eventId}`, {
    ttlMs: live ? 0 : final ? 12 * 60 * MIN : 5 * MIN,
  });
  const summary = {
    status: parseStatus(json?.header?.competitions?.[0]?.status),
    box: parseBoxScore(json, lg),
  };
  if (final) finishedSummaries.set(`${lg}:${eventId}`, summary);
  return summary;
};

export const getLeagueOdds = async (lg, eventId, { final = false } = {}) => {
  const json = await fetchJson(`${CORE(lg)}/events/${eventId}/competitions/${eventId}/odds`, {
    ttlMs: final ? 24 * 60 * MIN : 5 * MIN,
  });
  return parseEventOdds(json);
};

// While a game is on: the pregame line and the live one, from one download
// that's only cached for a few seconds.
export const getLeagueLiveLines = async (lg, eventId) => {
  const json = await fetchJson(`${CORE(lg)}/events/${eventId}/competitions/${eventId}/odds`, { ttlMs: 10 * 1000 });
  return { pregame: parsePregameOdds(json), live: parseLiveOdds(json) };
};

// ESPN's win-probability model. It has none for the NHL (every request is
// refused), so NHL picks go on the betting market alone.
export const getLeaguePredictor = async (lg, eventId) => {
  if (lg === 'nhl') return null;
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
  // NBA: a flat list; MLB and NHL: grouped by position
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

// The team's headline player this season: the NBA's points-per-game leader,
// MLB's home run leader, the NHL's points leader. Falls back to last season early on (spring training,
// opening week) when this season has no leaders yet. Athlete ids, best first,
// so the caller can skip anyone who has since left the team.
export const getLeagueTeamLeaders = async (lg, teamId, date) => {
  if (!teamId) return [];
  const d = date ? new Date(date) : new Date();
  // NBA and NHL seasons are named for the year they end in
  const season = (lg === 'nba' || lg === 'nhl') && d.getMonth() >= 7 ? d.getFullYear() + 1 : d.getFullYear();
  const category = { nba: 'pointsPerGame', mlb: 'homeRuns', nhl: 'points' }[lg] || 'points';
  const leadersIn = async (yr) => {
    const json = await fetchJson(`${CORE(lg)}/seasons/${yr}/types/2/teams/${teamId}/leaders`, {
      ttlMs: 60 * MIN,
    }).catch(() => null);
    return (json?.categories?.find((c) => c.name === category)?.leaders || [])
      .map((l) => String(l?.athlete?.$ref || '').match(/athletes\/(\d+)/)?.[1])
      .filter(Boolean);
  };
  const now = await leadersIn(season);
  return now.length ? now : leadersIn(season - 1);
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
