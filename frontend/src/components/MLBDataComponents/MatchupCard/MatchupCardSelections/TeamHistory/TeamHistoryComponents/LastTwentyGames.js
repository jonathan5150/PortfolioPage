import React, { useEffect, useRef, useState, useCallback } from 'react';
import { format } from 'date-fns';
import teamPrimaryColors, {
  getTeamBackgroundStyle,
} from '../../../MatchupCardComponents/mlbUtils/teamPrimaryColors';

const VISIBLE_COLUMNS = 6;

const LastTwentyGames = ({ awayGames, homeGames, awayTeamId, homeTeamId }) => {
  const containerRef = useRef(null);
  const trackRef = useRef(null);

  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startScrollLeft, setStartScrollLeft] = useState(0);
  const [columnWidth, setColumnWidth] = useState(60);

  const scrollToRight = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    el.scrollLeft = el.scrollWidth - el.clientWidth;
  }, []);

  const updateColumnWidth = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    const availableWidth = el.clientWidth;
    const nextWidth = Math.floor(availableWidth / VISIBLE_COLUMNS);

    setColumnWidth(Math.max(nextWidth, 1));
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    const track = trackRef.current;
    if (!el || !track) return;

    updateColumnWidth();
    scrollToRight();

    const raf1 = requestAnimationFrame(() => {
      updateColumnWidth();
      scrollToRight();
    });

    const raf2 = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        updateColumnWidth();
        scrollToRight();
      });
    });

    let resizeObserver;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        updateColumnWidth();
        scrollToRight();
      });
      resizeObserver.observe(el);
      resizeObserver.observe(track);
    }

    const handleResize = () => {
      updateColumnWidth();
      scrollToRight();
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('load', handleResize);
    window.addEventListener('pageshow', handleResize);

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('load', handleResize);
      window.removeEventListener('pageshow', handleResize);
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, [awayGames, homeGames, scrollToRight, updateColumnWidth]);

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

  const columnStyle = {
    flex: `0 0 ${columnWidth}px`,
    width: `${columnWidth}px`,
    minWidth: `${columnWidth}px`,
    maxWidth: `${columnWidth}px`,
  };

  const renderRow = (games, selectedTeamId) =>
    games.slice(0, 20).map((game, index) => {
      const awayScore = game.teams.away.score;
      const homeScore = game.teams.home.score;

      const isWinner =
        (game.teams.away.team.id === selectedTeamId && awayScore > homeScore) ||
        (game.teams.home.team.id === selectedTeamId && homeScore > awayScore);

      const selectedTeam =
        game.teams.away.team.id === selectedTeamId
          ? game.teams.away.team.name
          : game.teams.home.team.name;

      const winnerColor = isWinner ? teamPrimaryColors[selectedTeam] : null;

      return (
        <div
          key={`${game.gamePk ?? game.gameDate ?? index}-${index}`}
          className="last-twenty-column"
          style={columnStyle}
        >
          <div className="last-twenty-row date">
            {format(new Date(game.gameDate), 'M/d')}
          </div>

          <div
            className="team-and-score-group"
            style={{
              position: 'relative',
              overflow: 'hidden',
              borderRadius: '4px',
              backgroundColor: isWinner ? 'transparent' : 'rgba(41, 41, 41, 0.4)',
            }}
          >
            {winnerColor && (
              <div
                style={{
                  ...getTeamBackgroundStyle(winnerColor),
                  borderRadius: '4px',
                }}
              />
            )}

            <div
              className="last-twenty-row"
              style={{ position: 'relative', zIndex: 2 }}
            >
              <div className="team-cell">{game.teams.away.team.abbreviation}</div>
              <div className="score-cell">{game.teams.away.score}</div>
            </div>
            <div
              className="last-twenty-row"
              style={{ position: 'relative', zIndex: 2 }}
            >
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
        <div className="games-track" ref={trackRef}>
          <div className="team-row">{renderRow(awayGames, awayTeamId)}</div>
          <div className="team-row">{renderRow(homeGames, homeTeamId)}</div>
        </div>
      </div>
    </div>
  );
};

export default LastTwentyGames;