import React, { useEffect, useState } from 'react';

const Scoreboard = ({ game, getTeamAbbreviation, liveData }) => {
  const linescore = liveData?.linescore;

  const [prevLinescore, setPrevLinescore] = useState({});

  useEffect(() => {
    setPrevLinescore(linescore || {});
  }, [linescore]);

  const checkForChange = (current, previous) => {
    return current !== previous ? 'flash-text' : '';
  };

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
        <div className={`scoreboard-cell runs ${checkForChange(calculateTeamScore('away', linescore), calculateTeamScore('away', prevLinescore))}`} style={{ fontWeight: 'bold' }}>
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
        <div className={`scoreboard-cell runs ${checkForChange(calculateTeamScore('home', linescore), calculateTeamScore('home', prevLinescore))}`} style={{ fontWeight: 'bold' }}>
          {calculateTeamScore('home', linescore)}
        </div>
        <div className="scoreboard-cell hits">{liveData?.boxscore?.teams.home.teamStats?.batting?.hits || 0}</div>
        <div className="scoreboard-cell errors">{liveData?.boxscore?.teams.home.teamStats?.fielding?.errors || 0}</div>
      </div>
    </div>
  );
};

export default Scoreboard;
