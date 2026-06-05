'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/dashboard', label: 'Mission Board' },
  { href: '/dashboard/approvals', label: 'Approvals' },
  { href: '/dashboard/activity', label: 'Activity' },
  { href: '/dashboard/agents', label: 'Agents' },
  { href: '/dashboard/metrics', label: 'Metrics' },
];

export function SubNav() {
  const path = usePathname();
  return (
    <nav className="subnav desktop-only">
      {TABS.map((t) => {
        const active = t.href === '/dashboard' ? path === '/dashboard' : path.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} className={active ? 'active' : ''}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
