import React, { useEffect, useMemo, useState } from 'react';
import SwipeTeamPanel from '../shared/SwipeTeamPanel';
import StatTable from '../shared/StatTable';
import useAsyncData from '../shared/useAsyncData';
import { messageStyle } from '../shared/tableStyles';
import { getRoster, getPlayerGameLog, getStartingQbId, SKILL_POSITIONS } from '../../../pages/NFLData/NFLDataApi/nflDataService';
import { buildGameLogTable } from './gameLogColumns';

const POSITION_ORDER = { QB: 0, RB: 1, FB: 2, WR: 3, TE: 4 };
const GAME_COUNTS = [5, 10];

const TeamGameLog = ({ team, season, numGames, setNumGames, defaultPlayerId, throughDate }) => {
  // Always opens on the team's current starting QB (depth chart, then the
  // scoreboard's passing leader); picking another player only lasts while open.
  const [pickedId, setPickedId] = useState(null);
  const roster = useAsyncData(() => getRoster(team.id), [team?.id], { enabled: Boolean(team?.id) });
  const starter = useAsyncData(() => getStartingQbId(team.id, season), [team?.id, season], {
    enabled: Boolean(team?.id),
  });

  const players = useMemo(
    () =>
      (roster.data || [])
        .filter((p) => SKILL_POSITIONS.includes(p.position))
        .sort(
          (a, b) =>
            POSITION_ORDER[a.position] - POSITION_ORDER[b.position] ||
            a.name.split(' ').slice(-1)[0].localeCompare(b.name.split(' ').slice(-1)[0])
        ),
    [roster.data]
  );

  const onRoster = (id) => id && players.some((p) => p.id === id);
  const selectedId =
    (onRoster(pickedId) && pickedId) ||
    (onRoster(starter.data) && starter.data) ||
    (onRoster(defaultPlayerId) && defaultPlayerId) ||
    players.find((p) => p.position === 'QB')?.id ||
    players[0]?.id ||
    null;
  const selectedPlayer = players.find((p) => p.id === selectedId);

  const log = useAsyncData(() => getPlayerGameLog(selectedId, season), [selectedId, season], {
    enabled: Boolean(selectedId) && !starter.loading,
  });

  // "Last N" is relative to this matchup: viewing an old week shows the games leading up to it.
  const recentGames = useMemo(() => {
    const cutoff = throughDate ? new Date(throughDate).getTime() + 12 * 60 * 60 * 1000 : Infinity;
    return (log.data?.games || [])
      .filter((g) => !g.date || new Date(g.date).getTime() <= cutoff)
      .slice(0, numGames);
  }, [log.data, numGames, throughDate]);
  const table = useMemo(
    () => buildGameLogTable(selectedPlayer?.position, recentGames),
    [selectedPlayer?.position, recentGames]
  );

  if (roster.loading || starter.loading) return <div style={messageStyle}>Loading roster…</div>;
  if (roster.error || !players.length) return <div style={messageStyle}>Roster unavailable right now.</div>;

  return (
    <div>
      <div className="gamelog-controls">
        <select
          value={selectedId || ''}
          onChange={(e) => setPickedId(e.target.value)}
          aria-label="Player"
        >
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.position})
            </option>
          ))}
        </select>
        <select value={numGames} onChange={(e) => setNumGames(Number(e.target.value))} aria-label="Number of games">
          {GAME_COUNTS.map((n) => (
            <option key={n} value={n}>
              LAST {n}
            </option>
          ))}
        </select>
      </div>

      {log.loading ? (
        <div style={messageStyle}>Loading game log…</div>
      ) : log.error ? (
        <div style={messageStyle}>Game log unavailable right now.</div>
      ) : (
        <StatTable
          columns={table.columns}
          rows={recentGames}
          rowKey={(g) => g.eventId}
          totals={recentGames.length > 1 ? table.averages : null}
          totalsLabel="AVG"
          minWidth={table.minWidth}
          emptyMessage={`No ${season} games found for ${selectedPlayer?.name || 'this player'}.`}
        />
      )}
    </div>
  );
};

const PlayerGameLog = ({ gameId, game, awayTeam, homeTeam, season }) => {
  const [numGames, setNumGames] = useState(5);
  const [showing, setShowing] = useState('away');

  // Guard against stale stored values.
  useEffect(() => {
    if (!GAME_COUNTS.includes(numGames)) setNumGames(5);
  }, [numGames, setNumGames]);

  // Default to each team's passing leader from the scoreboard, if ESPN sent one.
  const leaderId = (competitor) => competitor?.leaders?.find((l) => /passing/i.test(l.category))?.athleteId || null;

  return (
    <SwipeTeamPanel
      awayTeam={awayTeam}
      homeTeam={homeTeam}
      showing={showing}
      onShowingChange={setShowing}
      renderSide={(side, team) => (
        <TeamGameLog
          team={team}
          season={season}
          numGames={numGames}
          setNumGames={setNumGames}
          defaultPlayerId={leaderId(game?.[side])}
          throughDate={game?.date}
        />
      )}
    />
  );
};

export default PlayerGameLog;
