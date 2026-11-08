import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import usePersistentState from './usePersistentState';
import { useLongPress } from '../ScoreBug/TeamCell';

// Parlay slip shared by every game card. Legs are saved in localStorage.
// A leg: { id, market, gameId, matchup, label, detail, odds, link }, where link is the
// DraftKings bet-slip link ({ url, eventId, outcome }) or null.

const ParlayContext = createContext(null);

export const ParlayProvider = ({ children }) => {
  const [storedLegs, setLegs] = usePersistentState('parlayLegs', []);
  // Drop legs saved in older formats (FanDuel links, or the first DraftKings version).
  const legs = useMemo(() => storedLegs.filter((l) => !('dkOutcome' in l) && !l.link?.marketId), [storedLegs]);

  const toggle = useCallback(
    (leg) =>
      setLegs((prev) => {
        if (prev.some((l) => l.id === leg.id)) return prev.filter((l) => l.id !== leg.id);
        // A new pick on the same market (e.g. the other side) replaces the old one.
        return [...prev.filter((l) => !(leg.market && l.market === leg.market)), leg];
      }),
    [setLegs]
  );
  const remove = useCallback((id) => setLegs((prev) => prev.filter((l) => l.id !== id)), [setLegs]);
  const clear = useCallback(() => setLegs([]), [setLegs]);

  const value = useMemo(() => {
    const ids = new Set(legs.map((l) => l.id));
    return { legs, has: (id) => ids.has(id), toggle, remove, clear };
  }, [legs, toggle, remove, clear]);

  return <ParlayContext.Provider value={value}>{children}</ParlayContext.Provider>;
};

const NO_PARLAY = { legs: [], has: () => false, toggle: () => {}, remove: () => {}, clear: () => {} };
export const useParlay = () => useContext(ParlayContext) || NO_PARLAY;

const HOLD_MS = 450;

// Wraps a pick: press and hold to add it to (or remove it from) the parlay.
// Selected picks get a gold background; a gold fill grows while holding.
export const Holdable = ({ leg, as: Tag = 'div', className = '', children, ...rest }) => {
  const { has, toggle } = useParlay();
  const [holding, setHolding] = useState(false);
  const legRef = useRef(leg);
  legRef.current = leg;

  const longPress = useLongPress(() => {
    setHolding(false);
    if (!legRef.current) return;
    toggle(legRef.current);
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15);
  }, HOLD_MS);

  if (!leg) return <Tag className={className} {...rest}>{children}</Tag>;

  const stop = () => {
    setHolding(false);
    longPress.clear();
  };

  return (
    <Tag
      className={`${className} holdable ${has(leg.id) ? 'selected' : ''} ${holding ? 'holding' : ''}`}
      onPointerDown={() => {
        setHolding(true);
        longPress.start();
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onClickCapture={longPress.suppressClick}
      onContextMenu={(e) => e.preventDefault()}
      title="Hold to add to your parlay"
      {...rest}
    >
      {children}
    </Tag>
  );
};
