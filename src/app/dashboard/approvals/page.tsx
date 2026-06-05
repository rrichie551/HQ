import { prisma } from '@/lib/db';
import { getClientConfig } from '@/lib/client-config';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { SubNav } from '@/components/SubNav';
import { ApprovalsClient } from './client';

export const dynamic = 'force-dynamic';

export default async function ApprovalsPage({ searchParams }: { searchParams: { draft?: string } }) {
  const client = getClientConfig();
  const drafts = await prisma.draft.findMany({
    include: { agent: true },
    orderBy: { createdAt: 'desc' },
    take: 80,
  });
  const pendingCount = drafts.filter((d) => d.status === 'PENDING').length;
  const view = drafts.map((d) => ({
    id: d.id,
    agent_slug: d.agent.slug,
    agent_name: d.agent.name,
    agent_color: d.agent.color,
    agent_tint: d.agent.tint,
    agent_icon: d.agent.icon,
    title: d.title,
    original_message: d.originalMessage,
    draft_text: d.draftText,
    edited_text: d.editedText,
    priority: d.priority,
    channel: d.channel,
    status: d.status,
    created_at: d.createdAt.toISOString(),
    approved_at: d.approvedAt?.toISOString() ?? null,
    approved_by: d.approvedBy,
  }));

  return (
    <div className="app">
      <Header client={client} attentionCount={pendingCount} notifications={pendingCount} />
      <SubNav />
      <div className="main" style={{ display: 'block', overflow: 'auto', padding: '24px' }}>
        <ApprovalsClient drafts={view} initialDraftId={searchParams.draft ?? null} />
      </div>
      <Footer />
    </div>
  );
}
