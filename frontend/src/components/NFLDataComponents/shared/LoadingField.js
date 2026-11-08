import React, { useEffect, useState } from 'react';

// Loading animation: yard lines rush past while a spiraling football is kicked
// through the uprights. Drawn entirely with CSS (see .field-loading styles).
const CAPTIONS = ['Huddling up…', 'Reading the defense…', 'Snapping the ball…', 'Moving the chains…', 'Kicking it through…'];

const LoadingField = ({ className = '' }) => {
  const [caption, setCaption] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setCaption((c) => (c + 1) % CAPTIONS.length), 1600);
    return () => clearInterval(id);
  }, []);

  return (
    <div className={`loading field-loading ${className}`} role="status" aria-label="Loading">
      <div className="field-stage" aria-hidden="true">
        <div className="field-turf" />
        <div className="field-goalpost">
          <span className="post-base" />
          <span className="post-bar" />
          <span className="post-left" />
          <span className="post-right" />
        </div>
        <div className="field-ball-path">
          <div className="field-ball">
            <span className="ball-laces" />
          </div>
        </div>
        <div className="field-shadow" />
      </div>
      <p className="field-caption">{CAPTIONS[caption]}</p>
    </div>
  );
};

export default LoadingField;
