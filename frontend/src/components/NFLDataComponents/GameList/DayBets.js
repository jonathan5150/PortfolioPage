import React, { useMemo, useState } from 'react';
import useAsyncData from '../shared/useAsyncData';
import SlideOpen from '../shared/SlideOpen';
import { runWithConcurrency } from '../../../pages/NFLData/NFLDataApi/http';
import { betReturn } from '../../../pages/NFLData/NFLDataApi/picks';
import { fmtOdds } from '../../../pages/NFLData/NFLDataApi/betting';
import { ticketsFor } from '../../../pages/NFLData/NFLDataApi/modelGrading';

// SHOW CONFIDENT BETS: just the picks strong enough to bet (the gold-bordered
// ones), for the games on screen, with each day's record and profit at a flat
// $100 a bet. Sits above SHOW MODEL RESULTS and is styled the same.
//
// items: [{ id, date, matchup, state }] (state: 'pre' | 'in' | 'post')
// loadTickets(item) -> [{ key, label, price, result, bet }] (result null until final)
const STAKE = 100;

const money = (n) => `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const signedMoney = (n) => `${n > 0.004 ? '+' : n < -0.004 ? '-' : ''}${money(n)}`;
const tone = (n) => (n > 0.004 ? 'up' : n < -0.004 ? 'down' : 'even');
const dayKey = (date) => new Date(date).toDateString();
const dayLabel = (date) =>
  new Date(date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();

const STATUS = { W: 'WON', L: 'LOST', P: 'PUSH' };
const statusOf = (bet, item) =>
  STATUS[bet.result] ||
  (item.state === 'in'
    ? 'LIVE'
    : item.date
      ? new Date(item.date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
      : 'SOON');

// record and profit for a list of bets; pending ones are only counted
const summarize = (bets) =>
  bets.reduce(
    (acc, b) => {
      if (!b.result) return { ...acc, pending: acc.pending + 1 };
      const back = betReturn(STAKE, b.price, b.result);
      return { ...acc, [b.result]: acc[b.result] + 1, profit: acc.profit + back - STAKE };
    },
    { W: 0, L: 0, P: 0, pending: 0, profit: 0 },
  );

// NFL / NBA / MLB games as items, and a stable ticket loader per league
export const asBetItems = (games) =>
  (games || []).map((game) => ({
    id: game.id,
    date: game.date,
    state: game.status?.state,
    matchup: `${game.away?.team?.abbreviation || 'AWAY'} @ ${game.home?.team?.abbreviation || 'HOME'}`,
    game,
  }));
const loaders = {};
export const leagueTicketLoader = (lg) => {
  if (!loaders[lg]) loaders[lg] = (item) => ticketsFor(lg, item.game);
  return loaders[lg];
};

const recordText = ({ W, L, P }) => `${W}-${L}${P ? `-${P}` : ''}`;

const Summary = ({ label, sum }) => (
  <div className="bet-row bet-total day-bets-summary">
    <span>
      {label} · {recordText(sum)}
      {sum.pending ? <span className="day-bets-pending"> · {sum.pending} TO PLAY</span> : null}
    </span>
    <span className={`bet-return ${tone(sum.profit)}`}>{signedMoney(sum.profit)}</span>
  </div>
);

const DayBets = ({ items, loadTickets, period = 'DAY', note = null }) => {
  const [open, setOpen] = useState(false);
  const ids = items.map((i) => `${i.id}:${i.state}`).join(',');
  const loaded = useAsyncData(
    async () => {
      const results = await runWithConcurrency(
        items.map((item) => () => loadTickets(item)),
        3,
      );
      return items
        .map((item, i) => ({ item, bets: (results[i].ok ? results[i].value || [] : []).filter((t) => t.bet) }))
        .filter((g) => g.bets.length);
    },
    [ids, loadTickets],
    { enabled: open && items.length > 0 },
  );

  // grouped by day, earliest first
  const days = useMemo(() => {
    const out = [];
    [...(loaded.data || [])]
      .sort((a, b) => new Date(a.item.date || 0) - new Date(b.item.date || 0))
      .forEach((g) => {
        const key = dayKey(g.item.date);
        let day = out[out.length - 1];
        if (!day || day.key !== key) {
          day = { key, label: dayLabel(g.item.date), games: [] };
          out.push(day);
        }
        day.games.push(g);
      });
    return out.map((d) => ({ ...d, sum: summarize(d.games.flatMap((g) => g.bets)) }));
  }, [loaded.data]);
  const all = summarize(days.flatMap((d) => d.games.flatMap((g) => g.bets)));
  const word = period.toLowerCase();

  return (
    <div className="gold-box prediction-record-outer day-bets">
      <div className="prediction-record">
        <button
          type="button"
          className={`bet-results-toggle gold-box-text ${open ? 'open' : ''}`}
          onClick={() => setOpen((o) => !o)}
        >
          <span className="game-section-name">
            {open ? 'HIDE CONFIDENT BETS' : 'SHOW CONFIDENT BETS'}
            <span className="gold-caret" aria-hidden="true" />
          </span>
        </button>
        <SlideOpen open={open} className="model-results-body">
          <div className="model-results-content">
            <div className="prediction-record-title">PICKS STRONG ENOUGH TO BET · ${STAKE} EACH</div>
            {!items.length ? (
              <div className="prediction-record-loading">Nothing on this {word} yet.</div>
            ) : !loaded.data ? (
              <div className="prediction-record-loading">Checking this {word}'s picks…</div>
            ) : !days.length ? (
              <div className="prediction-record-loading">
                Nothing strong enough to bet this {word}. Leans are on each game's LINES tab.
              </div>
            ) : (
              <>
                <div className="bet-row bet-head">
                  <span>BET</span>
                  <span>ODDS</span>
                  <span>STATUS</span>
                  <span>RETURN</span>
                </div>
                {days.map((day) => (
                  <div key={day.key} className="bet-day">
                    <div className="bet-day-label">{day.label}</div>
                    {day.games.map(({ item, bets }) => (
                      <div key={item.id} className="bet-game">
                        <div className="bet-game-label">{item.matchup}</div>
                        {bets.map((b) => (
                          <div key={b.key} className="bet-row">
                            <span className="bet-label">{b.label}</span>
                            <span>{fmtOdds(b.price)}</span>
                            <span className={`day-bets-status ${b.result || 'open'}`}>{statusOf(b, item)}</span>
                            <span className={`bet-return ${b.result ? tone(betReturn(STAKE, b.price, b.result) - STAKE) : ''}`}>
                              {b.result ? money(betReturn(STAKE, b.price, b.result)) : '—'}
                            </span>
                          </div>
                        ))}
                      </div>
                    ))}
                    <Summary label={`${day.label} RECORD`} sum={day.sum} />
                  </div>
                ))}
                {days.length > 1 && <Summary label={`${period} RECORD`} sum={all} />}
              </>
            )}
            {note && <div className="league-model-note">{note}</div>}
          </div>
        </SlideOpen>
      </div>
    </div>
  );
};

export default DayBets;
