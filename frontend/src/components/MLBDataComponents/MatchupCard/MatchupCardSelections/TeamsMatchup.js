import React, { useEffect, useMemo, useState } from 'react';

const containerStyle = {
  width: '100%',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  borderRadius: '8px',
  overflow: 'hidden',
  background: 'rgba(30, 30, 30, 0.55)',
};

const headerRowStyle = {
  display: 'grid',
  gridTemplateColumns: '1fr auto 1fr',
  alignItems: 'center',
  columnGap: '10px',
  padding: '8px 10px',
  background: 'rgba(255, 255, 255, 0.05)',
  borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
};

const teamNameStyle = {
  color: '#fff',
  fontSize: '0.78rem',
  fontWeight: 600,
  lineHeight: 1.1,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const centerLabelStyle = {
  color: 'rgba(255,255,255,0.7)',
  fontSize: '0.65rem',
  fontWeight: 700,
  letterSpacing: '0.06em',
};

const sectionTitleStyle = {
  padding: '7px 10px',
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
  gridTemplateColumns: '1fr auto 1fr',
  alignItems: 'center',
  columnGap: '10px',
  minHeight: '25px',
  padding: '0 10px',
  borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
};

const sideValueBaseStyle = {
  color: '#fff',
  fontSize: '0.7rem',
  fontWeight: 500,
  padding: '6px 0',
};

const labelStyle = {
  color: 'rgba(255,255,255,0.78)',
  fontSize: '0.7rem',
  fontWeight: 600,
  whiteSpace: 'nowrap',
  textAlign: 'center',
};

const loadingStyle = {
  padding: '14px 10px',
  textAlign: 'center',
  color: 'rgba(255,255,255,0.8)',
  fontSize: '0.78rem',
};

const getNumber = (value) => {
  if (value == null || value === '' || value === 'N/A') return null;
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
      ? '#d6b85f'
      : winner === 'tie'
      ? 'rgba(255,255,255,0.92)'
      : '#fff',
  fontWeight: winner === side ? 700 : 500,
});

const buildRows = (awayTeam, homeTeam, standingsMap) => {
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
    },
    {
      label: 'HR',
      awayDisplay: formatInteger(awayHitting.homeRuns),
      homeDisplay: formatInteger(homeHitting.homeRuns),
      awayCompare: awayHitting.homeRuns,
      homeCompare: homeHitting.homeRuns,
    },
    {
      label: 'RBI',
      awayDisplay: formatInteger(awayHitting.rbi),
      homeDisplay: formatInteger(homeHitting.rbi),
      awayCompare: awayHitting.rbi,
      homeCompare: homeHitting.rbi,
    },
    {
      label: 'AVG',
      awayDisplay: formatRate3(awayHitting.avg),
      homeDisplay: formatRate3(homeHitting.avg),
      awayCompare: awayHitting.avg,
      homeCompare: homeHitting.avg,
    },
    {
      label: 'OPS',
      awayDisplay: formatRate3(awayHitting.ops),
      homeDisplay: formatRate3(homeHitting.ops),
      awayCompare: awayHitting.ops,
      homeCompare: homeHitting.ops,
    },
    {
      section: 'PITCHING',
      label: 'ERA',
      awayDisplay: formatRate2(awayPitching.era),
      homeDisplay: formatRate2(homePitching.era),
      awayCompare: awayPitching.era,
      homeCompare: homePitching.era,
      lowerIsBetter: true,
    },
    {
      label: 'WHIP',
      awayDisplay: formatRate2(awayPitching.whip),
      homeDisplay: formatRate2(homePitching.whip),
      awayCompare: awayPitching.whip,
      homeCompare: homePitching.whip,
      lowerIsBetter: true,
    },
    {
      label: 'SO',
      awayDisplay: formatInteger(awayPitching.strikeOuts),
      homeDisplay: formatInteger(homePitching.strikeOuts),
      awayCompare: awayPitching.strikeOuts,
      homeCompare: homePitching.strikeOuts,
    },
    {
      label: 'B/AVG',
      awayDisplay: formatRate3(awayPitching.avg),
      homeDisplay: formatRate3(homePitching.avg),
      awayCompare: awayPitching.avg,
      homeCompare: homePitching.avg,
      lowerIsBetter: true,
    },
    {
      section: 'STANDINGS',
      label: 'REC',
      awayDisplay: awayRecordString,
      homeDisplay: homeRecordString,
      awayCompare: awayRecord.pct,
      homeCompare: homeRecord.pct,
    },
    {
      label: 'WIN %',
      awayDisplay: formatPct(awayRecord.pct),
      homeDisplay: formatPct(homeRecord.pct),
      awayCompare: awayRecord.pct,
      homeCompare: homeRecord.pct,
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
    },
    {
      label: 'GB',
      awayDisplay: awayStanding.gamesBack ?? '—',
      homeDisplay: homeStanding.gamesBack ?? '—',
      awayCompare: awayStanding.gamesBack,
      homeCompare: homeStanding.gamesBack,
      lowerIsBetter: true,
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
  });

  const [loading, setLoading] = useState(true);

  const awayTeamId = game?.teams?.away?.team?.id;
  const homeTeamId = game?.teams?.home?.team?.id;

  const awayTeamName =
    getTeamAbbreviation?.(awayTeamId) || game?.teams?.away?.team?.abbreviation || 'AWAY';

  const homeTeamName =
    getTeamAbbreviation?.(homeTeamId) || game?.teams?.home?.team?.abbreviation || 'HOME';

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
        ]);

        const standingsMap = {};
        (standingsData?.records || []).forEach((recordGroup) => {
          (recordGroup?.teamRecords || []).forEach((record) => {
            standingsMap[record.team.id] = {
              divisionRank:
                record.divisionRank != null ? Number(record.divisionRank) : null,
              gamesBack: record.gamesBack === '-' ? 0 : Number(record.gamesBack),
            };
          });
        });

        if (!isActive) return;

        setTeamStats({
          awayHitting: getTeamStatSplit(awayHittingData),
          awayPitching: getTeamStatSplit(awayPitchingData),
          homeHitting: getTeamStatSplit(homeHittingData),
          homePitching: getTeamStatSplit(homePitchingData),
          standingsMap,
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
    () => buildRows(awayTeam, homeTeam, teamStats.standingsMap),
    [awayTeam, homeTeam, teamStats.standingsMap]
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
      <div style={headerRowStyle}>
        <div style={{ ...teamNameStyle, textAlign: 'left' }}>{awayTeamName}</div>
        <div style={centerLabelStyle}>MATCHUP</div>
        <div style={{ ...teamNameStyle, textAlign: 'right' }}>{homeTeamName}</div>
      </div>

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
              <div style={labelStyle}>{row.label}</div>
              <div style={getSideStyle(winner, 'home', 'right')}>{row.homeDisplay}</div>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default TeamsMatchup;