import React, { useState } from 'react';
import { useParlay } from '../shared/ParlayContext';
import { fmtOdds, parlayOdds } from '../../../pages/NFLData/NFLDataApi/betting';
import { BOOK, parlayUrl } from '../../../pages/NFLData/NFLDataApi/sportsbookOdds';

// Floating parlay slip: lists held picks, shows the combined odds, and builds
// a DraftKings link that drops the legs into the DraftKings bet slip. Each leg
// also has its own add link.
const ParlayBar = () => {
  const { legs, remove, clear } = useParlay();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  if (!legs.length) return null;

  const odds = parlayOdds(legs);
  const url = parlayUrl(legs);
  const manual = legs.filter((l) => !l.link);
  const priced = legs.filter((l) => l.odds !== null && l.odds !== undefined).length;

  const copy = async () => {
    if (!url || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked – the open button still works
    }
  };

  return (
    <div className={`parlay-bar ${open ? 'open' : ''}`}>
      <button type="button" className="parlay-toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="parlay-title">PARLAY</span>
        <span className="parlay-count">
          {legs.length} leg{legs.length === 1 ? '' : 's'}
        </span>
        {odds !== null && <span className="parlay-odds">{fmtOdds(odds)}</span>}
        <span className="parlay-caret">{open ? '▾' : '▴'}</span>
      </button>

      {open && (
        <div className="parlay-body">
          <ul className="parlay-legs">
            {legs.map((l) => (
              <li key={l.id} className={l.link ? '' : 'manual'}>
                <div className="parlay-leg-text">
                  <span className="parlay-leg-label">{l.label}</span>
                  <span className="parlay-leg-detail">
                    {l.matchup}
                    {l.detail ? ` · ${l.detail}` : ''}
                  </span>
                </div>
                <span className="parlay-leg-odds">{l.odds !== null && l.odds !== undefined ? fmtOdds(l.odds) : '—'}</span>
                {l.link && (
                  <a
                    className="parlay-leg-add"
                    href={l.link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`Add ${l.label} to your ${BOOK.name} bet slip`}
                  >
                    ADD
                  </a>
                )}
                <button type="button" className="parlay-remove" aria-label={`Remove ${l.label}`} onClick={() => remove(l.id)}>
                  ×
                </button>
              </li>
            ))}
          </ul>

          {odds !== null && priced < legs.length && (
            <div className="parlay-note">
              Combined odds cover the {priced} priced leg{priced === 1 ? '' : 's'}; the rest have no {BOOK.name} price.
            </div>
          )}
          {manual.length > 0 && (
            <div className="parlay-note">
              {manual.length === 1 ? 'One leg has' : `${manual.length} legs have`} no {BOOK.name} link, so add{' '}
              {manual.length === 1 ? 'it' : 'them'} in {BOOK.name} after opening the slip.
            </div>
          )}

          <div className="parlay-actions">
            {url ? (
              <a className="parlay-open" href={url} target="_blank" rel="noopener noreferrer">
                OPEN IN {BOOK.name.toUpperCase()}
              </a>
            ) : (
              <span className="parlay-open disabled">NO LINKABLE LEGS</span>
            )}
            {url && (
              <button type="button" className="parlay-secondary" onClick={copy}>
                {copied ? 'COPIED' : 'COPY LINK'}
              </button>
            )}
            <button type="button" className="parlay-secondary" onClick={clear}>
              CLEAR
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ParlayBar;
