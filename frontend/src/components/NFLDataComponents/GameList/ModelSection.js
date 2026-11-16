import React, { useState } from 'react';
import SlideOpen from '../shared/SlideOpen';

// A collapsible section inside the MODEL dropdown, so it stays short: just the
// headings until one is opened. What's inside mounts only while it's open.
export const ModelSection = ({ title, defaultOpen = false, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`model-section model-fold ${open ? 'open' : ''}`}>
      <button type="button" className="model-fold-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span>{title}</span>
        <span className="bet-results-caret" aria-hidden="true" />
      </button>
      <SlideOpen open={open} className="model-fold-body">
        <div className="model-fold-content">{children}</div>
      </SlideOpen>
    </div>
  );
};

export default ModelSection;
