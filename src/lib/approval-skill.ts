/**
 * Approval-routing skill for Hermes.
 *
 * When the owner clicks "Install approval skill" in /admin (or it auto-installs
 * on first boot), we write this file into ~/.hermes/skills/. It teaches Hermes
 * to route drafts through Mission Control's approval queue instead of sending
 * customer-facing replies directly.
 *
 * The template is plain markdown — Hermes reads it as procedural memory. The
 * INGEST endpoint URL and key are substituted at install time so the file is
 * self-contained on disk.
 */
import path from 'node:path';
import fs from 'node:fs/promises';
import { hermesRoot } from './hermes-fs';

export const APPROVAL_SKILL_NAME = 'mission-control-approval.md';

function template({ dashboardUrl, ingestKey }: { dashboardUrl: string; ingestKey: string }): string {
  return `# Mission Control approval routing

Source-of-truth for how to gate human-approval drafts. Installed automatically
by the Mission Control dashboard. Edit the wording if you like, but keep the
endpoints and overall flow intact.

## When this applies

This applies whenever you have produced a **customer-facing or
publicly-visible** draft (an email reply, a public comment, a DM, a social
post) that the operator might want to review before it goes out. It does NOT
apply to internal notes, your own summaries, or actions where you have an
explicit "send without review" instruction in the same task.

If you are uncertain, prefer routing through approval.

## The flow

1. After you produce a draft, **do not send it**. Instead, POST it to the
   Mission Control dashboard:

   \`\`\`
   POST ${dashboardUrl}/api/ingest/draft
   Authorization: Bearer ${ingestKey}
   Content-Type: application/json

   {
     "agent_slug":  "<your agent slug, e.g. hermes-inbox>",
     "title":       "<short headline describing what this draft is>",
     "original_message": "<the inbound message you are replying to, if any>",
     "draft_text":  "<the full proposed reply>",
     "priority":    "HIGH" | "MED" | "LOW",
     "channel":     "email" | "skool" | "slack" | "instagram_dm" | "other",
     "metadata":    { "thread_id": "...", "any_extra_context": "..." }
   }
   \`\`\`

2. The dashboard returns \`{ "accepted": true }\` immediately and queues the
   draft under "Needs Attention". The operator (or, for Slack-configured
   clients, anyone in the channel) reviews and either approves, edits, or
   rejects it.

3. **Wait for the decision.** Poll:

   \`\`\`
   GET ${dashboardUrl}/api/decisions/<draft_id>
   \`\`\`

   The response is one of:

   - \`{ "status": "PENDING" }\` — keep waiting (back off to ~5s between polls)
   - \`{ "status": "APPROVED", "final_text": "...", "approved_by": "owner" | "slack-user" }\`
     — proceed to send \`final_text\` (which may differ from your original
     draft if the operator edited it). Send the message on whatever channel
     the draft was for.
   - \`{ "status": "REJECTED", "reason": "..." }\` — discard the draft. Do
     not retry without a meaningful change of plan.

   The draft id is in the dashboard's response to step 1, or in the URL of
   the draft inside the dashboard ("/dashboard/approvals?draft=<id>").

4. Once you have sent the final text, log the send via:

   \`\`\`
   POST ${dashboardUrl}/api/ingest/event
   Authorization: Bearer ${ingestKey}
   { "agent_slug": "...", "action_type": "SEND", "description": "..." }
   \`\`\`

## Priority guide (default heuristic)

- \`HIGH\` — refund / complaint / urgent customer-impact / press inquiry
- \`MED\` — normal customer reply, booking, follow-up
- \`LOW\` — onboarding, informational, FYI

## Channel guide

Pick the channel that matches where the original message arrived from. If you
synthesised the draft from no specific channel (e.g. a proactive outreach),
pick \`other\` and explain in metadata.

## Reminders

- Don't route routine internal thinking or research summaries through this.
- Don't double-route: if a draft was already approved once, don't re-queue it.
- If the dashboard is unreachable (5xx, network), DON'T send the draft as a
  fallback — surface the error to the operator and stop.
`;
}

export type InstallResult = {
  ok: boolean;
  path: string;
  alreadyExisted: boolean;
  error?: string;
};

export async function installApprovalSkill(opts: { dashboardUrl?: string; ingestKey?: string } = {}): Promise<InstallResult> {
  const dashboardUrl = (opts.dashboardUrl ?? process.env.NEXTAUTH_URL ?? 'http://localhost:4180').replace(/\/+$/, '');
  const ingestKey = opts.ingestKey ?? process.env.INGEST_API_KEY ?? '<INGEST_API_KEY-not-configured>';
  const dest = path.join(hermesRoot(), 'skills', APPROVAL_SKILL_NAME);
  try {
    await fs.mkdir(path.dirname(dest), { recursive: true });
    let alreadyExisted = false;
    try {
      await fs.access(dest);
      alreadyExisted = true;
    } catch { /* file doesn't exist yet, that's fine */ }
    await fs.writeFile(dest, template({ dashboardUrl, ingestKey }), 'utf-8');
    return { ok: true, path: dest, alreadyExisted };
  } catch (e) {
    return { ok: false, path: dest, alreadyExisted: false, error: (e as Error).message };
  }
}
