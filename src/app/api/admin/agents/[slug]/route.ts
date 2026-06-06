import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isOwner } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

async function requireOwner() {
  const s = await getServerSession(authOptions);
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!isOwner(s)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  return null;
}

export async function PATCH(req: NextRequest, { params }: { params: { slug: string } }) {
  const auth = await requireOwner();
  if (auth) return auth;
  const body = (await req.json().catch(() => null)) as Partial<{
    name: string; role: string; icon: string; color: string; tint: string; status: string;
  }> | null;
  if (!body) return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  const agent = await prisma.agent.update({
    where: { slug: params.slug },
    data: {
      name: body.name,
      role: body.role,
      icon: body.icon,
      color: body.color,
      tint: body.tint,
      status: body.status,
    },
  });
  return NextResponse.json(agent);
}

export async function DELETE(_req: NextRequest, { params }: { params: { slug: string } }) {
  const auth = await requireOwner();
  if (auth) return auth;
  await prisma.event.deleteMany({ where: { agent: { slug: params.slug } } });
  await prisma.draft.deleteMany({ where: { agent: { slug: params.slug } } });
  await prisma.agentComm.deleteMany({ where: { OR: [{ fromAgent: { slug: params.slug } }, { toAgent: { slug: params.slug } }] } });
  await prisma.agent.delete({ where: { slug: params.slug } });
  return NextResponse.json({ ok: true });
}
