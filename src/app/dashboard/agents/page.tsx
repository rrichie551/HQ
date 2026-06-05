import { prisma } from '@/lib/db';
import { getClientConfig } from '@/lib/client-config';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { SubNav } from '@/components/SubNav';
import { AgentAvatar, STATUS_META } from '@/components/AgentVisuals';
import { uptimeLabel, relTime, relTimeSeconds } from '@/lib/agents';

export const dynamic = 'force-dynamic';

export default async function AgentsPage() {
  const client = getClientConfig();
  const [agents, pending] = await Promise.all([
    prisma.agent.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.draft.count({ where: { status: 'PENDING' } }),
  ]);

  const counts = await Promise.all(
    agents.map(async (a) => ({
      slug: a.slug,
      eventCount: await prisma.event.count({ where: { agentId: a.id } }),
      lastEvents: await prisma.event.findMany({
        where: { agentId: a.id },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    })),
  );

  return (
    <div className="app">
      <Header client={client} attentionCount={pending} notifications={pending} />
      <SubNav />
      <div className="main" style={{ display: 'block', overflow: 'auto', padding: '24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px' }}>Agents</h1>
          <p style={{ color: 'var(--text-2)', margin: '0 0 20px' }}>{agents.length} agents · expanded details</p>

          <div style={{ display: 'grid', gap: 16 }}>
            {agents.map((a) => {
              const meta = counts.find((c) => c.slug === a.slug);
              const status = STATUS_META[a.status] ?? STATUS_META.idle;
              return (
                <div key={a.id} className="draft-section">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                    <AgentAvatar agent={{ ...a }} size={48} withStatus />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 16, fontWeight: 700 }}>{a.name}</div>
                      <div style={{ color: 'var(--text-2)', fontSize: 12 }}>{a.role}</div>
                    </div>
                    <span className={`dot-label ${status.cls}`}><span className="dot" />{status.label}</span>
                    <span className="uptime-chip">↑ {uptimeLabel(a.uptimeSince)}</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
                    <div className="metric"><div className="metric-label">Total events</div><div className="metric-value">{meta?.eventCount ?? 0}</div></div>
                    <div className="metric"><div className="metric-label">Last action</div><div className="metric-value" style={{ fontSize: 16 }}>{relTime(relTimeSeconds(a.lastActionAt))}</div></div>
                    <div className="metric"><div className="metric-label">Online since</div><div className="metric-value" style={{ fontSize: 16 }}>{a.uptimeSince ? a.uptimeSince.toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</div></div>
                  </div>

                  <h3 style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-3)', margin: '8px 0' }}>Recent events</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {meta?.lastEvents.length === 0 && <div style={{ color: 'var(--text-3)', fontSize: 12 }}>No recorded events yet.</div>}
                    {meta?.lastEvents.map((e) => (
                      <div key={e.id} style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                        <span style={{ color: 'var(--text-3)', fontVariantNumeric: 'tabular-nums', minWidth: 110 }}>
                          {e.createdAt.toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                        <span className="prio low" style={{ background: 'var(--idle-tint)' }}>{e.actionType}</span>
                        <span>{e.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
