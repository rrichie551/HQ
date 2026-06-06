import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isOwner } from '@/lib/auth';
import { exec as bridgeExec, isHealthy } from '@/lib/hermes-bridge';

export const dynamic = 'force-dynamic';

async function requireOwner() {
  const s = await getServerSession(authOptions);
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!isOwner(s)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  return null;
}

/**
 * GET ?q=  → `hermes skills search <q>` (or `hermes skills list` if no q)
 * POST { name }  → `hermes skills install <name>`
 *
 * Both require the bridge.
 */
export async function GET(req: NextRequest) {
  const auth = await requireOwner();
  if (auth) return auth;
  const bridge = await isHealthy();
  if (!bridge.ok) return NextResponse.json({ error: 'bridge-offline', detail: bridge.error }, { status: 502 });
  const q = new URL(req.url).searchParams.get('q')?.trim();
  const args = q ? ['search', q] : ['list'];
  const r = await bridgeExec('skills', args);
  return NextResponse.json(r);
}

export async function POST(req: NextRequest) {
  const auth = await requireOwner();
  if (auth) return auth;
  const bridge = await isHealthy();
  if (!bridge.ok) return NextResponse.json({ error: 'bridge-offline', detail: bridge.error }, { status: 502 });
  const body = (await req.json().catch(() => null)) as { name?: string } | null;
  if (!body?.name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 });
  const r = await bridgeExec('skills', ['install', body.name.trim()]);
  return NextResponse.json(r);
}
