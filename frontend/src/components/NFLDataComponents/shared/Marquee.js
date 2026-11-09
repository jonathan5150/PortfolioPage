import React, { useLayoutEffect, useRef, useState } from 'react';

const SPEED_PX_PER_SEC = 35;
const GAP_PX = 48;
const PAUSE_MS = 1200;

// One line of text. When it's wider than its box it scrolls sideways (a
// second copy follows the first, so the loop has no jump), resting for a
// moment each time the start of the text is back at the left edge.
// Otherwise it just sits still.
const Marquee = ({ text, className = '' }) => {
  const boxRef = useRef(null);
  const trackRef = useRef(null);
  const textRef = useRef(null);
  const [scroll, setScroll] = useState(null);

  useLayoutEffect(() => {
    const box = boxRef.current;
    const span = textRef.current;
    if (!box || !span) return undefined;
    const measure = () => {
      const width = span.scrollWidth;
      setScroll(width > box.clientWidth + 1 ? width + GAP_PX : null);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, [text]);

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!scroll || !track?.animate) return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    const travelMs = (scroll / SPEED_PX_PER_SEC) * 1000;
    const duration = travelMs + PAUSE_MS;
    const hold = PAUSE_MS / duration;
    const animation = track.animate(
      [
        { transform: 'translateX(0)', offset: 0 },
        { transform: 'translateX(0)', offset: hold },
        { transform: `translateX(-${scroll}px)`, offset: 1 },
      ],
      { duration, iterations: Infinity, easing: 'linear' },
    );
    return () => animation.cancel();
  }, [scroll]);

  return (
    <div ref={boxRef} className={`marquee ${scroll ? 'scrolling' : ''} ${className}`} title={text}>
      <div ref={trackRef} className="marquee-track">
        <span ref={textRef} className="marquee-text">
          {text}
        </span>
        {scroll && (
          <span className="marquee-text" aria-hidden="true" style={{ paddingLeft: GAP_PX }}>
            {text}
          </span>
        )}
      </div>
    </div>
  );
};

export default Marquee;
