'use client';

import { useEffect, useRef, useState } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { Icon } from './Icon';

export function AvatarMenu({ initials, name }: { initials: string; name: string }) {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role as 'owner' | 'client' | undefined;
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        className="avatar-initials"
        title={name}
        onClick={() => setOpen((o) => !o)}
        style={{ border: open ? '1px solid var(--accent)' : undefined }}
      >
        {initials}
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            minWidth: 220,
            background: 'var(--surface)',
            border: '1px solid var(--border-soft)',
            borderRadius: 12,
            boxShadow: 'var(--shadow-lg)',
            zIndex: 60,
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-soft)' }}>
            <div style={{ fontSize: 13, fontWeight: 650 }}>{name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
              {role ? `Signed in as ${role}` : 'Signed in'}
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '10px 14px',
              border: 'none',
              background: 'transparent',
              textAlign: 'left',
              fontSize: 13,
              color: 'var(--text)',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'var(--bg)')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
          >
            <Icon name="close" style={{ width: 14, height: 14 }} />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
