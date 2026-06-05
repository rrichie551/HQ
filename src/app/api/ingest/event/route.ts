import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { checkIngestAuth } from '@/lib/ingest-auth';
import { defaultVisualFor, statusFromActionType } from '@/lib/agents';
import { emit } from '@/lib/socket';

export const dynamic = 'force-dynamic';

const Schema = z.object({
  agent_slug: z.string().min(1),
  action_type: z.enum(['READ', 'DRAFT', 'SEND', 'FLAG', 'MEMORY_UPDATE', 'AGENT_COMM']),
  description: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
  minutes_saved: z.number().optional(),
  revenue_event: z.boolean().optional(),
  timestamp: z.string().datetime().optional(),
});

export async function POST(req: NextRequest) {
  const unauthorized = checkIngestAuth(req);
  if (unauthorized) return unauthorized;

  const json = await req.json().catch(() => null);
  const parsed = Schema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'invalid', details: parsed.error.format() }, { status: 400 });

  const body = parsed.data;
  const when = body.timestamp ? new Date(body.timestamp) : new Date();

  // Fire-and-forget — return 202 immediately, process in background
  setImmediate(async () => {
    try {
      const visual = defaultVisualFor(body.agent_slug);
      const agent = await prisma.agent.upsert({
        where: { slug: body.agent_slug },
        update: {
          status: statusFromActionType(body.action_type),
          lastActionAt: when,
        },
        create: {
          slug: body.agent_slug,
          name: visual.name ?? body.agent_slug,
          role: visual.role ?? 'AI Agent',
          icon: visual.icon ?? 'activity',
          color: visual.color ?? '#C0603C',
          tint: visual.tint ?? '#F6E9E2',
          status: statusFromActionType(body.action_type),
          lastActionAt: when,
          uptimeSince: when,
        },
      });

      const event = await prisma.event.create({
        data: {
          agentId: agent.id,
          actionType: body.action_type,
          description: body.description,
          metadata: body.metadata ? JSON.stringify(body.metadata) : null,
          minutesSaved: body.minutes_saved ?? 0,
          revenueEvent: body.revenue_event ?? false,
          createdAt: when,
        },
      });

      emit('event.new', {
        id: event.id,
        agent_slug: agent.slug,
        agent_name: agent.name,
        action_type: event.actionType,
        description: event.description,
        created_at: event.createdAt.toISOString(),
      });
      emit('agent.update', {
        slug: agent.slug,
        status: agent.status,
        last_action_at: agent.lastActionAt?.toISOString(),
      });
    } catch (err) {
      console.error('[ingest/event]', err);
    }
  });

  return NextResponse.json({ accepted: true }, { status: 202 });
}
