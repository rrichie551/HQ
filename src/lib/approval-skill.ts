/**
 * Routing skills for Hermes — installed by /admin → "Install routing skills".
 *
 * Two files land in ~/.hermes/skills/ on install:
 *
 *   mission-control-approval.md — for drafts that need human review before
 *     they go out (customer-facing replies, public posts).
 *
 *   mission-control-output.md   — for autonomous scheduled outputs (reports,
 *     summaries, monitoring) that should land directly in the Completed lane
 *     without an approval gate.
 *
 * The dashboard URL + ingest key are substituted at install time so each
 * skill file is self-contained on disk.
 */
import path from 'node:path';
import fs from 'node:fs/promises';
import { hermesRoot } from './hermes-fs';

export const APPROVAL_SKILL_NAME = 'mission-control-approval.md';
export const OUTPUT_SKILL_NAME = 'mission-control-output.md';

function approvalTemplate({ dashboardUrl, ingestKey }: { dashboardUrl: string; ingestKey: string }): string {
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
   - \`{ "status": "APPROVED", "final_text": "...", "approved_by": "..." }\`
     — proceed to send \`final_text\` on whatever channel the draft was for.
   - \`{ "status": "REJECTED", "reason": "..." }\` — discard the draft.

4. Once you have sent the final text, log the send via:

   \`\`\`
   POST ${dashboardUrl}/api/ingest/event
   Authorization: Bearer ${ingestKey}
   { "agent_slug": "...", "action_type": "SEND", "description": "..." }
   \`\`\`

## Priority guide

- \`HIGH\` — refund / complaint / urgent customer-impact / press inquiry
- \`MED\` — normal customer reply, booking, follow-up
- \`LOW\` — onboarding, informational, FYI

## Reminders

- Don't route routine internal thinking or research summaries through this.
- Don't double-route: if a draft was already approved once, don't re-queue it.
- For scheduled reports / summaries / monitoring runs that don't need a
  human review, use the \`mission-control-output\` skill instead — it lands
  directly in the Completed lane.
- If the dashboard is unreachable (5xx, network), DON'T send the draft as a
  fallback — surface the error to the operator and stop.
`;
}

function outputTemplate({ dashboardUrl, ingestKey }: { dashboardUrl: string; ingestKey: string }): string {
  return `# Mission Control output (autonomous)

Source-of-truth for how to post autonomous outputs to the dashboard. Use
this skill for scheduled work that does NOT need human approval — daily
reports, weekly summaries, monitoring runs, internal-only briefs. Output
goes straight into the dashboard's "Completed" lane.

## When this applies

Use this skill when:

- You are running a scheduled cron / recurring task and producing a summary
  or report for the operator's records, not a customer-facing message.
- The task description explicitly says "no approval needed", "autonomous",
  "auto-send", "post directly", or similar.
- You produced an internal log entry, a metrics roll-up, a research note,
  or a status update.

If the output is customer-facing (reply to an email, public comment, social
post), use the \`mission-control-approval\` skill instead.

## The flow

After you complete the task and have the final output ready, POST it once:

\`\`\`
POST ${dashboardUrl}/api/ingest/draft
Authorization: Bearer ${ingestKey}
Content-Type: application/json

{
  "agent_slug":   "<your agent slug, e.g. daily-trend-watcher>",
  "title":        "<short headline, e.g. 'Daily trend report — 2026-06-06'>",
  "original_message": "<the trigger context, or the cron description>",
  "draft_text":   "<the full output / report body>",
  "priority":     "LOW",
  "channel":      "report",
  "auto_complete": true,
  "metadata":     { "run_id": "...", "any_extra_context": "..." }
}
\`\`\`

Important fields:

- \`auto_complete: true\` — this is what skips the approval gate. Without it,
  the entry would land in "Needs Attention" instead of "Completed".
- \`priority\`: usually \`LOW\` for routine reports; bump to \`MED\` or \`HIGH\`
  if the report itself flags something the operator should investigate.
- \`channel\`: use \`"report"\` for scheduled summaries, or whatever you used
  to actually deliver the output if you delivered it elsewhere (e.g.
  \`"email"\` if you also emailed the report).

The dashboard returns \`{ "accepted": true }\` immediately. No polling, no
decision callback. The entry is final.

## Logging side-effects (optional)

If the task did multiple things along the way (read N emails, queried M
data sources), you can ALSO log per-step events for the Live Feed:

\`\`\`
POST ${dashboardUrl}/api/ingest/event
Authorization: Bearer ${ingestKey}
{ "agent_slug": "...", "action_type": "READ" | "MEMORY_UPDATE" | ...,
  "description": "...", "minutes_saved": 12 }
\`\`\`

## Reminders

- One POST per completed run. Don't spam the dashboard with intermediate
  state — those go via \`/api/ingest/event\` if at all.
- Keep \`draft_text\` self-contained — it should make sense to the operator
  weeks later, scrolling back through Completed.
- If the dashboard is unreachable, retain the output locally and surface
  the error in the cron's session log.
`;
}

export type InstallResult = {
  ok: boolean;
  paths: string[];
  alreadyExisted: boolean[];
  error?: string;
};

export async function installApprovalSkill(opts: { dashboardUrl?: string; ingestKey?: string } = {}): Promise<InstallResult> {
  const dashboardUrl = (opts.dashboardUrl ?? process.env.NEXTAUTH_URL ?? 'http://localhost:4180').replace(/\/+$/, '');
  const ingestKey = opts.ingestKey ?? process.env.INGEST_API_KEY ?? '<INGEST_API_KEY-not-configured>';
  const skillsDir = path.join(hermesRoot(), 'skills');

  const files: { name: string; body: string }[] = [
    { name: APPROVAL_SKILL_NAME, body: approvalTemplate({ dashboardUrl, ingestKey }) },
    { name: OUTPUT_SKILL_NAME,   body: outputTemplate({ dashboardUrl, ingestKey }) },
  ];

  try {
    await fs.mkdir(skillsDir, { recursive: true });
    const paths: string[] = [];
    const alreadyExisted: boolean[] = [];
    for (const f of files) {
      const dest = path.join(skillsDir, f.name);
      let existed = false;
      try { await fs.access(dest); existed = true; } catch { /* not present */ }
      await fs.writeFile(dest, f.body, 'utf-8');
      paths.push(dest);
      alreadyExisted.push(existed);
    }
    return { ok: true, paths, alreadyExisted };
  } catch (e) {
    return { ok: false, paths: [], alreadyExisted: [], error: (e as Error).message };
  }
}
