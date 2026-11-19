// NBA opening-line backtest data (node collect.js 2016 2017 ... 2027): like ../collect.js,
// plus the opening line and opening prices ESPN keeps, and the consensus line where
// DraftKings / ESPN BET aren't there (older seasons).
// NBA backtest data: every regular-season game with its final score and the
// closing line (DraftKings, else ESPN BET, else the first full pre-game book).
// Writes scripts/backtest/nba/games-<season>.json. Re-runnable: finished
// seasons are skipped if already written. Usage: node collect.js 2023 2024 ...
// (season = the year the season ends, e.g. 2024 = 2023-24).
const https = require('https');
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const OUT = require('path').join(__dirname, 'data');
const SITE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';
const CORE = 'https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba';

const get = (url, tries = 4) =>
  new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'accept-encoding': 'gzip', 'user-agent': 'backtest' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        resolve(get(res.headers.location, tries));
        return;
      }
      const chunks = [];
      const stream = res.headers['content-encoding'] === 'gzip' ? res.pipe(zlib.createGunzip()) : res;
      stream.on('data', (c) => chunks.push(c));
      stream.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error(`${res.statusCode} ${url}`));
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        } catch (e) {
          reject(e);
        }
      });
      stream.on('error', reject);
    });
    req.setTimeout(20000, () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  }).catch(async (e) => {
    if (tries <= 1 || /^404/.test(e.message)) throw e;
    await new Promise((r) => setTimeout(r, 1500));
    return get(url, tries - 1);
  });

const pool = async (items, n, fn) => {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k], k).catch(() => null);
      }
    }),
  );
  return out;
};

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const pickBook = (items) => {
  const pre = (items || []).filter((i) => !/live/i.test(i.provider?.name || '') && i.spread !== undefined);
  const full = (i) => num(i.spread) !== null && num(i.overUnder) !== null && Math.abs(num(i.homeTeamOdds?.moneyLine) || 0) >= 100 && Math.abs(num(i.awayTeamOdds?.moneyLine) || 0) >= 100;
  return (
    pre.find((i) => /draftkings/i.test(i.provider?.name) && full(i)) ||
    pre.find((i) => /espn bet/i.test(i.provider?.name) && full(i)) ||
    pre.find((i) => /^consensus$/i.test(i.provider?.name) && full(i)) ||
    pre.find((i) => !/opening/i.test(i.provider?.name) && full(i)) ||
    null
  );
};
const openingBook = (items) => (items || []).find((i) => /^opening$/i.test(i.provider?.name || ''));

const season = async (yr) => {
  const file = path.join(OUT, `games-${yr}.json`);
  const teams = (await get(`${SITE}/teams?limit=40`)).sports[0].leagues[0].teams.map((t) => t.team);
  const byId = new Map();
  await pool(teams, 6, async (t) => {
    const s = await get(`${SITE}/teams/${t.id}/schedule?season=${yr}&seasontype=2`);
    (s.events || []).forEach((e) => {
      const c = e.competitions?.[0];
      if (!c || byId.has(e.id) || !c.status?.type?.completed) return;
      const side = (ha) => c.competitors.find((x) => x.homeAway === ha);
      const h = side('home');
      const a = side('away');
      byId.set(e.id, {
        id: e.id,
        date: e.date,
        neutral: Boolean(c.neutralSite),
        home: h.team.id,
        away: a.team.id,
        homeAbbr: h.team.abbreviation,
        awayAbbr: a.team.abbreviation,
        homeScore: num(h.score?.value ?? h.score),
        awayScore: num(a.score?.value ?? a.score),
      });
    });
  });
  const games = [...byId.values()].sort((x, y) => new Date(x.date) - new Date(y.date));
  console.log(yr, 'games', games.length, '- fetching odds');
  let done = 0;
  await pool(games, 10, async (g) => {
    const j = await get(`${CORE}/events/${g.id}/competitions/${g.id}/odds?limit=40`);
    const b = pickBook(j.items);
    done += 1;
    if (done % 200 === 0) console.log(yr, done, '/', games.length);
    if (!b) return;
    g.book = b.provider?.name;
    g.spread = num(b.spread); // home line
    g.total = num(b.overUnder);
    g.homeML = num(b.homeTeamOdds?.moneyLine);
    g.awayML = num(b.awayTeamOdds?.moneyLine);
    g.homeSpreadOdds = num(b.homeTeamOdds?.spreadOdds) ?? -110;
    g.awaySpreadOdds = num(b.awayTeamOdds?.spreadOdds) ?? -110;
    g.overOdds = num(b.overOdds) ?? -110;
    g.underOdds = num(b.underOdds) ?? -110;
    // opening line, for line-movement rules
    const op = openingBook(j.items);
    g.openSpread = num(b.homeTeamOdds?.open?.pointSpread?.american) ?? (op ? num(op.spread) : null);
    g.openTotal = num(b.open?.total?.american) ?? (op ? num(op.overUnder) : null);
    g.openHomeML = num(b.homeTeamOdds?.open?.moneyLine?.american);
    g.openHomeSpreadOdds = num(b.homeTeamOdds?.open?.spread?.american);
    g.openAwaySpreadOdds = num(b.awayTeamOdds?.open?.spread?.american);
    g.openOverOdds = num(b.open?.over?.american);
    g.openUnderOdds = num(b.open?.under?.american);
    g.closeHomeSpreadOdds = num(b.homeTeamOdds?.close?.spread?.american);
    g.closeTotal = num(b.close?.total?.american);
    g.openAwayML = num(b.awayTeamOdds?.open?.moneyLine?.american);
  });
  const withOdds = games.filter((g) => g.spread !== undefined && g.homeScore !== null);
  fs.writeFileSync(file, JSON.stringify(withOdds));
  console.log(yr, 'saved', withOdds.length, 'games with lines');
};

(async () => {
  for (const yr of process.argv.slice(2).map(Number)) {
    // eslint-disable-next-line no-await-in-loop
    await season(yr);
  }
})();
