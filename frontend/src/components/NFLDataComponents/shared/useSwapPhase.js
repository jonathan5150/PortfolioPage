import { useEffect, useRef, useState } from 'react';
import { isLowQuality } from './graphicsQuality';

// Switching to another week / day / card: the list that's there fades out to
// the loading screen, and the new one fades in once it's loaded.
//   'shown'  - the list, as normal
//   'out'    - the old list fading out (a new one has been asked for)
//   'loader' - the loading screen (the list isn't drawn)
//   'in'     - the new list fading in
// busy: true while the new data is loading. The loading screen stays up for
// a moment even when the data is already on hand, so it never just flickers.
// The fades themselves are CSS (.nfl-scroll-panel[data-swap], NFLData.scss).
export const SWAP_OUT_MS = 260;
const MIN_LOADER_MS = 350;
const SWAP_IN_MS = 400;

const useSwapPhase = (busy) => {
  const [phase, setPhase] = useState('shown');
  const loaderSince = useRef(0);
  useEffect(() => {
    const low = isLowQuality();
    let timer;
    if (busy && (phase === 'shown' || phase === 'in')) {
      loaderSince.current = performance.now();
      setPhase(low ? 'loader' : 'out');
    } else if (phase === 'out') {
      timer = setTimeout(() => {
        loaderSince.current = performance.now();
        setPhase('loader');
      }, SWAP_OUT_MS);
    } else if (phase === 'loader' && !busy) {
      const wait = low ? 0 : Math.max(0, MIN_LOADER_MS - (performance.now() - loaderSince.current));
      timer = setTimeout(() => setPhase(low ? 'shown' : 'in'), wait);
    } else if (phase === 'in') {
      timer = setTimeout(() => setPhase('shown'), SWAP_IN_MS);
    }
    return () => clearTimeout(timer);
  }, [busy, phase]);
  return phase;
};

// value as it was before `hold` turned on, for as long as it stays on: the old
// list keeps showing while it fades out, even if the new data lands meanwhile
export const useHeld = (value, hold) => {
  const ref = useRef(value);
  if (!hold) ref.current = value;
  return ref.current;
};

export default useSwapPhase;
