import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const agentSlug = url.searchParams.get('agent_slug') ?? undefined;
  const actionType = url.searchParams.get('action_type') ?? undefined;
  const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit') ?? 100)));

  const where: { actionType?: string; agent?: { slug: string } } = {};
  if (actionType) where.actionType = actionType;
  if (agentSlug) where.agent = { slug: agentSlug };

  const [total, events] = await Promise.all([
    prisma.event.count({ where }),
    prisma.event.findMany({
      where,
      include: { agent: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return NextResponse.json({
    total,
    page,
    limit,
    events: events.map((e) => ({
      id: e.id,
      agent_slug: e.agent.slug,
      agent_name: e.agent.name,
      agent_color: e.agent.color,
      agent_tint: e.agent.tint,
      agent_icon: e.agent.icon,
      action_type: e.actionType,
      description: e.description,
      metadata: e.metadata ? JSON.parse(e.metadata) : null,
      created_at: e.createdAt.toISOString(),
    })),
  });
}
