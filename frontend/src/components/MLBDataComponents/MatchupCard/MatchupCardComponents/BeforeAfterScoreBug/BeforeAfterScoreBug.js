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
  getTeamRecord,
  liveData,
}) => {
  const awayTeam = game.teams.away.team;
  const homeTeam = game.teams.home.team;
  const awayScore = liveData?.liveData?.linescore?.teams?.away?.runs ?? '-';
  const homeScore = liveData?.liveData?.linescore?.teams?.home?.runs ?? '-';

  const renderPitcherInfo = (team, pitcher) => (
    <div className="pitcher-details" style={{ fontSize: '12px' }}>
      {pitcher?.fullName ? (
        <>
          <div>
            <span style={{ fontWeight: 'bold' }}></span> {pitcher.fullName} ({pitcher.pitchHand})
          </div>
          <div>
            <span style={{ fontWeight: 'bold' }}>ERA:</span> {pitcher.era}
          </div>
        </>
      ) : (
        <span><b>P:</b> N/A</span>
      )}
    </div>
  );


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

  return (
    <>
      <div
        className="score-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gridTemplateRows: 'auto auto auto',
          gap: '5px',
          paddingRight: '10px',
          paddingLeft: '10px',
          paddingTop: '10px',
          marginRight: '3px',
        }}
      >
        {renderTeamCell(awayTeam, awayScore, 'away')}

        <div
          style={{
            border: '2px solid #555555',
            backgroundColor: 'rgba(70, 70, 70, 0.8)',
            opacity: 0.85,
            borderRadius: '0 7px 0 0',
            padding: '5px',
          }}
        >
          {renderPitcherInfo(game.teams.away.team, game.teams.away.probablePitcher)}
        </div>

        {renderTeamCell(homeTeam, homeScore, 'home')}

        <div
          style={{
            border: '2px solid #555555',
            backgroundColor: 'rgba(70, 70, 70, 0.8)',
            opacity: 0.85,
            padding: '5px',
          }}
        >
          {renderPitcherInfo(game.teams.home.team, game.teams.home.probablePitcher)}
        </div>

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

export default BeforeAfterScoreBug;
