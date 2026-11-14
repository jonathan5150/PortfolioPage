import React, { useEffect, useState } from 'react';
import { FONT_OPTIONS, THEME_OPTIONS, isPreviewSite } from './stylePresets';
import './StylePicker.css';

// Test-site only: two dropdowns floating at the bottom of the screen on every page
// that switch the whole site's font and colour theme, for comparing looks on a phone.

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

const setFlag = (root, name, on) => (on ? root.setAttribute(name, '') : root.removeAttribute(name));

// Applies the choice to <html> so the CSS in StylePicker.css can react to it.
export const applyStyleChoice = ({ font = 'default', theme = 'default' }) => {
  const root = document.documentElement;
  const fontOption = FONT_OPTIONS.find((f) => f.id === font) || FONT_OPTIONS[0];
  const themeOption = THEME_OPTIONS.find((t) => t.id === theme) || THEME_OPTIONS[0];

  if (fontOption.family) {
    loadGoogleFont(fontOption);
    root.style.setProperty('--preview-font', fontOption.family);
    root.setAttribute('data-preview-font', fontOption.id);
  } else {
    root.style.removeProperty('--preview-font');
    root.removeAttribute('data-preview-font');
  }

  if (themeOption.id !== 'default') root.setAttribute('data-preview-theme', themeOption.id);
  else root.removeAttribute('data-preview-theme');
  setFlag(root, 'data-preview-vars', Boolean(themeOption.vars));
  setFlag(root, 'data-preview-light', Boolean(themeOption.light));
  setFlag(root, 'data-preview-logos', Boolean(themeOption.logos));
};

const OptionList = ({ options }) =>
  options.map((o) => (
    <option key={o.id} value={o.id}>
      {o.label}
    </option>
  ));

function StylePicker() {
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

  // lets the CSS make room for the bar (page footer, sports pages' bottom bars)
  useEffect(() => {
    if (!enabled) return undefined;
    document.documentElement.setAttribute('data-style-picker', '');
    return () => document.documentElement.removeAttribute('data-style-picker');
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div className="style-picker" role="group" aria-label="Preview font and style">
      <label className="style-picker-field">
        <span>FONT</span>
        <select
          className="style-picker-select"
          value={choice.font}
          onChange={(e) => setChoice((c) => ({ ...c, font: e.target.value }))}
        >
          <OptionList options={FONT_OPTIONS} />
        </select>
      </label>
      <label className="style-picker-field">
        <span>STYLE</span>
        <select
          className="style-picker-select"
          value={choice.theme}
          onChange={(e) => setChoice((c) => ({ ...c, theme: e.target.value }))}
        >
          <OptionList options={THEME_OPTIONS} />
        </select>
      </label>
    </div>
  );
}

export default StylePicker;
