'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/chat', label: 'Chat' },
  { href: '/admin/agents', label: 'Agents' },
  { href: '/admin/skills', label: 'Skills' },
  { href: '/admin/memory', label: 'Memory' },
  { href: '/admin/crons', label: 'Crons' },
  { href: '/admin/config', label: 'Config' },
];

export function AdminNav() {
  const path = usePathname();
  return (
    <nav className="subnav">
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--accent)', marginRight: 12 }}>
        Admin
      </span>
      {TABS.map((t) => {
        const active = t.href === '/admin' ? path === '/admin' : path.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} className={active ? 'active' : ''}>
            {t.label}
          </Link>
        );
      })}
      <div style={{ marginLeft: 'auto' }}>
        <Link href="/dashboard" className="fchip">← Back to dashboard</Link>
      </div>
    </nav>
  );
}
