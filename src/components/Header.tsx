'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Icon } from './Icon';
import { StatusPill } from './StatusPill';
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
        <Clock tz={client.timezone} label={client.tzLabel} />
        <button className="icon-btn" aria-label="Notifications">
          <Icon name="bell" />
          {notifications > 0 && <span className="bell-badge">{notifications}</span>}
        </button>
        <div className="avatar-initials" title={client.owner}>{client.initials}</div>
      </div>
    </header>
  );
}
