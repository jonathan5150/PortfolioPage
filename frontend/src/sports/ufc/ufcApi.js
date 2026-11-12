// ESPN data for the UFC page: events (fight cards), each fight's card segment,
// result and odds, and fighters' tale of the tape.
import { fetchJson, runWithConcurrency } from '../../pages/NFLData/NFLDataApi/http';
import { parseStatus } from '../../pages/NFLData/NFLDataApi/espnParsers';
import { parseOddsLinks } from '../../pages/NFLData/NFLDataApi/betting';

const SITE = 'https://site.api.espn.com/apis/site/v2/sports/mma/ufc';
const CORE = 'https://sports.core.api.espn.com/v2/sports/mma/leagues/ufc';
const WEB = 'https://site.web.api.espn.com/apis/common/v3/sports/mma';
const MIN = 60 * 1000;

export const headshotUrl = (id) => `https://a.espncdn.com/i/headshots/mma/players/full/${id}.png`;
const refId = (ref) => String(ref || '').match(/athletes\/(\d+)/)?.[1] || null;
// an event's date as ESPN's scoreboard expects it: the US Eastern calendar day
export const etDay = (iso) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(iso))
    .replace(/-/g, '');

const parseFighter = (c) => ({
  id: String(c?.athlete?.id || c?.id || ''),
  name: c?.athlete?.displayName || c?.athlete?.fullName || '',
  shortName: c?.athlete?.shortName || '',
  lastName: (c?.athlete?.displayName || '').split(' ').slice(1).join(' ') || c?.athlete?.displayName || '',
  record:
    c?.records?.find((r) => r.type === 'total' || r.name === 'overall')?.summary || c?.records?.[0]?.summary || '',
  flag: c?.athlete?.flag?.href || null,
  country: c?.athlete?.flag?.alt || '',
  winner: Boolean(c?.winner),
  order: c?.order ?? 0,
});

const parseFight = (f, index) => {
  const fighters = (f.competitors || []).map(parseFighter).sort((a, b) => a.order - b.order);
  return {
    id: String(f.id),
    order: index, // card order: early prelims first, main event last
    date: f.date || f.startDate || null,
    weightClass: f.type?.abbreviation || '',
    rounds: f.format?.regulation?.periods || 3,
    status: parseStatus(f.status),
    red: fighters[0] || null,
    blue: fighters[1] || null,
  };
};

export const parseUfcScoreboard = (json) => {
  const e = json?.events?.[0];
  return {
    // every event on the calendar: { label, startDate, day }
    calendar: (json?.leagues?.[0]?.calendar || [])
      .filter((c) => c?.startDate)
      .map((c) => ({ label: c.label || '', startDate: c.startDate, day: etDay(c.startDate) })),
    event: e
      ? {
          id: String(e.id),
          name: e.name || '',
          shortName: e.shortName || '',
          date: e.date || null,
          status: parseStatus(e.status),
          venue: e.venues?.[0]?.fullName || e.competitions?.[0]?.venue?.fullName || '',
          city: [e.venues?.[0]?.address?.city, e.venues?.[0]?.address?.state].filter(Boolean).join(', '),
          fights: (e.competitions || []).map(parseFight),
        }
      : null,
  };
};

// No day: ESPN's current / next event.
export const getUfcScoreboard = async (day, { live = false } = {}) =>
  parseUfcScoreboard(
    await fetchJson(`${SITE}/scoreboard${day ? `?dates=${day}` : ''}`, { ttlMs: live ? 0 : 60 * 1000 }),
  );

// The days in one month (year, monthIndex 0-11) with a UFC event, as a Set of
// YYYYMMDD (US Eastern), from that year's event calendar.
export const getUfcEventDays = async (year, month) => {
  const json = await fetchJson(`${SITE}/scoreboard?dates=${year}`, { ttlMs: 6 * 60 * MIN }).catch(() => null);
  const prefix = `${year}${String(month + 1).padStart(2, '0')}`;
  return new Set(
    parseUfcScoreboard(json)
      .calendar.map((c) => c.day)
      .filter((d) => d.startsWith(prefix)),
  );
};

// Card segment (Main Card / Prelims / Early Prelims) and result for each fight.
export const getUfcFightDetails = async (eventId, fights, { live = false } = {}) => {
  const results = await runWithConcurrency(
    fights.map((f) => async () => {
      const [core, status] = await Promise.all([
        fetchJson(`${CORE}/events/${eventId}/competitions/${f.id}`, { ttlMs: 60 * MIN }),
        f.status.state === 'post' || live
          ? fetchJson(`${CORE}/events/${eventId}/competitions/${f.id}/status`, {
              ttlMs: f.status.state === 'post' ? 24 * 60 * MIN : 0,
            }).catch(() => null)
          : null,
      ]);
      const r = status?.result;
      return {
        id: f.id,
        segment: core?.cardSegment?.description || '',
        segmentKey: core?.cardSegment?.name || '',
        result: r
          ? {
              method: r.shortDisplayName || r.displayName || '',
              detail: r.displayDescription || r.description || '',
              round: status.period || null,
              clock: status.displayClock || '',
            }
          : null,
      };
    }),
    4,
  );
  const out = {};
  results.forEach((r) => {
    if (r.ok && r.value) out[r.value.id] = r.value;
  });
  return out;
};

// The fight's moneyline for each fighter, keyed by athlete id.
export const getUfcOdds = async (eventId, fightId, { final = false } = {}) => {
  const json = await fetchJson(`${CORE}/events/${eventId}/competitions/${fightId}/odds`, {
    ttlMs: final ? 24 * 60 * MIN : 10 * MIN,
  });
  const item = (json?.items || []).find((i) => !/live/i.test(i.provider?.name || '')) || json?.items?.[0];
  if (!item) return null;
  const side = (o) => (o ? { id: refId(o.athlete?.$ref), moneyLine: Number(o.moneyLine) || null } : null);
  const away = side(item.awayAthleteOdds);
  const home = side(item.homeAthleteOdds);
  const byId = {};
  [away, home].forEach((s) => {
    if (s?.id && s.moneyLine) byId[s.id] = s.moneyLine;
  });
  // DraftKings bet-slip links, keyed by fighter like the prices
  const links = parseOddsLinks(item.links);
  const linksById = {};
  if (away?.id && links.awayMl) linksById[away.id] = links.awayMl;
  if (home?.id && links.homeMl) linksById[home.id] = links.homeMl;
  return {
    provider: item.provider?.name || 'Sportsbook',
    byId,
    linksById,
    rounds: item.overUnder ?? null,
    overOdds: item.overOdds ?? null,
    underOdds: item.underOdds ?? null,
  };
};

// Tale of the tape.
export const getUfcFighter = async (id) => {
  const json = await fetchJson(`${WEB}/athletes/${id}`, { ttlMs: 6 * 60 * MIN });
  const a = json?.athlete || {};
  const stat = (name) => a.statsSummary?.statistics?.find((s) => s.name === name)?.displayValue;
  const wld = stat('wins-losses-draws');
  // "7-0" = 7 wins by (T)KO, 0 losses that way; only the wins are shown
  const firstOf = (v) => (v ? String(v).split('-')[0] : '');
  return {
    koWins: firstOf(stat('tkos-tkoLosses')),
    subWins: firstOf(stat('submissions-submissionLosses')),
    id,
    name: a.displayName || '',
    nickname: a.nickname || '',
    headshot: a.headshot?.href || headshotUrl(id),
    record: wld || '',
    age: a.age ?? null,
    height: a.displayHeight || '',
    weight: a.displayWeight || '',
    reach: a.displayReach || '',
    stance: a.stance?.text || '',
    style: a.displayFightingStyle || '',
    country: a.citizenship || a.flag?.alt || '',
  };
};
