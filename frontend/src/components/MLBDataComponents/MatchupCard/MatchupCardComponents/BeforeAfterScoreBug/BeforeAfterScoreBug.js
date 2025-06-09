import React from 'react';
import Scoreboard from '../Scoreboard';

// Official primary colors for each MLB team
const teamPrimaryColors = {
  'Arizona Diamondbacks': 'rgb(167, 25, 48)',
  'Atlanta Braves': 'rgb(35, 48, 115)',
  'Baltimore Orioles': 'rgb(223, 70, 1)',
  'Boston Red Sox': 'rgb(189, 48, 57)',
  'Chicago White Sox': 'rgb(160, 160, 160)',
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
  const trueLiveData = liveData?.liveData ?? liveData;
  const gameNotStarted = game.status.abstractGameState === 'Preview' || game.status.abstractGameState === 'Scheduled';
  const awayTeam = game.teams.away.team;
  const homeTeam = game.teams.home.team;
  const awayScore = gameNotStarted ? '-' : trueLiveData?.linescore?.teams?.away?.runs ?? '-';
  const homeScore = gameNotStarted ? '-' : trueLiveData?.linescore?.teams?.home?.runs ?? '-';

  const renderPitcherInfo = (team, pitcher) => (
    <div className="pitcher-details">
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
    const teamName = team.name;

    const gradientColor = teamPrimaryColors[teamName] || null;

    return (
      <div
        className="team-cell"
        style={{ display: 'flex', cursor: 'pointer', position: 'relative' }}
        onClick={() => handleStarClick(gamePk, team.id)}
      >
        {gradientColor && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              right: 0,
              left: 0,
              background: `linear-gradient(to left, ${gradientColor}, transparent 90%)`,
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
            border: '2px solid rgb(85, 85, 85)',
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
              src={getTeamLogo(teamName)}
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
    <div
      className="score-grid"
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gridTemplateRows: 'auto auto auto',
        padding: '5px 5px 0 5px',
      }}
    >
      <div style={{ margin: '2px' }}>
        {renderTeamCell(awayTeam, awayScore, 'away')}
      </div>

      <div
        style={{
          margin: '2px',
          border: '2px solid #555555',
          backgroundColor: 'rgba(70, 70, 70, 0.8)',
          opacity: 0.85,
          borderRadius: '0 6px 0 0',
          padding: '5px',
        }}
      >
        {renderPitcherInfo(awayTeam, game.teams.away.probablePitcher)}
      </div>

      <div style={{ margin: '2px' }}>
        {renderTeamCell(homeTeam, homeScore, 'home')}
      </div>

      <div
        style={{
          margin: '2px',
          border: '2px solid #555555',
          backgroundColor: 'rgba(70, 70, 70, 0.8)',
          opacity: 0.85,
          padding: '5px',
          borderRadius: '0 0 6px 0',
        }}
      >
        {renderPitcherInfo(homeTeam, game.teams.home.probablePitcher)}
      </div>

      {!gameNotStarted && (
        <div style={{ gridColumn: '1 / span 2', margin: '2px' }}>
          <Scoreboard
            game={game}
            getTeamAbbreviation={getTeamAbbreviation}
            liveData={trueLiveData}
          />
        </div>
      )}
    </div>
  );
};

export default BeforeAfterScoreBug;
