const getNumber = (value) => {
  if (
    value == null ||
    value === '' ||
    value === 'N/A' ||
    value === '—' ||
    Number.isNaN(Number(String(value).replace('%', '').trim()))
  ) {
    return null;
  }

  const parsed = Number(String(value).replace('%', '').trim());
  return Number.isFinite(parsed) ? parsed : null;
};

const createRankMap = (items, statKey, lowerIsBetter = false) => {
  const values = items
    .map((item) => ({
      teamId: item.teamId,
      value: getNumber(item[statKey]),
    }))
    .filter((item) => item.value != null);

  values.sort((a, b) => (lowerIsBetter ? a.value - b.value : b.value - a.value));

  const rankMap = {};
  let currentRank = 0;
  let previousValue = null;

  values.forEach((item, index) => {
    if (previousValue === null || item.value !== previousValue) {
      currentRank = index + 1;
      previousValue = item.value;
    }

    rankMap[item.teamId] = currentRank;
  });

  return rankMap;
};

const fetchJson = async (url) => {
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }

  return res.json();
};

const getTeamStatSplit = (data) => data?.stats?.[0]?.splits?.[0]?.stat || {};

export const fetchTeamMatchupData = async (season) => {
  const [standingsData, teamsData] = await Promise.all([
    fetchJson(
      `https://statsapi.mlb.com/api/v1/standings?leagueId=103,104&season=${season}&standingsTypes=regularSeason`
    ),
    fetchJson(`https://statsapi.mlb.com/api/v1/teams?sportId=1&season=${season}`),
  ]);

  const allTeamIds = (teamsData?.teams || []).map((team) => team.id);

  const [allHittingStats, allPitchingStats] = await Promise.all([
    Promise.all(
      allTeamIds.map(async (teamId) => {
        const data = await fetchJson(
          `https://statsapi.mlb.com/api/v1/teams/${teamId}/stats?stats=season&group=hitting&season=${season}`
        );

        return {
          teamId,
          ...getTeamStatSplit(data),
        };
      })
    ),
    Promise.all(
      allTeamIds.map(async (teamId) => {
        const data = await fetchJson(
          `https://statsapi.mlb.com/api/v1/teams/${teamId}/stats?stats=season&group=pitching&season=${season}`
        );

        return {
          teamId,
          ...getTeamStatSplit(data),
        };
      })
    ),
  ]);

  const standingsMap = {};
  const standingsRankInput = [];

  (standingsData?.records || []).forEach((recordGroup) => {
    (recordGroup?.teamRecords || []).forEach((record) => {
      const teamId = record.team.id;

      const divisionRank =
        record.divisionRank != null ? Number(record.divisionRank) : null;

      const gamesBack = record.gamesBack === '-' ? 0 : Number(record.gamesBack);

      const pct =
        typeof record.winningPercentage === 'string'
          ? Number(`0${record.winningPercentage}`)
          : null;

      standingsMap[teamId] = {
        divisionRank,
        gamesBack,
        pct,
      };

      standingsRankInput.push({
        teamId,
        pct,
        divisionRank,
        gamesBack,
      });
    });
  });

  const teamStatsMap = {};

  allHittingStats.forEach((team) => {
    teamStatsMap[team.teamId] = {
      ...(teamStatsMap[team.teamId] || {}),
      hitting: team,
    };
  });

  allPitchingStats.forEach((team) => {
    teamStatsMap[team.teamId] = {
      ...(teamStatsMap[team.teamId] || {}),
      pitching: team,
    };
  });

  const rankMaps = {
    runs: createRankMap(allHittingStats, 'runs'),
    hits: createRankMap(allHittingStats, 'hits'),
    homeRuns: createRankMap(allHittingStats, 'homeRuns'),
    rbi: createRankMap(allHittingStats, 'rbi'),
    stolenBases: createRankMap(allHittingStats, 'stolenBases'),
    avg: createRankMap(allHittingStats, 'avg'),
    ops: createRankMap(allHittingStats, 'ops'),
    era: createRankMap(allPitchingStats, 'era', true),
    whip: createRankMap(allPitchingStats, 'whip', true),
    strikeOuts: createRankMap(allPitchingStats, 'strikeOuts'),
    pitchingAvg: createRankMap(allPitchingStats, 'avg', true),
    recordPct: createRankMap(standingsRankInput, 'pct'),
    divisionRank: createRankMap(standingsRankInput, 'divisionRank', true),
    gamesBack: createRankMap(standingsRankInput, 'gamesBack', true),
  };

  return {
    teamStatsMap,
    standingsMap,
    rankMaps,
  };
};