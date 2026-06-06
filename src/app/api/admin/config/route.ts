import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isOwner } from '@/lib/auth';
import { readConfigRaw, writeConfigRaw, getHermesStatus } from '@/lib/hermes-fs';

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
  const [content, status] = await Promise.all([readConfigRaw(), getHermesStatus()]);
  return NextResponse.json({ content, status });
}

export async function PUT(req: NextRequest) {
  const auth = await requireOwner();
  if (auth) return auth;
  const body = (await req.json().catch(() => null)) as { content?: string } | null;
  if (typeof body?.content !== 'string') return NextResponse.json({ error: 'content required' }, { status: 400 });
  await writeConfigRaw(body.content);
  return NextResponse.json({ ok: true });
}
