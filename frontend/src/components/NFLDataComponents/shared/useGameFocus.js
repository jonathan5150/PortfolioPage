import { useEffect, useRef, useState } from 'react';
import { getTeamRingColors } from './teamColors';

// What happens around an open game on every sports page (NFL, NBA, MLB, UFC).
// The fading of everything else is CSS (.game-focus, see NFLData.scss); this
// does the rest:
//  - the site's background lines take the open game's two colours (away on one
//    set of lines, home on the other), fading back to gold when it closes
//  - a tap anywhere outside the open game closes it (its own team cells
//    already toggle it; the parlay slip and DONE bar don't close it)
//  - the game slides up to the top of the scrolling box (panelRef, just under
//    the pinned header), and closing it slides the box back to where it was
//  - while it's open the box only scrolls within the game, so a box score or
//    other panel running past the bottom of the screen can still be scrolled
//    to, but nothing else can
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
const LINE_VARS = ['--bg-line-a', '--bg-line-b', '--bg-line-a-strength', '--bg-line-b-strength'];
const GAP = 8; // space between the top of the box and the open game

const useGameFocus = ({ openKey, lineA, lineB, onClose, panelRef }) => {
  const isOpen = Boolean(openKey);

  // ---- the background lines ----
  // the teams' colours at full strength while a game is open (the gold lines
  // are kept softer, see SiteBackground.css)
  useEffect(() => {
    const root = document.documentElement.style;
    if (isOpen && lineA && lineB) {
      root.setProperty('--bg-line-a', lineA);
      root.setProperty('--bg-line-b', lineB);
      root.setProperty('--bg-line-a-strength', '1');
      root.setProperty('--bg-line-b-strength', '0.9');
    } else {
      LINE_VARS.forEach((v) => root.removeProperty(v));
    }
  }, [isOpen, lineA, lineB]);
  // leaving the page puts them back to gold
  useEffect(() => () => LINE_VARS.forEach((v) => document.documentElement.style.removeProperty(v)), []);

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

  // ---- slide up, scroll only within the game, slide back ----
  const returnTo = useRef(null);
  const [focusSpace, setFocusSpace] = useState(false);
  useEffect(() => {
    const box = panelRef.current;
    if (!box) return undefined;
    if (isOpen) {
      if (returnTo.current === null) returnTo.current = box.scrollTop;
      setFocusSpace(true);
      // no scrolling by hand until the game has finished sliding into place: a
      // scroll mid-slide fights the slide and leaves things out of place (the
      // slide itself still moves the box)
      box.style.overflowY = 'hidden';
      // the open game's scroll range: from it sitting at the top of the box to
      // its bottom edge just showing at the bottom of the box
      const range = () => {
        const slot = box.querySelector('.game-slot.open');
        if (!slot) return null;
        const top = box.scrollTop + slot.getBoundingClientRect().top - box.getBoundingClientRect().top - GAP;
        return [top, Math.max(top, top + slot.offsetHeight + GAP * 2 - box.clientHeight)];
      };
      let keepInside = null;
      let watch = null;
      // after the room below is in place: slide up, then hold the box to the game
      const slide = setTimeout(() => {
        const r = range();
        if (r) box.scrollTo({ top: r[0], behavior: 'smooth' });
      }, 30);
      const hold = setTimeout(() => {
        // a game that fits on the screen doesn't scroll at all; one that runs
        // past the bottom scrolls only far enough to see the rest of it. Checked
        // again whenever the game changes height (a tab opened, say).
        const fit = () => {
          const r = range();
          box.style.overflowY = r && r[1] <= r[0] + 1 ? 'hidden' : '';
        };
        keepInside = () => {
          const r = range();
          if (!r) return;
          if (box.scrollTop < r[0] - 1) box.scrollTop = r[0];
          else if (box.scrollTop > r[1] + 1) box.scrollTop = r[1];
        };
        // the slide is over: make sure the game ended up at the top, then let
        // the box scroll again (only within the game, if it's taller than the screen)
        const settled = range();
        if (settled && (box.scrollTop < settled[0] - 1 || box.scrollTop > settled[1] + 1)) box.scrollTop = settled[0];
        fit();
        box.addEventListener('scroll', keepInside, { passive: true });
        const slot = box.querySelector('.game-slot.open');
        if (slot && window.ResizeObserver) {
          watch = new ResizeObserver(fit);
          watch.observe(slot);
        }
        // and shortly after any tap inside the game (tabs open by tapping), in
        // case the size change isn't reported
        if (slot) {
          recheck = () => [350, 900].forEach((ms) => later.push(setTimeout(fit, ms)));
          slot.addEventListener('click', recheck);
          tapped = slot;
        }
      }, SLIDE_MS);
      let recheck = null;
      let tapped = null;
      const later = [];
      return () => {
        clearTimeout(slide);
        clearTimeout(hold);
        later.forEach(clearTimeout);
        if (keepInside) box.removeEventListener('scroll', keepInside);
        if (watch) watch.disconnect();
        if (tapped && recheck) tapped.removeEventListener('click', recheck);
        box.style.overflowY = '';
      };
    }
    if (returnTo.current === null) return undefined;
    // sliding back: no scrolling by hand until it's back where it was
    const back = returnTo.current;
    box.style.overflowY = 'hidden';
    box.scrollTo({ top: back, behavior: 'smooth' });
    returnTo.current = null;
    const unlock = setTimeout(() => {
      box.scrollTop = back;
      box.style.overflowY = '';
    }, SLIDE_MS);
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
