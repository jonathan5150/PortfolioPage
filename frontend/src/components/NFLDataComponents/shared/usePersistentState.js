import { useCallback, useEffect, useRef, useState } from 'react';

// User preferences for the NFL app live in localStorage under one namespace,
// so they never collide with the MLB app's cookies.
const NAMESPACE = 'nflStatsWizard:';

export const readPreference = (key, fallback) => {
  try {
    const raw = window.localStorage.getItem(NAMESPACE + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
};

export const writePreference = (key, value) => {
  try {
    window.localStorage.setItem(NAMESPACE + key, JSON.stringify(value));
  } catch {
    // storage full or disabled (private mode) – preferences just won't persist
  }
};

// Like useState, but the value survives reloads.
const usePersistentState = (key, initialValue) => {
  const [value, setValue] = useState(() =>
    readPreference(key, typeof initialValue === 'function' ? initialValue() : initialValue)
  );
  const keyRef = useRef(key);

  useEffect(() => {
    if (keyRef.current !== key) {
      keyRef.current = key;
      setValue(readPreference(key, typeof initialValue === 'function' ? initialValue() : initialValue));
    }
    // initialValue is intentionally not a dependency: it's only a default
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const update = useCallback(
    (next) => {
      setValue((prev) => {
        const resolved = typeof next === 'function' ? next(prev) : next;
        writePreference(keyRef.current, resolved);
        return resolved;
      });
    },
    []
  );

  return [value, update];
};

// Per-game preferences (e.g. which panel each game card shows) stored in one map,
// trimmed so it can't grow without bound across a season.
const MAX_MAP_ENTRIES = 120;

export const usePersistentMapEntry = (mapKey, entryKey, fallback) => {
  const [value, setValue] = useState(() => readPreference(mapKey, {})?.[entryKey] ?? fallback);

  const update = useCallback(
    (next) => {
      setValue((prev) => {
        const resolved = typeof next === 'function' ? next(prev) : next;
        const map = readPreference(mapKey, {}) || {};
        delete map[entryKey];
        map[entryKey] = resolved;
        const keys = Object.keys(map);
        if (keys.length > MAX_MAP_ENTRIES) {
          keys.slice(0, keys.length - MAX_MAP_ENTRIES).forEach((k) => delete map[k]);
        }
        writePreference(mapKey, map);
        return resolved;
      });
    },
    [mapKey, entryKey]
  );

  return [value, update];
};

export default usePersistentState;
