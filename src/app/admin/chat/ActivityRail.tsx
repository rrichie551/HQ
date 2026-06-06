'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { Icon } from '@/components/Icon';

type PendingDraft = {
  id: string;
  title: string;
  agent_name: string;
  agent_color: string;
  agent_tint: string;
  agent_icon: string;
  priority: string;
  draft_text?: string;
  created_at: string;
};

type ActivityEvent = {
  id: string;
  agent_name: string;
  agent_color: string;
  agent_tint: string;
  agent_icon: string;
  action_type: string;
  description: string;
  created_at: string;
};

function relTime(iso: string): string {
  const secs = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (secs < 5) return 'just now';
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

const ACTION_BADGE: Record<string, { bg: string; fg: string; label: string }> = {
  READ:           { bg: '#1E3A5F', fg: '#93C5FD', label: 'READ' },
  DRAFT:          { bg: '#4A2F1F', fg: '#FBBF24', label: 'DRAFT' },
  SEND:           { bg: '#1F3F2F', fg: '#6EE7B7', label: 'SEND' },
  FLAG:           { bg: '#4A1F1F', fg: '#FCA5A5', label: 'FLAG' },
  MEMORY_UPDATE:  { bg: '#3A2F4F', fg: '#C4B5FD', label: 'MEMORY' },
  AGENT_COMM:     { bg: '#3A2F4F', fg: '#A78BFA', label: 'COMMS' },
};

export function ActivityRail() {
  const [drafts, setDrafts] = useState<PendingDraft[]>([]);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const socketRef = useRef<Socket | null>(null);

  const refreshDrafts = useCallback(async () => {
    try {
      const res = await fetch('/api/approvals?status=PENDING', { cache: 'no-store' });
      if (!res.ok) return;
      setDrafts(await res.json());
    } catch { /* ignore */ }
  }, []);

  const refreshEvents = useCallback(async () => {
    try {
      const res = await fetch('/api/activity?limit=30', { cache: 'no-store' });
      if (!res.ok) return;
      const j = await res.json();
      setEvents(j.events ?? []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    refreshDrafts();
    refreshEvents();
    const socket = io({ path: '/socket.io/' });
    socketRef.current = socket;
    socket.emit('join', 'dashboard');
    socket.on('event.new', refreshEvents);
    socket.on('draft.new', refreshDrafts);
    socket.on('draft.update', () => { refreshDrafts(); refreshEvents(); });
    return () => {
      try { socket.disconnect(); } catch {}
      socketRef.current = null;
    };
  }, [refreshDrafts, refreshEvents]);

  async function approve(d: PendingDraft) {
    const res = await fetch(`/api/approvals/${d.id}/approve`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    if (res.ok) refreshDrafts();
  }
  async function reject(d: PendingDraft) {
    const res = await fetch(`/api/approvals/${d.id}/reject`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    if (res.ok) refreshDrafts();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#15172A', color: '#E5E7EB' }}>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid #2A2F40' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#9CA3AF' }}>
          Pending approvals
          <span style={{ marginLeft: 8, padding: '1px 8px', background: drafts.length ? '#4A2F1F' : '#2A2F40', color: drafts.length ? '#FBBF24' : '#6B7280', borderRadius: 999, fontSize: 10 }}>
            {drafts.length}
          </span>
        </div>
      </div>

      <div style={{ maxHeight: '40%', overflowY: 'auto', borderBottom: '1px solid #2A2F40' }}>
        {drafts.length === 0 ? (
          <div style={{ padding: 16, fontSize: 11, color: '#6B7280', textAlign: 'center' }}>
            Nothing pending. Drafts Hermes routes through the approval skill will appear here.
          </div>
        ) : (
          drafts.map((d) => (
            <div key={d.id} style={{ padding: '10px 12px', borderBottom: '1px solid #1F2236' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ width: 18, height: 18, borderRadius: 5, background: d.agent_tint, color: d.agent_color, display: 'grid', placeItems: 'center' }}>
                  <Icon name={d.agent_icon} />
                </span>
                <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600 }}>{d.agent_name}</span>
                <span style={{ marginLeft: 'auto', fontSize: 9, padding: '1px 6px', borderRadius: 4, fontWeight: 700, letterSpacing: '.04em',
                  background: d.priority === 'HIGH' ? '#4A1F1F' : d.priority === 'MED' ? '#4A2F1F' : '#2A2F40',
                  color: d.priority === 'HIGH' ? '#FCA5A5' : d.priority === 'MED' ? '#FBBF24' : '#9CA3AF',
                }}>{d.priority}</span>
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 650, lineHeight: 1.3, color: '#E5E7EB' }}>{d.title}</div>
              {d.draft_text && (
                <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4, lineHeight: 1.4, maxHeight: 32, overflow: 'hidden' }}>
                  {d.draft_text.slice(0, 90)}{d.draft_text.length > 90 ? '…' : ''}
                </div>
              )}
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <button onClick={() => approve(d)} style={{ flex: 1, padding: '5px 8px', borderRadius: 6, background: '#C0603C', color: '#fff', border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                  ✓ Approve
                </button>
                <button onClick={() => reject(d)} style={{ flex: 1, padding: '5px 8px', borderRadius: 6, background: 'transparent', color: '#9CA3AF', border: '1px solid #2A2F40', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                  ✗ Reject
                </button>
              </div>
              <div style={{ fontSize: 9.5, color: '#6B7280', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{relTime(d.created_at)}</div>
            </div>
          ))
        )}
      </div>

      <div style={{ padding: '12px 14px', borderBottom: '1px solid #2A2F40' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#9CA3AF' }}>
          Live activity
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {events.length === 0 ? (
          <div style={{ padding: 16, fontSize: 11, color: '#6B7280', textAlign: 'center' }}>
            No events yet.
          </div>
        ) : (
          events.map((e) => {
            const badge = ACTION_BADGE[e.action_type] ?? { bg: '#2A2F40', fg: '#9CA3AF', label: e.action_type };
            return (
              <div key={e.id} style={{ padding: '8px 12px', borderBottom: '1px solid #1F2236' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <span style={{ width: 16, height: 16, borderRadius: 4, background: e.agent_tint, color: e.agent_color, display: 'grid', placeItems: 'center' }}>
                    <Icon name={e.agent_icon} />
                  </span>
                  <span style={{ fontSize: 10.5, color: '#9CA3AF', fontWeight: 600 }}>{e.agent_name}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 9, padding: '1px 6px', borderRadius: 4, background: badge.bg, color: badge.fg, fontWeight: 700, letterSpacing: '.04em' }}>{badge.label}</span>
                </div>
                <div style={{ fontSize: 11.5, color: '#E5E7EB', lineHeight: 1.35 }}>{e.description}</div>
                <div style={{ fontSize: 9.5, color: '#6B7280', marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>{relTime(e.created_at)}</div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
