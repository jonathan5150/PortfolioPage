import { useEffect, useState } from 'react';

// GRAPHICS QUALITY (SETTINGS, under MODEL): HIGH (the default) or LOW. LOW is
// remembered on this device and marks the page <html data-quality="low">,
// which swaps the heavier effects for simple, snappy versions (see the
// "low graphics quality" rules in NFLData.scss and SiteBackground.css).

const KEY = 'graphicsQuality';
const listeners = new Set();

const saved = () => {
  try {
    return window.localStorage.getItem(KEY) === 'low' ? 'low' : 'high';
  } catch {
    return 'high';
  }
};

export const isLowQuality = () => document.documentElement.dataset.quality === 'low';

export const setGraphicsQuality = (quality) => {
  const q = quality === 'low' ? 'low' : 'high';
  document.documentElement.dataset.quality = q;
  try {
    if (q === 'low') window.localStorage.setItem(KEY, 'low');
    else window.localStorage.removeItem(KEY);
  } catch {
    // storage blocked: it still applies for this visit
  }
  listeners.forEach((fn) => fn(q));
};

export const useGraphicsQuality = () => {
  const [quality, setQuality] = useState(saved);
  useEffect(() => {
    listeners.add(setQuality);
    return () => listeners.delete(setQuality);
  }, []);
  return [quality, setGraphicsQuality];
};

// applied before the first paint, so a LOW page never starts with the heavy effects
if (typeof document !== 'undefined') document.documentElement.dataset.quality = saved();
