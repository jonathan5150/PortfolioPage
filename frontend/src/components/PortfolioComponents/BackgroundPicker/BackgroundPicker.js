import React, { useEffect, useRef, useState } from 'react';
import { BACKGROUNDS, applyBackground, savedBackground } from './backgrounds';
import './BackgroundPicker.css';

// apply the saved (or default) background before the first paint
if (typeof window !== 'undefined') applyBackground(savedBackground());

// A small floating BG button on every page: opens a list of dark backgrounds,
// each with a swatch; tapping one switches the whole site to it right away.
const BackgroundPicker = () => {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(savedBackground);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', close, true);
    return () => document.removeEventListener('pointerdown', close, true);
  }, [open]);
  const pick = (key) => {
    applyBackground(key);
    setCurrent(key);
  };
  const index = BACKGROUNDS.findIndex((b) => b.key === current);
  const step = (dir) => pick(BACKGROUNDS[(index + dir + BACKGROUNDS.length) % BACKGROUNDS.length].key);
  return (
    <div className={`bg-picker ${open ? 'open' : ''}`} ref={ref}>
      {open && (
        <div className="bg-picker-panel" role="listbox" aria-label="Background">
          <div className="bg-picker-head">
            <button type="button" className="bg-picker-step" aria-label="Previous background" onClick={() => step(-1)}>
              ◀
            </button>
            <span className="bg-picker-title">
              {BACKGROUNDS[index]?.label} · {index + 1}/{BACKGROUNDS.length}
            </span>
            <button type="button" className="bg-picker-step" aria-label="Next background" onClick={() => step(1)}>
              ▶
            </button>
          </div>
          <ul className="bg-picker-list">
            {BACKGROUNDS.map((b) => (
              <li key={b.key}>
                <button
                  type="button"
                  role="option"
                  aria-selected={b.key === current}
                  className={`bg-picker-option ${b.key === current ? 'active' : ''}`}
                  onClick={() => pick(b.key)}
                >
                  <span
                    className="bg-picker-swatch"
                    style={{ backgroundColor: b.page, backgroundImage: b.img, backgroundSize: b.size || 'auto' }}
                  />
                  <span className="bg-picker-label">{b.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <button
        type="button"
        className="bg-picker-toggle"
        aria-expanded={open}
        aria-label="Choose a background"
        onClick={() => setOpen((o) => !o)}
      >
        BG
      </button>
    </div>
  );
};

export default BackgroundPicker;
