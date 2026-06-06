import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isOwner } from '@/lib/auth';
import { deleteSkill, readSkill, writeSkill } from '@/lib/hermes-fs';

export const dynamic = 'force-dynamic';

async function requireOwner() {
  const s = await getServerSession(authOptions);
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!isOwner(s)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  return null;
}

export async function GET(_req: NextRequest, { params }: { params: { name: string } }) {
  const auth = await requireOwner();
  if (auth) return auth;
  const name = decodeURIComponent(params.name);
  const skill = await readSkill(name);
  if (!skill) return NextResponse.json({ error: 'not-found' }, { status: 404 });
  return NextResponse.json(skill);
}

export async function PUT(req: NextRequest, { params }: { params: { name: string } }) {
  const auth = await requireOwner();
  if (auth) return auth;
  const name = decodeURIComponent(params.name);
  const body = (await req.json().catch(() => null)) as { content?: string } | null;
  if (typeof body?.content !== 'string') {
    return NextResponse.json({ error: 'content required' }, { status: 400 });
  }
  const res = await writeSkill(name, body.content);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ ok: true, path: res.path });
}

export async function DELETE(_req: NextRequest, { params }: { params: { name: string } }) {
  const auth = await requireOwner();
  if (auth) return auth;
  const name = decodeURIComponent(params.name);
  const res = await deleteSkill(name);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
