import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { checkIngestAuth } from '@/lib/ingest-auth';
import { emit } from '@/lib/socket';

export const dynamic = 'force-dynamic';

const Schema = z.object({
  memory_md_chars: z.number().int().min(0),
  user_md_chars: z.number().int().min(0),
  memory_md_limit: z.number().int().positive().optional(),
  user_md_limit: z.number().int().positive().optional(),
});

export async function POST(req: NextRequest) {
  const unauthorized = checkIngestAuth(req);
  if (unauthorized) return unauthorized;

  const json = await req.json().catch(() => null);
  const parsed = Schema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'invalid', details: parsed.error.format() }, { status: 400 });
  const body = parsed.data;

  setImmediate(async () => {
    try {
      const snap = await prisma.memorySnapshot.create({
        data: {
          memoryMdChars: body.memory_md_chars,
          userMdChars: body.user_md_chars,
          memoryMdLimit: body.memory_md_limit ?? 4000,
          userMdLimit: body.user_md_limit ?? 1375,
        },
      });
      emit('memory.update', {
        memory_md_chars: snap.memoryMdChars,
        memory_md_limit: snap.memoryMdLimit,
        user_md_chars: snap.userMdChars,
        user_md_limit: snap.userMdLimit,
        pct: Math.round((snap.memoryMdChars / snap.memoryMdLimit) * 100),
      });
    } catch (err) {
      console.error('[ingest/memory]', err);
    }
  });

  return NextResponse.json({ accepted: true }, { status: 202 });
}
