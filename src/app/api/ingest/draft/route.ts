import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { checkIngestAuth } from '@/lib/ingest-auth';
import { defaultVisualFor } from '@/lib/agents';
import { emit } from '@/lib/socket';
import { isSlackConfigured, postDraftApprovalMessage } from '@/lib/slack';

export const dynamic = 'force-dynamic';

const Schema = z.object({
  agent_slug: z.string().min(1),
  title: z.string().min(1),
  original_message: z.string().min(1),
  draft_text: z.string().min(1),
  priority: z.enum(['HIGH', 'MED', 'LOW']).default('MED'),
  channel: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
});

export async function POST(req: NextRequest) {
  const unauthorized = checkIngestAuth(req);
  if (unauthorized) return unauthorized;

  const json = await req.json().catch(() => null);
  const parsed = Schema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'invalid', details: parsed.error.format() }, { status: 400 });
  const body = parsed.data;

  setImmediate(async () => {
    try {
      const visual = defaultVisualFor(body.agent_slug);
      const agent = await prisma.agent.upsert({
        where: { slug: body.agent_slug },
        update: { lastActionAt: new Date(), status: 'running' },
        create: {
          slug: body.agent_slug,
          name: visual.name ?? body.agent_slug,
          role: visual.role ?? 'AI Agent',
          icon: visual.icon ?? 'activity',
          color: visual.color ?? '#C0603C',
          tint: visual.tint ?? '#F6E9E2',
          status: 'running',
          lastActionAt: new Date(),
          uptimeSince: new Date(),
        },
      });

      const draft = await prisma.draft.create({
        data: {
          agentId: agent.id,
          title: body.title,
          originalMessage: body.original_message,
          draftText: body.draft_text,
          priority: body.priority,
          channel: body.channel,
          metadata: body.metadata ? JSON.stringify(body.metadata) : null,
        },
      });

      // Also log a DRAFT event so the live feed shows it
      await prisma.event.create({
        data: {
          agentId: agent.id,
          actionType: 'DRAFT',
          description: `${agent.name} drafted a reply: ${body.title}`,
          metadata: JSON.stringify({ draft_id: draft.id, channel: body.channel }),
        },
      });

      emit('draft.new', {
        id: draft.id,
        agent_slug: agent.slug,
        agent_name: agent.name,
        title: draft.title,
        priority: draft.priority,
        channel: draft.channel,
        created_at: draft.createdAt.toISOString(),
      });

      // Fire Slack notification async
      if (isSlackConfigured()) {
        const dashboardUrl =
          process.env.NEXTAUTH_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
        const res = await postDraftApprovalMessage({
          agentName: agent.name,
          draft,
          dashboardUrl,
        });
        if (res.ok && res.channel && res.ts) {
          await prisma.draft.update({
            where: { id: draft.id },
            data: { slackChannelId: res.channel, slackMessageTs: res.ts },
          });
        }
      }
    } catch (err) {
      console.error('[ingest/draft]', err);
    }
  });

  return NextResponse.json({ accepted: true }, { status: 202 });
}
