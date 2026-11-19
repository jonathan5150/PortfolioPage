// The NBA's every-game picks, all three markets at the opening line and price
// (2016-17 openers at -110; moneylines only 2024 on, where opening prices were kept):
//   SPREAD    the side with 2+ more days of rest, else the opening favourite
//   MONEYLINE the same team
//   TOTAL     the under when our scoring ratings are 2+ points below the opening total, else the over
const fs = require('fs');
const path = require('path');
const rows = JSON.parse(fs.readFileSync(path.join(__dirname, 'rows.json'), 'utf8')).filter((r) => r.openSpread !== null && r.openTotal !== null);
const open = new Map();
for (const y of [2024, 2025, 2026, 2027]) JSON.parse(fs.readFileSync(path.join(__dirname, 'data', `games-${y}.json`), 'utf8')).forEach((g) => open.set(g.id, g));
const S = [...new Set(rows.map((r) => r.season))].sort();
const payout = (p) => (p > 0 ? p / 100 : 100 / -p);
const price = (r, k) => { const g = open.get(r.id); return g && Number.isFinite(g[k]) && Math.abs(g[k]) >= 100 ? g[k] : -110; };
const tot = (r, side) => { const d = r.homeScore + r.awayScore - r.openTotal; if (d === 0) return 0; return (side === 'over' ? d > 0 : d < 0) ? payout(price(r, side === 'over' ? 'openOverOdds' : 'openUnderOdds')) : -1; };
const sp = (r, side) => { const c = r.homeScore - r.awayScore + r.openSpread; if (c === 0) return 0; return (side === 'home' ? c > 0 : c < 0) ? payout(price(r, side === 'home' ? 'openHomeSpreadOdds' : 'openAwaySpreadOdds')) : -1; };
const ml = (r, side) => { const g = open.get(r.id); const p = side === 'home' ? g?.openHomeML : g?.openAwayML; if (!Number.isFinite(p) || Math.abs(p) < 100) return null; const m = r.homeScore - r.awayScore; return (side === 'home' ? m > 0 : m < 0) ? payout(p) : -1; };
const team = (r) => (r.restH - r.restA >= 2 ? 'home' : r.restA - r.restH >= 2 ? 'away' : r.openSpread < 0 ? 'home' : 'away');
const by = {}; S.forEach((s) => (by[s] = { m: [], s: [], t: [] }));
rows.forEach((r) => {
  by[r.season].s.push(sp(r, team(r)));
  by[r.season].t.push(tot(r, r.perfTotal - r.openTotal <= -2 ? 'under' : 'over'));
  const v = ml(r, team(r)); if (v !== null) by[r.season].m.push(v);
});
const fmt = (l) => { const u = l.reduce((a, b) => a + b, 0); const w = l.filter((x) => x > 0).length; const lo = l.filter((x) => x < 0).length; return `${w}-${lo}`.padStart(10) + `${u >= 0 ? '+' : ''}${u.toFixed(1)}u`.padStart(9) + `${(100 * u / Math.max(1, l.length)).toFixed(1)}%`.padStart(7); };
console.log('season   moneyline                spread                   total                    all');
const A = { m: [], s: [], t: [] };
S.forEach((s) => { ['m', 's', 't'].forEach((k) => (A[k] = A[k].concat(by[s][k]))); console.log(`${s}${fmt(by[s].m)}   ${fmt(by[s].s)}   ${fmt(by[s].t)}   ${fmt([...by[s].m, ...by[s].s, ...by[s].t])}`); });
console.log(`ALL ${fmt(A.m)}   ${fmt(A.s)}   ${fmt(A.t)}   ${fmt([...A.m, ...A.s, ...A.t])}`);
