import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isOwner } from '@/lib/auth';
import { listSkills, readSkill, writeSkill } from '@/lib/hermes-fs';

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
  const url = new URL(req.url);
  const name = url.searchParams.get('name');
  if (name) {
    const skill = await readSkill(name);
    if (!skill) return NextResponse.json({ error: 'not-found' }, { status: 404 });
    return NextResponse.json(skill);
  }
  return NextResponse.json({ skills: await listSkills() });
}

export async function POST(req: NextRequest) {
  const auth = await requireOwner();
  if (auth) return auth;
  const body = (await req.json().catch(() => null)) as { name?: string; content?: string } | null;
  if (!body?.name || typeof body.content !== 'string') {
    return NextResponse.json({ error: 'name and content required' }, { status: 400 });
  }
  const res = await writeSkill(body.name, body.content);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ ok: true, path: res.path });
}
