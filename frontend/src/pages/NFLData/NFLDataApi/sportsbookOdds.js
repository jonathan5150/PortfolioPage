// DraftKings odds plumbing.
//   - Game lines come from ESPN's odds feed (which is DraftKings) and carry
//     DraftKings bet-slip links; parseBetslipLink / parlayUrl handle those.
//   - Anytime TD prices come from SportsGameOdds through the same-origin /sgo
//     proxy (key stays server-side): one cheap request for the whole slate.
//     DraftKings' TD links there are shared between players, so TD bets can't
//     be linked and are added in DraftKings by hand.
import { fetchJson } from './http';
import { hasStarted, frozenOdds, saveOddsSnapshot } from './oddsSnapshots';

const MINUTE = 60 * 1000;

export const BOOK = { id: 'draftkings', name: 'DraftKings' };

// "Kenneth Walker III" / "KENNETH_WALKER_1_NFL" -> "kenneth walker"
export const normalizeName = (name) =>
  String(name || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/_\d+_NFL$/i, '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/[.'’]/g, '')
    .replace(/\b(jr|sr|ii|iii|iv|v)\b/g, '')
    .replace(/[^a-z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const toNumber = (v) => {
  if (v === null || v === undefined || v === '') return null;
  if (/^even$/i.test(String(v).trim())) return 100;
  const n = Number(String(v).replace('+', ''));
  return Number.isFinite(n) ? n : null;
};

// https://sportsbook.draftkings.com/event/34118128?outcomes=0ML84695561_3 (possibly
// wrapped in an affiliate gateway link) -> { url, eventId, outcome }
export const parseBetslipLink = (href) => {
  if (!href) return null;
  let text = String(href);
  try {
    text = decodeURIComponent(text);
  } catch {
    // keep the raw link
  }
  const match = text.match(/draftkings\.com\/event\/(\d+)\?outcomes=([^&\s]+)/);
  if (!match) return null;
  const [, eventId, outcome] = match;
  return {
    url: `https://sportsbook.draftkings.com/event/${eventId}?outcomes=${encodeURIComponent(outcome)}`,
    eventId,
    outcome,
  };
};

// One DraftKings bet-slip link with every leg's outcome id, joined by '+'.
// Some ids contain '#', which must be escaped or the URL would end there.
export const parlayUrl = (legs) => {
  const linked = legs.map((l) => l.link).filter((l) => l?.eventId && l?.outcome);
  if (!linked.length) return null;
  const outcomes = linked.map((l) => encodeURIComponent(l.outcome)).join('+');
  return `https://sportsbook.draftkings.com/event/${linked[0].eventId}?outcomes=${outcomes}`;
};

const bookOf = (odd) => {
  const b = odd?.byBookmaker?.[BOOK.id];
  return b && b.available !== false ? b : null;
};

// ---------- parsing ----------

// Anytime TD price + link per player: the yes/no touchdowns market, or an over 0.5 line.
const parseTouchdowns = (event) => {
  const players = {};
  Object.values(event?.odds || {}).forEach((odd) => {
    if (odd.statID !== 'touchdowns' || odd.periodID !== 'game') return;
    const playerID = odd.playerID || (!['home', 'away', 'all'].includes(odd.statEntityID) ? odd.statEntityID : null);
    if (!playerID) return;
    const b = bookOf(odd);
    if (!b) return;
    const isYes = odd.betTypeID === 'yn' && odd.sideID === 'yes';
    const isOverHalf =
      odd.betTypeID === 'ou' && odd.sideID === 'over' && toNumber(b.overUnder ?? odd.bookOverUnder) === 0.5;
    if (!isYes && !isOverHalf) return;

    const key = normalizeName(event.players?.[playerID]?.name || playerID);
    if (players[key] && !isYes) return; // prefer the yes/no market
    players[key] = { anytimeTd: { yes: { price: toNumber(b.odds), link: parseBetslipLink(b.deeplink) } } };
  });

  // A link shared by several players points at a whole market, not one player: drop it.
  const counts = new Map();
  Object.values(players).forEach((p) => {
    const url = p.anytimeTd.yes.link?.url;
    if (url) counts.set(url, (counts.get(url) || 0) + 1);
  });
  Object.values(players).forEach((p) => {
    if (counts.get(p.anytimeTd.yes.link?.url) > 1) p.anytimeTd.yes.link = null;
  });
  return players;
};

export const parseSgoEvent = (event) => ({ players: parseTouchdowns(event) });

export const findSgoEvent = (events, game) => {
  const home = game.home?.team?.displayName;
  const away = game.away?.team?.displayName;
  const kickoff = game.date ? new Date(game.date).getTime() : null;
  return (
    (events || []).find((e) => {
      if (e.teams?.home?.names?.long !== home || e.teams?.away?.names?.long !== away) return false;
      const starts = e.status?.startsAt || e.startsAt;
      return !kickoff || !starts || Math.abs(new Date(starts).getTime() - kickoff) < 36 * 60 * MINUTE;
    }) || null
  );
};

// ---------- fetching ----------

// The free SportsGameOdds plan has a monthly cap, so TD odds refresh at most
// once per 6-hour window (about 4 requests a day for the whole site, since the
// proxy caches each window's slate at the edge).
const HOUR = 60 * MINUTE;
const SLATE_WINDOW = 6 * HOUR;
const windowStart = (now = Date.now()) => Math.floor(now / SLATE_WINDOW) * SLATE_WINDOW;
const slateExpiry = () => windowStart() + SLATE_WINDOW;
const STORAGE_KEY = 'nflStatsWizard:sgoSlate:v3'; // v1: unfiltered 15 MB slate, v2: another book
let slateCache = null;

// The free plan allows 10 requests a minute, so the slate is also kept in
// localStorage for 30 minutes: reloading the page doesn't spend a request.
const readStoredSlate = () => {
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null');
    return stored && stored.expires > Date.now() && stored.book === BOOK.id ? stored.events : null;
  } catch {
    return null;
  }
};
const storeSlate = (events) => {
  try {
    ['nflStatsWizard:sgoSlate', 'nflStatsWizard:sgoSlate:v2'].forEach((k) => window.localStorage.removeItem(k));
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ book: BOOK.id, expires: slateExpiry(), events }));
  } catch {
    // storage full or blocked – the in-memory cache still works
  }
};

// Only anytime TD odds. Without this filter the slate is ~15 MB (every prop
// the book offers); with it, well under 1 MB. PLAYER_ID matches any player.
export const SLATE_ODD_IDS = ['touchdowns-PLAYER_ID-game-yn-yes'];

const requestSlate = async () => {
  // Rounded to the 6-hour window so everyone in that window sends the identical
  // URL and the proxy's edge cache answers instead of spending the quota.
  const start = windowStart();
  const query = new URLSearchParams({
    leagueID: 'NFL',
    oddsAvailable: 'true',
    bookmakerID: BOOK.id,
    startsAfter: new Date(start - SLATE_WINDOW).toISOString(),
    startsBefore: new Date(start + 6 * 24 * HOUR + SLATE_WINDOW).toISOString(),
    limit: '50',
    oddID: SLATE_ODD_IDS.join(','),
  });
  const url = `/sgo/events?${query}`;
  try {
    return (await fetchJson(url, { ttlMs: 0, timeoutMs: 20000 }))?.data || [];
  } catch (error) {
    // One retry for rate limits and hiccups; a missing key won't fix itself.
    if (error.status === 503) throw error;
    await new Promise((resolve) => setTimeout(resolve, error.status === 429 ? 6000 : 1500));
    return (await fetchJson(url, { ttlMs: 0, timeoutMs: 20000 }))?.data || [];
  }
};

// This week's NFL games with anytime TD odds, in one request (~1 object per game).
const getSgoSlate = async () => {
  if (slateCache && slateCache.expires > Date.now()) return slateCache.value;
  const stored = readStoredSlate();
  if (stored) {
    slateCache = { value: Promise.resolve(stored), expires: slateExpiry() };
    return stored;
  }
  const promise = requestSlate().then((events) => {
    storeSlate(events);
    return events;
  });
  slateCache = { value: promise, expires: slateExpiry() };
  try {
    return await promise;
  } catch (error) {
    slateCache = null; // never cache a failure
    throw error;
  }
};

// { odds: { players } | null, problem, frozen } for one game. problem says why
// odds are missing: null (fine), 'nokey', 'ratelimit', 'offline', 'notlisted'
// or 'started' (kicked off before this device saved its pre-game odds).
// Once a game starts, its odds are the ones saved about 30 minutes before kickoff.
export const getBookOdds = async (game) => {
  if (hasStarted(game)) {
    const saved = frozenOdds(game, 'td');
    return saved ? { odds: saved, problem: null, frozen: true } : { odds: null, problem: 'started' };
  }
  try {
    const event = findSgoEvent(await getSgoSlate(), game);
    if (!event) return { odds: null, problem: 'notlisted' };
    const odds = parseSgoEvent(event);
    saveOddsSnapshot(game, 'td', odds);
    return { odds, problem: null };
  } catch (error) {
    // The proxy answers 503 when SGO_API_KEY isn't configured.
    const problem = error.status === 503 ? 'nokey' : error.status === 429 ? 'ratelimit' : 'offline';
    console.warn(`${BOOK.name} odds unavailable:`, error.message);
    return { odds: null, problem };
  }
};

export const playerMarketsFor = (bookOdds, playerName) => bookOdds?.players?.[normalizeName(playerName)] || null;
