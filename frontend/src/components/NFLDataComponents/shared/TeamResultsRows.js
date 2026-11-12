import React, { useLayoutEffect, useRef, useState } from 'react';
import { getTeamTextColor } from './teamColors';

// Both teams' recent results in one box (LINES tab, every sport): the logos
// stay put on the left and a single scroller holds both rows, so sliding it
// moves the two rows as one piece. Each row is lined up against the right edge
// (newest game last); when they don't fit, the older games fade out on the left.
// rows: [{ team, games: [{ id, date, opp, result, label, bye }] }, ...]
const TeamResultsRows = ({ rows }) => {
  const scrollRef = useRef(null);
  const [overflows, setOverflows] = useState(false);
  const total = rows.reduce((n, r) => n + r.games.length, 0);
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    const measure = () => setOverflows(el.scrollWidth > el.clientWidth + 1);
    measure();
    el.scrollLeft = el.scrollWidth; // open on the newest games
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [total]);
  if (!total) return null;
  return (
    <div className="team-results-history">
      <div className="team-results team-results-combined">
        <div className="team-results-logos">
          {rows.map(({ team }, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <div key={i} className="team-results-logo-cell">
              {team?.logo ? (
                <img className="team-results-logo" src={team.logo} alt={team.abbreviation || ''} draggable={false} />
              ) : (
                <span className="team-results-abbr" style={{ color: getTeamTextColor(team) }}>
                  {team?.abbreviation}
                </span>
              )}
            </div>
          ))}
        </div>
        <div ref={scrollRef} className={`team-results-scroll ${overflows ? 'overflows' : ''}`}>
          <div className="team-results-rows">
            {rows.map(({ team, games }, i) => (
              <div
                // eslint-disable-next-line react/no-array-index-key
                key={i}
                className="td-history-games"
                aria-label={`${team?.abbreviation || ''} won ${games.filter((g) => g.result === 'W').length} of ${
                  games.filter((g) => !g.bye).length
                }`}
              >
                {games.map((g) => (
                  <div key={g.id} className="td-history-col" title={g.label}>
                    <span className="td-history-date">{g.date}</span>
                    <span className="td-history-opp">{g.opp}</span>
                    <span
                      className={`td-history-game team-result ${g.result === 'W' ? 'hit' : ''} ${g.bye ? 'bye' : ''}`}
                    >
                      {g.bye ? '–' : g.result}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeamResultsRows;
