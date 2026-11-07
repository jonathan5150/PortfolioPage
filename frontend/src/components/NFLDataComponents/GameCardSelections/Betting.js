import React from 'react';
import useAsyncData from '../shared/useAsyncData';
import { getTeamColor, washOut } from '../shared/teamColors';
import {
  getEventOdds,
  getEventPredictor,
  getTeamBettingTrends,
  getPlayersBettingTrends,
} from '../../../pages/NFLData/NFLDataApi/bettingService';
import {
  buildInsights,
  fmtLine,
  fmtOdds,
  gradeFinal,
  impliedProbability,
  recordText,
} from '../../../pages/NFLData/NFLDataApi/betting';

// Betting tab: sportsbook lines, against-the-spread / over-under trends, and
// auto-generated highlights built from this season's results and player game logs.

const settle = async (promise) => {
  try {
    return await promise;
  } catch (error) {
    console.warn('Betting data unavailable:', error);
    return null;
  }
};

const teamAccent = (team) => washOut(getTeamColor(team) || 'rgba(120,120,120,0.6)', 0.15).replace(/[\d.]+\)$/, '1)');

// ---------- lines ----------

const OpenNote = ({ open, current, format }) =>
  open !== null && open !== undefined && open !== current ? <div className="bet-open">open {format(open)}</div> : null;

const LinesTable = ({ game, odds }) => {
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
        <div key={side} className={`bet-lines-row ${o.favorite ? 'favorite' : ''}`}>
          <div className="bet-team" style={{ borderLeftColor: teamAccent(competitor?.team) }}>
            <span className="bet-team-abbr">{competitor?.team?.abbreviation}</span>
            {o.favorite && <span className="bet-fav-tag">FAV</span>}
          </div>
          <div className="bet-cell">
            <div className="bet-main">{fmtLine(o.spreadLine)}</div>
            <div className="bet-sub">{fmtOdds(o.spreadOdds)}</div>
            <OpenNote open={o.openSpreadLine} current={o.spreadLine} format={fmtLine} />
          </div>
          <div className="bet-cell">
            <div className="bet-main">{fmtOdds(o.moneyLine)}</div>
            <div className="bet-sub">
              {impliedProbability(o.moneyLine) !== null ? `${Math.round(impliedProbability(o.moneyLine))}% implied` : ''}
            </div>
            <OpenNote open={o.openMoneyLine} current={o.moneyLine} format={fmtOdds} />
          </div>
          <div className="bet-cell">
            <div className="bet-main">
              {totalLabel} {odds.total.line ?? '—'}
            </div>
            <div className="bet-sub">{fmtOdds(totalOdds)}</div>
            {side === 'away' && (
              <OpenNote open={odds.total.openLine} current={odds.total.line} format={(v) => String(v)} />
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

const WinProbability = ({ game, predictor }) => {
  if (!predictor) return null;
  const awayColor = teamAccent(game.away?.team);
  const homeColor = teamAccent(game.home?.team);
  const away = Math.round(predictor.away * 10) / 10;
  const home = Math.round(predictor.home * 10) / 10;
  return (
    <div className="bet-winprob">
      <div className="bet-winprob-labels">
        <span>
          {game.away?.team?.abbreviation} {away}%
        </span>
        <span className="bet-winprob-title">ESPN FPI WIN PROBABILITY</span>
        <span>
          {home}% {game.home?.team?.abbreviation}
        </span>
      </div>
      <div className="bet-winprob-bar">
        <div style={{ width: `${away}%`, background: awayColor }} />
        <div style={{ width: `${home}%`, background: homeColor }} />
      </div>
    </div>
  );
};

const FinalResult = ({ game, odds }) => {
  const result = gradeFinal(game, odds);
  if (!result) return null;
  const totalText =
    result.total === 'O' ? `Over ${odds.total.line} hit` : result.total === 'U' ? `Under ${odds.total.line} hit` : result.total === 'P' ? 'Total pushed' : null;
  return (
    <div className="bet-final">
      <span className="bet-final-label">RESULT</span>
      {result.spread && <span className="bet-chip">{result.spread}</span>}
      {totalText && (
        <span className="bet-chip">
          {totalText} ({result.points})
        </span>
      )}
    </div>
  );
};

// ---------- trends ----------

const pct = (rec, a = 'W', b = 'L') => {
  const n = (rec[a] || 0) + (rec[b] || 0);
  return n ? (rec[a] || 0) / n : null;
};

const TrendValue = ({ rec, keys = ['W', 'L', 'P'], good = 'W', bad = 'L' }) => {
  const rate = pct(rec, good, bad);
  const total = keys.reduce((s, k) => s + (rec[k] || 0), 0);
  const cls = rate === null ? '' : rate >= 0.6 ? 'hot' : rate <= 0.4 ? 'cold' : '';
  return <span className={`bet-trend-val ${cls}`}>{total ? recordText(rec, keys) : '—'}</span>;
};

const AtsDots = ({ games }) => (
  <span className="bet-dots">
    {games.length
      ? games.map((g) => (
          <span key={g.gameId} className={`bet-dot ${g.ats || 'none'}`} title={`${g.oppAbbr}: ${g.ats || 'no line'}`} />
        ))
      : '—'}
  </span>
);

const TrendsTable = ({ game, awayTrends, homeTrends }) => {
  const a = awayTrends;
  const h = homeTrends;
  const n = (v) => (v === null || v === undefined ? '—' : (Math.round(v * 10) / 10).toFixed(1));
  const rows = [
    { label: 'W/L RECORD', away: <TrendValue rec={a.su} keys={['W', 'L', 'T']} />, home: <TrendValue rec={h.su} keys={['W', 'L', 'T']} /> },
    { label: 'ATS', away: <TrendValue rec={a.ats} />, home: <TrendValue rec={h.ats} /> },
    { label: 'ATS AS FAV', away: <TrendValue rec={a.atsFav} />, home: <TrendValue rec={h.atsFav} /> },
    { label: 'ATS AS DOG', away: <TrendValue rec={a.atsDog} />, home: <TrendValue rec={h.atsDog} /> },
    { label: 'ATS AWAY / HOME', away: <TrendValue rec={a.atsAway} />, home: <TrendValue rec={h.atsHome} /> },
    {
      label: 'OVER / UNDER',
      away: <TrendValue rec={a.ou} keys={['O', 'U', 'P']} good="O" bad="U" />,
      home: <TrendValue rec={h.ou} keys={['O', 'U', 'P']} good="O" bad="U" />,
    },
    { label: 'PTS FOR / AGAINST', away: `${n(a.ppg)} / ${n(a.papg)}`, home: `${n(h.ppg)} / ${n(h.papg)}` },
    { label: 'LAST 5 ATS', away: <AtsDots games={a.last5} />, home: <AtsDots games={h.last5} /> },
  ];

  return (
    <div className="bet-trends">
      <div className="bet-trends-row bet-trends-head">
        <span style={{ color: teamAccent(game.away?.team) }}>{game.away?.team?.abbreviation}</span>
        <span />
        <span style={{ color: teamAccent(game.home?.team) }}>{game.home?.team?.abbreviation}</span>
      </div>
      {rows.map((r) => (
        <div key={r.label} className="bet-trends-row">
          <span className="bet-trends-side left">{r.away}</span>
          <span className="bet-trends-label">{r.label}</span>
          <span className="bet-trends-side right">{r.home}</span>
        </div>
      ))}
    </div>
  );
};

// ---------- highlights ----------

const TYPE_LABEL = { spread: 'SPREAD', total: 'TOTAL', moneyline: 'MONEYLINE', player: 'PLAYER' };

const Highlights = ({ insights }) => {
  if (!insights.length) {
    return <div className="bet-message">No strong trends stand out for this matchup yet.</div>;
  }
  return (
    <div className="bet-highlights">
      {insights.map((i) => (
        <div key={i.id} className={`bet-highlight ${i.tone}`}>
          <div className="bet-highlight-top">
            <span className="bet-highlight-type">{TYPE_LABEL[i.type] || 'TREND'}</span>
            <span className="bet-strength" aria-label={`signal strength ${Math.round(i.strength * 100)}%`}>
              {[0.25, 0.5, 0.75].map((t) => (
                <span key={t} className={i.strength >= t ? 'on' : ''} />
              ))}
            </span>
          </div>
          <div className="bet-highlight-title">{i.title}</div>
          <div className="bet-highlight-text">{i.text}</div>
          {i.lean && <div className="bet-lean">{i.lean}</div>}
        </div>
      ))}
    </div>
  );
};

// ---------- panel ----------

const Betting = ({ game }) => {
  const isFinal = game.status.state === 'post';
  const lines = useAsyncData(
    async () => {
      const [odds, predictor] = await Promise.all([
        settle(getEventOdds(game.id, { final: isFinal })),
        isFinal ? null : settle(getEventPredictor(game.id)),
      ]);
      return { odds, predictor };
    },
    [game.id, isFinal]
  );

  const trends = useAsyncData(
    async () => {
      const [awayTrends, homeTrends, players] = await Promise.all([
        settle(getTeamBettingTrends(game.away?.teamId, game)),
        settle(getTeamBettingTrends(game.home?.teamId, game)),
        settle(getPlayersBettingTrends(game)),
      ]);
      return { awayTrends, homeTrends, players: players || [] };
    },
    [game.id, game.away?.teamId, game.home?.teamId, game.season, game.seasonType]
  );

  const odds = lines.data?.odds;
  const predictor = lines.data?.predictor;
  const insights =
    trends.data && !lines.loading
      ? buildInsights({ game, odds, predictor, ...trends.data })
      : [];

  return (
    <div className="betting-panel">
      <div className="bet-section-title">
        <span>LINES</span>
        {odds?.provider && <span className="bet-provider">{isFinal ? 'closing · ' : ''}{odds.provider}</span>}
      </div>
      {lines.loading ? (
        <div className="bet-message">Loading lines…</div>
      ) : odds ? (
        <>
          <LinesTable game={game} odds={odds} />
          {isFinal && <FinalResult game={game} odds={odds} />}
          <WinProbability game={game} predictor={predictor} />
        </>
      ) : (
        <div className="bet-message">No betting lines are posted for this game yet.</div>
      )}

      <div className="bet-section-title">
        <span>ATS &amp; TRENDS</span>
        <span className="bet-provider">{game.season} season{isFinal ? ', before this game' : ''}</span>
      </div>
      {trends.loading ? (
        <div className="bet-message">Crunching this season's results…</div>
      ) : trends.data?.awayTrends && trends.data?.homeTrends ? (
        <TrendsTable game={game} awayTrends={trends.data.awayTrends} homeTrends={trends.data.homeTrends} />
      ) : (
        <div className="bet-message">Trends are unavailable right now.</div>
      )}

      <div className="bet-section-title">
        <span>HIGHLIGHTS</span>
        {isFinal && <span className="bet-provider">pre-game view</span>}
      </div>
      {trends.loading || lines.loading ? (
        <div className="bet-message">Looking for angles…</div>
      ) : (
        <Highlights insights={insights} />
      )}

      <div className="bet-disclaimer">
        Trends describe past results and aren't predictions. For entertainment only. 21+. Gambling problem? Call
        1-800-GAMBLER.
      </div>
    </div>
  );
};

export default Betting;
