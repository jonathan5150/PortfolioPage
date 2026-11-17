import React, { useEffect, useState } from 'react';

// "SITE UPDATED 2h 14m 05s AGO": the time since the last build, from the stamp
// written by scripts/build-info.js. Hidden if there isn't one.
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
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let active = true;
    fetch('/build-info.json', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((info) => {
        const t = info?.builtAt ? Date.parse(info.builtAt) : NaN;
        if (active && Number.isFinite(t)) setBuiltAt(t);
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
      SITE UPDATED <span className="last-updated-ago">{since(now - builtAt)}</span> AGO
    </div>
  );
};

export default LastUpdated;
