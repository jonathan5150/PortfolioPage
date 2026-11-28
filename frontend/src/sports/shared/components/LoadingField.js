import React, { useState } from 'react';
import { useInRouterContext, useLocation } from 'react-router-dom';
import { isSport, startingSport } from '../utils/sports';
import '../styles/LoadingField.scss';

// Loading animation for the sports pages: the ball of the sport being loaded
// (a football for NFL, a baseball for MLB, a basketball for NBA, a puck for
// NHL, the octagon for UFC), gold and black, turning in place with a soft gold glow pulsing
// behind it. The sport comes from the address (/sports/nfl ...), which already
// points at the sport being opened while it loads; on /sports itself it's the
// sport that's about to open (the remembered one, or the one in season).
//
// It runs entirely on CSS animation (transform and opacity), so it keeps going
// while the phone is busy loading the page; a JavaScript timer would freeze
// then. Every copy is also in step with the clock, so when one loading screen
// hands over to the next the ball carries on turning instead of starting over.
const GOLD = '#f5d16b';
const BLACK = '#0d0c0a';

const Football = () => (
  <svg viewBox="0 0 40 40" className="sl-icon">
    <g transform="rotate(-35 20 20)">
      <ellipse cx="20" cy="20" rx="17" ry="10.5" fill={BLACK} stroke={GOLD} strokeWidth="1.8" />
      <g stroke={GOLD} strokeWidth="1.4" strokeLinecap="round">
        <path d="M7.5 15.5 Q9 20 7.5 24.5" fill="none" />
        <path d="M32.5 15.5 Q31 20 32.5 24.5" fill="none" />
        <line x1="14" y1="20" x2="26" y2="20" />
        <line x1="16" y1="17.6" x2="16" y2="22.4" />
        <line x1="19" y1="17.6" x2="19" y2="22.4" />
        <line x1="22" y1="17.6" x2="22" y2="22.4" />
        <line x1="25" y1="17.6" x2="25" y2="22.4" />
      </g>
    </g>
  </svg>
);

const Baseball = () => (
  <svg viewBox="0 0 40 40" className="sl-icon">
    <circle cx="20" cy="20" r="15" fill={BLACK} stroke={GOLD} strokeWidth="1.8" />
    <g stroke={GOLD} strokeWidth="1.3" fill="none" strokeLinecap="round">
      <path d="M11 8.8 Q16.5 20 11 31.2" />
      <path d="M29 8.8 Q23.5 20 29 31.2" />
      <path d="M11.6 12.6 l2.5 -0.8 M13.2 16.8 l2.7 -0.3 M13.2 21.6 l2.7 0.3 M11.9 26 l2.5 0.9" />
      <path d="M28.4 12.6 l-2.5 -0.8 M26.8 16.8 l-2.7 -0.3 M26.8 21.6 l-2.7 0.3 M28.1 26 l-2.5 0.9" />
    </g>
  </svg>
);

const Basketball = () => (
  <svg viewBox="0 0 40 40" className="sl-icon">
    <circle cx="20" cy="20" r="15" fill={BLACK} stroke={GOLD} strokeWidth="1.8" />
    <g stroke={GOLD} strokeWidth="1.4" fill="none">
      <line x1="5" y1="20" x2="35" y2="20" />
      <line x1="20" y1="5" x2="20" y2="35" />
      <path d="M9.2 9.6 Q15.5 20 9.2 30.4" />
      <path d="M30.8 9.6 Q24.5 20 30.8 30.4" />
    </g>
  </svg>
);

// the cage: an octagon with a second, inner fence line and its posts
const octagon = (r) =>
  Array.from({ length: 8 }, (_, i) => {
    const a = ((i * 45 + 22.5) * Math.PI) / 180;
    return `${(20 + r * Math.cos(a)).toFixed(2)},${(20 + r * Math.sin(a)).toFixed(2)}`;
  }).join(' ');
const posts = Array.from({ length: 8 }, (_, i) => {
  const a = ((i * 45 + 22.5) * Math.PI) / 180;
  return [20 + 12.2 * Math.cos(a), 20 + 12.2 * Math.sin(a), 20 + 16 * Math.cos(a), 20 + 16 * Math.sin(a)];
});
const Octagon = () => (
  <svg viewBox="0 0 40 40" className="sl-icon">
    <polygon points={octagon(16)} fill={BLACK} stroke={GOLD} strokeWidth="1.8" strokeLinejoin="round" />
    <polygon points={octagon(12.2)} fill="none" stroke={GOLD} strokeWidth="1" strokeLinejoin="round" opacity="0.8" />
    <g stroke={GOLD} strokeWidth="1" opacity="0.8">
      {posts.map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />
      ))}
    </g>
    <circle cx="20" cy="20" r="2.2" fill={GOLD} opacity="0.85" />
  </svg>
);

// grip lines down the puck's side: x, top, bottom (shorter towards the edges,
// where the side curves away)
const PUCK_GRIP = [
  [9, 21.5, 26.5],
  [13.5, 22.3, 28],
  [18, 22.6, 28.6],
  [22, 22.6, 28.6],
  [26.5, 22.3, 28],
  [31, 21.5, 26.5],
];

// a puck, tipped towards you: its top face with a centre ring, and its side
// with the grip lines round the edge
const Puck = () => (
  <svg viewBox="0 0 40 40" className="sl-icon">
    <path
      d="M5 16.5 v7 A15 6 0 0 0 35 23.5 v-7"
      fill={BLACK}
      stroke={GOLD}
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
    <g stroke={GOLD} strokeWidth="1" opacity="0.75" strokeLinecap="round">
      {PUCK_GRIP.map(([x, y1, y2]) => (
        <line key={x} x1={x} y1={y1} x2={x} y2={y2} />
      ))}
    </g>
    <ellipse cx="20" cy="16.5" rx="15" ry="6" fill={BLACK} stroke={GOLD} strokeWidth="1.8" />
    <ellipse cx="20" cy="16.5" rx="8" ry="3.2" fill="none" stroke={GOLD} strokeWidth="1.1" opacity="0.8" />
  </svg>
);

const ICONS = { nfl: Football, mlb: Baseball, nba: Basketball, nhl: Puck, ufc: Octagon };
const TURN_S = 1.6;

const sportIn = (path) => {
  const m = /^\/sports\/([a-z]+)/.exec(path || '');
  return m && isSport(m[1]) ? m[1] : startingSport();
};

const Loader = ({ sport, className }) => {
  // where in the turn the clock is right now, so every copy is in step
  const [phase] = useState(() => (performance.now() / 1000) % TURN_S);
  const Icon = ICONS[sport] || Football;
  return (
    <div className={`loading sports-loading ${className}`} role="status" aria-label="Loading">
      <div className="sl-morph" aria-hidden="true" style={{ '--sl-phase': `${-phase}s` }}>
        <div key={sport} className={`sl-shape sl-ball sl-${sport}`}>
          <Icon />
        </div>
      </div>
      <p className="sl-caption">Loading</p>
    </div>
  );
};

const RoutedLoader = (props) => <Loader {...props} sport={sportIn(useLocation().pathname)} />;

const LoadingField = ({ className = '' }) =>
  useInRouterContext() ? (
    <RoutedLoader className={className} />
  ) : (
    <Loader className={className} sport={sportIn(window.location.pathname)} />
  );

export default LoadingField;
