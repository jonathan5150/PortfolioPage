import React from 'react';
import Scoreboard from '../Scoreboard';

const LiveScoreBug = ({
  game,
  gamePk,
  handleStarClick,
  getTeamLogo,
  gameBackgroundColors,
  starredTeams,
  getTeamAbbreviation,
  getTeamRecord,
  liveData,
}) => {
  const trueLiveData = liveData?.liveData ?? liveData;

  const awayTeam = game.teams.away.team;
  const homeTeam = game.teams.home.team;
  const awayScore = liveData?.linescore?.teams?.away?.runs ?? '-';
  const homeScore = liveData?.linescore?.teams?.home?.runs ?? '-';

  const count = liveData?.plays?.currentPlay?.count || {};
  const balls = count.balls ?? 0;
  const strikes = count.strikes ?? 0;
  const outs = count.outs ?? 0;

  const offense = liveData?.linescore?.offense || {};
  const onFirst = !!offense.first;
  const onSecond = !!offense.second;
  const onThird = !!offense.third;

  const inning = liveData?.linescore?.currentInning ?? '';
  const isTopInning = liveData?.linescore?.isTopInning;
  const inningArrow = isTopInning ? '▲' : '▼';

  const batter = liveData?.plays?.currentPlay?.matchup?.batter;
  const pitcher = liveData?.plays?.currentPlay?.matchup?.pitcher;

  const isLiveGame = game.status.abstractGameState === 'Live';

  const allPlayers = {
    ...trueLiveData?.boxscore?.teams?.away?.players,
    ...trueLiveData?.boxscore?.teams?.home?.players,
  };

  const getBatterLine = () => {
    if (!batter || !batter.id || !allPlayers) return '';
    const playerData = allPlayers[`ID${batter.id}`];
    if (!playerData || !playerData.stats?.batting) return '';
    const stats = playerData.stats.batting;

    const hits = stats.hits ?? 0;
    const atBats = stats.atBats ?? 0;
    const rbi = stats.rbi ?? 0;
    const homeRuns = stats.homeRuns ?? 0;

    const parts = [];

    // Always show at-bats/hits
    parts.push(`${hits} for ${atBats}`);

    if (rbi > 0) parts.push(`${rbi} RBI`);
    if (homeRuns > 0) parts.push(`${homeRuns} HR`);

    return parts.join(', ');
  };

  const getPitcherLine = () => {
    if (!pitcher || !pitcher.id || !allPlayers) return '';
    const playerData = allPlayers[`ID${pitcher.id}`];
    if (!playerData || !playerData.stats?.pitching) return '';
    const stats = playerData.stats.pitching;

    const ip = typeof stats.inningsPitched === 'number'
      ? stats.inningsPitched.toFixed(1)
      : stats.inningsPitched ?? '0.0';
    const earnedRuns = stats.earnedRuns ?? 0;
    const strikeOuts = stats.strikeOuts ?? 0;

    return `IP ${ip}, ${earnedRuns} ER, ${strikeOuts} K`;
  };

  const formatName = (player) => {
    if (!player?.fullName) return 'N/A';
    const parts = player.fullName.split(' ');
    if (parts.length === 1) return parts[0];
    if (parts.length >= 3 && parts[parts.length - 1].includes('.')) {
      return parts.slice(-2).join(' '); // handles "Gurriel Jr."
    }
    return parts.slice(-1)[0];
  };

  const renderTeamCell = (team, score, side) => {
    const abbr = getTeamAbbreviation(team.id);
    const record = getTeamRecord(team.id);

    return (
      <div className="team-cell" style={{ display: 'flex', cursor: 'pointer' }} onClick={() => handleStarClick(gamePk, team.id)}>
        <div
          className="team-info-container"
          style={{
            width: '100%',
            height: '50px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            border: '2px solid #555555',
            backgroundColor: 'rgba(70, 70, 70, 0.8)',
            borderRadius: side === 'away' ? '6px 0 0 0' : '0 0 0 6px',
            padding: '5px 10px',
            opacity: 0.85,
          }}
        >
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <img
              src={getTeamLogo(team.name)}
              alt={`${team.name} logo`}
              style={{
                width: '37px',
                height: '37px',
                objectFit: 'contain',
                userSelect: 'none',
                WebkitUserDrag: 'none',
                outline: 'none',
                WebkitTapHighlightColor: 'transparent',
              }}
            />
            {starredTeams[gamePk] === team.id && (
              <div className="star-icon" style={{ position: 'absolute', top: '0', right: '-8px' }}>⭐</div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '40px' }}>
            <div className="abbreviation" style={{ height: '30px', fontWeight: 'bold', color: '#fff', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{abbr}</div>
            <div style={{ fontSize: '11px', color: '#ccc', lineHeight: '12px', width: '60px', textAlign: 'center' }}>{record}</div>
          </div>
          <div style={{ fontWeight: 'bold', fontSize: '25px', color: '#fff', width: '30px', textAlign: 'center' }}>{score}</div>
        </div>
      </div>
    );
  };

  const renderPitchOutBox = () => (
    <div className="pitch-out-container" style={{ width: '100%', height: '60px', display: 'flex', gap: '4px', justifyContent: 'space-between' }}>
      <div style={{ flex: 1, height: '60px', border: '2px solid #555555', backgroundColor: 'rgba(70, 70, 70, 0.8)', opacity: 0.85, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ fontWeight: 'bold', color: '#fff', marginBottom: '4px' }}>{balls}-{strikes}</div>
        <div style={{ display: 'flex', gap: '4px' }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: i < outs ? 'gold' : 'transparent', border: '2px solid #555555' }} />
          ))}
        </div>
      </div>

      <div style={{ flex: 1, height: '60px', border: '2px solid #555555', backgroundColor: 'rgba(70, 70, 70, 0.8)', borderRadius: '0 6px 0 0', opacity: 0.85, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ position: 'relative', width: '50px', height: '50px' }}>
          <div style={{ position: 'absolute', top: '10px', left: '50%', transform: 'translate(-50%, 0) rotate(45deg)', width: '16px', height: '16px', backgroundColor: onSecond ? 'gold' : 'white' }} />
          <div style={{ position: 'absolute', bottom: -3, left: '97%', transform: 'translate(-100%, 0) rotate(45deg)', width: '16px', height: '16px', backgroundColor: onFirst ? 'gold' : 'white' }} />
          <div style={{ position: 'absolute', bottom: -3, left: 2, transform: 'rotate(45deg)', width: '16px', height: '16px', backgroundColor: onThird ? 'gold' : 'white' }} />
        </div>
        <div style={{ marginTop: '2px', marginBottom: '4px', marginRight: '2px', fontWeight: 'bold', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: '6px', marginRight: '2px' }}>{inningArrow}</span>
          <span style={{ fontSize: '13px' }}>{inning}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div
      className="score-grid"
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gridTemplateRows: '1fr 1fr',
        gap: '4px',
        paddingRight: '10px',
        paddingLeft: '10px',
        paddingTop: '10px',
        paddingBottom: isLiveGame ? '5px' : '0px', // ← dynamic padding
      }}
    >
      {renderTeamCell(awayTeam, awayScore, 'away')}
      {renderPitchOutBox()}
      {renderTeamCell(homeTeam, homeScore, 'home')}

      <div style={{
        border: '2px solid #555555',
        backgroundColor: 'rgba(70, 70, 70, 0.8)',
        opacity: 0.85,
        fontSize: '11px',
        color: 'white',
        padding: '6px 8px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        lineHeight: '1.3',
        textAlign: 'left',
        paddingLeft: '14px',
        borderRadius: '0 0 6px 0', // ✅ bottom right corner
      }}>

        <div style={{ marginBottom: '4px' }}>
          {batter ? `${formatName(batter)} (${getBatterLine()})` : 'Batter: N/A'}
        </div>
        <div>
          {pitcher ? `${formatName(pitcher)} (${getPitcherLine()})` : 'Pitcher: N/A'}
        </div>
      </div>

      <div style={{ gridColumn: '1 / span 2' }}>
        <Scoreboard game={game} getTeamAbbreviation={getTeamAbbreviation} liveData={liveData} />
      </div>
    </div>
  );
};

export default LiveScoreBug;
