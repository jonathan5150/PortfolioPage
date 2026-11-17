import React, { useEffect, useMemo, useRef, useState } from 'react';
import LinesModeToggle from '../../../shared/components/LinesModeToggle';
import useAsyncData from '../../../shared/hooks/useAsyncData';
import useInView from '../../hooks/useInView';
import { getTeamColor, getTeamBorderColor, getTeamTextColor, washOut } from '../../../shared/utils/teamColors';
import {
  getEventLiveLines,
  getEventOdds,
  getEventPredictor,
  getTeamBettingTrends,
  getTeamPlayers,
  TD_SHOWN,
  getGameSkillPlayers,
  getRecentGames,
} from '../../../shared/api/bettingService';
import { BOOK, getBookOdds, playerMarketsFor } from '../../../shared/api/sportsbookOdds';
import { fmtLine, fmtOdds } from '../../../shared/api/betting';
import { loadTeamModel } from '../../../shared/api/teamModels';
import {
  buildLinePicks,
  gradeLinePicks,
  buildPlayerPicks,
  pickPlayer,
  impliedTeamPoints,
} from '../../../shared/api/picks';
import { headshotUrl } from '../../../shared/api/endpoints';
import { Holdable } from '../../../shared/components/ParlayContext';
import TeamToggle from '../../../shared/components/TeamToggle';
import BoxScore from './BoxScore';
import useGameSummary from '../../hooks/useGameSummary';
import TeamStatsCompare from '../../../shared/components/TeamStatsCompare';
import { touchdownScorers } from '../../../shared/api/espnParsers';
import {
  hasStarted,
  frozenOdds,
  saveOddsSnapshot,
  PICKS_SNAPSHOT,
} from '../../../shared/api/oddsSnapshots';

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
    <Holdable className={`pick-line ${pick.strong ? 'strong' : ''} ${isBet ? 'is-bet' : 'lean'}`} leg={leg}>
      <span className="pick-title-row">
        <span className={`pick-kind ${isBet ? 'bet' : 'lean'}${pick.upset ? ' upset' : ''}`}>
          {isBet ? 'BET' : pick.upset ? 'UPSET' : 'LEAN'}
        </span>
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

// live games: PREGAME / LIVE odds (LIVE first). The live odds load and refresh
// the whole time the game is open, whichever tab is showing, so LINES draws
// straight away instead of its table popping in after the switch.
const useLiveLines = (game, enabled) => {
  const isLive = game.status.state === 'in';
  const [mode, setMode] = useState('live');
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!isLive || !enabled) return undefined;
    const id = setInterval(() => document.visibilityState !== 'hidden' && setTick((t) => t + 1), LIVE_LINES_MS);
    return () => clearInterval(id);
  }, [isLive, enabled]);
  const liveLines = useAsyncData(() => getEventLiveLines(game.id, game), [game.id, tick], {
    enabled: isLive && enabled,
    keepPrevious: true,
  });
  return { liveLines, mode, setMode };
};

const LinesTab = ({ game, lines, live, linePicks, grades }) => {
  const odds = lines.data?.odds;
  const predictor = lines.data?.predictor;
  const isLive = game.status.state === 'in';
  const { liveLines, mode, setMode } = live;
  const showLive = isLive && mode === 'live';
  const tableOdds = !isLive ? odds : showLive ? liveLines.data?.live : odds || liveLines.data?.pregame;
  const chance = showLive ? game.situation?.winProbability || null : predictor;
  const toggle = isLive ? <LinesModeToggle mode={mode} onChange={setMode} /> : null;
  if (lines.loading && !lines.data) return <div className="bet-message">Loading lines…</div>;
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

// a team's abbreviation in its colour, made readable on the dark cards
const teamTextStyle = (team) => {
  const color = team ? getTeamTextColor(team) : null;
  return color ? { color } : undefined;
};

// onCollapse: tapping its top row folds it back into the player's row
const TouchdownCard = ({ pick, game, large = false, onCollapse }) => {
  const { player, td, stats, tdHistory } = pick;
  const scored = React.useContext(TdScorersContext)[player.id];
  const side = player.teamSide;
  return (
    <Holdable className={`td-card ${CHANCE_CLASS[td.chance] || 'avoid'}`} leg={tdLeg(game, player, td)}>
      <div
        className={`td-card-top ${onCollapse ? 'collapsible' : ''}`}
        onClick={onCollapse}
        role={onCollapse ? 'button' : undefined}
        aria-expanded={onCollapse ? true : undefined}
      >
        <Headshot player={player} team={game[side]?.team} size={large ? 'large' : ''} />
        <div className="td-card-name">
          <span className="player-name">{player.name}</span>
          <span className="player-pos">
            {player.position} ·{' '}
            <span className="td-team-abbr" style={teamTextStyle(game[side]?.team)}>
              {game[side]?.team?.abbreviation}
            </span>
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

const SearchResult = ({ player, game, deep, odds, rankings, onCollapse, loadingRow }) => {
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

  if (!pick) return loadingRow;
  return <TouchdownCard pick={pick} game={game} large onCollapse={onCollapse} />;
};

// ---------- TD ODDS lists ----------

// Best odds first: -150, +130, +800 ... and players with no price yet last.
const byPrice = (a, b) => (a.price ?? Infinity) - (b.price ?? Infinity) || a.player.name.localeCompare(b.player.name);

// One player folded up: headshot, team, name and anytime TD odds. Tap to open
// the full card; hold to add the bet to the parlay slip.
const TdRow = ({ player, game, price, leg, onOpen, loading = false }) => {
  const scored = React.useContext(TdScorersContext)[player.id];
  const team = game[player.teamSide]?.team;
  return (
    <Holdable className={`td-row ${loading ? 'loading' : ''}`} leg={leg} onClick={onOpen} role="button" aria-expanded={false}>
      <Headshot player={player} team={team} size="small" />
      <span className="td-row-team" style={teamTextStyle(team)}>
        {team?.logo && <img src={team.logo} alt="" draggable={false} />}
        {team?.abbreviation}
      </span>
      <span className="td-row-name">
        {player.name}
        <span className="player-pos"> {player.position}</span>
      </span>
      <span className="td-row-odds">
        {loading ? '…' : price !== null && price !== undefined ? fmtOdds(price) : '—'}
      </span>
      {scored > 0 && (
        <span className="pick-result right" title={`Scored ${scored > 1 ? `${scored} touchdowns` : 'a touchdown'}`} />
      )}
    </Holdable>
  );
};

// entries: [{ key, player, price, leg, pick? }], already sorted. card(entry,
// close, loadingRow) draws an opened player; one is open at a time.
const TdPlayerList = ({ entries, game, openKey, setOpenKey, card, empty }) => {
  if (!entries.length) return <div className="bet-message small">{empty}</div>;
  return (
    <div className="td-list">
      {entries.map((entry) => {
        const row = (loading) => (
          <TdRow
            key={entry.key}
            player={entry.player}
            game={game}
            price={entry.price}
            leg={entry.leg}
            loading={loading}
            onOpen={() => setOpenKey(entry.key)}
          />
        );
        return openKey === entry.key ? (
          <React.Fragment key={entry.key}>{card(entry, () => setOpenKey(null), row(true))}</React.Fragment>
        ) : (
          row(false)
        );
      })}
    </div>
  );
};

// SEARCH: every QB / RB / WR / TE on the chosen team(s) with a DraftKings TD
// price, narrowed by name, team or position as you type.
const SearchPanel = ({ game, deep, odds, rankings, teamSide, openKey, setOpenKey }) => {
  const [query, setQuery] = useState('');
  const roster = useAsyncData(() => getGameSkillPlayers(game), [game.id, game.away?.teamId, game.home?.teamId]);
  const bookOdds = deep.data?.bookOdds;
  const q = query.trim().toLowerCase();
  const entries = useMemo(
    () =>
      (roster.data || [])
        .map((p) => {
          const yes = playerMarketsFor(bookOdds, p.name)?.anytimeTd?.yes;
          return yes
            ? {
                key: `${p.teamSide}-${p.id}`,
                player: p,
                price: yes.price ?? null,
                leg: tdLeg(game, p, { price: yes.price ?? null, link: yes.link || null }),
              }
            : null;
        })
        .filter(Boolean)
        .filter(({ player: p }) => teamSide === 'all' || p.teamSide === teamSide)
        .filter(
          ({ player: p }) =>
            !q ||
            p.name.toLowerCase().includes(q) ||
            p.position.toLowerCase() === q ||
            (p.teamAbbr || '').toLowerCase() === q,
        )
        .sort(byPrice),
    [roster.data, bookOdds, teamSide, q, game],
  );

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
      {roster.loading ? (
        <div className="bet-message breathing">Loading rosters…</div>
      ) : (
        <TdPlayerList
          entries={entries}
          game={game}
          openKey={openKey}
          setOpenKey={setOpenKey}
          empty={q ? `No players with TD odds match “${query}”.` : 'No TD odds for this team yet.'}
          card={(entry, close, loadingRow) => (
            <SearchResult
              player={entry.player}
              game={game}
              deep={deep}
              odds={odds}
              rankings={rankings}
              onCollapse={close}
              loadingRow={loadingRow}
            />
          )}
        />
      )}
    </div>
  );
};

// ALL: every player we have a card for; the others narrow it by position.
const GROUPS = [
  { key: 'all', label: 'ALL', from: ['qb', 'rb', 'wr'] },
  { key: 'qbrb', label: 'QBs/RBs', from: ['qb', 'rb'] },
  { key: 'wr', label: 'WRs/TEs', from: ['wr'] },
  { key: 'search', label: 'SEARCH' },
];
const BOTH_TEAMS = { key: 'all', label: 'ALL' };

const PlayersTab = ({ game, deep, playerPicks, isFinal, odds, rankings, oddsProblem, onRetryOdds }) => {
  const [group, setGroup] = useState('all');
  // 'away', 'home' or 'all' (both teams)
  const [teamSide, setTeamSide] = useState('all');
  const [openKey, setOpenKey] = useState(null);
  const from = GROUPS.find((g) => g.key === group)?.from;
  // Once DraftKings has TD odds for the game, a player without a price isn't
  // listed; each team shows its top QB, 2 RBs and 5 WR/TEs that have one.
  // (With no TD odds at all, everyone stays, with our chances only.)
  const priced = Object.keys(deep.data?.bookOdds?.players || {}).length > 0;
  const entries = useMemo(() => {
    if (!from || !playerPicks) return [];
    const seen = new Set();
    return from
      .flatMap((key) =>
        ['away', 'home'].flatMap((side) =>
          (playerPicks[key] || [])
            .filter((p) => p.player.teamSide === side)
            .filter((p) => !priced || (p.td.price !== null && p.td.price !== undefined))
            .slice(0, TD_SHOWN[key] ?? Infinity),
        ),
      )
      .filter((p) => teamSide === 'all' || p.player.teamSide === teamSide)
      .map((p) => ({
        key: `${p.player.teamSide}-${p.player.id}`,
        player: p.player,
        price: p.td.price,
        leg: tdLeg(game, p.player, p.td),
        pick: p,
      }))
      .filter((e) => {
        if (seen.has(e.key)) return false;
        seen.add(e.key);
        return true;
      })
      .sort(byPrice);
  }, [from, playerPicks, teamSide, game, priced]);

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
      <div className="td-team-toggle">
        <TeamToggle game={game} teamSide={teamSide} onChange={setTeamSide} middle={BOTH_TEAMS} filled />
      </div>
      {group === 'search' ? (
        <SearchPanel
          game={game}
          deep={deep}
          odds={odds}
          rankings={rankings}
          teamSide={teamSide}
          openKey={openKey}
          setOpenKey={setOpenKey}
        />
      ) : !playerPicks ? (
        <div className="bet-message breathing">Loading players…</div>
      ) : (
        <TdPlayerList
          entries={entries}
          game={game}
          openKey={openKey}
          setOpenKey={setOpenKey}
          empty="No players found."
          card={(entry, close) => <TouchdownCard pick={entry.pick} game={game} onCollapse={close} />}
        />
      )}
      {!deep.loading && (
        <OddsStatus bookOdds={deep.data?.bookOdds} problem={oddsProblem} isFinal={isFinal} onRetry={onRetryOdds} />
      )}
    </>
  );
};

// ---------- panel ----------

// An upcoming game has no box score yet: its first tab is STATS instead, the
// two teams' season stats side by side (TeamStatsCompare).
const TABS = [
  { key: 'boxscore', label: 'BOX SCORE' },
  { key: 'lines', label: 'LINES' },
  { key: 'players', label: 'TD ODDS' },
];
const UPCOMING_TABS = [{ key: 'stats', label: 'STATS' }, ...TABS.slice(1)];

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
        settle(getEventPredictor(game.id, { final: isFinal })),
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
  const live = useLiveLines(game, isOpen);

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

  // the backtested winner model and head-to-head history (one download, shared)
  const teamModel = useAsyncData(() => loadTeamModel('nfl'), [], { enabled: inView || needPlayers });
  const currentPicks = useMemo(
    () =>
      research.data && odds && !teamModel.loading
        ? buildLinePicks({ game, odds, predictor: lines.data?.predictor, ...research.data, teamModel: teamModel.data })
        : null,
    [research.data, game, odds, lines.data, teamModel.loading, teamModel.data],
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
        {(game.status.state === 'pre' ? UPCOMING_TABS : TABS).map((t) => (
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
      {tab === 'stats' && <TeamStatsCompare lg="nfl" game={game} />}
      {tab === 'lines' && <LinesTab game={game} lines={lines} live={live} linePicks={linePicks} grades={grades} />}
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
