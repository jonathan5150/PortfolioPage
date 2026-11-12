import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import useAsyncData from '../../components/NFLDataComponents/shared/useAsyncData';
import TeamToggle from '../../components/NFLDataComponents/shared/TeamToggle';
import {
  getTeamBackgroundStyle,
  getTeamBorderColor,
  getTeamColor,
  getTeamTextColor,
  washOut,
} from '../../components/NFLDataComponents/shared/teamColors';
import { fmtLine, fmtOdds } from '../../pages/NFLData/NFLDataApi/betting';
import { gradeLinePicks, teamResultHistory } from '../../pages/NFLData/NFLDataApi/picks';
import {
  LEAGUES,
  getLeagueGameLog,
  getLeagueOdds,
  getLeaguePredictor,
  getLeagueRoster,
  getLeagueTeamLeaders,
  getLeagueSummary,
  getLeagueTeamSchedule,
} from './leagueApi';
import { buildLeaguePicks } from './leaguePicks';

const accent = (team) => washOut(getTeamColor(team) || 'rgba(120,120,120,0.6)', 0.15).replace(/[\d.]+\)$/, '1)');
const LIVE_REFRESH_MS = 20000;

// re-run a loader every few seconds while a game is live
const useTicker = (live) => {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!live) return undefined;
    const id = setInterval(() => {
      if (document.visibilityState !== 'hidden') setTick((t) => t + 1);
    }, LIVE_REFRESH_MS);
    return () => clearInterval(id);
  }, [live]);
  return tick;
};

// ---------- LINES: odds, win probability, picks, each team's results ----------

export const useGameLines = (lg, game, enabled) => {
  const final = game.status.state === 'post';
  return useAsyncData(
    async () => {
      const [odds, predictor] = await Promise.all([
        getLeagueOdds(lg, game.id, { final }).catch(() => null),
        getLeaguePredictor(lg, game.id).catch(() => null),
      ]);
      return { odds, predictor };
    },
    [lg, game.id, final],
    { enabled },
  );
};

const LinesTable = ({ game, odds, lineLabel }) => {
  const rows = [
    { side: 'away', c: game.away, o: odds.away, t: 'O', tOdds: odds.total?.overOdds },
    { side: 'home', c: game.home, o: odds.home, t: 'U', tOdds: odds.total?.underOdds },
  ];
  return (
    <div className="bet-lines">
      <div className="bet-lines-row bet-lines-head">
        <div />
        <div>{lineLabel}</div>
        <div>MONEYLINE</div>
        <div>TOTAL</div>
      </div>
      {rows.map(({ side, c, o, t, tOdds }) => (
        <div key={side} className="bet-lines-row">
          <div className="bet-team" style={{ borderLeftColor: accent(c?.team) }}>
            {c?.team?.logo && <img src={c.team.logo} alt="" className="bet-team-logo" draggable={false} />}
            <span className="bet-team-abbr">{c?.team?.abbreviation}</span>
          </div>
          <div className="bet-cell">
            <div className="bet-main">{fmtLine(o?.spreadLine)}</div>
            <div className="bet-sub">{fmtOdds(o?.spreadOdds)}</div>
          </div>
          <div className="bet-cell bet-cell-ml">
            <div className="bet-main">{fmtOdds(o?.moneyLine)}</div>
          </div>
          <div className="bet-cell">
            <div className="bet-main">
              {t} {odds.total?.line ?? '—'}
            </div>
            <div className="bet-sub">{fmtOdds(tOdds)}</div>
          </div>
        </div>
      ))}
    </div>
  );
};

export const WinBar = ({ game, chance, title = 'WIN PROBABILITY' }) => {
  if (!chance) return null;
  const away = Math.round(chance.away * 10) / 10;
  const home = Math.round(chance.home * 10) / 10;
  return (
    <div className="bet-winprob">
      <div className="bet-winprob-labels">
        <span>
          {game.away?.team?.abbreviation} {away}%
        </span>
        <span className="bet-winprob-title">{title}</span>
        <span>
          {home}% {game.home?.team?.abbreviation}
        </span>
      </div>
      <div className="bet-winprob-bar">
        <div style={{ width: `${away}%`, background: accent(game.away?.team) }} />
        <div style={{ width: `${home}%`, background: accent(game.home?.team) }} />
      </div>
    </div>
  );
};

const PickCard = ({ pick, game, grade }) => {
  if (!pick) return null;
  const team = pick.key !== 'total' ? game[pick.side]?.team : null;
  return (
    <div className="pick-line lean">
      <span className="pick-title-row">
        <span className="pick-kind lean">LEAN</span>
        <span className="pick-headline">
          {team?.logo && <img src={team.logo} alt="" className="pick-team-logo" draggable={false} />}
          {pick.headline}
        </span>
      </span>
      <span className="pick-because">{pick.summary}</span>
      {pick.odds && <span className="pick-odds">{pick.odds}</span>}
      {(grade === 'W' || grade === 'L') && <span className={`pick-result ${grade === 'W' ? 'right' : 'wrong'}`} />}
    </div>
  );
};

// A team's recent results (last 20), newest on the right; both rows scroll together.
const TeamResults = ({ lg, game, side, scrollRef, onScroll }) => {
  const team = game[side]?.team;
  const history = useAsyncData(
    async () =>
      teamResultHistory(
        await getLeagueTeamSchedule(lg, game[side]?.teamId, game.season),
        game[side]?.teamId,
        game,
      ).slice(-20),
    [lg, game.id, game[side]?.teamId],
  );
  const games = history.data || [];
  const [overflows, setOverflows] = useState(false);
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    const measure = () => setOverflows(el.scrollWidth > el.clientWidth + 1);
    measure();
    el.scrollLeft = el.scrollWidth;
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [games.length, scrollRef]);
  if (!games.length) return null;
  return (
    <div className="team-results">
      {team?.logo ? (
        <img className="team-results-logo" src={team.logo} alt={team.abbreviation || ''} draggable={false} />
      ) : (
        <span className="team-results-abbr" style={{ color: getTeamTextColor(team) }}>
          {team?.abbreviation}
        </span>
      )}
      <div ref={scrollRef} className={`team-results-scroll ${overflows ? 'overflows' : ''}`} onScroll={onScroll}>
        <div className="td-history-games">
          {games.map((g) => (
            <div key={g.id} className="td-history-col" title={g.label}>
              <span className="td-history-date">{g.date}</span>
              <span className="td-history-opp">{g.opp}</span>
              <span className={`td-history-game team-result ${g.result === 'W' ? 'hit' : ''}`}>{g.result}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const TeamResultsHistory = ({ lg, game }) => {
  const awayRef = useRef(null);
  const homeRef = useRef(null);
  const follow = (from, to) => () => {
    const src = from.current;
    const dst = to.current;
    if (!src || !dst) return;
    const fromRight = src.scrollWidth - src.clientWidth - src.scrollLeft;
    const target = Math.max(0, dst.scrollWidth - dst.clientWidth - fromRight);
    if (Math.abs(dst.scrollLeft - target) >= 1) dst.scrollLeft = target;
  };
  return (
    <div className="team-results-history">
      <TeamResults lg={lg} game={game} side="away" scrollRef={awayRef} onScroll={follow(awayRef, homeRef)} />
      <TeamResults lg={lg} game={game} side="home" scrollRef={homeRef} onScroll={follow(homeRef, awayRef)} />
    </div>
  );
};

export const LinesPanel = ({ lg, game, lines }) => {
  const odds = lines.data?.odds;
  const predictor = lines.data?.predictor;
  const picks = useMemo(
    () => (odds ? buildLeaguePicks({ lg, game, odds, predictor }) : null),
    [lg, game, odds, predictor],
  );
  const grades = useMemo(
    () => (picks && game.status.state === 'post' ? gradeLinePicks(picks, game, odds) : null),
    [picks, game, odds],
  );
  if (lines.loading && !lines.data) return <div className="bet-message">Loading lines…</div>;
  if (!odds) {
    return (
      <>
        <div className="bet-message">No betting lines are posted for this game yet.</div>
        <TeamResultsHistory lg={lg} game={game} />
      </>
    );
  }
  return (
    <>
      <LinesTable game={game} odds={odds} lineLabel={LEAGUES[lg].lineLabel} />
      <WinBar game={game} chance={predictor} />
      <TeamResultsHistory lg={lg} game={game} />
      <div className="pick-lines">
        {['winner', 'spread', 'total'].map((key) => (
          <PickCard key={key} pick={picks?.[key]} game={game} grade={grades?.[key]} />
        ))}
      </div>
    </>
  );
};

// ---------- BOX SCORE ----------

const StatGroup = ({ group }) => (
  <div className="league-box-group">
    {group.title && <div className="league-box-title">{group.title.toUpperCase()}</div>}
    <div className="league-box-scroll">
      <table className="league-box-table">
        <thead>
          <tr>
            <th className="league-box-name">PLAYER</th>
            {group.labels.map((l) => (
              <th key={l}>{l}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {group.players.map((p) => (
            <tr key={p.id || p.name} className={p.starter ? 'starter' : ''}>
              <td className="league-box-name">
                {p.name}
                {p.position && <span className="league-box-pos"> {p.position}</span>}
              </td>
              {p.stats.map((v, i) => (
                // eslint-disable-next-line react/no-array-index-key
                <td key={i}>{v}</td>
              ))}
            </tr>
          ))}
          {group.totals.length > 0 && (
            <tr className="league-box-totals">
              <td className="league-box-name">TEAM</td>
              {group.totals.map((v, i) => (
                // eslint-disable-next-line react/no-array-index-key
                <td key={i}>{v}</td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </div>
);

export const BoxScorePanel = ({ lg, game }) => {
  const live = game.status.state === 'in';
  const tick = useTicker(live);
  const summary = useAsyncData(() => getLeagueSummary(lg, game.id, { live }), [lg, game.id, live, tick]);
  const [side, setSide] = useState('away');
  const teamBox = (summary.data?.box || []).find((b) => b.teamId === game[side]?.teamId);
  return (
    <div className="box-score-tab">
      <div className="td-team-toggle">
        <TeamToggle game={game} teamSide={side} onChange={setSide} filled />
      </div>
      {summary.loading && !summary.data ? (
        <div className="bet-message">Loading box score…</div>
      ) : !teamBox || !teamBox.groups.some((g) => g.players.length) ? (
        <div className="bet-message">No box score yet.</div>
      ) : (
        teamBox.groups.filter((g) => g.players.length).map((g) => <StatGroup key={g.name || g.title} group={g} />)
      )}
    </div>
  );
};

// ---------- PLAYERS: roster, tap a player for his recent games ----------

// NBA columns lead with the headline numbers: MIN, then PTS REB AST 3PT 3P%,
// then whatever else ESPN lists.
const NBA_LEAD = ['MIN', 'PTS', 'REB', 'AST', '3PT', '3P%'];
const columnOrder = (lg, labels) => {
  const all = labels.map((_, i) => i);
  if (lg !== 'nba') return all;
  const lead = NBA_LEAD.map((l) => labels.indexOf(l)).filter((i) => i >= 0);
  return [...lead, ...all.filter((i) => !lead.includes(i))];
};

// LAST 5 / 10 / 20: one choice shared by every PLAYERS tab (NBA and MLB) for
// as long as the page is open; it starts at 10 on each visit.
const GAME_COUNTS = [5, 10, 20];
let sharedGameCount = 10;
const gameCountListeners = new Set();
const useGameCount = () => {
  const [count, setCount] = useState(sharedGameCount);
  useEffect(() => {
    gameCountListeners.add(setCount);
    return () => gameCountListeners.delete(setCount);
  }, []);
  const update = (n) => {
    sharedGameCount = n;
    gameCountListeners.forEach((fn) => fn(n));
  };
  return [count, update];
};

const GameCountPicker = () => {
  const [count, setCount] = useGameCount();
  return (
    <span className="league-count-select-wrap">
      <select
        className="league-count-select"
        value={count}
        onChange={(e) => setCount(Number(e.target.value))}
        aria-label="How many games"
      >
        {GAME_COUNTS.map((n) => (
          <option key={n} value={n}>
            LAST {n}
          </option>
        ))}
      </select>
      <span className="league-count-caret" aria-hidden="true" />
    </span>
  );
};

const PlayerLog = ({ lg, player }) => {
  const [count] = useGameCount();
  const log = useAsyncData(() => getLeagueGameLog(lg, player.id), [lg, player.id]);
  if (log.loading && !log.data) return <div className="bet-message small">Loading {player.shortName}'s games…</div>;
  // the most recent games (as many as picked, or fewer if that's all there
  // are), oldest at the top and the latest at the bottom
  const games = (log.data?.games || []).slice(0, count).reverse();
  if (!games.length) return <div className="bet-message small">No games this season yet.</div>;
  const order = columnOrder(lg, log.data.labels || []);
  return (
    <div className="league-box-scroll">
      <table className="league-box-table">
        <thead>
          <tr>
            <th className="league-box-name">GAME</th>
            {order.map((i) => (
              <th key={log.data.labels[i]}>{log.data.labels[i]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {games.map((g) => (
            <tr key={g.id}>
              <td className="league-box-name">
                {g.date ? new Date(g.date).toLocaleDateString([], { month: 'numeric', day: 'numeric' }) : ''} {g.opp}{' '}
                <span className={g.result === 'W' ? 'league-win' : 'league-loss'}>{g.result}</span>
              </td>
              {order.map((i) => (
                // eslint-disable-next-line react/no-array-index-key
                <td key={i}>{g.stats[i]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// One player at a time: the team's headline player first (NBA points leader,
// MLB home run leader), any other from the dropdown.
export const PlayersPanel = ({ lg, game }) => {
  const [side, setSide] = useState('away');
  const [pickedId, setPickedId] = useState(null);
  const teamId = game[side]?.teamId;
  const roster = useAsyncData(() => getLeagueRoster(lg, teamId), [lg, teamId]);
  const leaders = useAsyncData(() => getLeagueTeamLeaders(lg, teamId, game.date), [lg, teamId, game.date]);
  const players = useMemo(
    () =>
      [...(roster.data || [])].sort((a, b) =>
        a.name.split(' ').slice(-1)[0].localeCompare(b.name.split(' ').slice(-1)[0]),
      ),
    [roster.data],
  );
  // the best of the leaders still on the roster
  const leaderId = (leaders.data || []).find((id) => players.some((p) => p.id === id)) || null;
  const byId = (id) => players.find((p) => p.id === id) || null;
  const player = byId(pickedId) || byId(leaderId) || (leaders.loading ? null : players[0]) || null;
  const accentColor = accent(game[side]?.team);
  return (
    <div className="box-score-tab">
      <div className="td-team-toggle">
        <TeamToggle
          game={game}
          teamSide={side}
          onChange={(s) => {
            setSide(s);
            setPickedId(null);
          }}
          filled
        />
      </div>
      {roster.loading && !roster.data ? (
        <div className="bet-message">Loading roster…</div>
      ) : !players.length ? (
        <div className="bet-message">No roster listed.</div>
      ) : (
        <div className="league-player-pick">
          <div
            className="league-player-select-wrap"
            style={{
              '--player-accent': getTeamBorderColor(game[side]?.team) || accentColor,
              '--player-fill': getTeamBackgroundStyle(getTeamColor(game[side]?.team) || 'rgba(120, 120, 120, 1)')
                .background,
            }}
          >
            <select
              className="league-player-select"
              value={player?.id || ''}
              onChange={(e) => setPickedId(e.target.value)}
              aria-label="Player"
            >
              {!player && <option value="">Loading…</option>}
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.position ? ` · ${p.position}` : ''}
                  {p.jersey ? ` #${p.jersey}` : ''}
                  {p.injured ? ' (INJ)' : ''}
                </option>
              ))}
            </select>
            <span className="league-player-caret" aria-hidden="true" />
          </div>
          {player && (
            <div className="league-roster-row open" style={{ borderColor: accentColor }}>
              <div className="league-player-head">
                {player.headshot && (
                  <img src={player.headshot} alt="" className="league-player-photo" draggable={false} />
                )}
                <span className="league-roster-name">
                  {player.name}
                  {player.injured && <span className="league-roster-injured">INJ</span>}
                </span>
                <GameCountPicker />
              </div>
              <PlayerLog lg={lg} player={player} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
