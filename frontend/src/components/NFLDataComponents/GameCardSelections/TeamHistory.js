import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { getTeamSchedule } from '../../../pages/NFLData/NFLDataApi/nflDataService';
import useAsyncData from '../shared/useAsyncData';
import { getTeamBackgroundStyle, getTeamColor } from '../shared/teamColors';
import { viewportStyle, messageStyle } from '../shared/tableStyles';

// NFL version of the MLB "TEAM W/L HISTORY" panel: each team's completed games
// this season leading up to this matchup, newest on the right. Wins get the
// team's color wash. Drag (or swipe) sideways to see earlier games.

const VISIBLE_COLUMNS = 6;

const loadTeamHistory = async (teamId, game) => {
  const season = game.season;
  const requests = [getTeamSchedule(teamId, season, 2)];
  if (game.seasonType === 3) requests.push(getTeamSchedule(teamId, season, 3));
  const schedules = await Promise.all(requests);

  const cutoff = game.date ? new Date(game.date).getTime() : Infinity;
  return schedules
    .flat()
    .filter((g) => g.id !== game.id && g.status.state === 'post' && new Date(g.date).getTime() < cutoff)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
};

const weekLabel = (g) => {
  if (g.seasonType === 3) return 'POST';
  if (g.week) return `WK ${g.week}`;
  return g.date ? new Date(g.date).toLocaleDateString([], { month: 'numeric', day: 'numeric' }) : '';
};

const HistoryColumn = ({ g, teamId, width }) => {
  const self = g.away?.teamId === teamId ? g.away : g.home;
  const opp = self === g.away ? g.home : g.away;
  const tie = g.away?.score === g.home?.score;
  const won = !tie && (self?.winner || (self?.score ?? 0) > (opp?.score ?? 0));
  const color = won ? getTeamColor(self?.team) : null;

  return (
    <div className="history-column" style={{ flex: `0 0 ${width}px`, width: `${width}px` }}>
      <div className="history-week">{weekLabel(g)}</div>
      <div className={`history-box ${won ? 'won' : ''}`}>
        {color && <div style={{ ...getTeamBackgroundStyle(color), borderRadius: '4px' }} />}
        {[g.away, g.home].map((c) => (
          <div key={c?.teamId} className="history-line">
            <span className={c?.teamId === teamId ? 'history-self' : ''}>{c?.team?.abbreviation}</span>
            <span>{c?.score ?? '-'}</span>
          </div>
        ))}
      </div>
      <div className={`history-result ${won ? 'w' : tie ? 't' : 'l'}`}>{won ? 'W' : tie ? 'T' : 'L'}</div>
    </div>
  );
};

const TeamHistory = ({ game }) => {
  const awayId = game.away?.teamId;
  const homeId = game.home?.teamId;

  const { data, error, loading } = useAsyncData(
    async () => {
      const [away, home] = await Promise.all([loadTeamHistory(awayId, game), loadTeamHistory(homeId, game)]);
      return { away, home };
    },
    [game.id, awayId, homeId, game.season, game.seasonType]
  );

  const containerRef = useRef(null);
  const dragRef = useRef(null);
  const [columnWidth, setColumnWidth] = useState(60);

  const fit = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    setColumnWidth(Math.max(Math.floor(el.clientWidth / VISIBLE_COLUMNS), 40));
    el.scrollLeft = el.scrollWidth;
  }, []);

  useLayoutEffect(() => {
    fit();
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, [data, fit]);

  // Column width changes after the first measure; keep the newest games in view.
  useEffect(() => {
    const el = containerRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [columnWidth]);

  const onMouseDown = (e) => {
    const el = containerRef.current;
    if (el) dragRef.current = { x: e.pageX, left: el.scrollLeft };
  };
  const onMouseMove = (e) => {
    const el = containerRef.current;
    if (!dragRef.current || !el) return;
    e.preventDefault();
    el.scrollLeft = dragRef.current.left - (e.pageX - dragRef.current.x) * 1.5;
  };
  const stopDrag = () => {
    dragRef.current = null;
  };

  if (loading) {
    return (
      <div style={viewportStyle}>
        <div style={messageStyle}>Loading team history…</div>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div style={viewportStyle}>
        <div style={messageStyle}>Team history is unavailable right now.</div>
      </div>
    );
  }
  if (!data.away.length && !data.home.length) {
    return (
      <div style={viewportStyle}>
        <div style={messageStyle}>No completed games yet this season.</div>
      </div>
    );
  }

  const rows = [
    { teamId: awayId, games: data.away },
    { teamId: homeId, games: data.home },
  ];

  return (
    <div className="team-history">
      <div
        className="history-scroll"
        ref={containerRef}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={stopDrag}
        onMouseLeave={stopDrag}
      >
        <div className="history-track">
          {rows.map((row) => (
            <div key={row.teamId} className="history-row">
              {row.games.length ? (
                row.games.map((g) => <HistoryColumn key={g.id} g={g} teamId={row.teamId} width={columnWidth} />)
              ) : (
                <div className="history-empty">No completed games</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TeamHistory;
