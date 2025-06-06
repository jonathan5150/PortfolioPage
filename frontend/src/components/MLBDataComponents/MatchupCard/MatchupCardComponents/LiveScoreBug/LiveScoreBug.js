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

  const offense = liveData?.liveData?.linescore?.offense || {};
  const onFirst = !!offense.first;
  const onSecond = !!offense.second;
  const onThird = !!offense.third;

  const renderTeamCell = (team, score, side) => {
    const abbr = getTeamAbbreviation(team.id);
    const record = getTeamRecord(team.id);

    return (
      <div
        className="team-cell"
        style={{
          display: 'flex',
          cursor: 'pointer',
        }}
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
            borderRadius: side === 'away' ? '7px 0 0 0' : '0',
            padding: '5px 10px',
            opacity: 0.85,
          }}
        >
          {/* Logo */}
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

          {/* Abbreviation + Record */}
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

          {/* Score */}
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
            borderRadius: '0 7px 0 0',
            opacity: 0.85,
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <div style={{ position: 'relative', width: '50px', height: '50px' }}>
            <div
              style={{
                position: 'absolute',
                top: '7px',
                left: '50%',
                transform: 'translate(-50%, 0) rotate(45deg)',
                width: '16px',
                height: '16px',
                backgroundColor: onSecond ? 'gold' : 'white',
                border: '2px solid black',
              }}
            />
            <div
              style={{
                position: 'absolute',
                bottom: 8,
                left: '102%',
                transform: 'translate(-100%, 0) rotate(45deg)',
                width: '16px',
                height: '16px',
                backgroundColor: onFirst ? 'gold' : 'white',
                border: '2px solid black',
              }}
            />
            <div
              style={{
                position: 'absolute',
                bottom: 8,
                left: -1,
                transform: 'rotate(45deg)',
                width: '16px',
                height: '16px',
                backgroundColor: onThird ? 'gold' : 'white',
                border: '2px solid black',
              }}
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
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
          }}
        />
        <div style={{ gridColumn: '1 / span 2' }}>
          <Scoreboard
            game={game}
            getTeamAbbreviation={getTeamAbbreviation}
            liveData={liveData}
          />
        </div>
      </div>
    </>
  );
};

export default LiveScoreBug;
