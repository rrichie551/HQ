import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { checkIngestAuth } from '@/lib/ingest-auth';
import { defaultVisualFor } from '@/lib/agents';
import { emit } from '@/lib/socket';

export const dynamic = 'force-dynamic';

const Schema = z.object({
  from_agent_slug: z.string(),
  to_agent_slug: z.string(),
  topic: z.string(),
  question: z.string(),
  answer: z.string(),
});

async function upsertAgent(slug: string) {
  const v = defaultVisualFor(slug);
  return prisma.agent.upsert({
    where: { slug },
    update: {},
    create: {
      slug,
      name: v.name ?? slug,
      role: v.role ?? 'AI Agent',
      icon: v.icon ?? 'activity',
      color: v.color ?? '#C0603C',
      tint: v.tint ?? '#F6E9E2',
      lastActionAt: new Date(),
      uptimeSince: new Date(),
    },
  });
}

export async function POST(req: NextRequest) {
  const unauthorized = checkIngestAuth(req);
  if (unauthorized) return unauthorized;

  const json = await req.json().catch(() => null);
  const parsed = Schema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'invalid', details: parsed.error.format() }, { status: 400 });
  const body = parsed.data;

  setImmediate(async () => {
    try {
      const [from, to] = await Promise.all([upsertAgent(body.from_agent_slug), upsertAgent(body.to_agent_slug)]);
      const comm = await prisma.agentComm.create({
        data: {
          fromAgentId: from.id,
          toAgentId: to.id,
          topic: body.topic,
          question: body.question,
          answer: body.answer,
        },
      });

      await prisma.event.create({
        data: {
          agentId: from.id,
          actionType: 'AGENT_COMM',
          description: `${from.name} ↔ ${to.name} · ${body.topic}`,
          metadata: JSON.stringify({ comm_id: comm.id, to: to.slug, topic: body.topic }),
        },
      });

      emit('comm.new', {
        id: comm.id,
        from_slug: from.slug,
        from_name: from.name,
        to_slug: to.slug,
        to_name: to.name,
        topic: comm.topic,
        created_at: comm.createdAt.toISOString(),
      });
    } catch (err) {
      console.error('[ingest/agent-comm]', err);
    }
  });

  return NextResponse.json({ accepted: true }, { status: 202 });
}
