// While a game slides open or closed (useGameFocus), newly loaded data waits
// and is drawn the moment the game comes to rest. Drawing a freshly loaded
// panel (a STATS table, LINES...) took a weak phone a few frames, and in the
// middle of a slide that showed as the game jumping.
let moving = false;
let waiting = [];
let safety = 0;

const release = () => {
  moving = false;
  clearTimeout(safety);
  const run = waiting;
  waiting = [];
  run.forEach((fn) => fn());
};

export const setMoving = (on) => {
  if (on) {
    moving = true;
    clearTimeout(safety);
    // never hold anything for long, whatever happens to the slide
    safety = setTimeout(release, 3000);
  } else if (moving) {
    release();
  }
};

// runs fn now, or once the current slide has finished
export const whenStill = (fn) => {
  if (moving) waiting.push(fn);
  else fn();
};
