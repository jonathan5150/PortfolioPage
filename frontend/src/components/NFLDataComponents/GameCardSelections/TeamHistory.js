import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { getTeamSchedule } from '../../../pages/NFLData/NFLDataApi/nflDataService';
import useAsyncData from '../shared/useAsyncData';
import { getTeamBackgroundStyle, getTeamBorderColor, getTeamColor } from '../shared/teamColors';
import { viewportStyle, messageStyle } from '../shared/tableStyles';

// NFL version of the MLB "TEAM W/L HISTORY" panel: each team's completed games
// this season leading up to this matchup, newest on the right. Wins get the
// team's color wash and border; losses are a neutral slate tile. Drag (or swipe) sideways to see earlier games.

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

const resultOf = (g, teamId) => {
  const self = g.away?.teamId === teamId ? g.away : g.home;
  const opp = self === g.away ? g.home : g.away;
  const tie = g.away?.score === g.home?.score;
  const won = !tie && (self?.winner || Number(self?.score ?? 0) > Number(opp?.score ?? 0));
  return { self, opp, home: self === g.home, result: tie ? 'T' : won ? 'W' : 'L' };
};

// "6-3" (plus ties) and the current streak, e.g. "W2".
const summarize = (games, teamId) => {
  const results = games.map((g) => resultOf(g, teamId).result);
  const count = (r) => results.filter((x) => x === r).length;
  const ties = count('T');
  const record = `${count('W')}-${count('L')}${ties ? `-${ties}` : ''}`;
  const last = results[results.length - 1];
  let streak = 0;
  for (let i = results.length - 1; i >= 0 && results[i] === last; i -= 1) streak += 1;
  return { record, streak: last ? `${last}${streak}` : '' };
};

const HistoryHead = ({ team, games, teamId }) => {
  const { record, streak } = summarize(games, teamId);
  return (
    <div className="history-head">
      {team?.logo && <img src={team.logo} alt="" draggable={false} />}
      <span className="history-head-name">{team?.abbreviation}</span>
      <span className="history-head-record">{record}</span>
      {streak && <span className={`history-streak ${streak[0].toLowerCase()}`}>{streak}</span>}
    </div>
  );
};

const HistoryColumn = ({ g, teamId, width }) => {
  const { self, opp, home, result } = resultOf(g, teamId);
  const won = result === 'W';
  const color = won ? getTeamColor(self?.team) : null;

  return (
    <div className="history-column" style={{ flex: `0 0 ${width}px`, width: `${width}px` }}>
      <div className="history-week">{weekLabel(g)}</div>
      <div
        className={`history-box ${result.toLowerCase()}`}
        style={won ? { borderColor: getTeamBorderColor(self?.team) } : undefined}
      >
        {color && <div style={{ ...getTeamBackgroundStyle(color), borderRadius: '6px' }} />}
        <span className={`history-result ${result.toLowerCase()}`}>{result}</span>
        <span className="history-opp">
          <span className="history-at">{home ? 'vs' : '@'}</span>
          {opp?.team?.logo ? (
            <img src={opp.team.logo} alt={opp.team.abbreviation} draggable={false} />
          ) : (
            opp?.team?.abbreviation
          )}
        </span>
        <span className="history-score">
          {self?.score ?? '-'}-{opp?.score ?? '-'}
        </span>
      </div>
    </div>
  );
};

const TeamHistory = ({ game }) => {
  const awayId = game.away?.teamId;
  const homeId = game.home?.teamId;

  const { data, error, loading } = useAsyncData(async () => {
    const [away, home] = await Promise.all([loadTeamHistory(awayId, game), loadTeamHistory(homeId, game)]);
    return { away, home };
  }, [game.id, awayId, homeId, game.season, game.seasonType]);

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
    { teamId: awayId, team: game.away?.team, games: data.away },
    { teamId: homeId, team: game.home?.team, games: data.home },
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
            <div key={row.teamId} className="history-block">
              <HistoryHead team={row.team} games={row.games} teamId={row.teamId} />
              <div className="history-row">
                {row.games.length ? (
                  row.games.map((g) => <HistoryColumn key={g.id} g={g} teamId={row.teamId} width={columnWidth} />)
                ) : (
                  <div className="history-empty">No completed games</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TeamHistory;
