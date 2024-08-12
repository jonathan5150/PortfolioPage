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
          <div key={inning} className="scoreboard-cell inning">{inning + 1}</div>
        ))}
        {linescore?.innings.slice(9).map((_, extraInning) => (
          <div key={extraInning + 9} className="scoreboard-cell inning">{extraInning + 10}</div>
        ))}
        <div className="scoreboard-cell runs">R</div>
        <div className="scoreboard-cell hits">H</div>
        <div className="scoreboard-cell errors">E</div>
      </div>
      <div className="scoreboard-row">
        <div className="scoreboard-cell team-abbr">{getTeamAbbreviation(game.teams.away.team.id)}</div>
        {[...Array(9)].map((_, inning) => {
          const inningData = linescore?.innings[inning];
          return (
            <div key={inning} className="scoreboard-cell inning">
              {inningData ? (inningData.away?.runs !== undefined ? inningData.away.runs : '-') : '-'}
            </div>
          );
        })}
        {linescore?.innings.slice(9).map((inningData, extraInning) => (
          <div key={extraInning + 9} className="scoreboard-cell inning">
            {inningData.away?.runs !== undefined ? inningData.away.runs : '-'}
          </div>
        ))}
        <div className="scoreboard-cell runs" style={{ fontWeight: 'bold' }}>
          {calculateTeamScore('away', linescore)}
        </div>
        <div className="scoreboard-cell hits">{liveData?.boxscore?.teams.away.teamStats?.batting?.hits || 0}</div>
        <div className="scoreboard-cell errors">{liveData?.boxscore?.teams.away.teamStats?.fielding?.errors || 0}</div>
      </div>
      <div className="scoreboard-row">
        <div className="scoreboard-cell team-abbr">{getTeamAbbreviation(game.teams.home.team.id)}</div>
        {[...Array(9)].map((_, inning) => {
          const inningData = linescore?.innings[inning];
          return (
            <div key={inning} className="scoreboard-cell inning">
              {inningData ? (inningData.home?.runs !== undefined ? inningData.home.runs : '-') : '-'}
            </div>
          );
        })}
        {linescore?.innings.slice(9).map((inningData, extraInning) => (
          <div key={extraInning + 9} className="scoreboard-cell inning">
            {inningData.home?.runs !== undefined ? inningData.home.runs : '-'}
          </div>
        ))}
        <div className="scoreboard-cell runs" style={{ fontWeight: 'bold' }}>
          {calculateTeamScore('home', linescore)}
        </div>
        <div className="scoreboard-cell hits">{liveData?.boxscore?.teams.home.teamStats?.batting?.hits || 0}</div>
        <div className="scoreboard-cell errors">{liveData?.boxscore?.teams.home.teamStats?.fielding?.errors || 0}</div>
      </div>
    </div>
  );
};

export default Scoreboard;
