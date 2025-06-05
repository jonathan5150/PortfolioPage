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
  liveData,
}) => {
  const awayTeam = game.teams.away.team;
  const homeTeam = game.teams.home.team;
  const awayScore = liveData?.linescore?.teams?.away?.runs ?? '-';
  const homeScore = liveData?.linescore?.teams?.home?.runs ?? '-';

  // ✅ Extract pitch count + outs
  const count = liveData?.plays?.currentPlay?.count || {};
  const balls = count.balls ?? 0;
  const strikes = count.strikes ?? 0;
  const outs = count.outs ?? 0;

  // ✅ Extract base runners
  const offense = liveData?.liveData?.linescore?.offense || {};
  const onFirst = !!offense.first;
  const onSecond = !!offense.second;
  const onThird = !!offense.third;

  const renderTeamCell = (team, score, side) => {
    const abbr = getTeamAbbreviation(team.id);

    return (
      <div
        className="team-cell"
        style={{
          display: 'flex',
          alignItems: 'center',
          cursor: 'pointer',
        }}
        onClick={() => handleStarClick(gamePk, team.id)}
      >
        <div
          className="team-info-container"
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            border: '2px solid #555555',
            backgroundColor: 'rgba(70, 70, 70, 0.8)',
            borderRadius: '7px',
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
                width: '55px',
                height: '55px',
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

          {/* Abbreviation */}
          <div
            style={{
              width: '40px',
              height: '55px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              fontSize: '25px',
              color: '#fff',
              textAlign: 'center',
            }}
          >
            {abbr}
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
          display: 'flex',
          gap: '5px',
          justifyContent: 'space-between',
        }}
      >
        {/* Pitch/Out Left Cell */}
        <div
          style={{
            flex: 1,
            height: '70px',
            border: '2px solid #555555',
            backgroundColor: 'rgba(70, 70, 70, 0.8)',
            borderRadius: '7px',
            padding: '5px 10px',
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

        {/* Right Cell: Baseball Diamond */}
        <div
          style={{
            flex: 1,
            height: '70px',
            border: '2px solid #555555',
            backgroundColor: 'rgba(70, 70, 70, 0.8)',
            borderRadius: '7px',
            opacity: 0.85,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <div style={{ position: 'relative', width: '50px', height: '50px' }}>
            {/* Second Base */}
            <div
              style={{
                position: 'absolute',
                top: '16px',
                left: '50%',
                transform: 'translate(-50%, 0) rotate(45deg)',
                width: '16px',
                height: '16px',
                backgroundColor: onSecond ? 'gold' : 'white',
                border: '2px solid black',
              }}
            />
            {/* First Base */}
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: '99%',
                transform: 'translate(-100%, 0) rotate(45deg)',
                width: '16px',
                height: '16px',
                backgroundColor: onFirst ? 'gold' : 'white',
                border: '2px solid black',
              }}
            />
            {/* Third Base */}
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
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
          padding: '10px',
          marginRight: '5px',
        }}
      >
        {renderTeamCell(awayTeam, awayScore, 'away')}
        {renderPitchOutBox()}
        {renderTeamCell(homeTeam, homeScore, 'home')}
        <div />
      </div>

      <Scoreboard
        game={game}
        getTeamAbbreviation={getTeamAbbreviation}
        liveData={liveData}
      />
    </>
  );
};

export default LiveScoreBug;
