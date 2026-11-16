import React from 'react';
import './SiteBackground.css';

// The site's background on every page: "tight braid", two sets of thin gold
// contour lines rolling sideways past each other in opposite directions over
// near-black. The drawings are repeating tiles in public/bg/ (each line carries
// across the tile's edges, so every line is unbroken); each layer is a tile
// wider than the screen and moves exactly one tile per loop, so it never jumps.
// Only transform animates, so the phone's GPU moves the layers without
// repainting the page. The pages themselves are see-through (--pv-page in
// SiteStyle.css) so this shows behind them.

// a choice from the old background picker, no longer used
try {
  window.localStorage.removeItem('siteBackground');
} catch {
  // storage blocked
}

const SiteBackground = () => (
  <div className="site-background" aria-hidden="true">
    <div className="site-background-layer rolls-right" style={{ backgroundImage: 'url(/bg/braid-tight-a.svg)' }} />
    <div className="site-background-layer rolls-left" style={{ backgroundImage: 'url(/bg/braid-tight-b.svg)' }} />
  </div>
);

export default SiteBackground;
