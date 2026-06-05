import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { resolveDraft } from '@/lib/approvals';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { reason?: string };
  const actor = session.user?.name ?? 'client';

  const res = await resolveDraft({
    draftId: params.id,
    source: 'dashboard',
    actor,
    decision: 'rejected',
    reason: body.reason,
  });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.code });
  return NextResponse.json({ ok: true, draft: res.draft });
}
