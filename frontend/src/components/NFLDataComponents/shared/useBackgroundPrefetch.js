import { useEffect, useRef } from 'react';
import { networkBusy } from '../../../pages/NFLData/NFLDataApi/http';

// Quietly loads what each game's BOX SCORE and LINES tabs (and UFC's fight
// panel) need, in the background, so tapping a game usually shows them right
// away instead of a loading message. The loaders all go through the shared
// request cache (http.js), so a later load of the same thing is instant.
//
// Gentle on a slow phone:
//  - starts only once the page has settled, then runs one load at a time, each
//    in a moment the phone is idle, with a pause between them
//  - waits while the list is being scrolled, and while the page isn't on screen
//  - doesn't run at all with data saver on or on a 2G connection
//  - paused: true holds it (pages pass that while a game is open and there are
//    live games; with no live games it carries on even with a game open)
//  - waits until no other request is going, so a game the user just opened
//    never waits behind it
//  - nothing is loaded twice within a few minutes, even across pages; while
//    the page stays open it checks again every few minutes, so things stay
//    ready (anything still fresh in the cache costs nothing)
//
// tasks: [{ key, run }] in the order to load them (see each page: box scores
// of finished games come before the rest of the finished games' data). Never include the touchdown scorer odds: they're
// costly, so they still wait for the user to open them.

const START_AFTER_MS = 2500;
const BETWEEN_MS = 120;
const SCROLL_QUIET_MS = 900;
const FRESH_MS = 3 * 60 * 1000;
const RECHECK_MS = 60 * 1000;

const doneAt = new Map(); // key -> when it was loaded

let lastScroll = 0;
if (typeof window !== 'undefined') {
  window.addEventListener(
    'scroll',
    () => {
      lastScroll = Date.now();
    },
    { capture: true, passive: true },
  );
}

const slowOrSaving = () => {
  const c = typeof navigator !== 'undefined' ? navigator.connection : null;
  return Boolean(c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || '')));
};

const idle = (fn) =>
  typeof window.requestIdleCallback === 'function'
    ? window.requestIdleCallback(fn, { timeout: 2000 })
    : setTimeout(fn, 200);
const cancelIdle = (id) =>
  typeof window.cancelIdleCallback === 'function' ? window.cancelIdleCallback(id) : clearTimeout(id);

const useBackgroundPrefetch = (tasks, { paused = false } = {}) => {
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;
  const signature = tasks.map((t) => t.key).join('|');

  useEffect(() => {
    if (!tasks.length || slowOrSaving()) return undefined;
    let active = true;
    let timer = null;
    let idleId = null;
    const stale = () => tasksRef.current.filter((t) => !(doneAt.get(t.key) > Date.now() - FRESH_MS));
    let queue = stale();

    const next = () => {
      if (!active) return;
      // everything's loaded: look again in a minute for anything gone stale
      if (!queue.length) {
        timer = setTimeout(() => {
          queue = stale();
          next();
        }, RECHECK_MS);
        return;
      }
      // hold off while scrolling, hidden, paused, or while other requests are
      // going (the user's come first); check again shortly
      if (pausedRef.current || document.hidden || networkBusy() || Date.now() - lastScroll < SCROLL_QUIET_MS) {
        timer = setTimeout(next, 400);
        return;
      }
      idleId = idle(async () => {
        if (!active) return;
        const task = queue.shift();
        try {
          await task.run();
          doneAt.set(task.key, Date.now());
        } catch {
          // a failed background load just means the tab loads it when opened
        }
        if (active) timer = setTimeout(next, BETWEEN_MS);
      });
    };
    timer = setTimeout(next, START_AFTER_MS);
    return () => {
      active = false;
      clearTimeout(timer);
      if (idleId !== null) cancelIdle(idleId);
    };
    // the task list is rebuilt every render; restart only when it really changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);
};

// Live games first, then upcoming, then finished.
const ORDER = { in: 0, pre: 1, post: 2 };
export const byPriority = (games, stateOf = (g) => g.status?.state) =>
  [...games].sort((a, b) => (ORDER[stateOf(a)] ?? 1) - (ORDER[stateOf(b)] ?? 1));

export default useBackgroundPrefetch;
