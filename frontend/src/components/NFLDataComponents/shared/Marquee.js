import React, { useLayoutEffect, useRef, useState } from 'react';

const SPEED_PX_PER_SEC = 35;
const GAP_PX = 48;

// One line of text. When it's wider than its box it scrolls sideways forever
// (a second copy follows the first, so the loop has no jump); otherwise it
// just sits still.
const Marquee = ({ text, className = '' }) => {
  const boxRef = useRef(null);
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

  const style = scroll
    ? { '--marquee-distance': `-${scroll}px`, animationDuration: `${scroll / SPEED_PX_PER_SEC}s` }
    : undefined;

  return (
    <div ref={boxRef} className={`marquee ${scroll ? 'scrolling' : ''} ${className}`} title={text}>
      <div className="marquee-track" style={style}>
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
