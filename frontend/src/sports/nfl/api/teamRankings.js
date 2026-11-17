// Builds offense/defense rankings (1 = best) for every team from either ESPN's
// team statistics or, as a fallback, nflverse's season team file.

const perGame = (total, games) => (games ? total / games : null);

export const ESPN_METRICS = [
  { section: 'OFFENSE', key: 'ppg', label: 'PTS/G', get: (s) => s.own.totalPointsPerGame, decimals: 1 },
  { key: 'ypg', label: 'YDS/G', get: (s) => s.own.yardsPerGame, decimals: 1 },
  { key: 'passYpg', label: 'PASS/G', get: (s) => s.own.netPassingYardsPerGame ?? s.own.passingYardsPerGame, decimals: 1 },
  { key: 'rushYpg', label: 'RUSH/G', get: (s) => s.own.rushingYardsPerGame, decimals: 1 },
  { key: 'thirdDown', label: '3RD %', get: (s) => s.own.thirdDownConvPct, decimals: 1, suffix: '%' },
  { key: 'giveaways', label: 'GIVEAWAYS', get: (s) => s.own.totalGiveaways, lowerIsBetter: true },
  { section: 'DEFENSE', key: 'oppPpg', label: 'PTS/G', get: (s) => s.opp.totalPointsPerGame, lowerIsBetter: true, decimals: 1 },
  { key: 'oppYpg', label: 'YDS/G', get: (s) => s.opp.yardsPerGame, lowerIsBetter: true, decimals: 1 },
  { key: 'oppPassYpg', label: 'PASS/G', get: (s) => s.opp.netPassingYardsPerGame ?? s.opp.passingYardsPerGame, lowerIsBetter: true, decimals: 1 },
  { key: 'oppRushYpg', label: 'RUSH/G', get: (s) => s.opp.rushingYardsPerGame, lowerIsBetter: true, decimals: 1 },
  { key: 'sacks', label: 'SACKS', get: (s) => s.opp.sacks },
  { key: 'takeaways', label: 'TAKEAWAYS', get: (s) => s.own.totalTakeaways ?? s.opp.interceptions },
  { section: 'BALANCE', key: 'toDiff', label: 'TO DIFF', get: (s) => s.own.turnOverDifferential },
];

export const NFLVERSE_METRICS = [
  { section: 'OFFENSE', key: 'ypg', label: 'YDS/G', get: (s) => perGame(s.offense.totalYards, s.games), decimals: 1 },
  { key: 'passYpg', label: 'PASS/G', get: (s) => perGame(s.offense.passingYards, s.games), decimals: 1 },
  { key: 'rushYpg', label: 'RUSH/G', get: (s) => perGame(s.offense.rushingYards, s.games), decimals: 1 },
  { key: 'offTd', label: 'OFF TD', get: (s) => s.offense.passingTouchdowns + s.offense.rushingTouchdowns },
  { key: 'giveaways', label: 'GIVEAWAYS', get: (s) => s.offense.giveaways, lowerIsBetter: true },
  { key: 'sacksAllowed', label: 'SACKS ALW', get: (s) => s.offense.sacksAllowed, lowerIsBetter: true },
  { section: 'DEFENSE', key: 'sacks', label: 'SACKS', get: (s) => s.defense.sacks },
  { key: 'ints', label: 'INT', get: (s) => s.defense.interceptions },
  { key: 'ff', label: 'FF', get: (s) => s.defense.fumblesForced },
  { key: 'tfl', label: 'TFL', get: (s) => s.defense.tacklesForLoss },
];

// Standard competition ranking: ties share a rank, next rank skips.
export const rankValues = (valuesByTeam, lowerIsBetter = false) => {
  const entries = Object.entries(valuesByTeam).filter(([, v]) => typeof v === 'number' && Number.isFinite(v));
  entries.sort((a, b) => (lowerIsBetter ? a[1] - b[1] : b[1] - a[1]));

  const ranks = {};
  let previousValue = null;
  let previousRank = 0;
  entries.forEach(([teamId, value], index) => {
    const rank = value === previousValue ? previousRank : index + 1;
    ranks[teamId] = rank;
    previousValue = value;
    previousRank = rank;
  });
  return ranks;
};

// statsByTeam: { [teamKey]: stats } -> { metrics, values: {key: {team: v}}, ranks: {key: {team: rank}}, teamCount }
export const buildRankings = (statsByTeam, metrics) => {
  const values = {};
  const ranks = {};

  metrics.forEach((metric) => {
    const metricValues = {};
    Object.entries(statsByTeam).forEach(([teamKey, stats]) => {
      let v = null;
      try {
        v = metric.get(stats);
      } catch {
        v = null;
      }
      metricValues[teamKey] = typeof v === 'number' && Number.isFinite(v) ? v : null;
    });
    values[metric.key] = metricValues;
    ranks[metric.key] = rankValues(metricValues, metric.lowerIsBetter);
  });

  return { metrics, values, ranks, teamCount: Object.keys(statsByTeam).length };
};
