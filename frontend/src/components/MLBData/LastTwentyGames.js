import React, { useEffect, useRef } from 'react';
import { format } from 'date-fns';

const LastTwentyGames = ({ games, teamId, scrollPosition, onScroll }) => {
  const containerRef = useRef(null);

  // Set the initial scroll position to the right
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollLeft = containerRef.current.scrollWidth; // Scroll to the right
    }
  }, []);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollLeft = scrollPosition; // Sync scroll position
    }
  }, [scrollPosition]); // Only update when scrollPosition changes

  const handleScroll = () => {
    if (containerRef.current) {
      onScroll(containerRef.current.scrollLeft); // Notify parent of scroll position
    }
  };

  return (
    <div className="last-twenty">
      <div
        className="games-container"
        ref={containerRef}
        onScroll={handleScroll}
      >
        {games.slice().reverse().map((game, index) => { // Reverse the array here
          const awayScore = game.teams.away.score;
          const homeScore = game.teams.home.score;
          const isWinner = (game.teams.away.team.id === teamId && awayScore > homeScore) || (game.teams.home.team.id === teamId && homeScore > awayScore);
          const backgroundColor = isWinner ? 'rgba(0, 255, 0, 0.1)' : 'rgba(255, 0, 0, 0.1)';

          return (
            <div key={index} className="last-twenty-column">
              <div className="last-twenty-row date">{format(new Date(game.gameDate), 'M/d')}</div>
              <div className="team-and-score-group" style={{ backgroundColor }}>
                <div className="last-twenty-row last-twenty-row-one">
                  <div className="team-cell">{game.teams.away.team.abbreviation}</div>
                  <div className="score-cell">{game.teams.away.score}</div>
                </div>
                <div className="last-twenty-row last-twenty-row-two">
                  <div className="team-cell">{game.teams.home.team.abbreviation}</div>
                  <div className="score-cell">{game.teams.home.score}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LastTwentyGames;
