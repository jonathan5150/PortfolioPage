import React from 'react';
import Scoreboard from '../Scoreboard';

const teamPrimaryColors = {
  'Arizona Diamondbacks': 'rgb(167, 25, 48)',
  'Atlanta Braves': 'rgb(35, 48, 115)',
  'Baltimore Orioles': 'rgb(223, 70, 1)',
  'Boston Red Sox': 'rgb(189, 48, 57)',
  'Chicago White Sox': 'rgb(255, 255, 255)', // pure white
  'Chicago Cubs': 'rgb(14, 51, 134)',
  'Cincinnati Reds': 'rgb(179, 0, 0)',
  'Cleveland Guardians': 'rgb(12, 35, 64)',
  'Colorado Rockies': 'rgb(51, 0, 111)',
  'Detroit Tigers': 'rgb(12, 35, 64)',
  'Houston Astros': 'rgb(0, 45, 98)',
  'Kansas City Royals': 'rgb(0, 70, 135)',
  'Los Angeles Angels': 'rgb(200, 16, 46)',
  'Los Angeles Dodgers': 'rgb(0, 90, 156)',
  'Miami Marlins': 'rgb(0, 163, 224)',
  'Milwaukee Brewers': 'rgb(19, 41, 75)',
  'Minnesota Twins': 'rgb(0, 43, 92)',
  'New York Yankees': 'rgb(12, 35, 64)',
  'New York Mets': 'rgb(0, 45, 114)',
  'Athletics': 'rgb(0, 56, 49)',
  'Philadelphia Phillies': 'rgb(232, 24, 40)',
  'Pittsburgh Pirates': 'rgb(253, 184, 39)',
  'San Diego Padres': 'rgb(255, 196, 37)',
  'San Francisco Giants': 'rgb(253, 90, 30)',
  'Seattle Mariners': 'rgb(0, 92, 92)',
  'St. Louis Cardinals': 'rgb(196, 30, 58)',
  'Tampa Bay Rays': 'rgb(9, 44, 92)',
  'Texas Rangers': 'rgb(0, 50, 120)',
  'Toronto Blue Jays': 'rgb(19, 74, 142)',
  'Washington Nationals': 'rgb(171, 0, 3)',
};

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

    const earnedRuns = stats.earnedRuns ?? 0;
    const strikeOuts = stats.strikeOuts ?? 0;

    return `${earnedRuns} ER, ${strikeOuts} K`;
  };

  const formatName = (player) => {
    if (!player?.fullName) return 'N/A';
    const parts = player.fullName.split(' ');
    if (parts.length === 1) return parts[0];
    if (parts.length >= 3 && parts[parts.length - 1].includes('.')) {
      return parts.slice(-2).join(' ');
    }
    return parts.slice(-1)[0];
  };

  const cellMargin = '2px';

  const renderTeamCell = (team, score, side) => {
    const abbr = getTeamAbbreviation(team.id);
    const record = getTeamRecord(team.id);
    const teamName = team.name;
    const color = teamPrimaryColors[teamName];

    return (
      <div
        className="team-cell"
        style={{ display: 'flex', cursor: 'pointer', position: 'relative', margin: cellMargin }}
        onClick={() => handleStarClick(gamePk, team.id)}
      >
        {color && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              right: 0,
              left: 0,
              background: `linear-gradient(to left, ${color}, transparent 80%)`,
              backgroundBlendMode: 'screen',
              pointerEvents: 'none',
              zIndex: 1,
              borderRadius: side === 'away' ? '6px 0 0 0' : '0 0 0 6px',
            }}
          />
        )}

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
            position: 'relative',
            zIndex: 2,
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
    <div className="pitch-out-container" style={{ display: 'flex', margin: cellMargin, boxSizing: 'border-box', gap: '4px' }}>
      <div style={{
        flex: 1, height: '60px', border: '2px solid #555555',
        backgroundColor: 'rgba(70, 70, 70, 0.8)', opacity: 0.85,
        display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
      }}>
        <div style={{ fontWeight: 'bold', color: '#fff', marginBottom: '4px' }}>{balls}-{strikes}</div>
        <div style={{ display: 'flex', gap: '4px' }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{
              width: '10px', height: '10px', borderRadius: '50%',
              backgroundColor: i < outs ? 'gold' : 'transparent', border: '2px solid #555555',
            }} />
          ))}
        </div>
      </div>
      <div style={{
        flex: 1, height: '60px', border: '2px solid #555555',
        backgroundColor: 'rgba(70, 70, 70, 0.8)', borderRadius: '0 6px 0 0',
        opacity: 0.85, display: 'flex', flexDirection: 'column',
        justifyContent: 'center', alignItems: 'center',
      }}>
        <div style={{ position: 'relative', width: '50px', height: '50px' }}>
          <div style={{ position: 'absolute', top: '10px', left: '50%', transform: 'translate(-50%, 0) rotate(45deg)', width: '16px', height: '16px', backgroundColor: onSecond ? 'gold' : 'white' }} />
          <div style={{ position: 'absolute', bottom: -3, left: '95%', transform: 'translate(-100%, 0) rotate(45deg)', width: '16px', height: '16px', backgroundColor: onFirst ? 'gold' : 'white' }} />
          <div style={{ position: 'absolute', bottom: -3, left: 3, transform: 'rotate(45deg)', width: '16px', height: '16px', backgroundColor: onThird ? 'gold' : 'white' }} />
        </div>
        <div style={{ marginTop: '2px', marginBottom: '4px', marginRight: '2px', fontWeight: 'bold', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: '6px', marginRight: '2px' }}>{inningArrow}</span>
          <span style={{ fontSize: '13px' }}>{inning}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="score-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', padding: '5px 5px 0 5px' }}>
      {renderTeamCell(awayTeam, awayScore, 'away')}
      {renderPitchOutBox()}
      {renderTeamCell(homeTeam, homeScore, 'home')}
      <div style={{
        margin: cellMargin, border: '2px solid #555555',
        backgroundColor: 'rgba(70, 70, 70, 0.8)', opacity: 0.85,
        fontSize: '11px', color: 'white', padding: '6px 8px',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        lineHeight: '1.3', textAlign: 'left', paddingLeft: '14px', borderRadius: '0 0 6px 0',
      }}>
        <div style={{ marginBottom: '4px' }}>
          {batter ? `${formatName(batter)} (${getBatterLine()})` : 'Batter: N/A'}
        </div>
        <div>
          {pitcher ? `${formatName(pitcher)} (${getPitcherLine()})` : 'Pitcher: N/A'}
        </div>
      </div>
      <div style={{ gridColumn: '1 / span 2', margin: cellMargin }}>
        <Scoreboard game={game} getTeamAbbreviation={getTeamAbbreviation} liveData={liveData} />
      </div>
    </div>
  );
};

export default LiveScoreBug;
