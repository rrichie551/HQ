import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const snap = await prisma.memorySnapshot.findFirst({ orderBy: { createdAt: 'desc' } });
  if (!snap) {
    return NextResponse.json({
      memory_md_chars: 0,
      memory_md_limit: 4000,
      user_md_chars: 0,
      user_md_limit: 1375,
      pct: 0,
      label: 'MEMORY.MD',
    });
  }
  return NextResponse.json({
    memory_md_chars: snap.memoryMdChars,
    memory_md_limit: snap.memoryMdLimit,
    user_md_chars: snap.userMdChars,
    user_md_limit: snap.userMdLimit,
    pct: Math.round((snap.memoryMdChars / snap.memoryMdLimit) * 100),
    label: 'MEMORY.MD',
    updated_at: snap.createdAt.toISOString(),
  });
}
