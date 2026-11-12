import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SPORTS, savePreferredSport, sportPath } from './sports';
import './SportSwitcher.scss';

// The sport picker in each sport's navbar (left of TEAMS). Picking a sport
// remembers it, so /sports opens on it from then on.
const SportSwitcher = ({ current }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', close, true);
    return () => document.removeEventListener('pointerdown', close, true);
  }, [open]);

  const pick = (key) => {
    savePreferredSport(key);
    setOpen(false);
    if (key !== current) navigate(sportPath(key));
  };

  const label = SPORTS.find((s) => s.key === current)?.label || 'SPORT';
  return (
    <div className="sport-switcher" ref={ref}>
      <button
        type="button"
        className={`sport-switcher-button ${open ? 'open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="sport-switcher-label">{label}</span>
        <span className="sport-switcher-caret" aria-hidden="true" />
      </button>
      {open && (
        <ul className="sport-switcher-menu" role="listbox" aria-label="Sport">
          {[...SPORTS]
            .sort((a, b) => a.label.localeCompare(b.label))
            .map((s) => (
              <li key={s.key}>
                <button
                  type="button"
                  role="option"
                  aria-selected={s.key === current}
                  className={`sport-switcher-option ${s.key === current ? 'active' : ''}`}
                  onClick={() => pick(s.key)}
                >
                  <span className="sport-switcher-option-label">{s.label}</span>
                  <span className="sport-switcher-option-name">{s.name}</span>
                </button>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
};

export default SportSwitcher;
