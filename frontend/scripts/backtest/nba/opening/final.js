// The final NBA strategy, at real opening prices (2016-17 openers at -110):
//   TOTAL  at the open: our fitted scoring model 6+ points off the opening total (both teams 10+ games)
//   SPREAD at the open: the side with 2+ more days of rest
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
const by = {}; S.forEach((s) => (by[s] = { t: [], s: [] }));
rows.forEach((r) => {
  if (Math.min(r.nH, r.nA) >= 10 && Math.abs(r.perfTotal - r.openTotal) >= 6) by[r.season].t.push(tot(r, r.perfTotal > r.openTotal ? 'over' : 'under'));
  const rs = r.restH - r.restA >= 2 ? 'home' : r.restA - r.restH >= 2 ? 'away' : null;
  if (rs) by[r.season].s.push(sp(r, rs));
});
const fmt = (l) => { const u = l.reduce((a, b) => a + b, 0); const w = l.filter((x) => x > 0).length; const lo = l.filter((x) => x < 0).length; return `${w}-${lo}`.padStart(8) + `${u >= 0 ? '+' : ''}${u.toFixed(1)}u`.padStart(9) + `${(100 * u / Math.max(1, l.length)).toFixed(1)}%`.padStart(8); };
console.log('season     totals (6+ off opener)        spread (rest edge 2+)         together');
let T = [], P = [];
S.forEach((s) => { const all = [...by[s].t, ...by[s].s]; T = T.concat(by[s].t); P = P.concat(by[s].s); console.log(`${s}${fmt(by[s].t)}     ${fmt(by[s].s)}     ${fmt(all)}`); });
console.log(`ALL ${fmt(T)}     ${fmt(P)}     ${fmt([...T, ...P])}`);
