import React from 'react';

const Scoreboard = ({ game, getTeamAbbreviation, getTeamScore }) => {
  return (
    <div className="scoreboard game-data-container">
      <p className="game-data-title">SCOREBOARD</p>
      <div className="scoreboard-row">
        <div className="scoreboard-cell team-abbr"></div>
        {[...Array(9)].map((_, inning) => (
          <div key={inning} className="scoreboard-cell inning">{inning + 1}</div>
        ))}
        {game.liveData.linescore?.innings.slice(9).map((_, extraInning) => (
          <div key={extraInning + 9} className="scoreboard-cell inning">{extraInning + 10}</div>
        ))}
        <div className="scoreboard-cell runs">R</div>
        <div className="scoreboard-cell hits">H</div>
        <div className="scoreboard-cell errors">E</div>
      </div>
      <div className="scoreboard-row">
        <div className="scoreboard-cell team-abbr">{getTeamAbbreviation(game.teams.away.team.id)}</div>
        {[...Array(9)].map((_, inning) => {
          const inningData = game.liveData.linescore?.innings[inning];
          return (
            <div key={inning} className="scoreboard-cell inning">
              {inningData ? (inningData.away?.runs !== undefined ? inningData.away.runs : '-') : '-'}
            </div>
          );
        })}
        {game.liveData.linescore?.innings.slice(9).map((inningData, extraInning) => (
          <div key={extraInning + 9} className="scoreboard-cell inning">
            {inningData.away?.runs !== undefined ? inningData.away.runs : '-'}
          </div>
        ))}
        <div className="scoreboard-cell runs" style={{ fontWeight: 'bold' }}>{getTeamScore(game.teams.away)}</div>
        <div className="scoreboard-cell hits">{game.liveData.boxscore.teams.away.teamStats?.batting?.hits || 0}</div>
        <div className="scoreboard-cell errors">{game.liveData.boxscore.teams.away.teamStats?.fielding?.errors || 0}</div>
      </div>
      <div className="scoreboard-row">
        <div className="scoreboard-cell team-abbr">{getTeamAbbreviation(game.teams.home.team.id)}</div>
        {[...Array(9)].map((_, inning) => {
          const inningData = game.liveData.linescore?.innings[inning];
          return (
            <div key={inning} className="scoreboard-cell inning">
              {inningData ? (inningData.home?.runs !== undefined ? inningData.home.runs : '-') : '-'}
            </div>
          );
        })}
        {game.liveData.linescore?.innings.slice(9).map((inningData, extraInning) => (
          <div key={extraInning + 9} className="scoreboard-cell inning">
            {inningData.home?.runs !== undefined ? inningData.home.runs : '-'}
          </div>
        ))}
        <div className="scoreboard-cell runs" style={{ fontWeight: 'bold' }}>{getTeamScore(game.teams.home)}</div>
        <div className="scoreboard-cell hits">{game.liveData.boxscore.teams.home.teamStats?.batting?.hits || 0}</div>
        <div className="scoreboard-cell errors">{game.liveData.boxscore.teams.home.teamStats?.fielding?.errors || 0}</div>
      </div>
    </div>
  );
};

export default Scoreboard;
