import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getClientConfig } from '@/lib/client-config';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { SubNav } from '@/components/SubNav';

export const dynamic = 'force-dynamic';

type Search = { agent_slug?: string; action_type?: string; page?: string };

export default async function ActivityPage({ searchParams }: { searchParams: Search }) {
  const client = getClientConfig();
  const page = Math.max(1, Number(searchParams.page ?? 1));
  const limit = 100;
  const where: { actionType?: string; agent?: { slug: string } } = {};
  if (searchParams.action_type) where.actionType = searchParams.action_type;
  if (searchParams.agent_slug) where.agent = { slug: searchParams.agent_slug };

  const [total, events, agents, pending] = await Promise.all([
    prisma.event.count({ where }),
    prisma.event.findMany({
      where,
      include: { agent: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.agent.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.draft.count({ where: { status: 'PENDING' } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const types = ['READ', 'DRAFT', 'SEND', 'FLAG', 'MEMORY_UPDATE', 'AGENT_COMM'];

  return (
    <div className="app">
      <Header client={client} attentionCount={pending} notifications={pending} />
      <SubNav />
      <div className="main" style={{ display: 'block', overflow: 'auto', padding: '24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px' }}>Activity log</h1>
          <p style={{ color: 'var(--text-2)', margin: '0 0 20px' }}>
            {total.toLocaleString()} events · page {page} of {totalPages}
          </p>

          <form method="get" className="board-toolbar" style={{ padding: '0 0 16px' }}>
            <select name="agent_slug" defaultValue={searchParams.agent_slug ?? ''} className="fchip" style={{ padding: '6px 12px' }}>
              <option value="">All agents</option>
              {agents.map((a) => (<option key={a.slug} value={a.slug}>{a.name}</option>))}
            </select>
            <select name="action_type" defaultValue={searchParams.action_type ?? ''} className="fchip" style={{ padding: '6px 12px' }}>
              <option value="">All actions</option>
              {types.map((t) => (<option key={t} value={t}>{t}</option>))}
            </select>
            <button type="submit" className="fchip on">Apply</button>
          </form>

          <div className="draft-section">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--text-3)', borderBottom: '1px solid var(--border-soft)' }}>
                  <th style={{ padding: '10px 8px', fontWeight: 600 }}>When</th>
                  <th style={{ padding: '10px 8px', fontWeight: 600 }}>Agent</th>
                  <th style={{ padding: '10px 8px', fontWeight: 600 }}>Action</th>
                  <th style={{ padding: '10px 8px', fontWeight: 600 }}>Description</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} style={{ borderBottom: '1px solid var(--border-soft)' }}>
                    <td style={{ padding: '10px 8px', color: 'var(--text-2)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      {e.createdAt.toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}>
                      <span className="agent-chip">
                        <span className="ac-ava" style={{ background: e.agent.tint, color: e.agent.color }} />
                        <span className="ac-name" style={{ color: 'var(--text)' }}>{e.agent.name}</span>
                      </span>
                    </td>
                    <td style={{ padding: '10px 8px' }}>
                      <span className="prio low" style={{ background: 'var(--idle-tint)' }}>{e.actionType}</span>
                    </td>
                    <td style={{ padding: '10px 8px', color: 'var(--text)' }}>{e.description}</td>
                  </tr>
                ))}
                {events.length === 0 && (
                  <tr><td colSpan={4} style={{ padding: 32, textAlign: 'center', color: 'var(--text-3)' }}>No events match these filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'space-between' }}>
            <Link className="fchip" href={`/dashboard/activity?page=${Math.max(1, page - 1)}${searchParams.agent_slug ? `&agent_slug=${searchParams.agent_slug}` : ''}${searchParams.action_type ? `&action_type=${searchParams.action_type}` : ''}`}>
              ← Prev
            </Link>
            <Link className="fchip" href={`/dashboard/activity?page=${Math.min(totalPages, page + 1)}${searchParams.agent_slug ? `&agent_slug=${searchParams.agent_slug}` : ''}${searchParams.action_type ? `&action_type=${searchParams.action_type}` : ''}`}>
              Next →
            </Link>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
