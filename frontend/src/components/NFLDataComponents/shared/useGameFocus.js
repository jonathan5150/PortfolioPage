import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { getTeamRingColors } from './teamColors';
import { holdBackgroundWork } from './useBackgroundPrefetch';
import { isLowQuality } from './graphicsQuality';
import { DETAILS_MS } from './detailsTiming';
import { setMoving } from './motionGate';

// What happens around an open game on every sports page (NFL, NBA, MLB, UFC).
// The fading of everything else is CSS (.game-focus, see NFLData.scss); this
// does the rest:
//  - the site's background lines take the open game's two colours (away on one
//    set of lines, home on the other), fading back to gold when it closes
//  - a tap below the open game closes it (its own team cells toggle it too)
//  - the game slides up to the top of the scrolling box (panelRef, just under
//    the pinned header), and closing it slides the box back to where it was
//  - once it's at the top, everything else (already faded out) is taken out
//    of the list (.focus-only), so the list holds just that game: it doesn't
//    scroll at all if the game fits on the screen, and scrolls the whole game
//    natively, stopping at its real ends, if it's taller. Nothing is held in
//    place by code, so there's no bounce. Taking things out and putting them
//    back keeps the game exactly where it is on screen, so nothing jumps.
//  - only then do its details unfold (.focus-details), and they fold away
//    before everything else comes back: unfolding while the whole list was
//    there made a weak phone lay out and redraw all of it every frame
// Returns focusSpace: true while the box needs room at its end (so even the
// last game can reach the top), kept until the slide back has finished.

// A team's colour for the background lines: its border colour made vivid
// enough for thin lines on black (see below). Takes any colour ('#b3262b' or
// 'rgb(...)'/'rgba(...)').
export const lineColorFrom = (color) => {
  const hex = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(color || '');
  const [r, g, b] = hex
    ? hex.slice(1).map((h) => parseInt(h, 16))
    : ((color || '').match(/[\d.]+/g) || [245, 209, 107]).map(Number);
  // vivid but readable on black: the team's hue, more saturated, at a
  // brightness that shows up as thin lines (dark navies and blacks lifted,
  // nothing so light it turns pastel)
  const [h, s, l] = toHsl(r / 255, g / 255, b / 255);
  const sat = Math.min(1, s * 1.3 + 0.12);
  const light = Math.min(0.66, Math.max(0.56, l));
  return `hsl(${Math.round(h * 360)}, ${Math.round(sat * 100)}%, ${Math.round(light * 100)}%)`;
};

const toHsl = (r, g, b) => {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) / 6 : max === g ? ((b - r) / d + 2) / 6 : ((r - g) / d + 4) / 6;
  return [h, s, l];
};

export const teamLineColor = (team) => lineColorFrom(getTeamRingColors(team)[0]);

const SLIDE_MS = 800; // the longest slide up (slideUpMs)
const FADE_MS = 580; // everything else fades out in 0.55s (NFLData.scss)
const FOLD_MS = DETAILS_MS + 30; // an open game's details fold away (detailsTiming), then the rest comes back
const GAP = 8; // space between the top of the box and the open game

// The slides, done here rather than by the browser's own smooth scroll (about
// 0.4s up, too quick to watch): opening glides the game up to the top in about
// 0.5-0.8s, and closing glides the list back to where it was in about
// 0.6-1.1s. Longer for longer distances, within limits.
const slideUpMs = (distance) => Math.min(SLIDE_MS, 480 + Math.abs(distance) * 0.25);
const slideBackMs = (distance) => Math.min(1080, 620 + Math.abs(distance) * 0.38);
const easeInOut = (p) => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2);

const useGameFocus = ({ openKey, lineA, lineB, onClose, panelRef }) => {
  const isOpen = Boolean(openKey);

  // ---- the background lines ----
  // Two sets of lines are stacked: gold and team-coloured. Opening a game
  // fades the team set in over the gold (only its opacity changes, which the
  // phone's GPU does without redrawing anything); closing fades it back out.
  // Its colours stay put while it fades out, so it never flashes gold. Set on
  // the background itself, not the whole page: a colour set on the page is
  // passed down to everything on it, which made the phone restyle every
  // element at the moment a game opened or closed.
  useEffect(() => {
    const bg = document.querySelector('.site-background');
    if (!bg) return;
    if (isOpen && lineA && lineB) {
      bg.style.setProperty('--bg-team-a', lineA);
      bg.style.setProperty('--bg-team-b', lineB);
      bg.classList.add('team-on');
    } else {
      bg.classList.remove('team-on');
    }
  }, [isOpen, lineA, lineB]);
  // leaving the page puts them back to gold
  useEffect(() => () => document.querySelector('.site-background')?.classList.remove('team-on'), []);

  // ---- tap below the game to close ----
  // Only the empty background below the open game closes it (its own score
  // area toggles it too). Nothing above its bottom edge does - not the header,
  // not the faded-out space above it - so a tap there is never mistaken for a
  // tap on the background. The parlay slip and DONE bar never close it.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!isOpen) return undefined;
    const closeOnTapBelow = (e) => {
      if (e.target.closest?.('.game-slot.open, .parlay-bar, .hide-done-bar')) return;
      const slot = document.querySelector('.game-slot.open');
      if (!slot || e.clientY <= slot.getBoundingClientRect().bottom) return;
      closeRef.current();
    };
    document.addEventListener('click', closeOnTapBelow, true);
    return () => document.removeEventListener('click', closeOnTapBelow, true);
  }, [isOpen]);

  // ---- slide up, just the game, slide back ----
  const returnTo = useRef(null);
  const target = useRef(null); // the open game's slot (marked data-focus-target: an attribute, as React rewrites its class list when it closes)
  const [focusSpace, setFocusSpace] = useState(false);
  // layout effect: the list is changed before the screen is drawn, so taking
  // things out or putting them back never shows a frame out of place
  useLayoutEffect(() => {
    const box = panelRef.current;
    if (!box) return undefined;
    const low = isLowQuality();
    // No scrolling by hand while the game slides (a scroll mid-slide fights
    // it). Done by refusing the gesture rather than switching the box's
    // scrolling off: switching that off and on made the phone redraw the whole
    // list each time, which showed as a flash.
    const blockWheel = (e) => e.preventDefault();
    const lock = () => {
      setMoving(true);
      box.classList.add('focus-sliding');
      box.addEventListener('wheel', blockWheel, { passive: false });
    };
    const unlock = () => {
      setMoving(false);
      box.classList.remove('focus-sliding');
      box.removeEventListener('wheel', blockWheel);
    };
    // keeps the game's spot on screen while things are taken out / put back
    const keepingPlace = (slot, change) => {
      const before = slot.getBoundingClientRect().top;
      change();
      box.scrollTop += slot.getBoundingClientRect().top - before;
    };
    const timers = [];
    const later = (fn, ms) => timers.push(setTimeout(fn, ms));
    let frame = 0;
    // glides the box to top over duration(distance) ms, then runs done
    const slideTo = (top, duration, done) => {
      const from = box.scrollTop;
      const distance = top - from;
      const ms = duration(distance);
      const startedAt = performance.now();
      const step = (now) => {
        const p = Math.min(1, (now - startedAt) / ms);
        box.scrollTop = from + distance * easeInOut(p);
        if (p < 1) frame = requestAnimationFrame(step);
        else {
          frame = 0;
          done();
        }
      };
      frame = requestAnimationFrame(step);
    };
    const cleanup = () => {
      timers.forEach(clearTimeout);
      cancelAnimationFrame(frame);
      unlock();
    };

    if (isOpen) {
      holdBackgroundWork(SLIDE_MS + 1000);
      if (returnTo.current === null) returnTo.current = box.scrollTop;
      setFocusSpace(true);
      lock();
      const startedAt = performance.now();
      // At the top: just the game stays in the list, which then scrolls it
      // natively, and its details unfold (cheap now, with nothing else in the
      // list to lay out again). Never before the rest has finished fading
      // out, so nothing vanishes while it can still be seen.
      const settle = () => {
        const wait = low ? 0 : FADE_MS - (performance.now() - startedAt);
        if (wait > 0) {
          later(settle, wait);
          return;
        }
        const slot = box.querySelector('.game-slot.open');
        if (!slot) return;
        slot.setAttribute('data-focus-target', '');
        target.current = slot;
        keepingPlace(slot, () => box.classList.add('focus-only'));
        // Data that came in during the slide is drawn now, while nothing
        // moves, and the details unfold two frames later, once that's done:
        // drawing it (and restyling the page for .focus-details) in the
        // unfold's first frames made a phone stall just as it began.
        // Anything newer waits until the details have unfolded.
        unlock();
        setMoving(true);
        frame = requestAnimationFrame(() => {
          frame = requestAnimationFrame(() => {
            frame = 0;
            box.classList.add('focus-details');
            later(() => setMoving(false), DETAILS_MS + 50);
          });
        });
      };
      later(() => {
        const slot = box.querySelector('.game-slot.open');
        if (!slot) return;
        const top = Math.max(
          0,
          Math.round(box.scrollTop + slot.getBoundingClientRect().top - box.getBoundingClientRect().top - GAP),
        );
        if (Math.abs(top - box.scrollTop) < 2) {
          settle();
          return;
        }
        if (low) {
          box.scrollTop = top;
          settle();
          return;
        }
        slideTo(top, slideUpMs, settle);
      }, 30);
      return cleanup;
    }

    // Closing. The game's details first fold away while it's still the only
    // thing in the list (cheap), then everything else is put back
    // faded out (.focus-fading) and let go, so it fades in together instead of
    // popping in at full strength (something that wasn't on the page has
    // nothing to fade from); the game keeps its spot on screen meanwhile. Then
    // the box glides back to where it was.
    if (returnTo.current === null) return undefined;
    holdBackgroundWork(FOLD_MS + 1080 + 900);
    const back = returnTo.current;
    lock();
    const wasFocused = Boolean(target.current) && box.classList.contains('focus-details');
    box.classList.remove('focus-details');
    const restore = () => {
      const slot = target.current;
      if (slot && box.classList.contains('focus-only')) {
        box.classList.add('focus-fading');
        // measuring (in keepingPlace) settles the faded look before it's let go
        keepingPlace(slot, () => box.classList.remove('focus-only'));
      }
      box.classList.remove('focus-only', 'focus-fading');
      if (slot) slot.removeAttribute('data-focus-target');
      target.current = null;
      returnTo.current = null;
      const done = () => {
        box.scrollTop = back;
        unlock();
        later(() => setFocusSpace(false), 100);
      };
      if (Math.abs(back - box.scrollTop) < 2) {
        later(done, low ? 0 : FADE_MS);
        return;
      }
      if (low) {
        box.scrollTop = back;
        done();
        return;
      }
      slideTo(back, slideBackMs, done);
    };
    if (wasFocused && !low) later(restore, FOLD_MS);
    else restore();
    return cleanup;
  }, [isOpen, openKey, panelRef]);

  return { focusSpace };
};

export default useGameFocus;
