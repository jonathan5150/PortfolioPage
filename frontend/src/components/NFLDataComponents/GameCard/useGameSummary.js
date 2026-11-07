import { useEffect, useState } from 'react';
import { getGameSummary } from '../../../pages/NFLData/NFLDataApi/nflDataService';

const LIVE_SUMMARY_POLL_MS = 15000;

// Loads the ESPN game summary (box score) for a game while `enabled`.
// Live games keep refreshing; final games are fetched once.
const useGameSummary = (game, enabled) => {
  const [state, setState] = useState({ data: null, error: null, loading: false });
  const isLive = game.status.state === 'in';
  const isPre = game.status.state === 'pre';
  // When the scoreboard poll shows the score/quarter changed, refresh immediately.
  const scoreKey = `${game.status.state}|${game.status.period}|${game.away?.score}|${game.home?.score}`;

  useEffect(() => {
    if (!enabled || isPre) return undefined;
    let active = true;

    const load = async (live) => {
      try {
        const data = await getGameSummary(game.id, { live });
        if (active) setState({ data, error: null, loading: false });
      } catch (error) {
        console.warn(`Box score unavailable for game ${game.id}:`, error);
        if (active) setState((prev) => ({ data: prev.data, error, loading: false }));
      }
    };

    setState((prev) => ({ ...prev, loading: !prev.data }));
    load(isLive);

    if (!isLive) return () => {
      active = false;
    };

    const id = setInterval(() => {
      if (document.visibilityState !== 'hidden') load(true);
    }, LIVE_SUMMARY_POLL_MS);

    return () => {
      active = false;
      clearInterval(id);
    };
  }, [enabled, isPre, isLive, game.id, scoreKey]);

  return state;
};

export default useGameSummary;
