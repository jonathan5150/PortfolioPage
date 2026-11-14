import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import FitText from '../../components/NFLDataComponents/shared/FitText';
import SportSwitcher from '../SportSwitcher';
import DayCalendar from '../DayCalendar';
import SlideOpen from '../../components/NFLDataComponents/shared/SlideOpen';
import LastUpdated from '../../components/NFLDataComponents/shared/LastUpdated';
import LoadingField from '../../components/NFLDataComponents/shared/LoadingField';
import { Holdable, ParlayProvider } from '../../components/NFLDataComponents/shared/ParlayContext';
import ParlayBar from '../../components/NFLDataComponents/ParlayBar/ParlayBar';
import { fightLeg } from '../parlayLegs';
import TeamCell from '../../components/NFLDataComponents/ScoreBug/TeamCell';
import useAsyncData from '../../components/NFLDataComponents/shared/useAsyncData';
import usePersistentState from '../../components/NFLDataComponents/shared/usePersistentState';
import { betReturn } from '../../pages/NFLData/NFLDataApi/picks';
import { fmtOdds } from '../../pages/NFLData/NFLDataApi/betting';
import { loadUfcModel, ufcPicks, gradeUfcPicks, decimalPrice, METHOD_LABEL } from './ufcModel';
import { runWithConcurrency } from '../../pages/NFLData/NFLDataApi/http';
import {
  etDay,
  getUfcFightDetails,
  getUfcFighter,
  getUfcOdds,
  getUfcEventDays,
  getUfcScoreboard,
  headshotUrl,
} from './ufcApi';
import '../../pages/NFLData/NFLData.scss';
import '../team/TeamSport.scss';
import './Ufc.scss';
import '../SportTitles.scss';

// red and blue corners stand in for team colours
const RED = '#b3262b';
const BLUE = '#2a5aa8';
const SEGMENTS = [
  { key: 'main', label: 'MAIN CARD' },
  { key: 'prelims', label: 'PRELIMS' },
  { key: 'early', label: 'EARLY PRELIMS' },
];
const segmentKey = (details) => {
  const s = `${details?.segmentKey || ''} ${details?.segment || ''}`.toLowerCase();
  if (s.includes('early')) return 'early';
  if (s.includes('prelim')) return 'prelims';
  return 'main';
};
const timeLabel = (iso) =>
  iso
    ? new Date(iso)
        .toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
        .toUpperCase()
    : '';

// A fighter shown in a team cell: last name, record, headshot, corner colour.
const asCompetitor = (fighter, color) =>
  fighter && {
    record: fighter.record,
    winner: fighter.winner,
    team: {
      league: 'ufc',
      abbreviation: (fighter.lastName || fighter.name).toUpperCase(),
      displayName: fighter.name,
      logo: headshotUrl(fighter.id),
      color,
    },
  };

// ---------- picks: the backtested UFC model (see ufcModel.js) ----------

const pct = (p) => `${Math.round(p * 100)}%`;
const ResultCorner = ({ grade }) =>
  grade === 'W' || grade === 'L' ? <span className={`pick-result ${grade === 'W' ? 'right' : 'wrong'}`} /> : null;

// why the model likes the winner pick, in a sentence or two
const winnerWhy = (w) => {
  const me = w.profile;
  const op = w.opp;
  const bits = [];
  if (me.known && op.known) {
    if (me.ageNow + 3 <= op.ageNow) bits.push(`${Math.round(op.ageNow - me.ageNow)} years younger`);
    if (me.reachCm && op.reachCm && me.reachCm - op.reachCm >= 7) bits.push('a clear reach edge');
    if (op.ko_w * me.ko_l < me.ko_w * op.ko_l - 0.03) bits.push('more knockout power against a shakier chin');
    if (me.tdpm - op.tdpm > 0.05) bits.push('the better wrestler');
    if (me.slpm - me.sapm - (op.slpm - op.sapm) > 1) bits.push('out-striking opponents by more');
  } else if (!op.known && me.known) bits.push(`facing a UFC newcomer`);
  return bits.slice(0, 3);
};

const WinnerPick = ({ w, leg, grade }) => {
  const why = winnerWhy(w);
  const name = w.fighter?.name || '';
  const headline = `${name.toUpperCase()} TO WIN`;
  const text = w.bet
    ? `${w.underdog ? 'Underdog value: ' : ''}we have ${name} at ${pct(w.chance)} to win; at ${fmtOdds(w.price)} the price only needs ${pct(1 / decimalPrice(w.price))}.${why.length ? ` They're ${why.join(', ')}.` : ''} The model's value picks broke about even over 900 out-of-sample fights from 2018 to 2025, with over half of them on underdogs.`
    : `Lean ${name}: about ${pct(w.chance)} to win, but at ${fmtOdds(w.price)} the price already says so. No value, so not a bet.`;
  return (
    <Holdable className={`pick-line ${w.bet ? 'bet' : 'lean'}`} leg={leg}>
      <span className="pick-title-row">
        <span className={`pick-kind ${w.bet ? 'bet' : 'lean'}`}>{w.bet ? (w.underdog ? 'UPSET' : 'BET') : 'LEAN'}</span>
        <span className="pick-headline">{headline}</span>
      </span>
      <span className="pick-because">{text}</span>
      <span className="pick-odds">ML {fmtOdds(w.price)}</span>
      <ResultCorner grade={grade} />
    </Holdable>
  );
};

const RoundsPick = ({ r, grade }) => {
  const word = r.side === 'over' ? 'OVER' : 'UNDER';
  const price = r.side === 'over' ? r.overOdds : r.underOdds;
  return (
    <div className="pick-line lean">
      <span className="pick-title-row">
        <span className="pick-kind lean">LEAN</span>
        <span className="pick-headline">
          {word} {r.line} ROUNDS
        </span>
      </span>
      <span className="pick-because">
        {r.side === 'over'
          ? `About ${pct(r.chance)} to go past ${r.line} rounds: these two have gone long and don't get finished often.`
          : `About ${pct(r.chance)} to end before ${r.line} rounds: there's finishing power and chins that have been cracked.`}{' '}
        {!r.posted && 'No rounds line is posted yet, so this is against the usual line. '}
        Right 60% of the time on the last year of fights (64% when the model was 60%+ sure).
      </span>
      {price !== null && price !== undefined && Math.abs(price) >= 100 && <span className="pick-odds">{fmtOdds(price)}</span>}
      <ResultCorner grade={grade} />
    </div>
  );
};

const MethodPick = ({ m, grade }) => (
  <div className="pick-line lean">
    <span className="pick-title-row">
      <span className="pick-kind lean">LEAN</span>
      <span className="pick-headline">ENDS BY {METHOD_LABEL[m.method]}</span>
    </span>
    <span className="pick-because">
      {`KO/TKO ${pct(m.probs.KO || 0)} · submission ${pct(m.probs.SUB || 0)} · decision ${pct(m.probs.DEC || 0)}. `}
      Right 49% of the time on the last year of fights, against 42% for always picking a decision.
    </span>
    <ResultCorner grade={grade} />
  </div>
);

// ---------- fight card ----------

const TaleRow = ({ label, red, blue }) => (
  <div className="ufc-tape-row">
    <span className="ufc-tape-red">{red || '—'}</span>
    <span className="ufc-tape-label">{label}</span>
    <span className="ufc-tape-blue">{blue || '—'}</span>
  </div>
);

const FightPanel = ({ eventId, fight, details }) => {
  const final = fight.status.state === 'post';
  const data = useAsyncData(async () => {
    const [red, blue, odds, model] = await Promise.all([
      fight.red ? getUfcFighter(fight.red.id).catch(() => null) : null,
      fight.blue ? getUfcFighter(fight.blue.id).catch(() => null) : null,
      getUfcOdds(eventId, fight.id, { final }).catch(() => null),
      loadUfcModel().catch(() => null),
    ]);
    return { red, blue, odds, model };
  }, [eventId, fight.id, final]);
  if (data.loading && !data.data) return <div className="bet-message">Loading the tale of the tape…</div>;
  const { red, blue, odds, model } = data.data || {};
  const picks = model && odds ? ufcPicks(model, fight, odds, { red, blue }) : null;
  const grades = picks ? gradeUfcPicks(picks, fight, details?.result) : null;
  return (
    <div className="ufc-panel">
      <div className="ufc-tape">
        <div className="ufc-tape-head">
          <span className="ufc-tape-red">{fight.red?.name}</span>
          <span className="ufc-tape-label">TALE OF THE TAPE</span>
          <span className="ufc-tape-blue">{fight.blue?.name}</span>
        </div>
        {(red?.nickname || blue?.nickname) && (
          <TaleRow
            label="NICKNAME"
            red={red?.nickname && `"${red.nickname}"`}
            blue={blue?.nickname && `"${blue.nickname}"`}
          />
        )}
        <TaleRow label="RECORD" red={red?.record || fight.red?.record} blue={blue?.record || fight.blue?.record} />
        <TaleRow label="KO WINS" red={red?.koWins} blue={blue?.koWins} />
        <TaleRow label="SUB WINS" red={red?.subWins} blue={blue?.subWins} />
        <TaleRow label="AGE" red={red?.age} blue={blue?.age} />
        <TaleRow label="HEIGHT" red={red?.height} blue={blue?.height} />
        <TaleRow label="REACH" red={red?.reach} blue={blue?.reach} />
        <TaleRow label="WEIGHT" red={red?.weight} blue={blue?.weight} />
        <TaleRow label="STANCE" red={red?.stance} blue={blue?.stance} />
        <TaleRow label="STYLE" red={red?.style} blue={blue?.style} />
        <TaleRow label="FROM" red={red?.country || fight.red?.country} blue={blue?.country || fight.blue?.country} />
      </div>

      {odds ? (
        <>
          <div className="ufc-odds">
            <Holdable
              className="ufc-odds-cell"
              style={{ borderColor: RED }}
              leg={!final && odds.byId[fight.red?.id] ? fightLeg(eventId, fight, fight.red, odds) : null}
            >
              <span className="ufc-odds-name">{fight.red?.shortName}</span>
              <span className="ufc-odds-price">{fmtOdds(odds.byId[fight.red?.id])}</span>
            </Holdable>
            <Holdable
              className="ufc-odds-cell"
              style={{ borderColor: BLUE }}
              leg={!final && odds.byId[fight.blue?.id] ? fightLeg(eventId, fight, fight.blue, odds) : null}
            >
              <span className="ufc-odds-name">{fight.blue?.shortName}</span>
              <span className="ufc-odds-price">{fmtOdds(odds.byId[fight.blue?.id])}</span>
            </Holdable>
            {odds.rounds !== null && (
              <div className="ufc-odds-cell">
                <span className="ufc-odds-name">ROUNDS O/U</span>
                <span className="ufc-odds-price">{odds.rounds}</span>
              </div>
            )}
          </div>
          {picks && (
            <div className="pick-lines">
              <WinnerPick
                w={picks.winner}
                grade={grades?.winner}
                leg={!final ? fightLeg(eventId, fight, picks.winner.fighter, odds) : null}
              />
              <RoundsPick r={picks.rounds} grade={grades?.rounds} />
              <MethodPick m={picks.method} grade={grades?.method} />
            </div>
          )}
        </>
      ) : (
        <div className="bet-message small">No odds posted for this fight.</div>
      )}
    </div>
  );
};

const FightCard = ({ eventId, fight, details, sectionsReady, isOpen, onToggle, hideMode, hidden, onToggleHidden }) => {
  const { state } = fight.status;
  // the win chances need this fight's odds - fetched only once the card is on
  // screen in its real section (card segments loaded) and only before the
  // result is in
  const odds = useAsyncData(() => getUfcOdds(eventId, fight.id).catch(() => null), [eventId, fight.id], {
    enabled: state !== 'post' && sectionsReady,
  }).data;
  const [hasOpened, setHasOpened] = useState(false);
  useEffect(() => {
    if (isOpen) {
      setHasOpened(true);
      return undefined;
    }
    const t = setTimeout(() => setHasOpened(false), 500);
    return () => clearTimeout(t);
  }, [isOpen]);
  const innerRef = useRef(null);
  const [height, setHeight] = useState(0);
  useLayoutEffect(() => {
    if (!isOpen) {
      setHeight(0);
      return undefined;
    }
    const inner = innerRef.current;
    if (!inner) return undefined;
    setHeight(inner.scrollHeight);
    if (typeof ResizeObserver === 'undefined') return undefined;
    const o = new ResizeObserver(() => setHeight(inner.scrollHeight));
    o.observe(inner);
    return () => o.disconnect();
  }, [isOpen, hasOpened]);

  const result = details?.result;
  const right =
    state === 'post'
      ? result
        ? `${result.method}${result.round ? ` · R${result.round} ${result.clock}` : ''}`
        : 'Final'
      : state === 'in'
        ? `● R${fight.status.period || 1} ${fight.status.displayClock || ''}`
        : timeLabel(fight.date);
  const score = (f) =>
    state === 'post' ? (f?.winner ? 'W' : fight.red?.winner || fight.blue?.winner ? 'L' : 'D') : '';

  return (
    <div
      className={`game-slot ufc-fight ${isOpen ? 'open' : ''} ${hideMode ? 'hide-mode' : ''} ${hidden ? 'hidden-game' : ''}`}
      style={{ '--ring-away': RED, '--ring-home': BLUE }}
    >
      {hideMode && (
        <label className="hide-check">
          <input
            type="checkbox"
            checked={hidden}
            onChange={() => onToggleHidden(fight.id)}
            aria-label={`Hide ${fight.red?.name || ''} vs ${fight.blue?.name || ''}`}
          />
        </label>
      )}
      <span className="game-ring" aria-hidden="true" />
      <div
        className="game-slot-body"
        onClickCapture={(e) => {
          if (!hideMode) return;
          e.preventDefault();
          e.stopPropagation();
          onToggleHidden(fight.id);
        }}
      >
        {hidden && <div className="hidden-overlay">HIDDEN</div>}
        <div className="game-slot-content">
          <div className="score-grid ufc-grid" onClick={onToggle}>
            <TeamCell
              side="away"
              competitor={asCompetitor(fight.red, RED)}
              score={score(fight.red)}
              showOdds={state !== 'post'}
              moneyLine={odds?.byId[fight.red?.id]}
              isWinner={fight.red?.winner}
              corner="top"
              expanded={isOpen}
            />
            <TeamCell
              side="home"
              competitor={asCompetitor(fight.blue, BLUE)}
              score={score(fight.blue)}
              showOdds={state !== 'post'}
              moneyLine={odds?.byId[fight.blue?.id]}
              isWinner={fight.blue?.winner}
              corner="top"
              expanded={isOpen}
            />
            <div className="ufc-fight-row">
              <span className="ufc-fight-class">
                {fight.weightClass.toUpperCase()} · {fight.rounds} RDS
              </span>
              <span className={`ufc-fight-result ${state}`}>{right}</span>
            </div>
          </div>
          <div
            className="game-data-container stat-toggle-container"
            style={{
              overflow: 'hidden',
              height: isOpen ? `${height}px` : '0px',
              opacity: isOpen ? 1 : 0,
              padding: isOpen ? '5px' : '0 5px',
              marginBottom: isOpen ? '7px' : '0',
              borderWidth: isOpen ? '2px' : '0px',
              pointerEvents: isOpen ? 'auto' : 'none',
              transition: 'height 0.35s ease, opacity 0.25s ease, padding 0.25s ease, margin 0.25s ease',
              boxSizing: 'content-box',
            }}
          >
            <div ref={innerRef}>{hasOpened && <FightPanel eventId={eventId} fight={fight} details={details} />}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------- the event's model results ----------

const money = (n) => `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const signed = (n) => `${n > 0.004 ? '+' : n < -0.004 ? '-' : ''}${money(n)}`;
const tone = (n) => (n > 0.004 ? 'up' : n < -0.004 ? 'down' : 'even');

const tally = (rows, key) =>
  rows.reduce(
    (a, g) => ({ W: a.W + (g[key] === 'W' ? 1 : 0), L: a.L + (g[key] === 'L' ? 1 : 0) }),
    { W: 0, L: 0 },
  );

const RecordRow = ({ label, rec, profit }) => (
  <div className="season-row total">
    <span>{label}</span>
    <span className="prediction-record-wl">
      {rec.W}-{rec.L}
    </span>
    <span className="prediction-record-pct">{rec.W + rec.L ? `${Math.round((rec.W / (rec.W + rec.L)) * 100)}%` : '—'}</span>
    {profit === undefined ? <span /> : <span className={`bet-return ${tone(profit)}`}>{signed(profit)}</span>}
  </div>
);

const EventModelResults = ({ event, details }) => {
  const [open, setOpen] = useState(false);
  const finished = useMemo(() => event.fights.filter((f) => f.status.state === 'post'), [event]);
  const graded = useAsyncData(
    async () => {
      const model = await loadUfcModel();
      const results = await runWithConcurrency(
        finished.map((fight) => async () => {
          const odds = await getUfcOdds(event.id, fight.id, { final: true }).catch(() => null);
          const picks = odds ? ufcPicks(model, fight, odds) : null;
          const g = picks ? gradeUfcPicks(picks, fight, details?.[fight.id]?.result) : null;
          return g ? { ...g, price: picks.winner.price, bet: picks.winner.bet } : null;
        }),
        4,
      );
      return results.map((r) => (r.ok ? r.value : null)).filter(Boolean);
    },
    [event.id, finished.length, Boolean(details)],
    { enabled: open && finished.length > 0 },
  );
  const rows = graded.data || [];
  const winners = tally(rows, 'winner');
  const bets = rows.filter((g) => g.bet);
  const betRec = tally(bets, 'winner');
  const profitOf = (list) => list.reduce((a, g) => a + (g.winner === 'P' ? 0 : betReturn(10, g.price, g.winner) - 10), 0);
  return (
    <div className="gold-box prediction-record-outer">
      <div className="prediction-record">
        <button
          type="button"
          className={`bet-results-toggle gold-box-text ${open ? 'open' : ''}`}
          onClick={() => setOpen((o) => !o)}
        >
          <span className="game-section-name">
            {open ? 'HIDE MODEL RESULTS' : 'SHOW MODEL RESULTS'}
            <span className="gold-caret" aria-hidden="true" />
          </span>
        </button>
        <SlideOpen open={open} className="model-results-body">
          <div className="model-results-content">
            <div className="prediction-record-title">THIS CARD · $10 EACH</div>
            {!finished.length ? (
              <div className="prediction-record-loading">No finished fights on this card yet.</div>
            ) : !graded.data ? (
              <div className="prediction-record-loading">Grading the card…</div>
            ) : (
              <>
                <RecordRow label="Winner bets" rec={betRec} profit={profitOf(bets)} />
                <RecordRow label="Every winner pick" rec={winners} profit={profitOf(rows)} />
                <RecordRow label="Rounds O/U" rec={tally(rows, 'rounds')} />
                <RecordRow label="Method" rec={tally(rows, 'method')} />
                <div className="league-model-note">
                  Winner bets are the model's value picks (often underdogs); every other winner pick is a lean on the
                  likelier fighter. On the last year of fights it held out, the model's value picks went 43-39 (44
                  underdogs) for about break-even, rounds picks were right 60% of the time and method picks 49%.
                </div>
              </>
            )}
          </div>
        </SlideOpen>
      </div>
    </div>
  );
};

// ---------- page ----------

const UfcPage = () => {
  const [day, setDay] = useState(null); // the event's US Eastern date, YYYYMMDD
  const [board, setBoard] = useState(null);
  const [error, setError] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const [calendar, setCalendar] = useState([]);

  // the first load asks ESPN for "the current event" and learns its day from
  // that; setting the day must not download the same board a second time
  const seededDay = useRef(null);
  useEffect(() => {
    if (day && seededDay.current === day) {
      seededDay.current = null;
      return undefined;
    }
    seededDay.current = null;
    let active = true;
    getUfcScoreboard(day, { live: refresh > 0 })
      .then((data) => {
        if (!active) return;
        setBoard(data);
        setError(null);
        if (data.calendar.length) setCalendar(data.calendar);
        if (!day && data.event?.date) {
          seededDay.current = etDay(data.event.date);
          setDay(seededDay.current);
        }
      })
      .catch((e) => active && setError(e));
    return () => {
      active = false;
    };
  }, [day, refresh]);

  const event = board?.event;
  const live = Boolean(event?.fights.some((f) => f.status.state === 'in'));
  useEffect(() => {
    const id = setInterval(
      () => document.visibilityState !== 'hidden' && setRefresh((r) => r + 1),
      live ? 20000 : 300000,
    );
    return () => clearInterval(id);
  }, [live]);

  const details = useAsyncData(
    () => (event ? getUfcFightDetails(event.id, event.fights, { live }) : null),
    [event?.id, live, live ? refresh : 0],
    { enabled: Boolean(event) },
  );

  // ---- FIGHTS: hide fights you don't care about (saved) ----
  const [hideMode, setHideMode] = useState(false);
  const [hiddenIds, setHiddenIds] = usePersistentState('hiddenFights', []);
  const hiddenSet = useMemo(() => new Set(hiddenIds), [hiddenIds]);
  const toggleHidden = useCallback(
    (id) => setHiddenIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])),
    [setHiddenIds],
  );
  const shownFights = useMemo(
    () => (!event ? [] : hideMode ? event.fights : event.fights.filter((f) => !hiddenSet.has(f.id))),
    [event, hideMode, hiddenSet],
  );
  const visibleCount = event ? event.fights.filter((f) => !hiddenSet.has(f.id)).length : 0;

  const [openId, setOpenId] = useState(null);
  const sections = useMemo(() => {
    if (!event) return [];
    const by = { main: [], prelims: [], early: [] };
    [...shownFights]
      .sort((a, b) => b.order - a.order) // main event first
      .forEach((f) => by[segmentKey(details.data?.[f.id])].push(f));
    return SEGMENTS.map((s) => ({ ...s, fights: by[s.key] })).filter((s) => s.fights.length);
  }, [event, shownFights, details.data]);

  const cookieName = event ? `ufcCollapsed_${event.id}` : null;
  const [savedCollapsed, setSavedCollapsed] = useState(null);
  // not saved anywhere: every event starts from the default view
  useEffect(() => setSavedCollapsed(null), [cookieName]);
  const collapsed = savedCollapsed || new Set(sections.map((s) => s.key).filter((k) => k !== 'main'));
  const toggleSection = (key, fights) => {
    const next = new Set(collapsed);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSavedCollapsed(next);
    if (fights.some((f) => f.id === openId)) setOpenId(null);
  };

  // previous / next event on the calendar
  // where the shown event sits on the calendar: the entry nearest its start
  const index = useMemo(() => {
    if (!event?.date || !calendar.length) return -1;
    const t = new Date(event.date).getTime();
    let best = -1;
    let bestGap = Infinity;
    calendar.forEach((c, i) => {
      const gap = Math.abs(new Date(c.startDate).getTime() - t);
      if (gap < bestGap) {
        best = i;
        bestGap = gap;
      }
    });
    return best;
  }, [event?.date, calendar]);
  // the event before / after: from the shown event, or (on a day with no
  // event) from the picked day
  const target = (dir) => {
    if (index >= 0) return calendar[index + dir] || null;
    if (!day) return null;
    const list = calendar.filter((c) => (dir > 0 ? c.day > day : c.day < day));
    return (dir > 0 ? list[0] : list[list.length - 1]) || null;
  };
  const go = (dir) => {
    const t = target(dir);
    if (t) {
      setDay(t.day);
      setOpenId(null);
    }
  };

  // the calendar: days, with event days lit gold
  const [pickingDay, setPickingDay] = useState(false);
  const dayRef = useRef(null);
  useEffect(() => {
    if (!pickingDay) return undefined;
    const close = (e) => {
      if (!dayRef.current?.contains(e.target)) setPickingDay(false);
    };
    document.addEventListener('pointerdown', close, true);
    return () => document.removeEventListener('pointerdown', close, true);
  }, [pickingDay]);
  const pickDay = (key) => {
    setDay(key);
    setPickingDay(false);
    setOpenId(null);
  };
  const onToggle = useCallback((id) => setOpenId((prev) => (prev === id ? null : id)), []);

  if (error && !board) {
    return (
      <div className="nfl-data-container">
        <p className="noGames">Couldn't load the UFC schedule.</p>
      </div>
    );
  }
  if (!board) {
    return (
      <div className="nfl-data-container loading-background">
        <LoadingField />
      </div>
    );
  }

  const shortTitle = (event?.name || '').split(':')[0] || 'UFC';
  return (
    <ParlayProvider>
      <div className="nfl-data-container">
        <div className="matchup-card fade-in">
          <div className="nflDataNavbar">
            <h1 className="nfl-title sport-title-ufc">
              <span className="nfl-title-badge">UFC</span>
              <span className="nfl-title-text">Stats Guide</span>
            </h1>
            <div className="controls">
              <div className="controls-left">
                <SportSwitcher current="ufc" />
              </div>
              <div className="week-control" ref={dayRef}>
                <button
                  type="button"
                  className="nfl-control-button week-step"
                  aria-label="Previous event"
                  disabled={!target(-1)}
                  onClick={() => go(-1)}
                >
                  ◀
                </button>
                <button
                  type="button"
                  className="nfl-control-button week-button ufc-event-button"
                  title={event?.name}
                  onClick={() => setPickingDay((o) => !o)}
                >
                  <FitText>{event ? shortTitle.replace(/^UFC Fight Night/i, 'FIGHT NIGHT').toUpperCase() : 'NO EVENT'}</FitText>
                </button>
                <button
                  type="button"
                  className="nfl-control-button week-step"
                  aria-label="Next event"
                  disabled={!target(1)}
                  onClick={() => go(1)}
                >
                  ▶
                </button>
                {pickingDay && (
                  <div className="nfl-dropdown-menu week-dropdown league-day-picker">
                    <DayCalendar
                      value={day}
                      onPick={pickDay}
                      onToday={() => pickDay(null)}
                      loadEventDays={getUfcEventDays}
                    />
                  </div>
                )}
              </div>
              <div className="controls-right">
                <button
                  type="button"
                  className={`nfl-control-button hide-games-button ufc-fights-button ${hideMode ? 'active' : ''}`}
                  aria-pressed={hideMode}
                  onClick={() => {
                    setOpenId(null);
                    setHideMode((h) => !h);
                  }}
                >
                  <span className="control-label">FIGHTS</span>
                  <span className="control-count">
                    {visibleCount}/{event?.fights.length || 0}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {event && (
            <div className="ufc-event-head">
              <div className="ufc-event-name">{event.name}</div>
              <div className="ufc-event-meta">
                {timeLabel(event.date)}
                {event.venue ? ` · ${event.venue}` : ''}
                {event.city ? `, ${event.city}` : ''}
              </div>
            </div>
          )}

          <div className={`matchup-container ${openId ? 'has-open' : ''}`}>
            {!event ? (
              <p className="noGames">No UFC event found.</p>
            ) : !sections.length ? (
              <p className="noGames">Every fight is hidden. Tap FIGHTS to bring some back.</p>
            ) : (
              sections.map((section) => (
                <div key={section.key} className={`game-section ${collapsed.has(section.key) ? 'collapsed' : ''}`}>
                  <button
                    type="button"
                    className={`game-section-label ${collapsed.has(section.key) ? 'collapsed' : ''}`}
                    aria-expanded={!collapsed.has(section.key)}
                    onClick={() => toggleSection(section.key, section.fights)}
                  >
                    <span className="game-section-name">
                      {section.label}
                      <span className="gold-caret" aria-hidden="true" />
                    </span>
                    <span className="game-section-count">{section.fights.length}</span>
                  </button>
                  <SlideOpen open={!collapsed.has(section.key)} className="game-section-body">
                    <div className="game-container game-group">
                      <div className="game-group-time">
                        {timeLabel(section.fights[section.fights.length - 1]?.date)}
                      </div>
                      {section.fights.map((fight, i) => (
                        <React.Fragment key={fight.id}>
                          {section.key === 'main' && i === 0 && <div className="ufc-main-event-tag">MAIN EVENT</div>}
                          <FightCard
                            eventId={event.id}
                            fight={fight}
                            details={details.data?.[fight.id]}
                            sectionsReady={Boolean(details.data || details.error)}
                            isOpen={openId === fight.id}
                            onToggle={() => onToggle(fight.id)}
                            hideMode={hideMode}
                            hidden={hiddenSet.has(fight.id)}
                            onToggleHidden={toggleHidden}
                          />
                        </React.Fragment>
                      ))}
                    </div>
                  </SlideOpen>
                </div>
              ))
            )}
          </div>

          {event && <EventModelResults event={event} details={details.data} />}
          <LastUpdated />
          <ParlayBar />
          {hideMode && (
            <button type="button" className="hide-done-bar" onClick={() => setHideMode(false)}>
              DONE
            </button>
          )}
        </div>
      </div>
    </ParlayProvider>
  );
};

export default UfcPage;
