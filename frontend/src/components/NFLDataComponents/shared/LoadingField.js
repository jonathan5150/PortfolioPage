import React, { useEffect, useState } from 'react';
import './LoadingField.scss';

// Loading animation for every sport: a football, basketball, baseball and a
// fight glove hop in a wave across a gold-trimmed stage, each one lighting up
// as it lands. Inline SVG + CSS only.
const CAPTIONS = ['Huddling up…', 'Checking the rotation…', 'Warming up the bullpen…', 'Taping the gloves…'];

const Football = () => (
  <svg viewBox="0 0 40 40" className="sl-ball">
    <ellipse cx="20" cy="20" rx="17" ry="11" transform="rotate(-35 20 20)" fill="#8a4b22" stroke="#5c2f12" />
    <path d="M10.5 13.5 Q20 20 29.5 26.5" stroke="#f3e6d3" strokeWidth="1.3" fill="none" opacity="0.5" />
    <g stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" transform="rotate(-35 20 20)">
      <line x1="14" y1="20" x2="26" y2="20" />
      <line x1="16" y1="17.5" x2="16" y2="22.5" />
      <line x1="19" y1="17.5" x2="19" y2="22.5" />
      <line x1="22" y1="17.5" x2="22" y2="22.5" />
      <line x1="25" y1="17.5" x2="25" y2="22.5" />
    </g>
  </svg>
);

const Basketball = () => (
  <svg viewBox="0 0 40 40" className="sl-ball">
    <circle cx="20" cy="20" r="15" fill="#e2731f" stroke="#7a3a0c" strokeWidth="1.4" />
    <g stroke="#2a1405" strokeWidth="1.4" fill="none">
      <line x1="5" y1="20" x2="35" y2="20" />
      <line x1="20" y1="5" x2="20" y2="35" />
      <path d="M9 9.5 Q15 20 9 30.5" />
      <path d="M31 9.5 Q25 20 31 30.5" />
    </g>
  </svg>
);

const Baseball = () => (
  <svg viewBox="0 0 40 40" className="sl-ball">
    <circle cx="20" cy="20" r="14" fill="#f7f4ec" stroke="#b9b2a2" strokeWidth="1.2" />
    <g stroke="#d0342c" strokeWidth="1.3" fill="none" strokeLinecap="round">
      <path d="M11 9.5 Q16 20 11 30.5" />
      <path d="M29 9.5 Q24 20 29 30.5" />
      <path d="M11.5 13 l2.4 -0.8 M13 17 l2.6 -0.3 M13 21.5 l2.6 0.3 M11.8 26 l2.4 0.9" />
      <path d="M28.5 13 l-2.4 -0.8 M27 17 l-2.6 -0.3 M27 21.5 l-2.6 0.3 M28.2 26 l-2.4 0.9" />
    </g>
  </svg>
);

const Glove = () => (
  <svg viewBox="0 0 40 40" className="sl-ball">
    <path
      d="M12 14 Q12 6 20 6 L26 6 Q32 6 32 13 L32 22 Q32 27 28 28 L28 33 L14 33 L14 28 Q9 27 9 21 Q9 16 12 16 Z"
      fill="#c0242b"
      stroke="#6e1015"
      strokeWidth="1.3"
      strokeLinejoin="round"
    />
    <path d="M12 16 Q16 15.5 17 19 Q17.5 22 14 22" fill="#a51d23" stroke="#6e1015" strokeWidth="1.1" />
    <path d="M18 9 Q24 7.5 29 10" stroke="#ff8f8f" strokeWidth="1.3" fill="none" opacity="0.55" strokeLinecap="round" />
    <rect x="14" y="28" width="14" height="5" fill="#f2f2f2" stroke="#6e1015" strokeWidth="1.1" />
  </svg>
);

const BALLS = [
  { key: 'nfl', Icon: Football },
  { key: 'nba', Icon: Basketball },
  { key: 'mlb', Icon: Baseball },
  { key: 'ufc', Icon: Glove },
];

const LoadingField = ({ className = '' }) => {
  const [caption, setCaption] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setCaption((c) => (c + 1) % CAPTIONS.length), 1600);
    return () => clearInterval(id);
  }, []);

  return (
    <div className={`loading sports-loading ${className}`} role="status" aria-label="Loading">
      <div className="sl-stage" aria-hidden="true">
        {BALLS.map(({ key, Icon }, i) => (
          <div key={key} className={`sl-slot sl-${key}`} style={{ '--i': i }}>
            <div className="sl-hop">
              <Icon />
            </div>
            <span className="sl-shadow" />
          </div>
        ))}
        <span className="sl-floor" />
      </div>
      <p className="sl-caption">{CAPTIONS[caption]}</p>
    </div>
  );
};

export default LoadingField;
