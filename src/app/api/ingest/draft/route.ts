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
  // When true, the draft skips the owner-approval flow and lands in the
  // Completed lane immediately. Used by autonomous agents (cron-driven
  // reports, scheduled summaries, anything that doesn't need a human gate).
  auto_complete: z.boolean().optional(),
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

      // Two modes:
      //   auto_complete=true  → land in Completed straight away
      //                        (autonomous agents, scheduled reports)
      //   default             → PENDING, wait for owner approval
      // We also honour the agent row's requiresApproval flag: if the agent
      // is registered as autonomous in the dashboard, treat the post as
      // auto_complete unless the caller explicitly says otherwise.
      const autonomous = body.auto_complete ?? !agent.requiresApproval;
      const now = new Date();

      const draft = await prisma.draft.create({
        data: {
          agentId: agent.id,
          title: body.title,
          originalMessage: body.original_message,
          draftText: body.draft_text,
          priority: body.priority,
          channel: body.channel,
          metadata: body.metadata ? JSON.stringify(body.metadata) : null,
          status: autonomous ? 'COMPLETED' : 'PENDING',
          approvedAt: autonomous ? now : null,
          approvedBy: autonomous ? 'auto' : null,
          sentAt: autonomous ? now : null,
        },
      });

      // Live feed entry. Autonomous outputs get a SEND event (the agent
      // produced its output); approval-required drafts get a DRAFT event.
      await prisma.event.create({
        data: {
          agentId: agent.id,
          actionType: autonomous ? 'SEND' : 'DRAFT',
          description: autonomous
            ? `${agent.name} completed: ${body.title}`
            : `${agent.name} drafted a reply: ${body.title}`,
          metadata: JSON.stringify({ draft_id: draft.id, channel: body.channel, autonomous }),
        },
      });

      emit('draft.new', {
        id: draft.id,
        agent_slug: agent.slug,
        agent_name: agent.name,
        title: draft.title,
        priority: draft.priority,
        channel: draft.channel,
        status: draft.status,
        created_at: draft.createdAt.toISOString(),
      });

      // Slack notification only for items needing the client's eyes.
      if (!autonomous && isSlackConfigured()) {
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
