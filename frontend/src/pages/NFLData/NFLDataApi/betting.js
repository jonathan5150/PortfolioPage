// Pure betting helpers: parse ESPN sportsbook data, grade past games against
// their closing lines, and turn the numbers into readable "highlights".
// No network or React in here, so everything is unit tested with fixtures.

const num = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (/^even$/i.test(String(value).trim())) return 100;
  const n = Number(String(value).replace(/[,+]/g, ''));
  return Number.isFinite(n) ? n : null;
};

const round1 = (n) => Math.round(n * 10) / 10;

// ---------- formatting ----------

export const fmtLine = (n) => {
  if (n === null || n === undefined) return '—';
  if (n === 0) return 'PK';
  return n > 0 ? `+${n}` : String(n);
};

export const fmtOdds = (n) => {
  if (n === null || n === undefined) return '—';
  return n > 0 ? `+${n}` : String(n);
};

// Moneyline -> implied win probability (0-100), ignoring the book's vig.
export const impliedProbability = (moneyLine) => {
  if (moneyLine === null || moneyLine === undefined || moneyLine === 0) return null;
  return moneyLine < 0 ? (-moneyLine / (-moneyLine + 100)) * 100 : (100 / (moneyLine + 100)) * 100;
};

const recordText = (r, keys = ['W', 'L', 'P']) =>
  keys
    .filter((k, i) => i < 2 || r[k])
    .map((k) => r[k] || 0)
    .join('-');

// ---------- parsers ----------

const parseOddsSide = (t, fallbackSpread) => ({
  favorite: Boolean(t?.favorite),
  moneyLine: num(t?.moneyLine ?? t?.current?.moneyLine?.american),
  openMoneyLine: num(t?.open?.moneyLine?.american),
  spreadLine: num(t?.current?.pointSpread?.american) ?? fallbackSpread,
  openSpreadLine: num(t?.open?.pointSpread?.american),
  spreadOdds: num(t?.spreadOdds ?? t?.current?.spread?.american),
});

// core API: events/{id}/competitions/{id}/odds. `spread` is the HOME team's line.
export const parseEventOdds = (json) => {
  const items = (json?.items || [])
    .filter((i) => i && (i.details || i.overUnder !== undefined || i.spread !== undefined))
    .sort((a, b) => (a.provider?.priority ?? 99) - (b.provider?.priority ?? 99));
  const item = items[0];
  if (!item) return null;

  const homeSpread = num(item.spread) ?? num(item.homeTeamOdds?.current?.pointSpread?.american);

  return {
    provider: item.provider?.name || 'Sportsbook',
    details: item.details || '',
    homeSpread,
    away: parseOddsSide(item.awayTeamOdds, homeSpread === null ? null : -homeSpread),
    home: parseOddsSide(item.homeTeamOdds, homeSpread),
    total: {
      line: num(item.overUnder ?? item.current?.total?.american),
      openLine: num(item.open?.total?.american),
      overOdds: num(item.overOdds ?? item.current?.over?.american),
      underOdds: num(item.underOdds ?? item.current?.under?.american),
    },
  };
};

// core API: events/{id}/competitions/{id}/predictor (ESPN FPI).
export const parsePredictor = (json) => {
  const pick = (side) => num(json?.[side]?.statistics?.find((s) => s.name === 'gameProjection')?.value);
  const home = pick('homeTeam');
  const away = pick('awayTeam');
  if (home === null && away === null) return null;
  return { home: home ?? (away !== null ? 100 - away : null), away: away ?? 100 - home };
};

// ---------- grading past games ----------

// Grades one completed game for `teamId` against its closing line and total.
export const gradeGame = (teamId, game, odds) => {
  const isHome = game.home?.teamId === teamId;
  const self = isHome ? game.home : game.away;
  const opp = isHome ? game.away : game.home;
  if (self?.score === null || self?.score === undefined || opp?.score === null || opp?.score === undefined) {
    return null;
  }

  const margin = self.score - opp.score;
  const line = odds?.homeSpread === null || odds?.homeSpread === undefined ? null : isHome ? odds.homeSpread : -odds.homeSpread;
  const cover = line === null ? null : margin + line;
  const total = self.score + opp.score;
  const overUnder = odds?.total?.line ?? null;

  return {
    gameId: game.id,
    date: game.date,
    week: game.week,
    isHome,
    oppAbbr: opp.team?.abbreviation || '',
    pointsFor: self.score,
    pointsAgainst: opp.score,
    margin,
    su: margin > 0 ? 'W' : margin < 0 ? 'L' : 'T',
    line,
    ats: cover === null ? null : cover > 0 ? 'W' : cover < 0 ? 'L' : 'P',
    coverMargin: cover,
    total,
    overUnder,
    ou: overUnder === null ? null : total > overUnder ? 'O' : total < overUnder ? 'U' : 'P',
  };
};

const tally = (list, key) =>
  list.reduce((acc, g) => {
    if (g[key]) acc[g[key]] = (acc[g[key]] || 0) + 1;
    return acc;
  }, {});

const streak = (list, key) => {
  const results = list.map((g) => g[key]).filter((r) => r && r !== 'P');
  if (!results.length) return null;
  const last = results[results.length - 1];
  let count = 0;
  for (let i = results.length - 1; i >= 0 && results[i] === last; i -= 1) count += 1;
  return { type: last, count };
};

const avg = (values) => {
  const v = values.filter((x) => x !== null && x !== undefined && Number.isFinite(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

// `graded` must be in chronological order.
export const computeTeamTrends = (graded) => {
  const games = graded.filter(Boolean);
  const withLine = games.filter((g) => g.ats);
  return {
    games: games.length,
    su: tally(games, 'su'),
    ats: tally(withLine, 'ats'),
    atsFav: tally(withLine.filter((g) => g.line < 0), 'ats'),
    atsDog: tally(withLine.filter((g) => g.line > 0), 'ats'),
    atsHome: tally(withLine.filter((g) => g.isHome), 'ats'),
    atsAway: tally(withLine.filter((g) => !g.isHome), 'ats'),
    ou: tally(games.filter((g) => g.ou), 'ou'),
    ppg: avg(games.map((g) => g.pointsFor)),
    papg: avg(games.map((g) => g.pointsAgainst)),
    avgCover: avg(withLine.map((g) => g.coverMargin)),
    suStreak: streak(games, 'su'),
    atsStreak: streak(withLine, 'ats'),
    last5: games.slice(-5),
  };
};

// ---------- player trends ----------

export const PLAYER_STAT_CONFIG = {
  passing: { stat: 'passingYards', label: 'pass yds', long: 'passing yards', tdStat: 'passingTouchdowns', minDiff: 25 },
  rushing: { stat: 'rushingYards', label: 'rush yds', long: 'rushing yards', tdStat: 'rushingTouchdowns', minDiff: 12 },
  receiving: { stat: 'receivingYards', label: 'rec yds', long: 'receiving yards', tdStat: 'receivingTouchdowns', minDiff: 12 },
};

// `games` are game-log rows (newest first) from every season we loaded, already
// limited to games played before this matchup.
export const computePlayerTrend = ({ games, season, opponentId, category }) => {
  const cfg = PLAYER_STAT_CONFIG[category];
  if (!cfg) return null;
  const has = (g) => g.stats?.[cfg.stat] !== null && g.stats?.[cfg.stat] !== undefined;
  const played = games.filter(has);
  const thisSeason = played.filter((g) => g.season === season);
  const vsOpp = played.filter((g) => g.opponentId && g.opponentId === opponentId);
  const recent = thisSeason.slice(0, 3);
  const last5 = thisSeason.slice(0, 5);
  const value = (g) => g.stats[cfg.stat];

  return {
    category,
    ...cfg,
    careerAvg: avg(played.map(value)),
    careerGames: played.length,
    firstSeason: played.length ? Math.min(...played.map((g) => g.season)) : season,
    seasonAvg: avg(thisSeason.map(value)),
    seasonGames: thisSeason.length,
    recentAvg: avg(recent.map(value)),
    recentGames: recent.length,
    vsOppAvg: avg(vsOpp.map(value)),
    vsOppGames: vsOpp.length,
    tdGames: last5.filter((g) => (g.stats?.[cfg.tdStat] ?? 0) > 0).length,
    tdWindow: last5.length,
  };
};

// ---------- insights ----------

const clamp01 = (n) => Math.max(0, Math.min(1, n));
const sampleWeight = (n, full = 8) => clamp01(n / full);

const teamInsights = ({ team, opp, trends, line, moneyLine, isHome }) => {
  const out = [];
  if (!trends || !team) return out;
  const abbr = team.abbreviation;
  const oppAbbr = opp?.abbreviation;
  const lineText = line === null || line === undefined ? '' : ` ${fmtLine(line)}`;

  // Overall ATS
  const W = trends.ats.W || 0;
  const L = trends.ats.L || 0;
  const P = trends.ats.P || 0;
  const n = W + L;
  if (n >= 4) {
    const rate = W / n;
    if (rate >= 0.65) {
      out.push({
        id: `${abbr}-ats`,
        type: 'spread',
        tone: 'positive',
        title: `${abbr} keeps covering`,
        text: `${abbr} has covered the spread in ${W} of ${n + P} games this season (${recordText(trends.ats)} ATS).`,
        lean: `Consider ${abbr}${lineText}`,
        strength: rate * sampleWeight(n),
      });
    } else if (rate <= 0.35) {
      out.push({
        id: `${abbr}-ats`,
        type: 'spread',
        tone: 'negative',
        title: `${abbr} struggles against the number`,
        text: `${abbr} has failed to cover in ${L} of ${n + P} games this season (${recordText(trends.ats)} ATS).`,
        lean: oppAbbr ? `Consider fading ${abbr}: ${oppAbbr}${line === null ? '' : ` ${fmtLine(-line)}`}` : null,
        strength: (1 - rate) * sampleWeight(n),
      });
    }
  }

  // ATS in this game's role (favorite / underdog)
  if (line) {
    const role = line < 0 ? 'favorite' : 'underdog';
    const rec = line < 0 ? trends.atsFav : trends.atsDog;
    const rn = (rec.W || 0) + (rec.L || 0);
    if (rn >= 3) {
      const rate = (rec.W || 0) / rn;
      if (rate >= 0.7 || rate <= 0.3) {
        const good = rate >= 0.7;
        out.push({
          id: `${abbr}-role`,
          type: 'spread',
          tone: good ? 'positive' : 'negative',
          title: `${abbr} as ${role === 'favorite' ? 'a favorite' : 'an underdog'}`,
          text: `${abbr} is ${recordText(rec)} ATS as ${role === 'favorite' ? 'a favorite' : 'an underdog'} this season, and they're ${fmtLine(line)} here.`,
          lean: good ? `Consider ${abbr} ${fmtLine(line)}` : `Consider ${oppAbbr} ${fmtLine(-line)}`,
          strength: (good ? rate : 1 - rate) * sampleWeight(rn, 6) * 0.95,
        });
      }
    }
  }

  // ATS at home / on the road
  const venue = isHome ? trends.atsHome : trends.atsAway;
  const vn = (venue.W || 0) + (venue.L || 0);
  if (vn >= 3) {
    const rate = (venue.W || 0) / vn;
    if (rate >= 0.75 || rate <= 0.25) {
      const good = rate >= 0.75;
      out.push({
        id: `${abbr}-venue`,
        type: 'spread',
        tone: good ? 'positive' : 'negative',
        title: `${abbr} ${isHome ? 'at home' : 'on the road'}`,
        text: `${abbr} is ${recordText(venue)} against the spread ${isHome ? 'at home' : 'on the road'} this season.`,
        lean: good ? `Consider ${abbr}${lineText}` : null,
        strength: (good ? rate : 1 - rate) * sampleWeight(vn, 5) * 0.85,
      });
    }
  }

  // Streaks
  const ats = trends.atsStreak;
  if (ats && ats.count >= 3) {
    out.push({
      id: `${abbr}-ats-streak`,
      type: 'spread',
      tone: ats.type === 'W' ? 'positive' : 'negative',
      title: ats.type === 'W' ? `${abbr} is on a cover streak` : `${abbr} keeps missing the number`,
      text:
        ats.type === 'W'
          ? `${abbr} has covered ${ats.count} straight games.`
          : `${abbr} has failed to cover ${ats.count} straight games.`,
      lean: ats.type === 'W' ? `Ride ${abbr}${lineText}` : null,
      strength: clamp01(ats.count / 6) * 0.8,
    });
  }

  const su = trends.suStreak;
  if (su && su.count >= 3 && su.type !== 'T') {
    const won = su.type === 'W';
    out.push({
      id: `${abbr}-su-streak`,
      type: 'moneyline',
      tone: won ? 'positive' : 'negative',
      title: won ? `${abbr} is rolling` : `${abbr} is skidding`,
      text: won ? `${abbr} has won ${su.count} straight.` : `${abbr} has lost ${su.count} straight.`,
      lean: won && moneyLine !== null && moneyLine !== undefined ? `${abbr} ML (${fmtOdds(moneyLine)})` : null,
      strength: clamp01(su.count / 6) * 0.6,
    });
  }

  return out;
};

const matchupInsights = ({ game, odds, predictor, awayTrends, homeTrends }) => {
  const out = [];
  const away = game.away?.team;
  const home = game.home?.team;
  const ouLine = odds?.total?.line ?? null;

  // Combined over/under results
  if (awayTrends && homeTrends && ouLine !== null) {
    const O = (awayTrends.ou.O || 0) + (homeTrends.ou.O || 0);
    const U = (awayTrends.ou.U || 0) + (homeTrends.ou.U || 0);
    const n = O + U;
    if (n >= 6) {
      const rate = O / n;
      if (rate >= 0.65 || rate <= 0.35) {
        const over = rate >= 0.65;
        out.push({
          id: 'combined-ou',
          type: 'total',
          tone: 'neutral',
          title: over ? 'Overs keep hitting' : 'Unders keep hitting',
          text: `The ${over ? 'over' : 'under'} has hit in ${over ? O : U} of ${n} combined ${away?.abbreviation} and ${home?.abbreviation} games this season.`,
          lean: `Consider the ${over ? 'over' : 'under'} ${ouLine}`,
          strength: (over ? rate : 1 - rate) * sampleWeight(n, 14),
        });
      }
    }
  }

  // Scoring-average projection vs the total and the spread
  if (awayTrends?.games >= 3 && homeTrends?.games >= 3 && awayTrends.ppg !== null && homeTrends.ppg !== null) {
    const projAway = (awayTrends.ppg + homeTrends.papg) / 2;
    const projHome = (homeTrends.ppg + awayTrends.papg) / 2;
    const projTotal = projAway + projHome;

    if (ouLine !== null) {
      const diff = projTotal - ouLine;
      if (Math.abs(diff) >= 3) {
        out.push({
          id: 'proj-total',
          type: 'total',
          tone: 'neutral',
          title: 'Scoring averages vs the total',
          text: `Season scoring averages project about ${round1(projTotal)} total points (${away?.abbreviation} ${round1(projAway)}, ${home?.abbreviation} ${round1(projHome)}) against a posted total of ${ouLine}.`,
          lean: `Lean ${diff > 0 ? 'over' : 'under'} ${ouLine}`,
          strength: clamp01(Math.abs(diff) / 10) * 0.9,
        });
      }
    }

    if (odds?.homeSpread !== null && odds?.homeSpread !== undefined) {
      const projMargin = projHome - projAway;
      const edge = projMargin + odds.homeSpread; // > 0 -> home covers
      if (Math.abs(edge) >= 3) {
        const pickHome = edge > 0;
        const pick = pickHome ? home : away;
        const pickLine = pickHome ? odds.homeSpread : -odds.homeSpread;
        const leader = projMargin >= 0 ? home : away;
        out.push({
          id: 'proj-spread',
          type: 'spread',
          tone: 'neutral',
          title: 'Scoring averages vs the spread',
          text: `Points scored and allowed this season project ${leader?.abbreviation} by about ${round1(Math.abs(projMargin))}, while the line is ${odds.details || `${home?.abbreviation} ${fmtLine(odds.homeSpread)}`}.`,
          lean: `Lean ${pick?.abbreviation} ${fmtLine(pickLine)}`,
          strength: clamp01(Math.abs(edge) / 10) * 0.85,
        });
      }
    }
  }

  // ESPN FPI vs moneyline implied probability
  if (predictor && odds) {
    [
      { team: away, prob: predictor.away, ml: odds.away?.moneyLine },
      { team: home, prob: predictor.home, ml: odds.home?.moneyLine },
    ].forEach(({ team, prob, ml }) => {
      const implied = impliedProbability(ml);
      if (prob === null || implied === null) return;
      const edge = prob - implied;
      if (edge >= 6) {
        out.push({
          id: `${team?.abbreviation}-value`,
          type: 'moneyline',
          tone: 'positive',
          title: `Moneyline value on ${team?.abbreviation}?`,
          text: `ESPN's FPI gives ${team?.abbreviation} a ${round1(prob)}% chance to win, but the moneyline (${fmtOdds(ml)}) implies only ${round1(implied)}%.`,
          lean: `Consider ${team?.abbreviation} ML (${fmtOdds(ml)})`,
          strength: clamp01(edge / 15),
        });
      }
    });
  }

  return out;
};

const playerInsights = (players = []) => {
  const out = [];
  players.forEach((p) => {
    if (!p?.trend) return;
    const t = p.trend;
    const name = p.name;

    // Versus this opponent
    if (t.vsOppGames >= 2 && t.vsOppAvg !== null && t.careerAvg !== null && t.careerGames >= 4) {
      const diff = t.vsOppAvg - t.careerAvg;
      const ratio = t.careerAvg > 0 ? t.vsOppAvg / t.careerAvg : 1;
      if (Math.abs(diff) >= t.minDiff && (ratio >= 1.2 || ratio <= 0.8)) {
        const up = diff > 0;
        out.push({
          id: `${p.id}-vs`,
          type: 'player',
          tone: up ? 'positive' : 'negative',
          title: up ? `${name} loves facing ${p.oppAbbr}` : `${p.oppAbbr} has bottled up ${name}`,
          text: `${name} has averaged ${round1(t.vsOppAvg)} ${t.label} in ${t.vsOppGames} game${t.vsOppGames === 1 ? '' : 's'} vs ${p.oppAbbr} since ${t.firstSeason}, compared with ${round1(t.careerAvg)} in all games.`,
          lean: `Consider ${name} ${up ? 'over' : 'under'} on ${t.long}`,
          strength: clamp01(Math.abs(ratio - 1)) * sampleWeight(t.vsOppGames, 3),
        });
      }
    }

    // Recent form
    if (t.seasonGames >= 4 && t.recentGames >= 3 && t.seasonAvg > 0 && t.recentAvg !== null) {
      const ratio = t.recentAvg / t.seasonAvg;
      if ((ratio >= 1.3 || ratio <= 0.7) && Math.abs(t.recentAvg - t.seasonAvg) >= t.minDiff * 0.8) {
        const up = ratio >= 1.3;
        out.push({
          id: `${p.id}-form`,
          type: 'player',
          tone: up ? 'positive' : 'negative',
          title: up ? `${name} is heating up` : `${name} has cooled off`,
          text: `${name} is averaging ${round1(t.recentAvg)} ${t.label} over the last 3 games, vs ${round1(t.seasonAvg)} for the season.`,
          lean: `Consider ${name} ${up ? 'over' : 'under'} on ${t.long}`,
          strength: clamp01(Math.abs(ratio - 1)) * 0.75,
        });
      }
    }

    // Touchdown consistency (skill players)
    if (t.category !== 'passing' && t.tdWindow >= 4 && t.tdGames / t.tdWindow >= 0.6) {
      out.push({
        id: `${p.id}-td`,
        type: 'player',
        tone: 'positive',
        title: `${name} keeps finding the end zone`,
        text: `${name} has scored in ${t.tdGames} of the last ${t.tdWindow} games.`,
        lean: `Consider ${name} anytime TD`,
        strength: (t.tdGames / t.tdWindow) * 0.7,
      });
    }
  });
  return out;
};

export const buildInsights = ({ game, odds, predictor, awayTrends, homeTrends, players, limit = 8 }) => {
  const awayLine = odds?.away?.spreadLine ?? null;
  const homeLine = odds?.home?.spreadLine ?? null;

  const all = [
    ...teamInsights({
      team: game.away?.team,
      opp: game.home?.team,
      trends: awayTrends,
      line: awayLine,
      moneyLine: odds?.away?.moneyLine,
      isHome: false,
    }),
    ...teamInsights({
      team: game.home?.team,
      opp: game.away?.team,
      trends: homeTrends,
      line: homeLine,
      moneyLine: odds?.home?.moneyLine,
      isHome: true,
    }),
    ...matchupInsights({ game, odds, predictor, awayTrends, homeTrends }),
    ...playerInsights(players),
  ];

  return all.sort((a, b) => b.strength - a.strength).slice(0, limit);
};

// Result of a final game against its closing line, from the home team's view.
export const gradeFinal = (game, odds) => {
  if (!odds || game.status?.state !== 'post') return null;
  const home = gradeGame(game.home?.teamId, game, odds);
  if (!home) return null;
  const coverTeam =
    home.ats === 'W' ? game.home?.team : home.ats === 'L' ? game.away?.team : null;
  return { spread: home.ats === null ? null : home.ats === 'P' ? 'PUSH' : `${coverTeam?.abbreviation} covered`, total: home.ou, points: home.total };
};

export { recordText };
