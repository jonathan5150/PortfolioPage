// One speed for an open game's details, every sport: the drawer under its
// team cells and the panel under that (BOX SCORE, LINES, STATS...) unfold
// together and fold away together, at the same speed both ways.
// NFLData.scss folds them with the same timings (.focus-details).
export const DETAILS_MS = 500;

// the drawer: its real height (grid rows 0fr -> 1fr), so it moves for the
// whole time instead of jumping open and pausing before it closes
export const DRAWER_TRANSITION = `grid-template-rows ${DETAILS_MS}ms ease, opacity 400ms ease`;

// the panel: a measured height, with its padding, gap and border easing with it
export const PANEL_TRANSITION = [
  `height ${DETAILS_MS}ms ease`,
  `padding ${DETAILS_MS}ms ease`,
  `margin ${DETAILS_MS}ms ease`,
  `border-width ${DETAILS_MS}ms ease`,
  'opacity 400ms ease',
].join(', ');
