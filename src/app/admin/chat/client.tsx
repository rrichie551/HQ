'use client';

import { useEffect, useRef, useState } from 'react';
import { SessionsRail } from './SessionsRail';
import { ActivityRail } from './ActivityRail';

export function ChatTerminal({ bridgeOk }: { bridgeOk: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const termRef = useRef<any>(null);
  const fitRef = useRef<any>(null);
  const [status, setStatus] = useState<'connecting' | 'open' | 'closed' | 'error'>('connecting');
  const [tick, setTick] = useState(0);
  const [resumeId, setResumeId] = useState<string | null>(null);
  // Hide rails on small screens — chat needs the room
  const [showSessions, setShowSessions] = useState(true);
  const [showActivity, setShowActivity] = useState(true);

  useEffect(() => {
    if (!bridgeOk) return;
    let cancelled = false;
    let cleanup = () => {};

    (async () => {
      const [{ Terminal }, { FitAddon }] = await Promise.all([
        import('@xterm/xterm'),
        import('@xterm/addon-fit'),
      ]);
      await import('@xterm/xterm/css/xterm.css');
      if (cancelled || !containerRef.current) return;

      const term = new Terminal({
        cursorBlink: true,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, "Courier New", monospace',
        fontSize: 13,
        lineHeight: 1.2,
        theme: {
          background: '#1A1D2A',
          foreground: '#E5E7EB',
          cursor: '#C0603C',
          selectionBackground: '#3A3F52',
          black: '#1A1D2A',
          red: '#F87171',
          green: '#34D399',
          yellow: '#FBBF24',
          blue: '#60A5FA',
          magenta: '#A78BFA',
          cyan: '#22D3EE',
          white: '#E5E7EB',
          brightBlack: '#6B7280',
          brightRed: '#FCA5A5',
          brightGreen: '#6EE7B7',
          brightYellow: '#FCD34D',
          brightBlue: '#93C5FD',
          brightMagenta: '#C4B5FD',
          brightCyan: '#67E8F9',
          brightWhite: '#F9FAFB',
        },
        allowProposedApi: true,
      });
      const fit = new FitAddon();
      term.loadAddon(fit);
      term.open(containerRef.current);
      fit.fit();

      termRef.current = term;
      fitRef.current = fit;

      const { cols, rows } = term;
      const params = new URLSearchParams({ cols: String(cols), rows: String(rows) });
      if (resumeId) params.set('resume', resumeId);
      const url = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/api/admin/term?${params}`;
      const ws = new WebSocket(url);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      ws.onopen = () => setStatus('open');
      ws.onclose = () => setStatus('closed');
      ws.onerror = () => setStatus('error');
      ws.onmessage = (ev) => {
        if (typeof ev.data === 'string') term.write(ev.data);
        else term.write(new Uint8Array(ev.data));
      };

      term.onData((data) => {
        if (ws.readyState === ws.OPEN) ws.send(data);
      });

      const onResize = () => {
        if (!fitRef.current || !termRef.current) return;
        try {
          fitRef.current.fit();
          const { cols, rows } = termRef.current;
          if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({ type: 'resize', cols, rows }));
          }
        } catch { /* may fire while DOM is in transition */ }
      };
      window.addEventListener('resize', onResize);
      // Refit also after our layout flips (sidebar toggles)
      const layoutTimer = setTimeout(onResize, 80);

      cleanup = () => {
        window.removeEventListener('resize', onResize);
        clearTimeout(layoutTimer);
        try { ws.close(); } catch {}
        try { term.dispose(); } catch {}
      };
    })();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [bridgeOk, tick, resumeId, showSessions, showActivity]);

  function reconnect() {
    setStatus('connecting');
    setTick((t) => t + 1);
  }
  function startNewSession() {
    setResumeId(null);
    reconnect();
  }
  function resumeSession(id: string) {
    if (id === resumeId) return;
    setResumeId(id);
    // tick changes via setResumeId triggering useEffect rerun
  }

  const dot = status === 'open' ? '#22C55E' : status === 'closed' ? '#9CA3AF' : status === 'error' ? '#DC2626' : '#FBBF24';
  const label = status === 'open' ? 'Connected' : status === 'closed' ? 'Disconnected' : status === 'error' ? 'Error' : 'Connecting…';

  return (
    <div
      className="draft-section"
      style={{
        padding: 0,
        overflow: 'hidden',
        background: '#1A1D2A',
        border: '1px solid #2A2F40',
        display: 'grid',
        gridTemplateColumns: `${showSessions ? '220px' : '0'} 1fr ${showActivity ? '300px' : '0'}`,
        height: 'calc(100vh - 240px)',
        minHeight: 480,
      }}
    >
      {/* Sessions rail */}
      <div style={{ overflow: 'hidden', borderRight: showSessions ? '1px solid #2A2F40' : 'none' }}>
        {showSessions && (
          <SessionsRail
            activeResumeId={resumeId}
            onResume={resumeSession}
            onNewSession={startNewSession}
          />
        )}
      </div>

      {/* Terminal column */}
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid #2A2F40', background: '#15172A', gap: 8 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#E5E7EB' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: dot, display: 'inline-block' }} />
            {label}
            {resumeId && (
              <span style={{ marginLeft: 8, padding: '1px 8px', background: '#2A2F40', color: '#FBBF24', borderRadius: 999, fontSize: 10, fontFamily: 'ui-monospace, Menlo, monospace' }}>
                resumed: {resumeId.slice(0, 24)}
              </span>
            )}
          </div>
          <div style={{ display: 'inline-flex', gap: 6 }}>
            <button onClick={() => setShowSessions((s) => !s)} title="Toggle sessions" style={ToolbarBtn}>{showSessions ? '⟨ sessions' : 'sessions ⟩'}</button>
            <button onClick={() => setShowActivity((s) => !s)} title="Toggle activity" style={ToolbarBtn}>{showActivity ? 'activity ⟩' : '⟨ activity'}</button>
            <button onClick={reconnect} style={ToolbarBtn}>Reconnect</button>
          </div>
        </div>
        <div ref={containerRef} style={{ flex: 1, background: '#1A1D2A', padding: 8, minHeight: 0 }} />
      </div>

      {/* Activity rail */}
      <div style={{ overflow: 'hidden', borderLeft: showActivity ? '1px solid #2A2F40' : 'none' }}>
        {showActivity && <ActivityRail />}
      </div>
    </div>
  );
}

const ToolbarBtn: React.CSSProperties = {
  background: 'transparent',
  color: '#9CA3AF',
  border: '1px solid #2A2F40',
  padding: '4px 10px',
  borderRadius: 6,
  fontSize: 11,
  cursor: 'pointer',
};
