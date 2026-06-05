import { NextResponse } from 'next/server';
import { sparklines } from '@/lib/metrics';

export const dynamic = 'force-dynamic';

export async function GET() {
  const series = await sparklines();
  return NextResponse.json(series);
}
