import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { getTeamRingColors } from './teamColors';
import { holdBackgroundWork } from './useBackgroundPrefetch';
import { isLowQuality } from './graphicsQuality';

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

const SLIDE_MS = 700;
const GAP = 8; // space between the top of the box and the open game

const useGameFocus = ({ openKey, lineA, lineB, onClose, panelRef }) => {
  const isOpen = Boolean(openKey);

  // ---- the background lines ----
  // Two sets of lines are stacked: gold and team-coloured. Opening a game
  // fades the team set in over the gold (only its opacity changes, which the
  // phone's GPU does without redrawing anything); closing fades it back out.
  // Its colours stay put while it fades out, so it never flashes gold.
  useEffect(() => {
    const root = document.documentElement.style;
    if (isOpen && lineA && lineB) {
      root.setProperty('--bg-team-a', lineA);
      root.setProperty('--bg-team-b', lineB);
      root.setProperty('--bg-team-on', '1');
    } else {
      root.setProperty('--bg-team-on', '0');
    }
  }, [isOpen, lineA, lineB]);
  // leaving the page puts them back to gold
  useEffect(() => () => document.documentElement.style.setProperty('--bg-team-on', '0'), []);

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

  // ---- the top fade ----
  // Once the list has been scrolled, what reaches the top of the scrolling box
  // fades out just under the header (.scrolled, see NFLData.scss); at the very
  // top nothing is faded.
  useEffect(() => {
    const box = panelRef.current;
    if (!box) return undefined;
    const mark = () => box.classList.toggle('scrolled', box.scrollTop > 2);
    mark();
    box.addEventListener('scroll', mark, { passive: true });
    return () => box.removeEventListener('scroll', mark);
  }, [panelRef]);

  // ---- slide up, just the game, slide back ----
  const returnTo = useRef(null);
  const target = useRef(null); // the open game's slot (marked .focus-target)
  const [focusSpace, setFocusSpace] = useState(false);
  // layout effect: the list is changed before the screen is drawn, so taking
  // things out or putting them back never shows a frame out of place
  useLayoutEffect(() => {
    const box = panelRef.current;
    if (!box) return undefined;
    const behavior = isLowQuality() ? 'auto' : 'smooth';
    // keeps the game's spot on screen while things are taken out / put back
    const keepingPlace = (slot, change) => {
      const before = slot.getBoundingClientRect().top;
      change();
      box.scrollTop += slot.getBoundingClientRect().top - before;
    };

    if (isOpen) {
      holdBackgroundWork(SLIDE_MS + 500);
      if (returnTo.current === null) returnTo.current = box.scrollTop;
      setFocusSpace(true);
      // no scrolling by hand during the slide (a scroll mid-slide fights it)
      box.style.overflowY = 'hidden';
      const slide = setTimeout(() => {
        const slot = box.querySelector('.game-slot.open');
        if (!slot) return;
        const top = box.scrollTop + slot.getBoundingClientRect().top - box.getBoundingClientRect().top - GAP;
        box.scrollTo({ top, behavior });
      }, 30);
      // at the top: just the game stays in the list, which scrolls natively again
      const settle = setTimeout(
        () => {
          const slot = box.querySelector('.game-slot.open');
          if (!slot) return;
          slot.classList.add('focus-target');
          target.current = slot;
          keepingPlace(slot, () => box.classList.add('focus-only'));
          box.style.overflowY = '';
        },
        behavior === 'smooth' ? SLIDE_MS : 60,
      );
      return () => {
        clearTimeout(slide);
        clearTimeout(settle);
      };
    }

    // closing: put everything back (the game stays put), then slide back
    if (returnTo.current === null) return undefined;
    holdBackgroundWork(SLIDE_MS + 500);
    const slot = target.current;
    if (slot && box.classList.contains('focus-only')) {
      keepingPlace(slot, () => box.classList.remove('focus-only'));
    }
    box.classList.remove('focus-only');
    if (slot) slot.classList.remove('focus-target');
    target.current = null;
    const back = returnTo.current;
    returnTo.current = null;
    box.style.overflowY = 'hidden';
    box.scrollTo({ top: back, behavior });
    const unlock = setTimeout(
      () => {
        box.scrollTop = back;
        box.style.overflowY = '';
      },
      behavior === 'smooth' ? SLIDE_MS : 60,
    );
    const t = setTimeout(() => setFocusSpace(false), SLIDE_MS + 100);
    return () => {
      clearTimeout(unlock);
      clearTimeout(t);
      box.style.overflowY = '';
    };
  }, [isOpen, openKey, panelRef]);

  return { focusSpace };
};

export default useGameFocus;
