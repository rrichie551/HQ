import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isOwner } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { listCrons, type DiscoveredCron } from '@/lib/hermes-cron';

export const dynamic = 'force-dynamic';

async function requireOwner() {
  const s = await getServerSession(authOptions);
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!isOwner(s)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  return null;
}

const PALETTE = [
  { color: '#0EA5A4', tint: '#DEF5F4', icon: 'activity' },
  { color: '#3B82F6', tint: '#E7F0FE', icon: 'calendar' },
  { color: '#8B5CF6', tint: '#EFE9FC', icon: 'chat' },
  { color: '#F59E0B', tint: '#FDF1DC', icon: 'inbox' },
  { color: '#C0603C', tint: '#F6E9E2', icon: 'mail' },
];

/** Pick a stable colour per cron id so re-syncs don't re-roll the look. */
function styleForCronId(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

/** Derive a slug from the task (first words) or the cron id as fallback. */
function deriveSlug(c: DiscoveredCron, existingSlugs: Set<string>): string {
  let base = '';
  if (c.task) {
    base = c.task
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .split('-')
      .slice(0, 5)
      .join('-')
      .slice(0, 40);
  }
  if (!base) base = `cron-${c.cronId.replace(/^cron_/, '').slice(0, 12)}`;
  let candidate = base;
  let n = 2;
  while (existingSlugs.has(candidate)) candidate = `${base}-${n++}`.slice(0, 48);
  existingSlugs.add(candidate);
  return candidate;
}

/** Derive a display name from the task (first few words, title-cased). */
function deriveName(c: DiscoveredCron): string {
  if (c.task) {
    const words = c.task.replace(/[—–|:]/g, ' ').split(/\s+/).slice(0, 5);
    if (words.length) {
      return words
        .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
        .join(' ')
        .slice(0, 50);
    }
  }
  return `Cron ${c.cronId.replace(/^cron_/, '').slice(0, 12)}`;
}

/**
 * POST /api/admin/agents/sync
 * Scans `hermes cron list` and imports any cron whose cronId isn't
 * already tracked by a dashboard Agent row. Returns counts + the raw
 * stdout so the UI can show what Hermes actually reported.
 */
export async function POST() {
  const auth = await requireOwner();
  if (auth) return auth;

  const r = await listCrons();
  if (!r.ok) {
    return NextResponse.json({ ok: false, error: r.error, discovered: 0, imported: 0, skipped: 0, raw_stdout: r.raw_stdout });
  }

  const tracked = await prisma.agent.findMany({
    where: { cronId: { not: null } },
    select: { cronId: true },
  });
  const trackedIds = new Set(tracked.map((a) => a.cronId!));
  const allSlugs = new Set((await prisma.agent.findMany({ select: { slug: true } })).map((a) => a.slug));

  let imported = 0;
  let skipped = 0;
  const importedRows: { slug: string; name: string; cronId: string }[] = [];

  for (const c of r.crons) {
    if (trackedIds.has(c.cronId)) {
      skipped++;
      continue;
    }
    const style = styleForCronId(c.cronId);
    const slug = deriveSlug(c, allSlugs);
    const name = deriveName(c);
    try {
      const row = await prisma.agent.create({
        data: {
          slug,
          name,
          role: 'Scheduled Hermes agent',
          icon: style.icon,
          color: style.color,
          tint: style.tint,
          status: 'idle',
          uptimeSince: new Date(),
          schedule: c.schedule,
          task: c.task,
          cronId: c.cronId,
          enabled: true,
        },
      });
      imported++;
      importedRows.push({ slug: row.slug, name: row.name, cronId: c.cronId });
    } catch (e) {
      // unique constraint (slug collision after retries) — skip rather than fail
      skipped++;
    }
  }

  return NextResponse.json({
    ok: true,
    discovered: r.crons.length,
    imported,
    skipped,
    importedRows,
    raw_stdout: r.raw_stdout,
  });
}
