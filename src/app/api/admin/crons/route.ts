import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isOwner } from '@/lib/auth';
import { readCronFileRaw, writeCronFileRaw } from '@/lib/hermes-fs';
import { exec as bridgeExec, isHealthy as bridgeHealth } from '@/lib/hermes-bridge';

export const dynamic = 'force-dynamic';

async function requireOwner() {
  const s = await getServerSession(authOptions);
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!isOwner(s)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  return null;
}

/**
 * GET returns:
 *   - bridge: { ok, hermes_bin, hermes_cwd } status of the host-side bridge
 *   - cliList: stdout of `hermes cron list` if bridge is healthy
 *   - file:    raw crons.yaml on disk (fallback if no bridge)
 */
export async function GET() {
  const auth = await requireOwner();
  if (auth) return auth;

  const [bridge, file] = await Promise.all([bridgeHealth(), readCronFileRaw()]);
  let cliList: { stdout: string; stderr: string; code: number } | null = null;
  if (bridge.ok) {
    const r = await bridgeExec('cron', ['list']);
    cliList = { stdout: r.stdout, stderr: r.stderr, code: r.code };
  }
  return NextResponse.json({ bridge, file, cliList });
}

/**
 * PUT body shapes:
 *   { content: string }           — write raw crons.yaml (file mode)
 *   { action: "add", task: "…" } — run `hermes cron add "…"` via bridge
 *   { action: "remove", id: "…" } — run `hermes cron remove <id>` via bridge
 */
export async function PUT(req: NextRequest) {
  const auth = await requireOwner();
  if (auth) return auth;
  const body = (await req.json().catch(() => null)) as any;
  if (!body) return NextResponse.json({ error: 'invalid body' }, { status: 400 });

  if (body.action === 'add') {
    if (typeof body.task !== 'string' || !body.task.trim()) {
      return NextResponse.json({ error: 'task required' }, { status: 400 });
    }
    const r = await bridgeExec('cron', ['add', body.task.trim()]);
    return NextResponse.json(r);
  }
  if (body.action === 'remove') {
    if (typeof body.id !== 'string' || !body.id.trim()) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }
    const r = await bridgeExec('cron', ['remove', body.id.trim()]);
    return NextResponse.json(r);
  }
  if (typeof body.content === 'string') {
    const out = await writeCronFileRaw(body.content);
    return NextResponse.json(out);
  }
  return NextResponse.json({ error: 'unknown payload' }, { status: 400 });
}
