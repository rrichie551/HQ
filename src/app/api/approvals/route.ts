import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const status = url.searchParams.get('status') ?? 'PENDING';
  const drafts = await prisma.draft.findMany({
    where: status === 'ALL' ? {} : { status },
    include: { agent: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return NextResponse.json(
    drafts.map((d) => ({
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
      approved_at: d.approvedAt?.toISOString() ?? null,
      approved_by: d.approvedBy,
      sent_at: d.sentAt?.toISOString() ?? null,
      created_at: d.createdAt.toISOString(),
    })),
  );
}
