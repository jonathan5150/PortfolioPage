import React, { useEffect, useMemo, useRef, useState } from 'react';
import TeamResultsRows from '../shared/TeamResultsRows';
import LinesModeToggle from '../shared/LinesModeToggle';
import useAsyncData from '../shared/useAsyncData';
import useInView from '../shared/useInView';
import { getTeamColor, getTeamBorderColor, washOut } from '../shared/teamColors';
import {
  getEventLiveLines,
  getEventOdds,
  getEventPredictor,
  getTeamBettingTrends,
  getTeamPlayers,
  getGameSkillPlayers,
  getRecentGames,
  getTeamResultHistory,
} from '../../../pages/NFLData/NFLDataApi/bettingService';
import { BOOK, getBookOdds, normalizeName } from '../../../pages/NFLData/NFLDataApi/sportsbookOdds';
import { fmtLine, fmtOdds } from '../../../pages/NFLData/NFLDataApi/betting';
import {
  buildLinePicks,
  gradeLinePicks,
  buildPlayerPicks,
  pickPlayer,
  impliedTeamPoints,
} from '../../../pages/NFLData/NFLDataApi/picks';
import { headshotUrl } from '../../../pages/NFLData/NFLDataApi/endpoints';
import { Holdable } from '../shared/ParlayContext';
import TeamToggle from '../shared/TeamToggle';
import BoxScore from './BoxScore';
import useGameSummary from '../GameCard/useGameSummary';
import { touchdownScorers } from '../../../pages/NFLData/NFLDataApi/espnParsers';
import {
  hasStarted,
  frozenOdds,
  saveOddsSnapshot,
  PICKS_SNAPSHOT,
} from '../../../pages/NFLData/NFLDataApi/oddsSnapshots';

// Betting tab (bet mode only).
//   BOX SCORE – scoring plays and each team's player stats
//   LINES   – main lines, win probability, one-line winner / spread / total picks
//   PLAYERS – touchdown chances and DraftKings anytime TD odds for each team's
//             QB, top RBs and WR/TEs, plus SEARCH for any skill player
// Hold a line, pick or player to add it to the parlay slip.

const settle = async (promise) => {
  try {
    return await promise;
  } catch (error) {
    console.warn('Betting data unavailable:', error);
    return null;
  }
};

const teamAccent = (team) => washOut(getTeamColor(team) || 'rgba(120,120,120,0.6)', 0.15).replace(/[\d.]+\)$/, '1)');
const fmtPct = (n) => `${Math.round(n)}%`;

// ---------- parlay legs ----------

const matchupOf = (game) => `${game.away?.team?.abbreviation} @ ${game.home?.team?.abbreviation}`;

// Game-line legs, with the book's bet-slip link for each side.
const gameLegs = (game, odds) => {
  const links = odds?.links || {};
  const base = { gameId: game.id, matchup: matchupOf(game) };
  const abbr = (side) => game[side]?.team?.abbreviation;
  return {
    ml: (side) => ({
      ...base,
      id: `${game.id}:ml:${side}`,
      market: `${game.id}:ml`,
      label: `${abbr(side)} ML`,
      detail: 'Moneyline',
      odds: odds?.[side]?.moneyLine ?? null,
      link: links[`${side}Ml`] || null,
    }),
    spread: (side) => ({
      ...base,
      id: `${game.id}:spread:${side}`,
      market: `${game.id}:spread`,
      label: `${abbr(side)} ${fmtLine(odds?.[side]?.spreadLine)}`,
      detail: 'Spread',
      odds: odds?.[side]?.spreadOdds ?? null,
      link: links[`${side}Spread`] || null,
    }),
    total: (ou) => ({
      ...base,
      id: `${game.id}:total:${ou}`,
      market: `${game.id}:total`,
      label: `${ou === 'over' ? 'Over' : 'Under'} ${odds?.total?.line}`,
      detail: 'Total points',
      odds: (ou === 'over' ? odds?.total?.overOdds : odds?.total?.underOdds) ?? null,
      link: links[ou] || null,
    }),
  };
};

const tdLeg = (game, player, td) => ({
  id: `${game.id}:td:${player.id}`,
  market: `${game.id}:td:${player.id}`,
  gameId: game.id,
  matchup: matchupOf(game),
  label: `${player.name} anytime TD`,
  detail: 'Touchdown scorer',
  odds: td.price,
  link: td.link,
});

// Each team's results this season, oldest to newest, in the same style as a
// player's touchdown history: date and opponent over a block that's gold for a
// win and plain grey for a loss. Both teams share one box and one scroller.
const TeamResultsHistory = ({ game }) => {
  const away = useAsyncData(() => getTeamResultHistory(game.away?.teamId, game), [game.id, game.away?.teamId]);
  const home = useAsyncData(() => getTeamResultHistory(game.home?.teamId, game), [game.id, game.home?.teamId]);
  return (
    <TeamResultsRows
      rows={[
        { team: game.away?.team, games: away.data || [] },
        { team: game.home?.team, games: home.data || [] },
      ]}
    />
  );
};

// ---------- LINES tab ----------

const LinesTable = ({ game, odds }) => {
  const legs = gameLegs(game, odds);
  const rows = [
    { side: 'away', competitor: game.away, o: odds.away, totalLabel: 'O', totalOdds: odds.total.overOdds },
    { side: 'home', competitor: game.home, o: odds.home, totalLabel: 'U', totalOdds: odds.total.underOdds },
  ];

  return (
    <div className="bet-lines">
      <div className="bet-lines-row bet-lines-head">
        <div />
        <div>SPREAD</div>
        <div>MONEYLINE</div>
        <div>TOTAL</div>
      </div>
      {rows.map(({ side, competitor, o, totalLabel, totalOdds }) => (
        <div key={side} className="bet-lines-row">
          <div className="bet-team" style={{ borderLeftColor: teamAccent(competitor?.team) }}>
            {competitor?.team?.logo && (
              <img src={competitor.team.logo} alt="" className="bet-team-logo" draggable={false} />
            )}
            <span className="bet-team-abbr">{competitor?.team?.abbreviation}</span>
          </div>
          <Holdable className="bet-cell" leg={o.spreadLine !== null ? legs.spread(side) : null}>
            <div className="bet-main">{fmtLine(o.spreadLine)}</div>
            <div className="bet-sub">{fmtOdds(o.spreadOdds)}</div>
          </Holdable>
          <Holdable className="bet-cell bet-cell-ml" leg={o.moneyLine !== null ? legs.ml(side) : null}>
            <div className="bet-main">{fmtOdds(o.moneyLine)}</div>
          </Holdable>
          <Holdable
            className="bet-cell"
            leg={odds.total.line !== null ? legs.total(side === 'away' ? 'over' : 'under') : null}
          >
            <div className="bet-main">
              {totalLabel} {odds.total.line ?? '—'}
            </div>
            <div className="bet-sub">{fmtOdds(totalOdds)}</div>
          </Holdable>
        </div>
      ))}
    </div>
  );
};

const WinProbability = ({ game, predictor }) => {
  if (!predictor) return null;
  const away = Math.round(predictor.away * 10) / 10;
  const home = Math.round(predictor.home * 10) / 10;
  return (
    <div className="bet-winprob">
      <div className="bet-winprob-labels">
        <span>
          {game.away?.team?.abbreviation} {away}%
        </span>
        <span className="bet-winprob-title">WIN PROBABILITY</span>
        <span>
          {home}% {game.home?.team?.abbreviation}
        </span>
      </div>
      <div className="bet-winprob-bar">
        <div style={{ width: `${away}%`, background: teamAccent(game.away?.team) }} />
        <div style={{ width: `${home}%`, background: teamAccent(game.home?.team) }} />
      </div>
    </div>
  );
};

const linePickLeg = (key, pick, game, odds) => {
  if (!pick) return null;
  const legs = gameLegs(game, odds);
  if (key === 'winner') return legs.ml(pick.side);
  if (key === 'spread') return legs.spread(pick.side);
  return legs.total(pick.side);
};

// Winner / spread lines lead with the picked team's logo and its name in the
// team-cell colour; the total line just shows OVER / UNDER.
const PickHeadline = ({ pick, game }) => {
  const team = pick.key !== 'total' ? game[pick.side]?.team : null;
  const nickname = team ? (team.name || team.abbreviation || '').toUpperCase() : null;
  if (!team || !nickname || !pick.headline.startsWith(nickname)) {
    return <span className="pick-headline">{pick.headline}</span>;
  }
  return (
    <span className="pick-headline">
      {team.logo && <img src={team.logo} alt="" className="pick-team-logo" draggable={false} />}
      <span style={{ color: teamAccent(team) }}>{nickname}</span>
      {pick.headline.slice(nickname.length)}
    </span>
  );
};

// Winner / spread odds sit in a pill of the picked team's cell colour; the
// over/under pill keeps the gold styling.
const teamPillStyle = (team) => {
  const color = getTeamColor(team);
  if (!color) return undefined;
  const fill = washOut(color, 0.1).replace(/[\d.]+\)$/, '0.85)');
  return { background: fill, color: '#ffffff' };
};

const GRADE_TITLE = { W: 'The pick was right', L: 'The pick was wrong' };

const PickLine = ({ pick, leg, game, grade }) => {
  if (!pick) return null;
  // BET: one of the rules that made money fired. LEAN: just the likelier side.
  const isBet = pick.bet !== false;
  return (
    <Holdable className={`pick-line ${pick.strong ? 'strong' : ''} ${isBet ? '' : 'lean'}`} leg={leg}>
      <span className="pick-title-row">
        <span className={`pick-kind ${isBet ? 'bet' : 'lean'}`}>{isBet ? 'BET' : 'LEAN'}</span>
        <PickHeadline pick={pick} game={game} />
      </span>
      <span className="pick-because">{pick.summary}</span>
      {pick.odds && (
        <span className="pick-odds" style={pick.key !== 'total' ? teamPillStyle(game[pick.side]?.team) : undefined}>
          {pick.odds}
        </span>
      )}
      {/* finished games: green corner when the pick was right, red when wrong */}
      {(grade === 'W' || grade === 'L') && (
        <span className={`pick-result ${grade === 'W' ? 'right' : 'wrong'}`} title={GRADE_TITLE[grade]} />
      )}
    </Holdable>
  );
};

const LIVE_LINES_MS = 20000;

const LinesTab = ({ game, lines, linePicks, grades }) => {
  const odds = lines.data?.odds;
  const predictor = lines.data?.predictor;
  // live games: PREGAME / LIVE odds (LIVE first), refreshed while it's on
  const isLive = game.status.state === 'in';
  const [mode, setMode] = useState('live');
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!isLive) return undefined;
    const id = setInterval(() => document.visibilityState !== 'hidden' && setTick((t) => t + 1), LIVE_LINES_MS);
    return () => clearInterval(id);
  }, [isLive]);
  const liveLines = useAsyncData(() => getEventLiveLines(game.id), [game.id, tick], {
    enabled: isLive,
    keepPrevious: true,
  });
  const showLive = isLive && mode === 'live';
  const tableOdds = !isLive ? odds : showLive ? liveLines.data?.live : odds || liveLines.data?.pregame;
  const chance = showLive ? game.situation?.winProbability || null : predictor;
  const lockedNote =
    lines.data?.frozen && !showLive ? (
      <div className="hold-hint">Lines locked at about 30 minutes before kickoff.</div>
    ) : null;
  const toggle = isLive ? <LinesModeToggle mode={mode} onChange={setMode} /> : null;
  if (lines.loading) return <div className="bet-message">Loading lines…</div>;
  if (!odds && !(showLive && tableOdds)) {
    return (
      <>
        {toggle}
        <div className="bet-message">No betting lines are posted for this game yet.</div>
        {showLive && <WinProbability game={game} predictor={chance} />}
      </>
    );
  }

  return (
    <>
      {toggle}
      {tableOdds ? (
        <LinesTable game={game} odds={tableOdds} />
      ) : (
        <div className="bet-message">
          {liveLines.loading && !liveLines.data ? 'Loading live odds…' : 'No live odds posted right now.'}
        </div>
      )}
      <WinProbability game={game} predictor={chance} />
      {lockedNote}
      <TeamResultsHistory game={game} />
      <div className="pick-lines">
        {linePicks ? (
          ['winner', 'spread', 'total'].map((key) => (
            <PickLine
              key={key}
              pick={linePicks[key]}
              leg={linePickLeg(key, linePicks[key], game, odds)}
              game={game}
              grade={grades?.[key]}
            />
          ))
        ) : (
          <div className="bet-message small">Working out the picks…</div>
        )}
      </div>
    </>
  );
};

// ---------- PLAYERS tab (touchdowns) ----------

const CHANCE_CLASS = { LIKELY: 'over', 'GOOD CHANCE': 'over', 'LONG SHOT': 'avoid', UNLIKELY: 'under' };

// Headshot ringed in the colour of the player's team cell.
const Headshot = ({ player, team, size = '' }) => (
  <div className={`player-headshot ${size}`} style={team ? { borderColor: getTeamBorderColor(team) } : undefined}>
    <img
      src={player.headshot || headshotUrl(player.id)}
      alt=""
      draggable={false}
      onError={(e) => {
        e.currentTarget.style.display = 'none';
      }}
    />
  </div>
);

// One player's touchdown card: our chance, the book's anytime TD odds, the call
// and why. Hold it to add the anytime TD bet to the parlay slip.
// This season's games (last 10 at most), oldest to newest: date and opponent
// over a block that's gold when they scored, grey when they didn't.
const TdHistory = ({ history }) => {
  if (!history?.length) return null;
  const scored = history.filter((g) => g.scored).length;
  return (
    <div className="td-history" aria-label={`Scored in ${scored} of ${history.length} games this season`}>
      <div className="td-history-games">
        {history.map((g) => (
          <div key={g.id} className="td-history-col" title={g.label}>
            <span className="td-history-date">{g.date}</span>
            <span className="td-history-opp">{g.opp}</span>
            <span className={`td-history-game ${g.scored ? 'hit' : ''}`}>{g.tds > 1 ? g.tds : ''}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Players who've scored a touchdown in this game, { athleteId: touchdowns }.
const TdScorersContext = React.createContext({});

const TouchdownCard = ({ pick, game, large = false }) => {
  const { player, td, stats, tdHistory } = pick;
  const scored = React.useContext(TdScorersContext)[player.id];
  const side = player.teamSide;
  const other = side === 'away' ? 'home' : 'away';
  return (
    <Holdable
      className={`td-card ${CHANCE_CLASS[td.chance] || 'avoid'} ${td.strong ? 'strong' : ''}`}
      leg={tdLeg(game, player, td)}
    >
      <div className="td-card-top">
        <Headshot player={player} team={game[side]?.team} size={large ? 'large' : ''} />
        <div className="td-card-name">
          <span className="player-name">{player.name}</span>
          <span className="player-pos">
            {player.position} · vs {game[other]?.team?.abbreviation}
          </span>
        </div>
        <span className="pick-market-verdict td-chance">{td.chance}</span>
        <div className="td-card-numbers">
          <span className="td-card-pct">{fmtPct(td.probability)}</span>
          <span className="td-card-odds">{td.price !== null ? `TD ${fmtOdds(td.price)}` : 'no odds yet'}</span>
        </div>
      </div>
      <TdHistory history={tdHistory} />
      {stats && (
        <div className="td-stats" title={`${stats.season} season`}>
          {stats.items.map((item) => (
            <div key={item.label} className="td-stat">
              <span className="td-stat-value">{item.value}</span>
              <span className="td-stat-label">{item.label}</span>
            </div>
          ))}
        </div>
      )}
      {td.factors.length > 0 && (
        <dl className="td-factors">
          {td.factors.map((f) => (
            <React.Fragment key={f.label}>
              <dt>{f.label}</dt>
              <dd className={f.tone || ''}>{f.value}</dd>
            </React.Fragment>
          ))}
        </dl>
      )}
      {/* green corner once the player has scored a touchdown in this game */}
      {scored > 0 && (
        <span className="pick-result right" title={`Scored ${scored > 1 ? `${scored} touchdowns` : 'a touchdown'}`} />
      )}
    </Holdable>
  );
};

// Says why touchdown odds are missing, with a retry when it's a connection problem.
const OddsStatus = ({ bookOdds, problem, isFinal, onRetry }) => {
  const hasTdOdds = Object.keys(bookOdds?.players || {}).length > 0;
  if (hasTdOdds) return null;
  let text;
  let retry = false;
  if (problem === 'started' && !isFinal) {
    text = `${BOOK.name} touchdown odds lock at kickoff, and they weren't loaded on this device before this game started. Our chances only.`;
  } else if (isFinal) text = `This game is over, so ${BOOK.name} touchdown odds are closed. Our chances only.`;
  else if (problem === 'nokey') {
    text = (
      <>
        {BOOK.name} touchdown odds are off: add an <code>SGO_API_KEY</code> (SportsGameOdds) to turn them on.
      </>
    );
  } else if (problem === 'ratelimit') {
    text = 'SportsGameOdds is rate-limiting us (10 requests a minute on the free plan).';
    retry = true;
  } else if (problem === 'offline') {
    text = `Couldn't reach SportsGameOdds for ${BOOK.name} odds.`;
    retry = true;
  } else text = `${BOOK.name} hasn't posted touchdown odds for this game yet.`;
  return (
    <div className="bet-message small">
      {text}
      {retry && (
        <button type="button" className="bet-retry" onClick={onRetry}>
          TRY AGAIN
        </button>
      )}
    </div>
  );
};

// SEARCH: every QB / RB / WR / TE on both rosters.

const SearchResult = ({ player, game, deep, odds, rankings }) => {
  const other = player.teamSide === 'away' ? 'home' : 'away';
  const games = useAsyncData(() => getRecentGames(player.id, game), [player.id, game.id]);

  const pick = useMemo(
    () =>
      games.data
        ? pickPlayer({
            player: { ...player, games: games.data },
            position: player.position,
            season: game.season,
            oppId: game[other]?.teamId,
            oppAbbr: game[other]?.team?.abbreviation,
            bookOdds: deep.data?.bookOdds,
            rankings,
            teamPoints: impliedTeamPoints(odds, player.teamSide),
          })
        : null,
    [games.data, player, game, other, deep.data, rankings, odds],
  );

  if (!pick) return <div className="bet-message small">Loading {player.name}'s games…</div>;
  return <TouchdownCard pick={pick} game={game} large />;
};

// SEARCH lists players by role, then last name.
const ROLE_ORDER = { QB: 0, RB: 1, FB: 1, WR: 2, TE: 3 };
const NAME_SUFFIX = /^(jr|sr|ii|iii|iv|v)\.?$/i;
const lastName = (name = '') => {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((part) => !NAME_SUFFIX.test(part));
  return parts[parts.length - 1] || name;
};

const SearchPanel = ({ game, deep, odds, rankings, teamSide, setTeamSide }) => {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const roster = useAsyncData(() => getGameSkillPlayers(game), [game.id, game.away?.teamId, game.home?.teamId]);
  const priced = deep.data?.bookOdds?.players || {};
  const hasOdds = (p) => Boolean(priced[normalizeName(p.name)]?.anytimeTd);

  // Only players DraftKings has a TD price for. The toggle picks which team's
  // list to show; typing a search covers both teams.
  const q = query.trim().toLowerCase();
  const players = useMemo(
    () =>
      (roster.data || [])
        .filter(hasOdds)
        .filter((p) =>
          q
            ? p.name.toLowerCase().includes(q) ||
              p.position.toLowerCase() === q ||
              (p.teamAbbr || '').toLowerCase() === q
            : p.teamSide === teamSide,
        )
        .sort(
          (a, b) =>
            (ROLE_ORDER[a.position] ?? 9) - (ROLE_ORDER[b.position] ?? 9) ||
            lastName(a.name).localeCompare(lastName(b.name)) ||
            a.name.localeCompare(b.name),
        ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [roster.data, q, teamSide, priced],
  );

  const selected = (roster.data || []).find((p) => p.id === selectedId) || null;

  return (
    <div className="bet-search">
      <input
        type="search"
        className="search-input"
        placeholder="Search QBs, RBs, WRs, TEs… (name, team or position)"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search players"
      />
      <TeamToggle game={game} teamSide={teamSide} onChange={setTeamSide} dimmed={Boolean(q)} filled />
      {selected && (
        <SearchResult key={selected.id} player={selected} game={game} deep={deep} odds={odds} rankings={rankings} />
      )}
      {roster.loading ? (
        <div className="bet-message">Loading rosters…</div>
      ) : (
        <div className="search-list" role="listbox" aria-label="Players">
          {players.map((p) => {
            const team = game[p.teamSide]?.team;
            return (
              <button
                key={`${p.teamSide}-${p.id}`}
                type="button"
                role="option"
                aria-selected={p.id === selectedId}
                className={`search-item ${p.id === selectedId ? 'active' : ''}`}
                onClick={() => setSelectedId(p.id)}
              >
                <span
                  className="player-headshot small"
                  style={team ? { borderColor: getTeamBorderColor(team) } : undefined}
                >
                  <img
                    src={p.headshot || headshotUrl(p.id)}
                    alt=""
                    loading="lazy"
                    draggable={false}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </span>
                <span className="search-item-name">{p.name}</span>
                <span className="player-pos">
                  {q ? `${p.teamAbbr} · ` : ''}
                  {p.position}
                </span>
              </button>
            );
          })}
          {!players.length && (
            <div className="bet-message small">
              {q ? `No players with TD odds match “${query}”.` : 'No TD odds for this team yet.'}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const GROUPS = [
  { key: 'qb', label: 'QBs' },
  { key: 'rb', label: 'RBs' },
  { key: 'wr', label: 'WRs/TEs' },
  { key: 'search', label: 'SEARCH' },
];

const PlayersTab = ({ game, deep, playerPicks, isFinal, odds, rankings, oddsProblem, onRetryOdds }) => {
  const [group, setGroup] = useState('qb');
  const [teamSide, setTeamSide] = useState('away');
  const list = (playerPicks?.[group] || []).filter((p) => p.player.teamSide === teamSide);

  return (
    <>
      <div className="bet-subtabs" role="tablist">
        {GROUPS.map((g) => (
          <button
            key={g.key}
            type="button"
            role="tab"
            aria-selected={group === g.key}
            className={group === g.key ? 'active' : ''}
            onClick={() => setGroup(g.key)}
          >
            {g.label}
          </button>
        ))}
      </div>
      {group === 'search' ? (
        <SearchPanel
          game={game}
          deep={deep}
          odds={odds}
          rankings={rankings}
          teamSide={teamSide}
          setTeamSide={setTeamSide}
        />
      ) : !playerPicks ? (
        <div className="bet-message">Loading players…</div>
      ) : (
        <>
          <div className="td-team-toggle">
            <TeamToggle game={game} teamSide={teamSide} onChange={setTeamSide} filled />
          </div>
          {list.length ? (
            <div className="td-list">
              {list.map((p) => (
                <TouchdownCard key={`${p.player.teamSide}-${p.player.id}`} pick={p} game={game} />
              ))}
            </div>
          ) : (
            <div className="bet-message">No players found.</div>
          )}
        </>
      )}
      {!deep.loading && (
        <OddsStatus bookOdds={deep.data?.bookOdds} problem={oddsProblem} isFinal={isFinal} onRetry={onRetryOdds} />
      )}
    </>
  );
};

// ---------- panel ----------

const TABS = [
  { key: 'boxscore', label: 'BOX SCORE' },
  { key: 'lines', label: 'LINES' },
  { key: 'players', label: 'TD ODDS' },
];

// Lines refresh this often while the game is open and hasn't started.
const LINES_REFRESH_MS = 5 * 60 * 1000;

const Betting = ({ game, rankings, isOpen = true }) => {
  const isFinal = game.status.state === 'post';
  const started = hasStarted(game);
  // Live and finished games open on BOX SCORE (scoring plays); upcoming ones on
  // LINES. The panel is rebuilt each time a game opens, so this applies to every open.
  const [tab, setTab] = useState(game.status.state === 'pre' ? 'lines' : 'boxscore');
  // counts openings, so BOX SCORE starts on SCORING PLAYS each time the game opens
  const [openCount, setOpenCount] = useState(0);
  useEffect(() => {
    if (isOpen) setOpenCount((n) => n + 1);
  }, [isOpen]);
  const [needPlayers, setNeedPlayers] = useState(false);
  const [ref, inView] = useInView();

  useEffect(() => {
    if (tab === 'players') setNeedPlayers(true);
  }, [tab]);

  // Box score (live games keep refreshing while the tab is showing).
  // TD ODDS uses it too, to mark the players who've scored.
  const summaryState = useGameSummary(game, isOpen && (tab === 'boxscore' || tab === 'players'));
  const tdScorers = useMemo(() => touchdownScorers(summaryState.data), [summaryState.data]);

  // Until kickoff, an open game's odds refresh every few minutes (and when it's
  // reopened after a while). TD prices come from the cached slate, so this
  // doesn't spend SportsGameOdds requests.
  const [refresh, setRefresh] = useState(0);
  const lastLoadRef = useRef(0);
  useEffect(() => {
    if (!isOpen || started) return undefined;
    if (lastLoadRef.current && Date.now() - lastLoadRef.current >= LINES_REFRESH_MS) setRefresh((n) => n + 1);
    const id = setInterval(() => {
      if (document.visibilityState !== 'hidden') setRefresh((n) => n + 1);
    }, LINES_REFRESH_MS);
    return () => clearInterval(id);
  }, [isOpen, started]);

  // Lines (with DraftKings bet-slip links) come from ESPN's DraftKings feed;
  // anytime TD prices from one cached SportsGameOdds slate. Before kickoff each
  // load is saved; after kickoff both show what they were ~30 minutes before.
  const [oddsAttempt, setOddsAttempt] = useState(0);
  const lines = useAsyncData(
    async () => {
      const [espnOdds, predictor, book] = await Promise.all([
        settle(getEventOdds(game.id, { final: isFinal })),
        settle(getEventPredictor(game.id)),
        getBookOdds(game),
      ]);
      lastLoadRef.current = Date.now();
      let odds = espnOdds;
      let frozen = false;
      if (!started) saveOddsSnapshot(game, 'lines', espnOdds);
      else {
        const saved = frozenOdds(game, 'lines');
        if (saved) {
          odds = saved;
          frozen = true;
        }
      }
      return { odds, frozen, predictor, bookOdds: book?.odds || null, problem: book?.problem || null };
    },
    [game.id, isFinal, started, oddsAttempt, refresh],
    { keepPrevious: true },
  );
  const odds = lines.data?.odds;
  const bookOdds = lines.data?.bookOdds || null;

  // Season results for the line picks wait until the panel is on screen.
  const research = useAsyncData(
    async () => {
      const [awayTrends, homeTrends] = await Promise.all([
        settle(getTeamBettingTrends(game.away?.teamId, game)),
        settle(getTeamBettingTrends(game.home?.teamId, game)),
      ]);
      return { awayTrends, homeTrends };
    },
    [game.id, game.away?.teamId, game.home?.teamId, game.season, game.seasonType],
    { enabled: inView || needPlayers },
  );

  // Players load once PLAYERS is opened. Their TD odds come with the lines (and
  // refresh with them) without reloading every player's game logs.
  const players = useAsyncData(
    async () => {
      const [away, home] = await Promise.all([
        settle(getTeamPlayers(game.away?.teamId, game)),
        settle(getTeamPlayers(game.home?.teamId, game)),
      ]);
      return { away, home };
    },
    [game.id, game.away?.teamId, game.home?.teamId, game.season],
    { enabled: needPlayers },
  );
  const deep = useMemo(
    () => ({
      ...players,
      loading: players.loading || lines.loading,
      data: players.data ? { players: players.data, bookOdds } : null,
    }),
    [players, lines.loading, bookOdds],
  );

  const currentPicks = useMemo(
    () =>
      research.data && odds ? buildLinePicks({ game, odds, predictor: lines.data?.predictor, ...research.data }) : null,
    [research.data, game, odds, lines.data],
  );
  // Before kickoff the picks are saved with the odds; after kickoff LINES shows
  // (and grades) the picks as they stood ~30 minutes before the game, the same
  // ones the weekly prediction record counts.
  useEffect(() => {
    if (!started && currentPicks) saveOddsSnapshot(game, PICKS_SNAPSHOT, currentPicks);
  }, [started, currentPicks, game]);
  const linePicks = useMemo(
    () => (started && frozenOdds(game, PICKS_SNAPSHOT)) || currentPicks,
    [started, currentPicks, game],
  );
  const grades = useMemo(
    () => (isFinal && linePicks ? gradeLinePicks(linePicks, game, odds) : null),
    [isFinal, linePicks, game, odds],
  );
  const playerPicks = useMemo(
    () =>
      deep.data
        ? buildPlayerPicks({ game, players: deep.data.players, bookOdds: deep.data.bookOdds, rankings, odds })
        : null,
    [deep.data, game, rankings, odds],
  );

  return (
    <div className="betting-panel" ref={ref}>
      <div className="bet-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={tab === t.key ? 'active' : ''}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'boxscore' && <BoxScore key={openCount} game={game} summaryState={summaryState} withToggle />}
      {tab === 'lines' && <LinesTab game={game} lines={lines} linePicks={linePicks} grades={grades} />}
      {tab === 'players' && (
        <TdScorersContext.Provider value={tdScorers}>
          <PlayersTab
            game={game}
            deep={deep}
            playerPicks={playerPicks}
            isFinal={isFinal}
            odds={odds}
            rankings={rankings}
            oddsProblem={lines.data?.problem}
            onRetryOdds={() => setOddsAttempt((n) => n + 1)}
          />
        </TdScorersContext.Provider>
      )}
    </div>
  );
};

export default Betting;
