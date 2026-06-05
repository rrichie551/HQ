import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { uptimeLabel, relTimeSeconds } from '@/lib/agents';

export const dynamic = 'force-dynamic';

export async function GET() {
  const agents = await prisma.agent.findMany({ orderBy: { createdAt: 'asc' } });
  return NextResponse.json(
    agents.map((a) => ({
      id: a.id,
      slug: a.slug,
      name: a.name,
      role: a.role,
      icon: a.icon,
      color: a.color,
      tint: a.tint,
      status: a.status,
      last: relTimeSeconds(a.lastActionAt),
      uptime: uptimeLabel(a.uptimeSince),
    })),
  );
}
