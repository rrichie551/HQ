import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * Polled by Hermes (or any agent) while it's waiting for a human decision on
 * a draft. Bearer-auth using the same INGEST_API_KEY so external agents can
 * read decisions back without holding a dashboard session.
 *
 *   GET /api/decisions/:id
 *     200 { status: "PENDING" }
 *     200 { status: "APPROVED", final_text: "...", approved_by: "..." }
 *     200 { status: "REJECTED", reason: "..." | null }
 *     404 { error: "not-found" }
 *     401 { error: "unauthorized" }
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const key = process.env.INGEST_API_KEY;
  if (!key) return NextResponse.json({ error: 'ingest-not-configured' }, { status: 500 });
  const auth = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (auth !== key) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const d = await prisma.draft.findUnique({ where: { id: params.id } });
  if (!d) return NextResponse.json({ error: 'not-found' }, { status: 404 });

  if (d.status === 'PENDING') {
    return NextResponse.json({ status: 'PENDING' });
  }
  if (d.status === 'APPROVED' || d.status === 'SENT') {
    return NextResponse.json({
      status: 'APPROVED',
      final_text: d.editedText ?? d.draftText,
      approved_by: d.approvedBy,
      approved_at: d.approvedAt?.toISOString() ?? null,
    });
  }
  if (d.status === 'REJECTED') {
    return NextResponse.json({
      status: 'REJECTED',
      reason: null,
      approved_by: d.approvedBy,
      approved_at: d.approvedAt?.toISOString() ?? null,
    });
  }
  return NextResponse.json({ status: d.status });
}
