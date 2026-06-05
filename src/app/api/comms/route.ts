import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit') ?? 20)));
  const comms = await prisma.agentComm.findMany({
    include: { fromAgent: true, toAgent: true },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return NextResponse.json(
    comms.map((c) => ({
      id: c.id,
      from: { slug: c.fromAgent.slug, name: c.fromAgent.name, color: c.fromAgent.color, tint: c.fromAgent.tint, icon: c.fromAgent.icon },
      to: { slug: c.toAgent.slug, name: c.toAgent.name, color: c.toAgent.color, tint: c.toAgent.tint, icon: c.toAgent.icon },
      topic: c.topic,
      question: c.question,
      answer: c.answer,
      created_at: c.createdAt.toISOString(),
    })),
  );
}
