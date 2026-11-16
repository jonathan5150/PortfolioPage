import React from 'react';
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
// The drawings are used as stencils (CSS masks) filled with a colour, so the
// lines can change colour: gold normally, or --bg-line-a / --bg-line-b on
// <html> (the NFL page sets them to the two teams' colours while a game is
// open, see GameList), fading between them.

// a choice from the old background picker, no longer used
try {
  window.localStorage.removeItem('siteBackground');
} catch {
  // storage blocked
}

const stencil = (file) => ({ WebkitMaskImage: `url(${file})`, maskImage: `url(${file})` });

const SiteBackground = () => (
  <div className="site-background" aria-hidden="true">
    <div className="site-background-layer rolls-right" style={stencil('/bg/braid-tight-a.svg')} />
    <div className="site-background-layer rolls-left" style={stencil('/bg/braid-tight-b.svg')} />
  </div>
);

export default SiteBackground;
