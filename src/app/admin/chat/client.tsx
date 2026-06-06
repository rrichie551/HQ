'use client';

import { useEffect, useRef, useState } from 'react';

export function ChatTerminal({ bridgeOk }: { bridgeOk: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const termRef = useRef<any>(null);
  const fitRef = useRef<any>(null);
  const [status, setStatus] = useState<'connecting' | 'open' | 'closed' | 'error'>('connecting');
  const [tick, setTick] = useState(0); // bump to force reconnect

  useEffect(() => {
    if (!bridgeOk) return;
    let cancelled = false;
    let cleanup = () => {};

    (async () => {
      // xterm.js & its fit addon are heavy — load only on the client.
      const [{ Terminal }, { FitAddon }] = await Promise.all([
        import('@xterm/xterm'),
        import('@xterm/addon-fit'),
      ]);
      // CSS for the terminal styles
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
      const url = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/api/admin/term?cols=${cols}&rows=${rows}`;
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
        fitRef.current.fit();
        const { cols, rows } = termRef.current;
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ type: 'resize', cols, rows }));
        }
      };
      window.addEventListener('resize', onResize);

      cleanup = () => {
        window.removeEventListener('resize', onResize);
        try { ws.close(); } catch {}
        try { term.dispose(); } catch {}
      };
    })();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [bridgeOk, tick]);

  const dot = status === 'open' ? '#22C55E' : status === 'closed' ? '#9CA3AF' : '#DC2626';
  const label = status === 'open' ? 'Connected to Hermes' : status === 'closed' ? 'Disconnected' : status === 'error' ? 'Connection error' : 'Connecting…';

  return (
    <div className="draft-section" style={{ padding: 0, overflow: 'hidden', background: '#1A1D2A' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid #2A2F40', background: '#15172A' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#E5E7EB' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: dot, display: 'inline-block' }} />
          {label}
        </div>
        <div style={{ display: 'inline-flex', gap: 6 }}>
          <button
            onClick={() => setTick((t) => t + 1)}
            style={{ background: 'transparent', color: '#9CA3AF', border: '1px solid #2A2F40', padding: '4px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}
          >
            Reconnect
          </button>
        </div>
      </div>
      <div ref={containerRef} style={{ height: 'calc(100vh - 280px)', minHeight: 420, background: '#1A1D2A', padding: 8 }} />
    </div>
  );
}
