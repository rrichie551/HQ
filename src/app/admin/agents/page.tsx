import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { AdminNav } from '@/components/AdminNav';
import { getClientConfig } from '@/lib/client-config';
import { prisma } from '@/lib/db';
import { AgentsAdminClient } from './client';

export const dynamic = 'force-dynamic';

export default async function AdminAgentsPage() {
  const client = getClientConfig();
  const [agents, pending] = await Promise.all([
    prisma.agent.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.draft.count({ where: { status: 'PENDING' } }),
  ]);
  return (
    <div className="app">
      <Header client={client} attentionCount={pending} notifications={pending} />
      <AdminNav />
      <div className="main" style={{ display: 'block', overflow: 'auto', padding: '24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px' }}>Agents</h1>
          <p style={{ color: 'var(--text-2)', margin: '0 0 20px' }}>
            Register agents that show up in the client's dashboard. Hermes still owns the actual behaviour — this manages how each one is presented.
          </p>
          <AgentsAdminClient initial={agents.map((a) => ({
            slug: a.slug, name: a.name, role: a.role, icon: a.icon,
            color: a.color, tint: a.tint, status: a.status,
          }))} />
        </div>
      </div>
      <Footer />
    </div>
  );
}
