import React, { useEffect, useMemo, useState } from 'react';
import useAsyncData from '../shared/useAsyncData';
import useInView from '../shared/useInView';
import { getTeamColor, getTeamBorderColor, washOut } from '../shared/teamColors';
import {
  getEventOdds,
  getEventPredictor,
  getTeamBettingTrends,
  getTeamPlayers,
  getGameSkillPlayers,
  getRecentGames,
} from '../../../pages/NFLData/NFLDataApi/bettingService';
import { BOOK, getBookOdds, normalizeName } from '../../../pages/NFLData/NFLDataApi/sportsbookOdds';
import { fmtLine, fmtOdds } from '../../../pages/NFLData/NFLDataApi/betting';
import {
  buildLinePicks,
  buildPlayerPicks,
  pickPlayer,
  impliedTeamPoints,
} from '../../../pages/NFLData/NFLDataApi/picks';
import { headshotUrl } from '../../../pages/NFLData/NFLDataApi/endpoints';
import { Holdable } from '../shared/ParlayContext';

// Betting tab (bet mode only).
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

const HoldHint = () => <div className="hold-hint">Hold a line or pick to add it to your parlay.</div>;

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

const PickLine = ({ pick, leg, game }) => {
  if (!pick) return null;
  return (
    <Holdable className={`pick-line ${pick.strong ? 'strong' : ''}`} leg={leg}>
      <PickHeadline pick={pick} game={game} />
      <span className="pick-because">{pick.summary}</span>
      {pick.odds && <span className="pick-odds">{pick.odds}</span>}
    </Holdable>
  );
};

const LinesTab = ({ game, lines, linePicks }) => {
  const odds = lines.data?.odds;
  const predictor = lines.data?.predictor;
  if (lines.loading) return <div className="bet-message">Loading lines…</div>;
  if (!odds) return <div className="bet-message">No betting lines are posted for this game yet.</div>;

  return (
    <>
      <LinesTable game={game} odds={odds} />
      <WinProbability game={game} predictor={predictor} />
      <HoldHint />
      <div className="pick-lines">
        {linePicks ? (
          ['winner', 'spread', 'total'].map((key) => (
            <PickLine key={key} pick={linePicks[key]} leg={linePickLeg(key, linePicks[key], game, odds)} game={game} />
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

const TouchdownCard = ({ pick, game, large = false }) => {
  const { player, td, stats, tdHistory } = pick;
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
    </Holdable>
  );
};

// Says why touchdown odds are missing, with a retry when it's a connection problem.
const OddsStatus = ({ bookOdds, problem, isFinal, onRetry }) => {
  const hasTdOdds = Object.keys(bookOdds?.players || {}).length > 0;
  if (hasTdOdds) return null;
  let text;
  let retry = false;
  if (isFinal) text = `This game is over, so ${BOOK.name} touchdown odds are closed. Our chances only.`;
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

// Players listed under a header with their team's logo and name, away team first.
const TeamGroup = ({ game, side, children }) => {
  const team = game[side]?.team;
  return (
    <div className="team-group">
      <div className="team-group-head" style={{ borderLeftColor: teamAccent(team) }}>
        {team?.logo && <img src={team.logo} alt="" className="team-group-logo" draggable={false} />}
        <span className="team-group-name">{team?.displayName || team?.abbreviation}</span>
      </div>
      {children}
    </div>
  );
};

// SEARCH: every QB / RB / WR / TE on both rosters.
const POSITION_ORDER = { QB: 0, RB: 1, FB: 1, WR: 2, TE: 3 };

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

const SearchPanel = ({ game, deep, odds, rankings }) => {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const roster = useAsyncData(() => getGameSkillPlayers(game), [game.id, game.away?.teamId, game.home?.teamId]);
  const priced = deep.data?.bookOdds?.players || {};
  const hasOdds = (p) => Boolean(priced[normalizeName(p.name)]?.anytimeTd);

  const players = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (roster.data || [])
      .filter(
        (p) =>
          !q ||
          p.name.toLowerCase().includes(q) ||
          p.position.toLowerCase() === q ||
          (p.teamAbbr || '').toLowerCase() === q,
      )
      .sort(
        (a, b) =>
          Number(hasOdds(b)) - Number(hasOdds(a)) ||
          (POSITION_ORDER[a.position] ?? 9) - (POSITION_ORDER[b.position] ?? 9) ||
          a.name.localeCompare(b.name),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roster.data, query, priced]);

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
      {selected && (
        <SearchResult key={selected.id} player={selected} game={game} deep={deep} odds={odds} rankings={rankings} />
      )}
      {roster.loading ? (
        <div className="bet-message">Loading rosters…</div>
      ) : (
        <div className="search-list" role="listbox" aria-label="Players">
          {['away', 'home'].map((side) => {
            const mine = players.filter((p) => p.teamSide === side);
            if (!mine.length) return null;
            const team = game[side]?.team;
            return (
              <React.Fragment key={side}>
                <div className="search-team-head" style={{ borderLeftColor: teamAccent(team) }}>
                  {team?.logo && <img src={team.logo} alt="" className="team-group-logo" draggable={false} />}
                  <span className="team-group-name">{team?.displayName}</span>
                </div>
                {mine.map((p) => (
                  <button
                    key={`${p.teamSide}-${p.id}`}
                    type="button"
                    role="option"
                    aria-selected={p.id === selectedId}
                    className={`search-item ${p.id === selectedId ? 'active' : ''}`}
                    onClick={() => setSelectedId(p.id)}
                  >
                    <span className="player-headshot small">
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
                    <span className="player-pos">{p.position}</span>
                    {hasOdds(p) && <span className="search-item-lines">TD ODDS</span>}
                  </button>
                ))}
              </React.Fragment>
            );
          })}
          {!players.length && <div className="bet-message small">No players match “{query}”.</div>}
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
  const list = playerPicks?.[group] || [];

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
      <div className="hold-hint">Hold a player to add their anytime TD to your parlay.</div>
      {group === 'search' ? (
        <SearchPanel game={game} deep={deep} odds={odds} rankings={rankings} />
      ) : !playerPicks ? (
        <div className="bet-message">Loading players…</div>
      ) : list.length ? (
        <div className="td-list">
          {['away', 'home'].map((side) => {
            const mine = list.filter((p) => p.player.teamSide === side);
            if (!mine.length) return null;
            return (
              <TeamGroup key={side} game={game} side={side}>
                {mine.map((p) => (
                  <TouchdownCard key={`${p.player.teamSide}-${p.player.id}`} pick={p} game={game} />
                ))}
              </TeamGroup>
            );
          })}
        </div>
      ) : (
        <div className="bet-message">No players found.</div>
      )}
      {!deep.loading && (
        <OddsStatus bookOdds={deep.data?.bookOdds} problem={oddsProblem} isFinal={isFinal} onRetry={onRetryOdds} />
      )}
    </>
  );
};

// ---------- panel ----------

const TABS = [
  { key: 'lines', label: 'LINES' },
  { key: 'players', label: 'PLAYERS' },
];

const Betting = ({ game, rankings }) => {
  const isFinal = game.status.state === 'post';
  const [tab, setTab] = useState('lines');
  const [needPlayers, setNeedPlayers] = useState(false);
  const [ref, inView] = useInView();

  useEffect(() => {
    if (tab === 'players') setNeedPlayers(true);
  }, [tab]);

  // Lines (with DraftKings bet-slip links) come from ESPN's DraftKings feed;
  // anytime TD prices from one cached SportsGameOdds slate request.
  const [oddsAttempt, setOddsAttempt] = useState(0);
  const lines = useAsyncData(
    async () => {
      const [espnOdds, predictor, book] = await Promise.all([
        settle(getEventOdds(game.id, { final: isFinal })),
        settle(getEventPredictor(game.id)),
        isFinal ? null : getBookOdds(game),
      ]);
      const bookOdds = book?.odds || null;
      return { odds: espnOdds, predictor, bookOdds, problem: book?.problem || null };
    },
    [game.id, isFinal, oddsAttempt],
    { keepPrevious: true },
  );
  const odds = lines.data?.odds;

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

  // Players load once PLAYERS is opened; their TD odds came with the lines.
  const deep = useAsyncData(
    async () => {
      const [away, home] = await Promise.all([
        settle(getTeamPlayers(game.away?.teamId, game)),
        settle(getTeamPlayers(game.home?.teamId, game)),
      ]);
      return { players: { away, home }, bookOdds: lines.data?.bookOdds || null };
    },
    [game.id, game.away?.teamId, game.home?.teamId, game.season, lines.data],
    { enabled: needPlayers && !lines.loading },
  );

  const linePicks = useMemo(
    () =>
      research.data && odds ? buildLinePicks({ game, odds, predictor: lines.data?.predictor, ...research.data }) : null,
    [research.data, game, odds, lines.data],
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

      {tab === 'lines' && <LinesTab game={game} lines={lines} linePicks={linePicks} />}
      {tab === 'players' && (
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
      )}
    </div>
  );
};

export default Betting;
