import React from 'react';
import { format } from 'date-fns';

const LastFiveGames = ({ games, teamId }) => {
  return (
    <div className="last-five">
      {games.map((game, index) => {
        const awayScore = game.teams.away.score;
        const homeScore = game.teams.home.score;
        const isWinner = (game.teams.away.team.id === teamId && awayScore > homeScore) || (game.teams.home.team.id === teamId && homeScore > awayScore);
        const backgroundColor = isWinner ? 'rgba(0, 255, 0, 0.1)' : 'rgba(255, 0, 0, 0.1)';

        return (
          <div key={index} className="last-five-column">
            <div className="last-five-row date">{format(new Date(game.gameDate), 'M/d')}</div>
            <div className="team-and-score-group" style={{ backgroundColor }}>
              <div className="last-five-row">
                <div className="team-cell">{game.teams.away.team.abbreviation}</div>
                <div className="score-cell">{game.teams.away.score}</div>
              </div>
              <div className="last-five-row">
                <div className="team-cell">{game.teams.home.team.abbreviation}</div>
                <div className="score-cell">{game.teams.home.score}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default LastFiveGames;
