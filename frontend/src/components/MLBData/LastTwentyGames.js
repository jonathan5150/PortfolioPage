import React, { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';

const LastTwentyGames = ({ games, teamId }) => {
  const containerRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollLeft = containerRef.current.scrollWidth;
    }
  }, []);

  const handleMouseDown = (e) => {
    setIsDragging(true);
    setStartX(e.pageX - containerRef.current.offsetLeft);
    setScrollLeft(containerRef.current.scrollLeft);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    e.preventDefault();
    const x = e.pageX - containerRef.current.offsetLeft;
    const walk = (x - startX) * 2; // The *2 makes the scroll faster
    containerRef.current.scrollLeft = scrollLeft - walk;
  };

  return (
    <div className="last-twenty">
      <div
        className="games-container"
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseLeave={handleMouseLeave}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
      >
        {games.map((game, index) => {
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