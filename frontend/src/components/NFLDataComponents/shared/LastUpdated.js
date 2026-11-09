import React, { useEffect, useState } from 'react';

// "LAST PUSH 2m 41s · SITE UPDATED 2h 14m 05s AGO": how long the latest push took
// (from asking for it to the build finishing) and the time since, from the
// stamp written by scripts/build-info.js. Hidden if there isn't one.
const pad = (n) => String(n).padStart(2, '0');
const since = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d) return `${d}d ${h}h ${pad(m)}m ${pad(sec)}s`;
  if (h) return `${h}h ${pad(m)}m ${pad(sec)}s`;
  if (m) return `${m}m ${pad(sec)}s`;
  return `${sec}s`;
};

const LastUpdated = () => {
  const [builtAt, setBuiltAt] = useState(null);
  const [pushTook, setPushTook] = useState(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let active = true;
    fetch('/build-info.json', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((info) => {
        const t = info?.builtAt ? Date.parse(info.builtAt) : NaN;
        if (active && Number.isFinite(t)) setBuiltAt(t);
        const asked = info?.requestedAt ? Date.parse(info.requestedAt) : NaN;
        if (active && Number.isFinite(asked) && Number.isFinite(t) && t > asked) setPushTook(t - asked);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!builtAt) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [builtAt]);

  if (!builtAt) return null;
  return (
    <div className="last-updated-timer" title={new Date(builtAt).toLocaleString()}>
      {pushTook !== null && (
        <>
          LAST PUSH <span className="last-updated-ago">{since(pushTook)}</span>
          <span className="last-updated-sep">·</span>
        </>
      )}
      SITE UPDATED <span className="last-updated-ago">{since(now - builtAt)}</span> AGO
    </div>
  );
};

export default LastUpdated;
