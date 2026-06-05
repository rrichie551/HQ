import crypto from 'node:crypto';

const SLACK_BASE = 'https://slack.com/api';

type DraftLike = {
  id: string;
  title: string;
  draftText: string;
  priority: string;
};

function colorForPriority(priority: string): string {
  if (priority === 'HIGH') return '#DC2626';
  if (priority === 'MED') return '#F59E0B';
  return '#9CA3AF';
}

export function isSlackConfigured(): boolean {
  return Boolean(process.env.SLACK_BOT_TOKEN && process.env.SLACK_CHANNEL_ID);
}

/**
 * Post a draft approval message to the configured Slack channel.
 * Returns { channel, ts } on success so the draft row can be updated.
 */
export async function postDraftApprovalMessage(args: {
  agentName: string;
  draft: DraftLike;
  dashboardUrl: string;
}): Promise<{ ok: boolean; channel?: string; ts?: string; error?: string }> {
  if (!isSlackConfigured()) return { ok: false, error: 'slack-not-configured' };
  const { agentName, draft, dashboardUrl } = args;
  const preview = draft.draftText.length > 300 ? `${draft.draftText.slice(0, 300)}…` : draft.draftText;
  const reviewUrl = `${dashboardUrl.replace(/\/+$/, '')}/dashboard/approvals?draft=${draft.id}`;

  const body = {
    channel: process.env.SLACK_CHANNEL_ID,
    text: `${agentName} drafted a reply — review needed`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${agentName}* drafted a reply.\n*${draft.title}*  \`${draft.priority}\``,
        },
      },
      { type: 'section', text: { type: 'mrkdwn', text: '```' + preview + '```' } },
      {
        type: 'actions',
        block_id: `draft:${draft.id}`,
        elements: [
          {
            type: 'button',
            style: 'primary',
            text: { type: 'plain_text', text: '✓ Approve', emoji: true },
            value: `approve:${draft.id}`,
            action_id: 'approve_draft',
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: '✎ Edit & Approve', emoji: true },
            url: reviewUrl,
            action_id: 'edit_draft',
          },
          {
            type: 'button',
            style: 'danger',
            text: { type: 'plain_text', text: '✗ Reject', emoji: true },
            value: `reject:${draft.id}`,
            action_id: 'reject_draft',
          },
        ],
      },
      {
        type: 'context',
        elements: [
          { type: 'mrkdwn', text: `Priority: \`${draft.priority}\` · <${reviewUrl}|Open in dashboard>` },
        ],
      },
    ],
    attachments: [
      { color: colorForPriority(draft.priority), text: ' ', fallback: draft.title },
    ],
  };

  try {
    const res = await fetch(`${SLACK_BASE}/chat.postMessage`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json; charset=utf-8',
        authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
      },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as { ok: boolean; channel?: string; ts?: string; error?: string };
    if (!json.ok) return { ok: false, error: json.error };
    return { ok: true, channel: json.channel, ts: json.ts };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Update an existing Slack message to reflect the approve/reject decision. */
export async function updateDraftDecisionMessage(args: {
  channel: string;
  ts: string;
  agentName: string;
  draft: DraftLike;
  decision: 'approved' | 'rejected';
  source: 'dashboard' | 'slack';
  actor: string;
  whenIso: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!isSlackConfigured()) return { ok: false, error: 'slack-not-configured' };
  const { channel, ts, agentName, draft, decision, source, actor, whenIso } = args;
  const time = new Date(whenIso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const icon = decision === 'approved' ? '✓' : '✗';
  const verb = decision === 'approved' ? 'Approved' : 'Rejected';

  const body = {
    channel,
    ts,
    text: `${verb} by ${actor} via ${source} at ${time}`,
    blocks: [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*${agentName}* — ${draft.title}` },
      },
      {
        type: 'context',
        elements: [
          { type: 'mrkdwn', text: `${icon} *${verb}* by *${actor}* via *${source}* at ${time}` },
        ],
      },
    ],
  };

  try {
    const res = await fetch(`${SLACK_BASE}/chat.update`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json; charset=utf-8',
        authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
      },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as { ok: boolean; error?: string };
    if (!json.ok) return { ok: false, error: json.error };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * Verify Slack interactive callback signature.
 * https://api.slack.com/authentication/verifying-requests-from-slack
 */
export function verifySlackSignature(args: {
  signingSecret: string;
  timestamp: string;
  signature: string;
  rawBody: string;
}): boolean {
  const { signingSecret, timestamp, signature, rawBody } = args;
  if (!signingSecret || !timestamp || !signature) return false;
  // Reject requests older than 5 minutes
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(timestamp)) > 300) return false;
  const basestring = `v0:${timestamp}:${rawBody}`;
  const hmac = crypto.createHmac('sha256', signingSecret).update(basestring).digest('hex');
  const expected = `v0=${hmac}`;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}
