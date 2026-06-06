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

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);

/** Slug priority: Hermes' Name field → task first words → short cron id. */
function deriveSlug(c: DiscoveredCron, existingSlugs: Set<string>): string {
  let base = '';
  if (c.name) base = slugify(c.name);
  if (!base && c.task) base = slugify(c.task).split('-').slice(0, 5).join('-');
  if (!base) base = `cron-${c.cronId.slice(0, 12)}`;
  let candidate = base;
  let n = 2;
  while (existingSlugs.has(candidate)) candidate = `${base}-${n++}`.slice(0, 48);
  existingSlugs.add(candidate);
  return candidate;
}

/** Display-name priority: Name (title-cased) → task first words → short cron id. */
function deriveName(c: DiscoveredCron): string {
  if (c.name) {
    return c.name
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (ch) => ch.toUpperCase())
      .slice(0, 50);
  }
  if (c.task) {
    const words = c.task.replace(/[—–|:]/g, ' ').split(/\s+/).slice(0, 5);
    if (words.length) {
      return words
        .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
        .join(' ')
        .slice(0, 50);
    }
  }
  return `Cron ${c.cronId.slice(0, 12)}`;
}

/**
 * POST /api/admin/agents/sync
 * Scans `hermes cron list` and imports any cron whose cronId isn't already
 * tracked by a dashboard Agent row. Hermes' cron list output doesn't
 * include the original natural-language task verbatim, so we synthesise
 * a task description from name/skills/workdir so the owner sees something
 * recognisable on the card.
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
    if (trackedIds.has(c.cronId)) { skipped++; continue; }

    const style = styleForCronId(c.cronId);
    const slug = deriveSlug(c, allSlugs);
    const name = deriveName(c);

    // Build a meaningful task description from what `cron list` gave us.
    const taskParts: string[] = [];
    if (c.task) taskParts.push(c.task);
    if (c.skills) taskParts.push(`Skills: ${c.skills}`);
    if (c.workdir) taskParts.push(`Workdir: ${c.workdir}`);
    const task = taskParts.length ? taskParts.join(' · ') : c.raw;

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
          task,
          skill: c.skills,
          cronId: c.cronId,
          enabled: c.enabled ?? true,
          lastActionAt: c.lastRun ? safeDate(c.lastRun) : null,
        },
      });
      imported++;
      importedRows.push({ slug: row.slug, name: row.name, cronId: c.cronId });
    } catch (e) {
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

function safeDate(s: string): Date | null {
  // Strip trailing "  ok" / "  failed" annotations Hermes adds to Last run
  const cleaned = s.replace(/\s+(ok|fail(ed)?|error)\s*$/i, '').trim();
  const d = new Date(cleaned);
  return Number.isFinite(d.getTime()) ? d : null;
}
