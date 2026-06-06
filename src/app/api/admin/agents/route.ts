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

export async function GET() {
  const auth = await requireOwner();
  if (auth) return auth;
  const agents = await prisma.agent.findMany({ orderBy: { createdAt: 'asc' } });
  return NextResponse.json(agents);
}

export async function POST(req: NextRequest) {
  const auth = await requireOwner();
  if (auth) return auth;
  const body = (await req.json().catch(() => null)) as Partial<{
    slug: string; name: string; role: string; icon: string; color: string; tint: string;
  }> | null;
  if (!body?.slug || !body.name) return NextResponse.json({ error: 'slug and name required' }, { status: 400 });
  const agent = await prisma.agent.upsert({
    where: { slug: body.slug },
    update: {
      name: body.name, role: body.role ?? 'AI Agent',
      icon: body.icon ?? 'activity', color: body.color ?? '#C0603C', tint: body.tint ?? '#F6E9E2',
    },
    create: {
      slug: body.slug, name: body.name, role: body.role ?? 'AI Agent',
      icon: body.icon ?? 'activity', color: body.color ?? '#C0603C', tint: body.tint ?? '#F6E9E2',
      status: 'idle', uptimeSince: new Date(),
    },
  });
  return NextResponse.json(agent);
}
