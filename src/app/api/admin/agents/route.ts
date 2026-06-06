import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isOwner } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { scaffoldAgent } from '@/lib/hermes-fs';
import { addCron } from '@/lib/hermes-cron';

export const dynamic = 'force-dynamic';

async function requireOwner() {
  const s = await getServerSession(authOptions);
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!isOwner(s)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  return null;
}

export async function GET() {
  const auth = await requireOwner();
  if (auth) return auth;
  const agents = await prisma.agent.findMany({ orderBy: { createdAt: 'asc' } });
  return NextResponse.json(agents);
}

/**
 * Create a new agent. In Hermes' model that means:
 *   1. Write a skill file (if requested) at ~/.hermes/skills/<slug>.md
 *   2. Add an entry to config.yaml's agents: block (for visual metadata)
 *   3. Schedule a `hermes cron` so the agent actually runs autonomously
 *
 * Returns the dashboard row + a structured report of what worked. If the
 * bridge is offline the row still gets created — the cron just doesn't,
 * and the UI surfaces that so the owner can install the bridge and retry.
 */
export async function POST(req: NextRequest) {
  const auth = await requireOwner();
  if (auth) return auth;
  const body = (await req.json().catch(() => null)) as Partial<{
    slug: string; name: string; role: string; icon: string; color: string; tint: string;
    schedule: string; task: string; skill: string;
    scaffold: boolean;
  }> | null;
  if (!body?.slug || !body.name) return NextResponse.json({ error: 'slug and name required' }, { status: 400 });

  const agent = await prisma.agent.upsert({
    where: { slug: body.slug },
    update: {
      name: body.name,
      role: body.role ?? 'AI Agent',
      icon: body.icon ?? 'activity',
      color: body.color ?? '#C0603C',
      tint: body.tint ?? '#F6E9E2',
      schedule: body.schedule ?? null,
      task: body.task ?? null,
      skill: body.skill ?? null,
    },
    create: {
      slug: body.slug,
      name: body.name,
      role: body.role ?? 'AI Agent',
      icon: body.icon ?? 'activity',
      color: body.color ?? '#C0603C',
      tint: body.tint ?? '#F6E9E2',
      status: 'idle',
      uptimeSince: new Date(),
      schedule: body.schedule ?? null,
      task: body.task ?? null,
      skill: body.skill ?? null,
    },
  });

  // Scaffold the matching skill + config.yaml entry unless the caller opts out.
  let scaffold: Awaited<ReturnType<typeof scaffoldAgent>> | null = null;
  if (body.scaffold !== false) {
    try {
      scaffold = await scaffoldAgent({
        slug: agent.slug,
        name: agent.name,
        role: agent.role,
        icon: agent.icon,
        color: agent.color,
        tint: agent.tint,
      });
    } catch (e) {
      scaffold = { skillCreated: null, configUpdated: null, notes: [`scaffold failed: ${(e as Error).message}`] };
    }
  }

  // Schedule a Hermes cron so the agent actually runs.
  let cron: { ok: boolean; cronId?: string | null; error?: string } | null = null;
  if (body.schedule && body.task) {
    const r = await addCron({ schedule: body.schedule, task: body.task, skill: body.skill });
    if (r.ok) {
      cron = { ok: true, cronId: r.cronId };
      if (r.cronId) {
        await prisma.agent.update({ where: { id: agent.id }, data: { cronId: r.cronId, enabled: true } });
      }
    } else {
      cron = { ok: false, error: r.error };
    }
  }

  const final = await prisma.agent.findUnique({ where: { id: agent.id } });
  return NextResponse.json({ ...final, scaffold, cron });
}
