import React, { useLayoutEffect, useRef } from 'react';

// One line of text that shrinks its font until it fits its container, so a
// label like "FRI, NOV 13" is never cut off. It refits when the container
// resizes or the text's own size changes (e.g. a different font loads).
const FitText = ({ children, min = 8, className = '' }) => {
  const ref = useRef(null);

  useLayoutEffect(() => {
    const el = ref.current;
    const box = el?.parentElement;
    if (!el || !box) return undefined;

    const fit = () => {
      el.style.fontSize = '';
      const cs = getComputedStyle(box);
      const room = box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      if (room <= 0) return;
      let size = parseFloat(getComputedStyle(el).fontSize);
      // step down until it fits (a few steps at most for these short labels)
      while (el.scrollWidth > room && size > min) {
        size = Math.max(min, size - 0.5);
        el.style.fontSize = `${size}px`;
      }
    };

    fit();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(fit);
    observer.observe(box);
    if (document.fonts?.ready) document.fonts.ready.then(fit).catch(() => {});
    return () => observer.disconnect();
  }, [children, min]);

  return (
    <span ref={ref} className={`fit-text ${className}`.trim()}>
      {children}
    </span>
  );
};

export default FitText;
