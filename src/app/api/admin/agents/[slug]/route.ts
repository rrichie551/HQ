import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isOwner } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { addCron, removeCron, setCronEnabled } from '@/lib/hermes-cron';

export const dynamic = 'force-dynamic';

async function requireOwner() {
  const s = await getServerSession(authOptions);
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!isOwner(s)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  return null;
}

/**
 * PATCH an agent. Special handling for cron-affecting fields:
 *   - changing schedule/task/skill removes the old Hermes cron and
 *     creates a fresh one (Hermes cron rules aren't editable in-place)
 *   - flipping `enabled` calls hermes cron enable/disable
 */
export async function PATCH(req: NextRequest, { params }: { params: { slug: string } }) {
  const auth = await requireOwner();
  if (auth) return auth;
  const body = (await req.json().catch(() => null)) as Partial<{
    name: string; role: string; icon: string; color: string; tint: string; status: string;
    schedule: string; task: string; skill: string; enabled: boolean;
  }> | null;
  if (!body) return NextResponse.json({ error: 'invalid body' }, { status: 400 });

  const current = await prisma.agent.findUnique({ where: { slug: params.slug } });
  if (!current) return NextResponse.json({ error: 'not-found' }, { status: 404 });

  // Determine whether the cron needs rebuilding
  const scheduleChanged = body.schedule !== undefined && body.schedule !== current.schedule;
  const taskChanged = body.task !== undefined && body.task !== current.task;
  const skillChanged = body.skill !== undefined && body.skill !== current.skill;
  const cronRebuild = scheduleChanged || taskChanged || skillChanged;

  let cron: { ok: boolean; cronId?: string | null; error?: string } | null = null;

  if (cronRebuild) {
    // Remove the old cron (best-effort)
    if (current.cronId) {
      const r = await removeCron(current.cronId);
      if (!r.ok) cron = { ok: false, error: `remove old cron failed: ${r.error}` };
    }
    const schedule = body.schedule ?? current.schedule;
    const task = body.task ?? current.task;
    const skill = body.skill ?? current.skill ?? undefined;
    if (schedule && task) {
      const r = await addCron({ schedule, task, skill: skill ?? undefined });
      if (r.ok) cron = { ok: true, cronId: r.cronId };
      else cron = { ok: false, error: r.error };
    }
  } else if (body.enabled !== undefined && body.enabled !== current.enabled && current.cronId) {
    const r = await setCronEnabled(current.cronId, body.enabled);
    cron = r.ok ? { ok: true, cronId: r.cronId } : { ok: false, error: r.error };
  }

  const updated = await prisma.agent.update({
    where: { slug: params.slug },
    data: {
      name: body.name,
      role: body.role,
      icon: body.icon,
      color: body.color,
      tint: body.tint,
      status: body.status,
      schedule: body.schedule,
      task: body.task,
      skill: body.skill,
      enabled: body.enabled,
      cronId: cron?.ok && cron.cronId ? cron.cronId : cronRebuild ? null : current.cronId,
    },
  });
  return NextResponse.json({ ...updated, cron });
}

export async function DELETE(_req: NextRequest, { params }: { params: { slug: string } }) {
  const auth = await requireOwner();
  if (auth) return auth;
  const current = await prisma.agent.findUnique({ where: { slug: params.slug } });
  if (!current) return NextResponse.json({ error: 'not-found' }, { status: 404 });

  // Best-effort: remove the Hermes cron too. Failure here doesn't block the
  // dashboard delete — the owner can clean up the cron via /admin/crons.
  let cron: { ok: boolean; error?: string } | null = null;
  if (current.cronId) {
    const r = await removeCron(current.cronId);
    cron = r.ok ? { ok: true } : { ok: false, error: r.error };
  }

  await prisma.event.deleteMany({ where: { agentId: current.id } });
  await prisma.draft.deleteMany({ where: { agentId: current.id } });
  await prisma.agentComm.deleteMany({ where: { OR: [{ fromAgentId: current.id }, { toAgentId: current.id }] } });
  await prisma.agent.delete({ where: { id: current.id } });
  return NextResponse.json({ ok: true, cron });
}
