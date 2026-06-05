import { NextRequest, NextResponse } from 'next/server';
import { verifySlackSignature } from '@/lib/slack';
import { resolveDraft } from '@/lib/approvals';

export const dynamic = 'force-dynamic';

/**
 * Slack posts an x-www-form-urlencoded body with a single `payload` field
 * containing the JSON. We need the raw body for HMAC verification, so we
 * read as text and parse manually.
 */
export async function POST(req: NextRequest) {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) return NextResponse.json({ error: 'not-configured' }, { status: 500 });

  const rawBody = await req.text();
  const timestamp = req.headers.get('x-slack-request-timestamp') ?? '';
  const signature = req.headers.get('x-slack-signature') ?? '';

  if (!verifySlackSignature({ signingSecret, timestamp, signature, rawBody })) {
    return NextResponse.json({ error: 'bad-signature' }, { status: 401 });
  }

  const form = new URLSearchParams(rawBody);
  const payloadRaw = form.get('payload');
  if (!payloadRaw) return NextResponse.json({ error: 'no-payload' }, { status: 400 });

  let payload: {
    type: string;
    user?: { username?: string; name?: string; id?: string };
    actions?: { value?: string; action_id?: string }[];
  };
  try {
    payload = JSON.parse(payloadRaw);
  } catch {
    return NextResponse.json({ error: 'bad-json' }, { status: 400 });
  }

  if (payload.type !== 'block_actions' || !payload.actions?.length) {
    return NextResponse.json({ ok: true });
  }

  const action = payload.actions[0];
  const value = action.value ?? '';
  const [verb, draftId] = value.split(':');
  if (!draftId || !['approve', 'reject'].includes(verb)) {
    return NextResponse.json({ error: 'unknown-action' }, { status: 400 });
  }
  const actor = payload.user?.name ?? payload.user?.username ?? 'slack-user';

  const res = await resolveDraft({
    draftId,
    source: 'slack',
    actor,
    decision: verb === 'approve' ? 'approved' : 'rejected',
  });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.code });
  return NextResponse.json({ ok: true });
}
