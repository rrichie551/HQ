import { NextRequest, NextResponse } from 'next/server';

export function checkIngestAuth(req: NextRequest): NextResponse | null {
  const key = process.env.INGEST_API_KEY;
  if (!key) return NextResponse.json({ error: 'INGEST_API_KEY not configured' }, { status: 500 });
  const auth = req.headers.get('authorization') ?? '';
  const presented = auth.replace(/^Bearer\s+/i, '').trim();
  if (presented !== key) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return null;
}
