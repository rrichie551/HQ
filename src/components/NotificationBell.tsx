'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Icon } from './Icon';

type PendingDraft = {
  id: string;
  title: string;
  agent_name: string;
  agent_color: string;
  agent_tint: string;
  agent_icon: string;
  priority: string;
  created_at: string;
};

function relTime(iso: string): string {
  const secs = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

/** Subscribe to Socket.io draft.new events from the dashboard's existing socket. */
function useDraftNotifications(onNewDraft: (d: PendingDraft) => void) {
  useEffect(() => {
    let socket: any = null;
    let cancelled = false;
    import('socket.io-client').then((mod) => {
      if (cancelled) return;
      const io = (mod as any).io ?? (mod as any).default?.io ?? mod;
      socket = io({ path: '/socket.io/' });
      socket.emit('join', 'dashboard');
      socket.on('draft.new', async (payload: any) => {
        // Pull the freshly-created draft to get its full preview
        try {
          const res = await fetch('/api/approvals?status=PENDING', { cache: 'no-store' });
          if (!res.ok) return;
          const list: PendingDraft[] = await res.json();
          const fresh = list.find((d) => d.id === payload.id) ?? list[0];
          if (fresh) onNewDraft(fresh);
        } catch {/* ignore */}
      });
    });
    return () => { cancelled = true; try { socket?.disconnect(); } catch {} };
  }, [onNewDraft]);
}

function fireDesktopNotification(d: PendingDraft) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  try {
    const n = new Notification(`${d.agent_name} — new draft`, {
      body: d.title,
      tag: `draft-${d.id}`,
      icon: '/icon-192.png', // optional — falls back to the favicon
    });
    n.onclick = () => {
      window.focus();
      window.location.href = `/dashboard/approvals?draft=${d.id}`;
      n.close();
    };
  } catch { /* notification permission revoked */ }
}

export function NotificationBell({ initialCount }: { initialCount: number }) {
  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState<PendingDraft[]>([]);
  const [count, setCount] = useState(initialCount);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const rootRef = useRef<HTMLDivElement>(null);

  // Load pending drafts whenever the dropdown opens
  useEffect(() => {
    if (!open) return;
    let alive = true;
    fetch('/api/approvals?status=PENDING', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : []))
      .then((list: PendingDraft[]) => {
        if (!alive) return;
        setDrafts(list);
        setCount(list.length);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [open]);

  // Close when clicking outside
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);

  // Track current Notification API permission
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window)) { setPermission('unsupported'); return; }
    setPermission(Notification.permission);
  }, []);

  // Live updates: push new drafts to the list + fire desktop notif if granted
  useDraftNotifications((fresh) => {
    setDrafts((prev) => {
      if (prev.some((d) => d.id === fresh.id)) return prev;
      const next = [fresh, ...prev].slice(0, 12);
      setCount(next.length);
      return next;
    });
    fireDesktopNotification(fresh);
  });

  async function requestPermission() {
    if (!('Notification' in window)) return;
    const res = await Notification.requestPermission();
    setPermission(res);
    if (res === 'granted') {
      // Send a confirmation notification so the user can see it works
      try { new Notification('Desktop notifications enabled', { body: "You'll be pinged when a draft needs review." }); } catch {}
    }
  }

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button className="icon-btn" aria-label="Notifications" onClick={() => setOpen((o) => !o)}>
        <Icon name="bell" />
        {count > 0 && <span className="bell-badge">{count}</span>}
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: 360,
            background: 'var(--surface)',
            border: '1px solid var(--border-soft)',
            borderRadius: 12,
            boxShadow: 'var(--shadow-lg)',
            zIndex: 60,
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border-soft)' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Pending approvals</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{count} need{count === 1 ? 's' : ''} your attention</div>
            </div>
            <Link href="/dashboard/approvals" style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', textDecoration: 'none' }} onClick={() => setOpen(false)}>
              View all →
            </Link>
          </div>

          {permission === 'default' && (
            <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-soft)', background: 'var(--accent-tint-2)' }}>
              <div style={{ fontSize: 12, color: 'var(--accent-600)', marginBottom: 6 }}>
                Get a desktop ping when a draft needs review.
              </div>
              <button className="btn btn-primary" onClick={requestPermission} style={{ flex: 'none' }}>
                Enable desktop notifications
              </button>
            </div>
          )}
          {permission === 'denied' && (
            <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-soft)', background: 'var(--bg)', fontSize: 11, color: 'var(--text-3)' }}>
              Desktop notifications are blocked. Enable them in your browser settings to get pings.
            </div>
          )}
          {permission === 'granted' && (
            <div style={{ padding: '6px 16px', borderBottom: '1px solid var(--border-soft)', background: 'var(--running-tint)', fontSize: 11, color: '#15803D' }}>
              Desktop notifications on
            </div>
          )}

          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {drafts.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>
                Nothing pending. You'll see drafts here as they arrive.
              </div>
            ) : (
              drafts.map((d) => (
                <Link
                  key={d.id}
                  href={`/dashboard/approvals?draft=${d.id}`}
                  onClick={() => setOpen(false)}
                  style={{ display: 'block', padding: '12px 16px', borderBottom: '1px solid var(--border-soft)', textDecoration: 'none', color: 'inherit' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span className="ac-ava" style={{ width: 22, height: 22, borderRadius: 6, background: d.agent_tint, color: d.agent_color, display: 'grid', placeItems: 'center' }}>
                      <Icon name={d.agent_icon} />
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>{d.agent_name}</span>
                    <span className={`prio ${d.priority.toLowerCase()}`} style={{ marginLeft: 'auto' }}>{d.priority}</span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3 }}>{d.title}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 4 }}>{relTime(d.created_at)}</div>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
