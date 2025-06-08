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

  const renderTeamCell = (team, score, side) => {
    const abbr = getTeamAbbreviation(team.id);
    const record = getTeamRecord(team.id);

    console.log('LiveScoreBug liveData:', liveData);

    return (
      <div
        className="team-cell"
        style={{ display: 'flex', cursor: 'pointer' }}
        onClick={() => handleStarClick(gamePk, team.id)}
      >
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
            borderRadius: side === 'away' ? '5px 0 0 0' : '0',
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
            <div
              className="abbreviation"
              style={{
                height: '30px',
                fontWeight: 'bold',
                color: '#fff',
                textAlign: 'center',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {abbr}
            </div>
            <div
              style={{
                fontSize: '11px',
                color: '#ccc',
                lineHeight: '12px',
                width: '60px',
                textAlign: 'center',
                alignItems: 'center',
              }}
            >
              {record}
            </div>
          </div>

          <div
            style={{
              fontWeight: 'bold',
              fontSize: '25px',
              color: '#fff',
              width: '30px',
              textAlign: 'center',
            }}
          >
            {score}
          </div>
        </div>
      </div>
    );
  };

  const renderPitchOutBox = () => {
    return (
      <div
        className="pitch-out-container"
        style={{
          width: '100%',
          height: '60px',
          display: 'flex',
          gap: '5px',
          justifyContent: 'space-between',
        }}
      >
        <div
          style={{
            flex: 1,
            height: '60px',
            border: '2px solid #555555',
            backgroundColor: 'rgba(70, 70, 70, 0.8)',
            opacity: 0.85,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <div style={{ fontWeight: 'bold', color: '#fff', marginBottom: '4px' }}>
            {balls}-{strikes}
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: i < outs ? 'gold' : 'transparent',
                  border: '2px solid #555555',
                }}
              />
            ))}
          </div>
        </div>

        <div
          style={{
            flex: 1,
            height: '60px',
            border: '2px solid #555555',
            backgroundColor: 'rgba(70, 70, 70, 0.8)',
            borderRadius: '0 5px 0 0',
            opacity: 0.85,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <div style={{ position: 'relative', width: '50px', height: '50px' }}>
            <div
              style={{
                position: 'absolute',
                top: '10px',
                left: '50%',
                transform: 'translate(-50%, 0) rotate(45deg)',
                width: '16px',
                height: '16px',
                backgroundColor: onSecond ? 'gold' : 'white',
              }}
            />
            <div
              style={{
                position: 'absolute',
                bottom: -3,
                left: '97%',
                transform: 'translate(-100%, 0) rotate(45deg)',
                width: '16px',
                height: '16px',
                backgroundColor: onFirst ? 'gold' : 'white',
              }}
            />
            <div
              style={{
                position: 'absolute',
                bottom: -3,
                left: 2,
                transform: 'rotate(45deg)',
                width: '16px',
                height: '16px',
                backgroundColor: onThird ? 'gold' : 'white',
              }}
            />
          </div>
          <div
            style={{
              marginTop: '2px',
              marginBottom: '4px',
              marginRight: '2px',
              fontWeight: 'bold',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ fontSize: '6px', marginRight: '2px' }}>{inningArrow}</span>
            <span style={{ fontSize: '13px' }}>{inning}</span>
          </div>
        </div>
      </div>
    );
  };

  const batter = liveData?.plays?.currentPlay?.matchup?.batter;
  const pitcher = liveData?.plays?.currentPlay?.matchup?.pitcher;

  const formatName = (player) =>
    player ? `${player.fullName.split(' ')[0][0]}. ${player.fullName.split(' ').slice(-1)}` : 'N/A';

  return (
    <div
      className="score-grid"
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gridTemplateRows: '1fr 1fr',
        gap: '5px',
        paddingRight: '10px',
        paddingLeft: '10px',
        paddingTop: '10px',
      }}
    >
      {renderTeamCell(awayTeam, awayScore, 'away')}
      {renderPitchOutBox()}
      {renderTeamCell(homeTeam, homeScore, 'home')}
      <div
        style={{
          border: '2px solid #555555',
          backgroundColor: 'rgba(70, 70, 70, 0.8)',
          opacity: 0.85,
          fontSize: '13px',
          color: 'white',
          padding: '6px 8px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          lineHeight: '1.3',
          textAlign: 'left',
          paddingLeft: '14px',
        }}
      >
        <div style={{ marginBottom: '4px' }}>
          <strong>AB:</strong>{' '}
          {batter ? formatName(batter) : 'Batter: N/A'}
        </div>
        <div>
          <strong>P:</strong>{' '}
          {pitcher ? formatName(pitcher) : 'Pitcher: N/A'}
        </div>
      </div>
      <div style={{ gridColumn: '1 / span 2' }}>
        <Scoreboard game={game} getTeamAbbreviation={getTeamAbbreviation} liveData={liveData} />
      </div>
    </div>
  );
};

export default LiveScoreBug;
