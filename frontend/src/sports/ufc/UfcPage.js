import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import SportSwitcher from '../SportSwitcher';
import SlideOpen from '../../components/NFLDataComponents/shared/SlideOpen';
import LastUpdated from '../../components/NFLDataComponents/shared/LastUpdated';
import TeamsMenu from '../../components/NFLDataComponents/NFLDataNavbar/NFLDataNavbarComponents/TeamsMenu';
import LoadingField from '../../components/NFLDataComponents/shared/LoadingField';
import TeamCell from '../../components/NFLDataComponents/ScoreBug/TeamCell';
import useAsyncData from '../../components/NFLDataComponents/shared/useAsyncData';
import { readCookie, writeCookie } from '../../components/NFLDataComponents/shared/cookies';
import { betReturn } from '../../pages/NFLData/NFLDataApi/picks';
import { fmtOdds, impliedProbability } from '../../pages/NFLData/NFLDataApi/betting';
import { runWithConcurrency } from '../../pages/NFLData/NFLDataApi/http';
import { etDay, getUfcFightDetails, getUfcFighter, getUfcOdds, getUfcScoreboard, headshotUrl } from './ufcApi';
import '../../pages/NFLData/NFLData.scss';
import '../team/TeamSport.scss';
import './Ufc.scss';

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
  iso ? new Date(iso).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' }).toUpperCase() : '';

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

// ---------- the pick: the betting favourite (a lean; UFC isn't backtested) ----------

const fightPick = (fight, odds) => {
  if (!odds) return null;
  const r = odds.byId[fight.red?.id];
  const b = odds.byId[fight.blue?.id];
  if (!r || !b) return null;
  const fav = r <= b ? fight.red : fight.blue;
  const price = r <= b ? r : b;
  return { fighter: fav, price, chance: impliedProbability(price) };
};
// each fighter's chance to win from the moneylines, with the book's margin removed
const winChances = (fight, odds) => {
  const r = odds?.byId[fight.red?.id];
  const b = odds?.byId[fight.blue?.id];
  if (!r || !b) return null;
  const pr = impliedProbability(r);
  const pb = impliedProbability(b);
  if (!pr || !pb) return null;
  return { red: (pr / (pr + pb)) * 100, blue: (pb / (pr + pb)) * 100 };
};
const gradeFight = (fight, pick) => {
  if (!pick || fight.status.state !== 'post') return null;
  if (!fight.red?.winner && !fight.blue?.winner) return 'P'; // draw / no contest
  return pick.fighter.winner ? 'W' : 'L';
};

// ---------- fight card ----------

const TaleRow = ({ label, red, blue }) => (
  <div className="ufc-tape-row">
    <span className="ufc-tape-red">{red || '—'}</span>
    <span className="ufc-tape-label">{label}</span>
    <span className="ufc-tape-blue">{blue || '—'}</span>
  </div>
);

const FightPanel = ({ eventId, fight }) => {
  const final = fight.status.state === 'post';
  const data = useAsyncData(async () => {
    const [red, blue, odds] = await Promise.all([
      fight.red ? getUfcFighter(fight.red.id).catch(() => null) : null,
      fight.blue ? getUfcFighter(fight.blue.id).catch(() => null) : null,
      getUfcOdds(eventId, fight.id, { final }).catch(() => null),
    ]);
    return { red, blue, odds };
  }, [eventId, fight.id, final]);
  if (data.loading && !data.data) return <div className="bet-message">Loading the tale of the tape…</div>;
  const { red, blue, odds } = data.data || {};
  const pick = fightPick(fight, odds);
  const grade = gradeFight(fight, pick);
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
            <div className="ufc-odds-cell" style={{ borderColor: RED }}>
              <span className="ufc-odds-name">{fight.red?.shortName}</span>
              <span className="ufc-odds-price">{fmtOdds(odds.byId[fight.red?.id])}</span>
            </div>
            <div className="ufc-odds-cell" style={{ borderColor: BLUE }}>
              <span className="ufc-odds-name">{fight.blue?.shortName}</span>
              <span className="ufc-odds-price">{fmtOdds(odds.byId[fight.blue?.id])}</span>
            </div>
            {odds.rounds !== null && (
              <div className="ufc-odds-cell">
                <span className="ufc-odds-name">ROUNDS O/U</span>
                <span className="ufc-odds-price">{odds.rounds}</span>
              </div>
            )}
          </div>
          {pick && (
            <div className="pick-lines">
              <div className="pick-line lean">
                <span className="pick-title-row">
                  <span className="pick-kind lean">LEAN</span>
                  <span className="pick-headline">{pick.fighter.name.toUpperCase()} TO WIN</span>
                </span>
                <span className="pick-because">
                  Lean the betting favorite: about {Math.round(pick.chance)}% to win at {fmtOdds(pick.price)}. There's
                  no UFC model yet, so this is a lean, not a bet.
                </span>
                <span className="pick-odds">ML {fmtOdds(pick.price)}</span>
                {(grade === 'W' || grade === 'L') && (
                  <span className={`pick-result ${grade === 'W' ? 'right' : 'wrong'}`} />
                )}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="bet-message small">No odds posted for this fight.</div>
      )}
    </div>
  );
};

const FightCard = ({ eventId, fight, details, odds, isOpen, onToggle }) => {
  const { state } = fight.status;
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
  // before and during the fight: each fighter's chance to win, from the odds
  const chances = state === 'post' ? null : winChances(fight, odds);
  const cellScore = (corner) => (chances ? `${Math.round(chances[corner])}%` : score(fight[corner]));

  return (
    <div className={`game-slot ufc-fight ${isOpen ? 'open' : ''}`} style={{ '--ring-away': RED, '--ring-home': BLUE }}>
      <span className="game-ring" aria-hidden="true" />
      <div className="game-slot-body">
        <div className="game-slot-content">
          <div className="score-grid ufc-grid" onClick={onToggle}>
            <TeamCell
              side="away"
              competitor={asCompetitor(fight.red, RED)}
              score={cellScore('red')}
              scoreIsSpread={Boolean(chances)}
              subScore={chances ? 'WIN PROB' : null}
              isWinner={fight.red?.winner}
              corner="top"
              expanded={isOpen}
            />
            <TeamCell
              side="home"
              competitor={asCompetitor(fight.blue, BLUE)}
              score={cellScore('blue')}
              scoreIsSpread={Boolean(chances)}
              subScore={chances ? 'WIN PROB' : null}
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
            <div ref={innerRef}>{hasOpened && <FightPanel eventId={eventId} fight={fight} />}</div>
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

const EventModelResults = ({ event }) => {
  const [open, setOpen] = useState(false);
  const finished = useMemo(() => event.fights.filter((f) => f.status.state === 'post'), [event]);
  const graded = useAsyncData(
    async () => {
      const results = await runWithConcurrency(
        finished.map((fight) => async () => {
          const odds = await getUfcOdds(event.id, fight.id, { final: true }).catch(() => null);
          const pick = fightPick(fight, odds);
          const result = gradeFight(fight, pick);
          return pick && result ? { result, price: pick.price } : null;
        }),
        4,
      );
      return results.map((r) => (r.ok ? r.value : null)).filter(Boolean);
    },
    [event.id, finished.length],
    { enabled: open && finished.length > 0 },
  );
  const rec = (graded.data || []).reduce(
    (a, g) => ({
      W: a.W + (g.result === 'W' ? 1 : 0),
      L: a.L + (g.result === 'L' ? 1 : 0),
      profit: a.profit + betReturn(10, g.price, g.result) - 10,
    }),
    { W: 0, L: 0, profit: 0 },
  );
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
            <div className="prediction-record-title">FAVORITES · $10 EACH</div>
            {!finished.length ? (
              <div className="prediction-record-loading">No finished fights on this card yet.</div>
            ) : !graded.data ? (
              <div className="prediction-record-loading">Grading the card…</div>
            ) : (
              <>
                <div className="season-row total">
                  <span>Moneyline</span>
                  <span className="prediction-record-wl">
                    {rec.W}-{rec.L}
                  </span>
                  <span className="prediction-record-pct">
                    {rec.W + rec.L ? `${Math.round((rec.W / (rec.W + rec.L)) * 100)}%` : '—'}
                  </span>
                  <span className={`bet-return ${tone(rec.profit)}`}>{signed(rec.profit)}</span>
                </div>
                <div className="league-model-note">
                  Each fight's pick is the betting favorite. There's no UFC model yet, so these are leans, not bets.
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

  useEffect(() => {
    let active = true;
    getUfcScoreboard(day, { live: refresh > 0 })
      .then((data) => {
        if (!active) return;
        setBoard(data);
        setError(null);
        if (data.calendar.length) setCalendar(data.calendar);
        if (!day && data.event?.date) setDay(etDay(data.event.date));
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

  // every fight's odds up front, for the win chances on the cards
  const allOdds = useAsyncData(
    async () => {
      const list = await runWithConcurrency(
        event.fights.map((f) => async () => [
          f.id,
          await getUfcOdds(event.id, f.id, { final: f.status.state === 'post' }).catch(() => null),
        ]),
        4,
      );
      return Object.fromEntries(list.filter((r) => r.ok).map((r) => r.value));
    },
    [event?.id],
    { enabled: Boolean(event) },
  );

  // ---- FIGHTERS filter: every fighter on this card, main event first ----
  const fighters = useMemo(
    () =>
      event
        ? [...event.fights]
            .sort((a, b) => b.order - a.order)
            .flatMap((f) => [
              f.red && { ...asCompetitor(f.red, RED).team, id: f.red.id },
              f.blue && { ...asCompetitor(f.blue, BLUE).team, id: f.blue.id },
            ])
            .filter(Boolean)
        : [],
    [event],
  );
  const allFighterIds = useMemo(() => fighters.map((f) => f.id), [fighters]);
  const [fighterPicks, setFighterPicks] = useState({}); // event id -> picked fighter ids
  const pickedFighters = (event && fighterPicks[event.id]) || allFighterIds;
  const setPicked = (ids) => event && setFighterPicks((m) => ({ ...m, [event.id]: ids }));
  const [fightersOpen, setFightersOpen] = useState(false);
  const fightersRef = useRef(null);
  useEffect(() => {
    if (!fightersOpen) return undefined;
    const close = (e) => {
      if (!fightersRef.current?.contains(e.target)) setFightersOpen(false);
    };
    document.addEventListener('pointerdown', close, true);
    return () => document.removeEventListener('pointerdown', close, true);
  }, [fightersOpen]);
  const shownFights = useMemo(() => {
    if (!event) return [];
    const picked = new Set(pickedFighters);
    return event.fights.filter((f) => picked.has(f.red?.id) || picked.has(f.blue?.id));
  }, [event, pickedFighters]);

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
  useEffect(() => {
    const v = cookieName ? readCookie(cookieName) : null;
    setSavedCollapsed(v === null ? null : new Set(v.split(',').filter((k) => k && k !== 'none')));
  }, [cookieName]);
  const collapsed = savedCollapsed || new Set(sections.map((s) => s.key).filter((k) => k !== 'main'));
  const toggleSection = (key, fights) => {
    const next = new Set(collapsed);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSavedCollapsed(next);
    writeCookie(cookieName, next.size ? [...next].join(',') : 'none');
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
  const go = (dir) => {
    const target = calendar[index + dir];
    if (target) {
      setDay(target.day);
      setOpenId(null);
    }
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
    <div className="nfl-data-container">
      <div className="matchup-card fade-in">
        <div className="nflDataNavbar">
          <h1 className="nfl-title">
            <span className="nfl-title-badge">UFC</span>
            <span className="nfl-title-text">Stats Guide</span>
          </h1>
          <div className="controls">
            <div className="controls-left">
              <SportSwitcher current="ufc" />
              <div className="teams-dropdown-wrapper" ref={fightersRef}>
                <button type="button" className="nfl-control-button" onClick={() => setFightersOpen((o) => !o)}>
                  <span className="control-label">FIGHTERS</span>
                  <span className="control-count">
                    {pickedFighters.filter((id) => allFighterIds.includes(id)).length}/{allFighterIds.length}
                  </span>
                </button>
                {fightersOpen && (
                  <div className="nfl-dropdown-menu ufc-fighters-menu">
                    <TeamsMenu
                      teams={fighters}
                      selectedTeams={pickedFighters}
                      onTeamChange={(id) =>
                        setPicked(
                          pickedFighters.includes(id)
                            ? pickedFighters.filter((x) => x !== id)
                            : [...pickedFighters, id],
                        )
                      }
                      onSelectAll={() => setPicked(allFighterIds)}
                      onDeselectAll={() => setPicked([])}
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="week-control">
              <button
                type="button"
                className="nfl-control-button week-step"
                aria-label="Previous event"
                disabled={index <= 0}
                onClick={() => go(-1)}
              >
                ◀
              </button>
              <button type="button" className="nfl-control-button week-button ufc-event-button" title={event?.name}>
                {shortTitle.replace(/^UFC Fight Night/i, 'FIGHT NIGHT').toUpperCase()}
              </button>
              <button
                type="button"
                className="nfl-control-button week-step"
                aria-label="Next event"
                disabled={index < 0 || index >= calendar.length - 1}
                onClick={() => go(1)}
              >
                ▶
              </button>
            </div>
            <div className="nfl-control-button hide-games-button ufc-fights-count">
              <span className="control-label">FIGHTS</span>
              <span className="control-count">
                {shownFights.length}/{event?.fights.length || 0}
              </span>
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
            <p className="noGames">No fights for the picked fighters.</p>
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
                    <div className="game-group-time">{timeLabel(section.fights[section.fights.length - 1]?.date)}</div>
                    {section.fights.map((fight, i) => (
                      <React.Fragment key={fight.id}>
                        {section.key === 'main' && i === 0 && <div className="ufc-main-event-tag">MAIN EVENT</div>}
                        <FightCard
                          eventId={event.id}
                          fight={fight}
                          details={details.data?.[fight.id]}
                          odds={allOdds.data?.[fight.id]}
                          isOpen={openId === fight.id}
                          onToggle={() => onToggle(fight.id)}
                        />
                      </React.Fragment>
                    ))}
                  </div>
                </SlideOpen>
              </div>
            ))
          )}
        </div>

        {event && <EventModelResults event={event} />}
        <LastUpdated />
      </div>
    </div>
  );
};

export default UfcPage;
