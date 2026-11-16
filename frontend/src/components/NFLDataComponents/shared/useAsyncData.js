import { useEffect, useState } from 'react';

// Runs an async loader whenever deps change; ignores stale responses.
// Pass enabled=false to defer loading (e.g. until a card is expanded).
// initial: data already on hand (e.g. odds fetched during the loading screen),
// shown from the first render and kept while the loader refreshes it.
const useAsyncData = (loader, deps, { enabled = true, keepPrevious = false, initial } = {}) => {
  const hasInitial = initial !== undefined && initial !== null;
  if (hasInitial) keepPrevious = true; // eslint-disable-line no-param-reassign
  const [state, setState] = useState({
    data: hasInitial ? initial : null,
    error: null,
    loading: enabled && !hasInitial,
  });

  useEffect(() => {
    if (!enabled) return undefined;
    let active = true;

    setState((prev) => ({ data: keepPrevious ? prev.data : null, error: null, loading: true }));

    loader()
      .then((data) => {
        if (active) setState({ data, error: null, loading: false });
      })
      .catch((error) => {
        console.warn('NFL data load failed:', error);
        if (active) setState((prev) => ({ data: keepPrevious ? prev.data : null, error, loading: false }));
      });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled]);

  return state;
};

export default useAsyncData;
