import React, { useEffect, useState } from 'react';

const SLIDE_MS = 500;

// Grows open and shrinks shut like an opened game (CSS animates the grid row
// between 0 and the content's height; see .slide-open in NFLData.scss).
// Children stay mounted only while open and during the closing slide.
const SlideOpen = ({ open, className = '', children }) => {
  const [mounted, setMounted] = useState(open);
  const [expanded, setExpanded] = useState(open);
  useEffect(() => {
    if (open) {
      setMounted(true);
      // let the closed (0 height) frame paint first, so the opening animates
      const frame = requestAnimationFrame(() => requestAnimationFrame(() => setExpanded(true)));
      return () => cancelAnimationFrame(frame);
    }
    setExpanded(false);
    const timer = setTimeout(() => setMounted(false), SLIDE_MS);
    return () => clearTimeout(timer);
  }, [open]);
  return (
    <div className={`slide-open ${className} ${expanded ? 'open' : ''}`}>
      <div className="slide-open-inner">{mounted && children}</div>
    </div>
  );
};

export default SlideOpen;
