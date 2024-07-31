import React, { useEffect, useState } from 'react';

const Scoreboard = ({ game, getTeamAbbreviation, getTeamScore, liveData }) => {
  const linescore = liveData?.linescore;
  const boxscore = liveData?.boxscore;

  const [prevLinescore, setPrevLinescore] = useState({});
  const [prevBoxscore, setPrevBoxscore] = useState({});

  useEffect(() => {
    setPrevLinescore(linescore || {});
    setPrevBoxscore(boxscore || {});
  }, [linescore, boxscore]);

  const checkForChange = (current, previous) => {
    return current !== previous ? 'flash-text' : '';
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
            <div key={inning} className={`scoreboard-cell inning ${checkForChange(inningData?.away?.runs, prevLinescore.innings?.[inning]?.away?.runs)}`}>
              {inningData ? (inningData.away?.runs !== undefined ? inningData.away.runs : '-') : '-'}
            </div>
          );
        })}
        {linescore?.innings.slice(9).map((inningData, extraInning) => (
          <div key={extraInning + 9} className={`scoreboard-cell inning ${checkForChange(inningData.away?.runs, prevLinescore.innings?.[extraInning + 9]?.away?.runs)}`}>
            {inningData.away?.runs !== undefined ? inningData.away.runs : '-'}
          </div>
        ))}
        <div className={`scoreboard-cell runs ${checkForChange(getTeamScore(game.teams.away), prevBoxscore.teams?.away?.teamStats?.batting?.runs)}`} style={{ fontWeight: 'bold' }}>
          {getTeamScore(game.teams.away)}
        </div>
        <div className={`scoreboard-cell hits ${checkForChange(boxscore?.teams.away.teamStats?.batting?.hits, prevBoxscore.teams?.away?.teamStats?.batting?.hits)}`}>
          {boxscore?.teams.away.teamStats?.batting?.hits || 0}
        </div>
        <div className={`scoreboard-cell errors ${checkForChange(boxscore?.teams.away.teamStats?.fielding?.errors, prevBoxscore.teams?.away?.teamStats?.fielding?.errors)}`}>
          {boxscore?.teams.away.teamStats?.fielding?.errors || 0}
        </div>
      </div>
      <div className="scoreboard-row">
        <div className="scoreboard-cell team-abbr">{getTeamAbbreviation(game.teams.home.team.id)}</div>
        {[...Array(9)].map((_, inning) => {
          const inningData = linescore?.innings[inning];
          return (
            <div key={inning} className={`scoreboard-cell inning ${checkForChange(inningData?.home?.runs, prevLinescore.innings?.[inning]?.home?.runs)}`}>
              {inningData ? (inningData.home?.runs !== undefined ? inningData.home.runs : '-') : '-'}
            </div>
          );
        })}
        {linescore?.innings.slice(9).map((inningData, extraInning) => (
          <div key={extraInning + 9} className={`scoreboard-cell inning ${checkForChange(inningData.home?.runs, prevLinescore.innings?.[extraInning + 9]?.home?.runs)}`}>
            {inningData.home?.runs !== undefined ? inningData.home.runs : '-'}
          </div>
        ))}
        <div className={`scoreboard-cell runs ${checkForChange(getTeamScore(game.teams.home), prevBoxscore.teams?.home?.teamStats?.batting?.runs)}`} style={{ fontWeight: 'bold' }}>
          {getTeamScore(game.teams.home)}
        </div>
        <div className={`scoreboard-cell hits ${checkForChange(boxscore?.teams.home.teamStats?.batting?.hits, prevBoxscore.teams?.home?.teamStats?.batting?.hits)}`}>
          {boxscore?.teams.home.teamStats?.batting?.hits || 0}
        </div>
        <div className={`scoreboard-cell errors ${checkForChange(boxscore?.teams.home.teamStats?.fielding?.errors, prevBoxscore.teams?.home?.teamStats?.fielding?.errors)}`}>
          {boxscore?.teams.home.teamStats?.fielding?.errors || 0}
        </div>
      </div>
    </div>
  );
};

export default Scoreboard;
