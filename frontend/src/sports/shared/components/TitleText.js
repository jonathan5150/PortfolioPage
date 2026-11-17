import React from 'react';

// "STATS GUIDE" in every sport's title: white words with a gold shine sweeping
// across them now and then. The shine is a gold copy of the words seen through
// a sliding window (see .title-shine in sports.scss), so the phone's GPU can
// move it without redrawing the words.
const TitleText = ({ children }) => (
  <span className="nfl-title-text">
    {children}
    <span className="title-shine" aria-hidden="true">
      <span className="title-shine-text">{children}</span>
    </span>
  </span>
);

export default TitleText;
