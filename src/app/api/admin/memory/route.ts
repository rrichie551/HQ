import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isOwner } from '@/lib/auth';
import { listMemoryFiles, readMemoryFile, writeMemoryFile } from '@/lib/hermes-fs';

export const dynamic = 'force-dynamic';

async function requireOwner() {
  const s = await getServerSession(authOptions);
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!isOwner(s)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  return null;
}

export async function GET(req: NextRequest) {
  const auth = await requireOwner();
  if (auth) return auth;
  const name = new URL(req.url).searchParams.get('name');
  if (name) {
    const f = await readMemoryFile(name);
    if (!f) return NextResponse.json({ error: 'not-found' }, { status: 404 });
    return NextResponse.json(f);
  }
  return NextResponse.json({ files: await listMemoryFiles() });
}

export async function PUT(req: NextRequest) {
  const auth = await requireOwner();
  if (auth) return auth;
  const body = (await req.json().catch(() => null)) as { name?: string; content?: string } | null;
  if (!body?.name || typeof body.content !== 'string') {
    return NextResponse.json({ error: 'name and content required' }, { status: 400 });
  }
  const res = await writeMemoryFile(body.name, body.content);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
