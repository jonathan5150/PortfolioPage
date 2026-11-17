import { useEffect, useState } from 'react';
import { whenStill } from '../../shared/utils/motionGate';
import { getGameSummary } from '../api/nflDataService';
import { peekGameSummary } from '../../shared/api/espnService';

const LIVE_SUMMARY_POLL_MS = 15000;

// Loads the ESPN game summary (box score) for a game while `enabled`.
// Live games keep refreshing; final games are fetched once.
const useGameSummary = (game, enabled) => {
  const isLive = game.status.state === 'in';
  const isPre = game.status.state === 'pre';
  const isFinal = game.status.state === 'post';
  // a finished game's box score that's already loaded (in the background, say)
  // shows straight away, with no loading message
  const [state, setState] = useState(() => ({
    data: isFinal ? peekGameSummary(game.id) || null : null,
    error: null,
    loading: false,
  }));
  // When the scoreboard poll shows the score/quarter changed, refresh immediately.
  const scoreKey = `${game.status.state}|${game.status.period}|${game.away?.score}|${game.home?.score}`;

  useEffect(() => {
    if (!enabled || isPre) return undefined;
    let active = true;

    const load = async (live) => {
      try {
        const data = await getGameSummary(game.id, { live, final: isFinal });
        // drawn once any game sliding open or closed has come to rest (motionGate)
        whenStill(() => {
          if (active) setState({ data, error: null, loading: false });
        });
      } catch (error) {
        console.warn(`Box score unavailable for game ${game.id}:`, error);
        if (active) setState((prev) => ({ data: prev.data, error, loading: false }));
      }
    };

    setState((prev) => ({ ...prev, loading: !prev.data }));
    load(isLive);

    if (!isLive)
      return () => {
        active = false;
      };

    const id = setInterval(() => {
      if (document.visibilityState !== 'hidden') load(true);
    }, LIVE_SUMMARY_POLL_MS);

    return () => {
      active = false;
      clearInterval(id);
    };
  }, [enabled, isPre, isLive, isFinal, game.id, scoreKey]);

  return state;
};

export default useGameSummary;
