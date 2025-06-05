import React from 'react';
import Scoreboard from '../Scoreboard';

const BeforeAfterScoreBug = ({
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
  const awayScore = liveData?.liveData?.linescore?.teams?.away?.runs ?? '-';
  const homeScore = liveData?.liveData?.linescore?.teams?.home?.runs ?? '-';


  const renderTeamCell = (team, score, side) => {
    const abbr = getTeamAbbreviation(team.id);

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
                width: '45px',
                height: '45px',
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
              fontSize: '30px',
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
              fontSize: '30px',
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
          paddingLeft: '11px',
          paddingTop: '10px',
          marginRight: '3px',
          marginBottom: '5px',
        }}
      >
        {renderTeamCell(awayTeam, awayScore, 'away')}

        {/* Replaces pitch-out-container with blank cell */}
        <div
          style={{
            border: '2px solid #555555',
            backgroundColor: 'rgba(70, 70, 70, 0.8)',
            opacity: 0.85,
            height: '60px',
            borderRadius: '0 7px 0 0'
          }}
        />

        {renderTeamCell(homeTeam, homeScore, 'home')}

        {/* Bottom right cell */}
        <div
          style={{
            border: '2px solid #555555',
            backgroundColor: 'rgba(70, 70, 70, 0.8)',
            opacity: 0.85,
          }}
        />
      </div>

      <Scoreboard
        game={game}
        getTeamAbbreviation={getTeamAbbreviation}
        liveData={liveData?.liveData}
      />
    </>
  );
};

export default BeforeAfterScoreBug;
