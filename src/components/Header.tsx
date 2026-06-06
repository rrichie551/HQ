'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Icon } from './Icon';
import { StatusPill } from './StatusPill';
import { NotificationBell } from './NotificationBell';
import { AvatarMenu } from './AvatarMenu';
import type { ClientConfig } from '@/lib/client-config';

function Clock({ tz, label }: { tz: string; label: string }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const time = now
    ? now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: tz })
    : '—';
  return (
    <div className="clock desktop-only">
      <div className="clock-time">{time}</div>
      <div className="clock-zone">{label} time</div>
    </div>
  );
}

export function Header({ client, attentionCount, notifications = 0 }: { client: ClientConfig; attentionCount: number; notifications?: number }) {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role as 'owner' | 'client' | undefined;

  return (
    <header className="header">
      <div className="brand">
        <Link href="/dashboard" className="logo-mark" aria-label="First Word Read">
          <span>FW</span>
        </Link>
        <div className="brand-divider desktop-only" />
        <div>
          <div className="client-name">{client.name}</div>
          <div className="client-tag">{client.owner} · {client.role}</div>
        </div>
      </div>
      <div className="header-center">
        <StatusPill attentionCount={attentionCount} />
      </div>
      <div className="header-right">
        {role === 'owner' && (
          <Link href="/admin" className="fchip desktop-only" style={{ background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' }}>
            <Icon name="lock" style={{ width: 12, height: 12 }} /> Admin
          </Link>
        )}
        <Clock tz={client.timezone} label={client.tzLabel} />
        <NotificationBell initialCount={notifications} />
        <AvatarMenu initials={client.initials} name={client.owner} />
      </div>
    </header>
  );
}
