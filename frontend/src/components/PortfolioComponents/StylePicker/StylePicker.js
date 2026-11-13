import React, { useEffect, useState } from 'react';
import { FONT_OPTIONS, THEME_OPTIONS, isPreviewSite } from './stylePresets';
import './StylePicker.css';

// Test-site only: two dropdowns pinned to the bottom of the page that switch the
// whole site's font and color theme, so different looks can be compared on a phone.

const STORAGE_KEY = 'stylePreview';

const readSaved = () => {
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
};

const loadGoogleFont = (font) => {
  if (!font?.google) return;
  const id = `style-preview-font-${font.id}`;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${font.google}&display=swap`;
  document.head.appendChild(link);
};

// Applies the choice to <html> so the CSS in StylePicker.css can react to it.
export const applyStyleChoice = ({ font = 'default', theme = 'default' }) => {
  const root = document.documentElement;
  const fontOption = FONT_OPTIONS.find((f) => f.id === font) || FONT_OPTIONS[0];

  if (fontOption.family) {
    loadGoogleFont(fontOption);
    root.style.setProperty('--preview-font', fontOption.family);
    root.setAttribute('data-preview-font', fontOption.id);
  } else {
    root.style.removeProperty('--preview-font');
    root.removeAttribute('data-preview-font');
  }

  if (theme && theme !== 'default') root.setAttribute('data-preview-theme', theme);
  else root.removeAttribute('data-preview-theme');
};

function StylePicker({ visible = true }) {
  const [choice, setChoice] = useState(() => ({ font: 'default', theme: 'default', ...readSaved() }));
  const enabled = isPreviewSite();

  useEffect(() => {
    if (!enabled) return;
    applyStyleChoice(choice);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(choice));
    } catch {
      // storage unavailable: the choice just won't be remembered
    }
  }, [choice, enabled]);

  // lets the CSS move the page footer up so the bar doesn't cover it
  const showing = enabled && visible;
  useEffect(() => {
    if (!showing) return undefined;
    document.documentElement.setAttribute('data-style-picker', '');
    return () => document.documentElement.removeAttribute('data-style-picker');
  }, [showing]);

  if (!showing) return null;

  return (
    <div className="style-picker" role="group" aria-label="Preview font and style">
      <label className="style-picker-field">
        <span>FONT</span>
        <select value={choice.font} onChange={(e) => setChoice((c) => ({ ...c, font: e.target.value }))}>
          {FONT_OPTIONS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
      </label>
      <label className="style-picker-field">
        <span>STYLE</span>
        <select value={choice.theme} onChange={(e) => setChoice((c) => ({ ...c, theme: e.target.value }))}>
          {THEME_OPTIONS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export default StylePicker;
