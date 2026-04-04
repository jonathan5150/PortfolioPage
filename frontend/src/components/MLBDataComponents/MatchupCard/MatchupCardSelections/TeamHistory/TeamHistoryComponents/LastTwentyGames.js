import React, { useLayoutEffect, useRef, useState } from 'react';
import { format } from 'date-fns';

const LastTwentyGames = ({ awayGames, homeGames, awayTeamId, homeTeamId }) => {
  const containerRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startScrollLeft, setStartScrollLeft] = useState(0);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const resetToRight = () => {
      el.scrollLeft = Math.max(0, el.scrollWidth - el.clientWidth);
    };

    resetToRight();

    const raf = requestAnimationFrame(resetToRight);
    return () => cancelAnimationFrame(raf);
  }, [awayGames, homeGames]);

  const handleMouseDown = (e) => {
    const el = containerRef.current;
    if (!el) return;

    setIsDragging(true);
    setStartX(e.pageX - el.offsetLeft);
    setStartScrollLeft(el.scrollLeft);
  };

  const stopDragging = () => setIsDragging(false);

  const handleMouseMove = (e) => {
    const el = containerRef.current;
    if (!isDragging || !el) return;

    e.preventDefault();
    const x = e.pageX - el.offsetLeft;
    const walk = (x - startX) * 2;
    el.scrollLeft = startScrollLeft - walk;
  };

  const renderRow = (games, selectedTeamId) =>
    games.slice(0, 20).map((game, index) => {
      const awayScore = game.teams.away.score;
      const homeScore = game.teams.home.score;

      const isWinner =
        (game.teams.away.team.id === selectedTeamId && awayScore > homeScore) ||
        (game.teams.home.team.id === selectedTeamId && homeScore > awayScore);

      const backgroundColor = isWinner
        ? 'rgba(0, 255, 0, 0.1)'
        : 'rgba(255, 0, 0, 0.1)';

      return (
        <div key={index} className="last-twenty-column">
          <div className="last-twenty-row date">
            {format(new Date(game.gameDate), 'M/d')}
          </div>

          <div className="team-and-score-group" style={{ backgroundColor }}>
            <div className="last-twenty-row">
              <div className="team-cell">{game.teams.away.team.abbreviation}</div>
              <div className="score-cell">{game.teams.away.score}</div>
            </div>
            <div className="last-twenty-row">
              <div className="team-cell">{game.teams.home.team.abbreviation}</div>
              <div className="score-cell">{game.teams.home.score}</div>
            </div>
          </div>
        </div>
      );
    });

  return (
    <div className="last-twenty">
      <div
        className="games-container"
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseLeave={stopDragging}
        onMouseUp={stopDragging}
        onMouseMove={handleMouseMove}
      >
        <div className="games-track">
          <div className="team-row">{renderRow(awayGames, awayTeamId)}</div>
          <div className="team-row">{renderRow(homeGames, homeTeamId)}</div>
        </div>
      </div>
    </div>
  );
};

export default LastTwentyGames;