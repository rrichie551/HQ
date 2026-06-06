'use client';

import { useEffect, useState } from 'react';
import { Icon } from '@/components/Icon';

export type SessionRow = { id: string; title?: string; timestamp?: string; raw: string };

export function SessionsRail({
  activeResumeId,
  onResume,
  onNewSession,
}: {
  activeResumeId: string | null;
  onResume: (id: string) => void;
  onNewSession: () => void;
}) {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [bridgeOk, setBridgeOk] = useState<boolean | null>(null);

  async function load() {
    setBusy(true); setErr(null);
    try {
      const res = await fetch('/api/admin/sessions', { cache: 'no-store' });
      const j = await res.json();
      if (!res.ok) {
        setErr(j.error ?? `HTTP ${res.status}`);
        setBridgeOk(false);
      } else {
        setSessions(j.sessions ?? []);
        setBridgeOk(j.ok !== false);
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#15172A', color: '#E5E7EB' }}>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid #2A2F40', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#9CA3AF' }}>Sessions</div>
          <div style={{ fontSize: 10.5, color: '#6B7280', marginTop: 2 }}>{sessions.length} stored</div>
        </div>
        <button
          onClick={onNewSession}
          title="Start a fresh session"
          style={{ background: 'transparent', color: '#E5E7EB', border: '1px solid #2A2F40', padding: '4px 8px', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}
        >
          + new
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 8 }}>
        {bridgeOk === false && (
          <div style={{ fontSize: 11, color: '#FCA5A5', padding: 8 }}>
            Bridge offline. Run <code>install-hermes-bridge.sh</code> on the host.
          </div>
        )}
        {err && bridgeOk !== false && (
          <div style={{ fontSize: 11, color: '#FCA5A5', padding: 8 }}>{err}</div>
        )}
        {!err && bridgeOk && sessions.length === 0 && !busy && (
          <div style={{ fontSize: 11, color: '#6B7280', padding: 12, textAlign: 'center' }}>
            No prior sessions. Start chatting on the right.
          </div>
        )}
        {sessions.map((s) => {
          const active = activeResumeId === s.id;
          return (
            <button
              key={s.id}
              onClick={() => onResume(s.id)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '10px 12px',
                margin: '0 0 6px',
                borderRadius: 8,
                background: active ? '#2A2F40' : 'transparent',
                border: active ? '1px solid #C0603C' : '1px solid transparent',
                color: '#E5E7EB',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 12,
                lineHeight: 1.35,
              }}
              onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = '#1F2236'; }}
              onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <div style={{ fontWeight: 600, marginBottom: 3, wordBreak: 'break-word' }}>
                {s.title || s.id}
              </div>
              <div style={{ fontSize: 10, color: '#6B7280', fontFamily: 'ui-monospace, Menlo, monospace' }}>
                {s.timestamp ? `${s.timestamp} · ` : ''}{s.id.slice(0, 24)}
              </div>
            </button>
          );
        })}
      </div>

      <div style={{ padding: 10, borderTop: '1px solid #2A2F40' }}>
        <button
          onClick={load}
          disabled={busy}
          style={{ width: '100%', background: 'transparent', color: '#9CA3AF', border: '1px solid #2A2F40', padding: '6px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}
        >
          {busy ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
    </div>
  );
}
