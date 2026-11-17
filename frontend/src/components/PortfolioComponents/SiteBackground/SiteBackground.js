import React from 'react';
import '../../../sports/shared/utils/graphicsQuality';
import './SiteBackground.css';

// The site's background on every page: "tight braid", two sets of thin
// contour lines rolling sideways past each other in opposite directions over
// near-black. The drawings are repeating tiles in public/bg/ (each line carries
// across the tile's edges, so every line is unbroken); each layer is a tile
// wider than the screen and moves exactly one tile per loop, so it never jumps.
// Only transform animates, so the phone's GPU moves the layers without
// repainting the page. The pages themselves are see-through (--pv-page in
// SiteStyle.css) so this shows behind them.
//
// The drawings are used as stencils (CSS masks) filled with a colour. Each set
// of lines is there twice: soft gold, and a team-coloured copy on top that's
// invisible until a game is open (useGameFocus marks the background .team-on
// and sets --bg-team-a / -b on it). Switching between them only fades opacity,
// which the GPU does without redrawing the lines.

// a choice from the old background picker, no longer used
try {
  window.localStorage.removeItem('siteBackground');
} catch {
  // storage blocked
}

const stencil = (file) => ({ WebkitMaskImage: `url(${file})`, maskImage: `url(${file})` });
const A = stencil('/bg/braid-tight-a.svg');
const B = stencil('/bg/braid-tight-b.svg');

const SiteBackground = () => (
  <div className="site-background" aria-hidden="true">
    <div className="site-background-layer rolls-right gold" style={A} />
    <div className="site-background-layer rolls-right team" style={A} />
    <div className="site-background-layer rolls-left gold" style={B} />
    <div className="site-background-layer rolls-left team" style={B} />
  </div>
);

export default SiteBackground;
