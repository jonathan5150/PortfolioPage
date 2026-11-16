import React, { useState } from 'react';
import SlideOpen from '../shared/SlideOpen';
import { useGraphicsQuality } from '../shared/graphicsQuality';

// SETTINGS, under MODEL on every sports page: a gold box that opens to the
// site's settings. For now just GRAPHICS QUALITY: HIGH (the default) or LOW,
// which swaps the heavier animations and effects for simple, snappy ones and
// is remembered on this device (see graphicsQuality.js).
const OPTIONS = [
  { key: 'high', label: 'HIGH' },
  { key: 'low', label: 'LOW' },
];

const SettingsPanel = () => {
  const [open, setOpen] = useState(false);
  const [quality, setQuality] = useGraphicsQuality();
  return (
    <div className="gold-box prediction-record-outer settings-panel">
      <div className="prediction-record">
        <button
          type="button"
          className={`bet-results-toggle gold-box-text ${open ? 'open' : ''}`}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <span className="game-section-name">
            SETTINGS
            <span className="gold-caret" aria-hidden="true" />
          </span>
        </button>
        <SlideOpen open={open} className="model-results-body">
          <div className="model-results-content">
            <div className="settings-row">
              <span className="model-filter-title">GRAPHICS QUALITY</span>
              <div className="bet-filter settings-choices" aria-label="Graphics quality">
                {OPTIONS.map((o) => (
                  <button
                    key={o.key}
                    type="button"
                    className={`bet-filter-btn ${quality === o.key ? 'active' : ''}`}
                    onClick={() => setQuality(o.key)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </SlideOpen>
      </div>
    </div>
  );
};

export default SettingsPanel;
