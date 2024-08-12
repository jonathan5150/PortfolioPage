import React from 'react';

const Scoreboard = ({ game, getTeamAbbreviation, liveData }) => {
  const linescore = liveData?.linescore;

  const calculateTeamScore = (team, linescore) => {
    if (!linescore || !linescore.innings) return 0;
    return linescore.innings.reduce((total, inning) => {
      return total + (inning[team]?.runs || 0);
    }, 0);
  };

  return (
    <div className="scoreboard game-data-container">
      <p className="game-data-title">SCOREBOARD</p>
      <div className="scoreboard-row">
        <div className="scoreboard-cell team-abbr"></div>
        {[...Array(9)].map((_, inning) => (
          <div key={inning} className="scoreboard-cell inning" style={{ animationDelay: `${inning * 0.1}s` }}>
            {inning + 1}
          </div>
        ))}
        {linescore?.innings.slice(9).map((_, extraInning) => (
          <div key={extraInning + 9} className="scoreboard-cell inning" style={{ animationDelay: `${(extraInning + 9) * 0.1}s` }}>
            {extraInning + 10}
          </div>
        ))}
        <div className="scoreboard-cell runs" style={{ animationDelay: '0.1s' }}>R</div>
        <div className="scoreboard-cell hits" style={{ animationDelay: '0.1s' }}>H</div>
        <div className="scoreboard-cell errors" style={{ animationDelay: '0.1s' }}>E</div>
      </div>
      <div className="scoreboard-row">
        <div className="scoreboard-cell team-abbr" style={{ animationDelay: '0.1s' }}>{getTeamAbbreviation(game.teams.away.team.id)}</div>
        {[...Array(9)].map((_, inning) => {
          const inningData = linescore?.innings[inning];
          return (
            <div key={inning} className="scoreboard-cell inning" style={{ animationDelay: `${(inning + 1) * 0.1}s` }}>
              {inningData ? (inningData.away?.runs !== undefined ? inningData.away.runs : '-') : '-'}
            </div>
          );
        })}
        {linescore?.innings.slice(9).map((inningData, extraInning) => (
          <div key={extraInning + 9} className="scoreboard-cell inning" style={{ animationDelay: `${(extraInning + 9) * 0.1}s` }}>
            {inningData.away?.runs !== undefined ? inningData.away.runs : '-'}
          </div>
        ))}
        <div className="scoreboard-cell runs" style={{ fontWeight: 'bold', animationDelay: '1.0s' }}>
          {calculateTeamScore('away', linescore)}
        </div>
        <div className="scoreboard-cell hits" style={{ animationDelay: '1.1s' }}>{liveData?.boxscore?.teams.away.teamStats?.batting?.hits || 0}</div>
        <div className="scoreboard-cell errors" style={{ animationDelay: '1.2s' }}>{liveData?.boxscore?.teams.away.teamStats?.fielding?.errors || 0}</div>
      </div>
      <div className="scoreboard-row">
        <div className="scoreboard-cell team-abbr" style={{ animationDelay: '0.1s' }}>{getTeamAbbreviation(game.teams.home.team.id)}</div>
        {[...Array(9)].map((_, inning) => {
          const inningData = linescore?.innings[inning];
          return (
            <div key={inning} className="scoreboard-cell inning" style={{ animationDelay: `${(inning + 1) * 0.1}s` }}>
              {inningData ? (inningData.home?.runs !== undefined ? inningData.home.runs : '-') : '-'}
            </div>
          );
        })}
        {linescore?.innings.slice(9).map((inningData, extraInning) => (
          <div key={extraInning + 9} className="scoreboard-cell inning" style={{ animationDelay: `${(extraInning + 9) * 0.1}s` }}>
            {inningData.home?.runs !== undefined ? inningData.home.runs : '-'}
          </div>
        ))}
        <div className="scoreboard-cell runs" style={{ fontWeight: 'bold', animationDelay: '1.0s' }}>
          {calculateTeamScore('home', linescore)}
        </div>
        <div className="scoreboard-cell hits" style={{ animationDelay: '1.1s' }}>{liveData?.boxscore?.teams.home.teamStats?.batting?.hits || 0}</div>
        <div className="scoreboard-cell errors" style={{ animationDelay: '1.2s' }}>{liveData?.boxscore?.teams.home.teamStats?.fielding?.errors || 0}</div>
      </div>
    </div>
  );
};

export default Scoreboard;
