import React, { useMemo, useState } from 'react';
import SwipeTeamPanel from '../shared/SwipeTeamPanel';
import StatTable from '../shared/StatTable';
import useAsyncData from '../shared/useAsyncData';
import usePersistentState, { usePersistentMapEntry } from '../shared/usePersistentState';
import { messageStyle, sourceNoteStyle } from '../shared/tableStyles';
import { getTeamPlayerSeasonStats } from '../../../pages/NFLData/NFLDataApi/nflDataService';
import { SEASON_VIEWS, sortRows } from './playerStatColumns';

const SEASONS_BACK = 6;

const TeamSeasonTable = ({ state, view, sort, onSort, team }) => {
  if (state.loading) return <div style={messageStyle}>Loading {team?.abbreviation} season stats…</div>;
  if (state.error || !state.data) return <div style={messageStyle}>Season stats unavailable right now.</div>;

  const config = SEASON_VIEWS[view];
  const rows = sortRows(state.data.players.filter(config.filter), config.columns, sort);

  return (
    <>
      <StatTable
        columns={config.columns}
        rows={rows}
        sort={sort}
        onSort={onSort}
        minWidth={config.minWidth}
        emptyMessage={`No ${config.label} stats for ${team?.abbreviation}.`}
      />
      <div style={sourceNoteStyle}>source: {state.data.source}</div>
    </>
  );
};

const PlayerSeasonStats = ({ gameId, awayTeam, homeTeam, season, currentSeason }) => {
  const [view, setView] = usePersistentState('seasonStatsView', 'qb');
  const [sorts, setSorts] = usePersistentState('seasonStatsSort', {});
  const [showing, setShowing] = usePersistentMapEntry('seasonStatsSideByGame', gameId, 'away');
  const [statsSeason, setStatsSeason] = useState(season);

  const config = SEASON_VIEWS[view] || SEASON_VIEWS.qb;
  const sort = sorts[view] || config.defaultSort;

  const away = useAsyncData(
    () => getTeamPlayerSeasonStats(awayTeam, statsSeason, currentSeason),
    [awayTeam?.id, statsSeason, currentSeason],
    { enabled: Boolean(awayTeam?.id) }
  );
  const home = useAsyncData(
    () => getTeamPlayerSeasonStats(homeTeam, statsSeason, currentSeason),
    [homeTeam?.id, statsSeason, currentSeason],
    { enabled: Boolean(homeTeam?.id) }
  );

  const seasonOptions = useMemo(
    () => Array.from({ length: SEASONS_BACK + 1 }, (_, i) => (currentSeason || season) - i),
    [currentSeason, season]
  );

  const handleSort = (key) =>
    setSorts((prev) => {
      const current = prev[view] || config.defaultSort;
      const direction = current.key === key ? (current.direction === 'asc' ? 'desc' : 'asc') : key === 'name' ? 'asc' : 'desc';
      return { ...prev, [view]: { key, direction } };
    });

  return (
    <div>
      <div className="panel-toolbar">
        <div className="segmented">
          {Object.entries(SEASON_VIEWS).map(([key, v]) => (
            <button
              key={key}
              type="button"
              className={`segment ${view === key ? 'active' : ''}`}
              onClick={() => setView(key)}
            >
              {v.label}
            </button>
          ))}
        </div>
        <select
          className="toolbar-select"
          value={statsSeason}
          onChange={(e) => setStatsSeason(Number(e.target.value))}
          aria-label="Stats season"
        >
          {seasonOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <SwipeTeamPanel
        awayTeam={awayTeam}
        homeTeam={homeTeam}
        showing={showing}
        onShowingChange={setShowing}
        renderSide={(side, team) => (
          <TeamSeasonTable
            state={side === 'away' ? away : home}
            view={view in SEASON_VIEWS ? view : 'qb'}
            sort={sort}
            onSort={handleSort}
            team={team}
          />
        )}
      />
    </div>
  );
};

export default PlayerSeasonStats;
