import React, { useEffect, useMemo, useState } from 'react';

const containerStyle = {
  width: '100%',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  borderRadius: '8px',
  overflow: 'hidden',
  background: 'rgba(30, 30, 30, 0.55)',
};

const sectionTitleStyle = {
  padding: '6px 10px',
  background: 'rgba(255, 255, 255, 0.04)',
  color: 'rgba(255,255,255,0.8)',
  fontSize: '0.63rem',
  fontWeight: 300,
  letterSpacing: '0.08em',
  borderTop: '1px solid rgba(255, 255, 255, 0.08)',
  borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
};

const rowStyle = {
  display: 'grid',
  gridTemplateColumns: '1fr 40px 70px 40px 1fr',
  alignItems: 'center',
  columnGap: '15px',
  minHeight: '25px',
  padding: '0px 10px',
  borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
};

const sideValueBaseStyle = {
  color: 'white',
  fontSize: '0.7rem',
  fontWeight: 500,
  padding: '1px 0',
};

const rankBaseStyle = {
  color: 'white',
  fontSize: '0.6rem',
  fontWeight: 600,
  justifySelf: 'stretch',
  width: '100%',
  padding: '1px 0',
  fontVariantNumeric: 'tabular-nums',
};

const labelStyle = {
  color: 'white',
  fontSize: '0.7rem',
  fontWeight: 600,
  textAlign: 'center',
  width: '100%',
};

const loadingStyle = {
  padding: '14px 10px',
  textAlign: 'center',
  color: 'rgba(255,255,255,0.8)',
  fontSize: '0.7rem',
};

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

const formatRate3 = (value) => {
  const num = getNumber(value);
  if (num == null) return '—';
  return num.toFixed(3).replace(/^0(?=\.)/, '');
};

const formatRate2 = (value) => {
  const num = getNumber(value);
  if (num == null) return '—';
  return num.toFixed(2);
};

const formatInteger = (value) => {
  const num = getNumber(value);
  if (num == null) return '—';
  return String(Math.round(num));
};

const formatPct = (value) => {
  const num = getNumber(value);
  if (num == null) return '—';

  if (num > 1) {
    return `${num.toFixed(1)}%`;
  }

  return num.toFixed(3).replace(/^0(?=\.)/, '');
};

const formatRank = (value) => {
  const num = getNumber(value);
  if (num == null) return '—';
  return `#${num}`;
};

const getRankNumberFromDisplay = (rankDisplay) => {
  if (!rankDisplay || rankDisplay === '—') return null;
  return getNumber(String(rankDisplay).replace('#', ''));
};

const getRecordPieces = (recordString) => {
  if (!recordString || typeof recordString !== 'string') {
    return { wins: null, losses: null, pct: null };
  }

  const [winsRaw, lossesRaw] = recordString.split('-');
  const wins = Number(winsRaw);
  const losses = Number(lossesRaw);

  if (!Number.isFinite(wins) || !Number.isFinite(losses)) {
    return { wins: null, losses: null, pct: null };
  }

  const total = wins + losses;
  const pct = total > 0 ? wins / total : null;

  return { wins, losses, pct };
};

const getComparisonWinner = (awayValue, homeValue, lowerIsBetter = false) => {
  const awayNum = getNumber(awayValue);
  const homeNum = getNumber(homeValue);

  if (awayNum == null || homeNum == null) return null;
  if (awayNum === homeNum) return 'tie';

  if (lowerIsBetter) {
    return awayNum < homeNum ? 'away' : 'home';
  }

  return awayNum > homeNum ? 'away' : 'home';
};

const getSideStyle = (winner, side, align) => ({
  ...sideValueBaseStyle,
  textAlign: align,
  color:
    winner === side
      ? '#b59841'
      : winner === 'tie'
      ? 'white'
      : 'white',
  fontWeight: winner === side ? 700 : 500,
});

const getRankColor = (rankDisplay) => {
  const rankNum = getRankNumberFromDisplay(rankDisplay);

  if (rankNum == null) return 'white';
  if (rankNum <= 5) return '#b59841';
  if (rankNum >= 25) return '#9c4848';
  return 'white';
};

const getRankStyle = (rankDisplay) => {

  return {
    ...rankBaseStyle,
    paddingRight: '4px',
    color: getRankColor(rankDisplay),
  };
};

const createRankMap = (items, statKey, lowerIsBetter = false) => {
  const values = items
    .map((item) => ({
      teamId: item.teamId,
      value: getNumber(item[statKey]),
    }))
    .filter((item) => item.value != null);

  values.sort((a, b) => {
    if (lowerIsBetter) return a.value - b.value;
    return b.value - a.value;
  });

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

const buildRows = (awayTeam, homeTeam, standingsMap, rankMaps) => {
  const awayStanding = standingsMap[awayTeam.id] || {};
  const homeStanding = standingsMap[homeTeam.id] || {};

  const awayRecordString =
    awayTeam.displayRecord || awayTeam.pregameRecord || awayTeam.currentRecord || '0-0';
  const homeRecordString =
    homeTeam.displayRecord || homeTeam.pregameRecord || homeTeam.currentRecord || '0-0';

  const awayRecord = getRecordPieces(awayRecordString);
  const homeRecord = getRecordPieces(homeRecordString);

  const awayHitting = awayTeam.teamStats?.hitting || {};
  const homeHitting = homeTeam.teamStats?.hitting || {};
  const awayPitching = awayTeam.teamStats?.pitching || {};
  const homePitching = homeTeam.teamStats?.pitching || {};

  return [
    {
      section: 'HITTING',
      label: 'RUNS',
      awayDisplay: formatInteger(awayHitting.runs),
      homeDisplay: formatInteger(homeHitting.runs),
      awayCompare: awayHitting.runs,
      homeCompare: homeHitting.runs,
      awayRank: formatRank(rankMaps.runs?.[awayTeam.id]),
      homeRank: formatRank(rankMaps.runs?.[homeTeam.id]),
    },
    {
      label: 'HITS',
      awayDisplay: formatInteger(awayHitting.hits),
      homeDisplay: formatInteger(homeHitting.hits),
      awayCompare: awayHitting.hits,
      homeCompare: homeHitting.hits,
      awayRank: formatRank(rankMaps.hits?.[awayTeam.id]),
      homeRank: formatRank(rankMaps.hits?.[homeTeam.id]),
    },
    {
      label: 'HR',
      awayDisplay: formatInteger(awayHitting.homeRuns),
      homeDisplay: formatInteger(homeHitting.homeRuns),
      awayCompare: awayHitting.homeRuns,
      homeCompare: homeHitting.homeRuns,
      awayRank: formatRank(rankMaps.homeRuns?.[awayTeam.id]),
      homeRank: formatRank(rankMaps.homeRuns?.[homeTeam.id]),
    },
    {
      label: 'RBI',
      awayDisplay: formatInteger(awayHitting.rbi),
      homeDisplay: formatInteger(homeHitting.rbi),
      awayCompare: awayHitting.rbi,
      homeCompare: homeHitting.rbi,
      awayRank: formatRank(rankMaps.rbi?.[awayTeam.id]),
      homeRank: formatRank(rankMaps.rbi?.[homeTeam.id]),
    },
    {
      label: 'SB',
      awayDisplay: formatInteger(awayHitting.stolenBases),
      homeDisplay: formatInteger(homeHitting.stolenBases),
      awayCompare: awayHitting.stolenBases,
      homeCompare: homeHitting.stolenBases,
      awayRank: formatRank(rankMaps.stolenBases?.[awayTeam.id]),
      homeRank: formatRank(rankMaps.stolenBases?.[homeTeam.id]),
    },
    {
      label: 'AVG',
      awayDisplay: formatRate3(awayHitting.avg),
      homeDisplay: formatRate3(homeHitting.avg),
      awayCompare: awayHitting.avg,
      homeCompare: homeHitting.avg,
      awayRank: formatRank(rankMaps.avg?.[awayTeam.id]),
      homeRank: formatRank(rankMaps.avg?.[homeTeam.id]),
    },
    {
      label: 'OPS',
      awayDisplay: formatRate3(awayHitting.ops),
      homeDisplay: formatRate3(homeHitting.ops),
      awayCompare: awayHitting.ops,
      homeCompare: homeHitting.ops,
      awayRank: formatRank(rankMaps.ops?.[awayTeam.id]),
      homeRank: formatRank(rankMaps.ops?.[homeTeam.id]),
    },
    {
      section: 'PITCHING',
      label: 'ERA',
      awayDisplay: formatRate2(awayPitching.era),
      homeDisplay: formatRate2(homePitching.era),
      awayCompare: awayPitching.era,
      homeCompare: homePitching.era,
      lowerIsBetter: true,
      awayRank: formatRank(rankMaps.era?.[awayTeam.id]),
      homeRank: formatRank(rankMaps.era?.[homeTeam.id]),
    },
    {
      label: 'WHIP',
      awayDisplay: formatRate2(awayPitching.whip),
      homeDisplay: formatRate2(homePitching.whip),
      awayCompare: awayPitching.whip,
      homeCompare: homePitching.whip,
      lowerIsBetter: true,
      awayRank: formatRank(rankMaps.whip?.[awayTeam.id]),
      homeRank: formatRank(rankMaps.whip?.[homeTeam.id]),
    },
    {
      label: 'SO',
      awayDisplay: formatInteger(awayPitching.strikeOuts),
      homeDisplay: formatInteger(homePitching.strikeOuts),
      awayCompare: awayPitching.strikeOuts,
      homeCompare: homePitching.strikeOuts,
      awayRank: formatRank(rankMaps.strikeOuts?.[awayTeam.id]),
      homeRank: formatRank(rankMaps.strikeOuts?.[homeTeam.id]),
    },
    {
      label: 'B/AVG',
      awayDisplay: formatRate3(awayPitching.avg),
      homeDisplay: formatRate3(homePitching.avg),
      awayCompare: awayPitching.avg,
      homeCompare: homePitching.avg,
      lowerIsBetter: true,
      awayRank: formatRank(rankMaps.pitchingAvg?.[awayTeam.id]),
      homeRank: formatRank(rankMaps.pitchingAvg?.[homeTeam.id]),
    },
    {
      section: 'STANDINGS',
      label: 'REC',
      awayDisplay: awayRecordString,
      homeDisplay: homeRecordString,
      awayCompare: awayRecord.pct,
      homeCompare: homeRecord.pct,
      awayRank: formatRank(rankMaps.recordPct?.[awayTeam.id]),
      homeRank: formatRank(rankMaps.recordPct?.[homeTeam.id]),
    },
    {
      label: 'WIN %',
      awayDisplay: formatPct(awayRecord.pct),
      homeDisplay: formatPct(homeRecord.pct),
      awayCompare: awayRecord.pct,
      homeCompare: homeRecord.pct,
      awayRank: formatRank(rankMaps.recordPct?.[awayTeam.id]),
      homeRank: formatRank(rankMaps.recordPct?.[homeTeam.id]),
    },
    {
      label: 'DIV',
      awayDisplay:
        awayStanding.divisionRank != null ? String(awayStanding.divisionRank) : '—',
      homeDisplay:
        homeStanding.divisionRank != null ? String(homeStanding.divisionRank) : '—',
      awayCompare: awayStanding.divisionRank,
      homeCompare: homeStanding.divisionRank,
      lowerIsBetter: true,
      awayRank: formatRank(rankMaps.divisionRank?.[awayTeam.id]),
      homeRank: formatRank(rankMaps.divisionRank?.[homeTeam.id]),
    },
    {
      label: 'GB',
      awayDisplay: awayStanding.gamesBack ?? '—',
      homeDisplay: homeStanding.gamesBack ?? '—',
      awayCompare: awayStanding.gamesBack,
      homeCompare: homeStanding.gamesBack,
      lowerIsBetter: true,
      awayRank: formatRank(rankMaps.gamesBack?.[awayTeam.id]),
      homeRank: formatRank(rankMaps.gamesBack?.[homeTeam.id]),
    },
  ];
};

const TeamsMatchup = ({ game, getTeamAbbreviation }) => {
  const [teamStats, setTeamStats] = useState({
    awayHitting: null,
    awayPitching: null,
    homeHitting: null,
    homePitching: null,
    standingsMap: {},
    rankMaps: {},
  });

  const [loading, setLoading] = useState(true);

  const awayTeamId = game?.teams?.away?.team?.id;
  const homeTeamId = game?.teams?.home?.team?.id;

  useEffect(() => {
    let isActive = true;

    const fetchJson = async (url) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }
      return response.json();
    };

    const getTeamStatSplit = (data) => data?.stats?.[0]?.splits?.[0]?.stat || {};

    const load = async () => {
      if (!awayTeamId || !homeTeamId) return;

      setLoading(true);

      try {
        const season = new Date(game?.gameDate || Date.now()).getFullYear();

        const [
          awayHittingData,
          awayPitchingData,
          homeHittingData,
          homePitchingData,
          standingsData,
          teamsData,
        ] = await Promise.all([
          fetchJson(
            `https://statsapi.mlb.com/api/v1/teams/${awayTeamId}/stats?stats=season&group=hitting&season=${season}`
          ),
          fetchJson(
            `https://statsapi.mlb.com/api/v1/teams/${awayTeamId}/stats?stats=season&group=pitching&season=${season}`
          ),
          fetchJson(
            `https://statsapi.mlb.com/api/v1/teams/${homeTeamId}/stats?stats=season&group=hitting&season=${season}`
          ),
          fetchJson(
            `https://statsapi.mlb.com/api/v1/teams/${homeTeamId}/stats?stats=season&group=pitching&season=${season}`
          ),
          fetchJson(
            `https://statsapi.mlb.com/api/v1/standings?leagueId=103,104&season=${season}&standingsTypes=regularSeason`
          ),
          fetchJson(`https://statsapi.mlb.com/api/v1/teams?sportId=1&season=${season}`),
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

        const allTeamIds = (teamsData?.teams || []).map((team) => team.id);

        const [allHittingStats, allPitchingStats] = await Promise.all([
          Promise.all(
            allTeamIds.map(async (teamId) => {
              const data = await fetchJson(
                `https://statsapi.mlb.com/api/v1/teams/${teamId}/stats?stats=season&group=hitting&season=${season}`
              );
              return { teamId, ...getTeamStatSplit(data) };
            })
          ),
          Promise.all(
            allTeamIds.map(async (teamId) => {
              const data = await fetchJson(
                `https://statsapi.mlb.com/api/v1/teams/${teamId}/stats?stats=season&group=pitching&season=${season}`
              );
              return { teamId, ...getTeamStatSplit(data) };
            })
          ),
        ]);

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

        if (!isActive) return;

        setTeamStats({
          awayHitting: getTeamStatSplit(awayHittingData),
          awayPitching: getTeamStatSplit(awayPitchingData),
          homeHitting: getTeamStatSplit(homeHittingData),
          homePitching: getTeamStatSplit(homePitchingData),
          standingsMap,
          rankMaps,
        });
      } catch (error) {
        console.error('Failed to load TeamsMatchup data:', error);

        if (!isActive) return;

        setTeamStats({
          awayHitting: {},
          awayPitching: {},
          homeHitting: {},
          homePitching: {},
          standingsMap: {},
          rankMaps: {},
        });
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      isActive = false;
    };
  }, [awayTeamId, homeTeamId, game?.gameDate]);

  const awayTeam = useMemo(
    () => ({
      ...game?.teams?.away,
      id: awayTeamId,
      teamStats: {
        hitting: teamStats.awayHitting || {},
        pitching: teamStats.awayPitching || {},
      },
    }),
    [game, awayTeamId, teamStats.awayHitting, teamStats.awayPitching]
  );

  const homeTeam = useMemo(
    () => ({
      ...game?.teams?.home,
      id: homeTeamId,
      teamStats: {
        hitting: teamStats.homeHitting || {},
        pitching: teamStats.homePitching || {},
      },
    }),
    [game, homeTeamId, teamStats.homeHitting, teamStats.homePitching]
  );

  const rows = useMemo(
    () => buildRows(awayTeam, homeTeam, teamStats.standingsMap, teamStats.rankMaps),
    [awayTeam, homeTeam, teamStats.standingsMap, teamStats.rankMaps]
  );

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={loadingStyle}>Loading team matchup...</div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>

      {rows.map((row, index) => {
        const winner = getComparisonWinner(
          row.awayCompare,
          row.homeCompare,
          row.lowerIsBetter
        );

        return (
          <React.Fragment key={`${row.section || 'row'}-${row.label}-${index}`}>
            {row.section ? <div style={sectionTitleStyle}>{row.section}</div> : null}

            <div
              style={{
                ...rowStyle,
                borderBottom:
                  index === rows.length - 1
                    ? 'none'
                    : '1px solid rgba(255, 255, 255, 0.06)',
              }}
            >
              <div style={getSideStyle(winner, 'away', 'left')}>{row.awayDisplay}</div>
              <div style={getRankStyle(row.awayRank)}>{row.awayRank}</div>
              <div style={labelStyle}>{row.label}</div>
              <div style={getRankStyle(row.homeRank)}>{row.homeRank}</div>
              <div style={getSideStyle(winner, 'home', 'right')}>{row.homeDisplay}</div>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default TeamsMatchup;