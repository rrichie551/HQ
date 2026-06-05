'use client';

import { useEffect, useState } from 'react';

export function MemoryBar({ pct, label = 'MEMORY.MD' }: { pct: number; label?: string }) {
  let color = 'var(--running)';
  if (pct >= 90) color = 'var(--danger)';
  else if (pct >= 70) color = 'var(--attention)';
  return (
    <div className="mem">
      <span className="mem-label">{label}</span>
      <div className="mem-bar">
        <div className="mem-fill" style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: color }} />
      </div>
      <span className="mem-pct" style={{ color }}>{pct}%</span>
    </div>
  );
}

export function Footer({ memPct = 0 }: { memPct?: number }) {
  const [sync, setSync] = useState<string>('—');
  useEffect(() => {
    const t = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setSync(t);
  }, []);
  return (
    <footer className="footer">
      <MemoryBar pct={memPct} />
      <div className="sync desktop-only">
        <span>Last sync {sync}</span>
        <span style={{ color: 'var(--border)' }}>·</span>
        <span className="src"><span className="dot" style={{ background: 'var(--running)' }} /> Dashboard</span>
        <span className="src"><span className="dot" style={{ background: 'var(--running)' }} /> Slack</span>
        <span className="src"><span className="dot" style={{ background: 'var(--running)' }} /> Hermes</span>
      </div>
      <div className="footer-right">
        <a href="https://firstwordread.com" target="_blank" rel="noreferrer">Powered by First Word Read</a>
      </div>
    </footer>
  );
}
