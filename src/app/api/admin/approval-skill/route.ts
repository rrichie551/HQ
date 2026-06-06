import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isOwner } from '@/lib/auth';
import { installApprovalSkill } from '@/lib/approval-skill';

export const dynamic = 'force-dynamic';

export async function POST() {
  const s = await getServerSession(authOptions);
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!isOwner(s)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const res = await installApprovalSkill();
  return NextResponse.json(res, { status: res.ok ? 200 : 500 });
}
