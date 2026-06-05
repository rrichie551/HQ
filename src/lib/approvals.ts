import { prisma } from './db';
import { emit } from './socket';
import { postDecision } from './hermes';
import { updateDraftDecisionMessage } from './slack';

type ResolveArgs = {
  draftId: string;
  source: 'dashboard' | 'slack';
  actor: string;
  decision: 'approved' | 'rejected';
  editedText?: string;
  reason?: string;
};

export async function resolveDraft(args: ResolveArgs) {
  const draft = await prisma.draft.findUnique({
    where: { id: args.draftId },
    include: { agent: true },
  });
  if (!draft) return { ok: false as const, code: 404, error: 'draft-not-found' };
  if (draft.status !== 'PENDING') return { ok: false as const, code: 409, error: `already-${draft.status.toLowerCase()}` };

  const now = new Date();
  const updated = await prisma.draft.update({
    where: { id: draft.id },
    data: {
      status: args.decision === 'approved' ? 'APPROVED' : 'REJECTED',
      approvedAt: now,
      approvedBy: args.source,
      editedText: args.editedText ?? draft.editedText,
    },
    include: { agent: true },
  });

  await prisma.event.create({
    data: {
      agentId: updated.agentId,
      actionType: args.decision === 'approved' ? 'SEND' : 'FLAG',
      description: `${args.actor} ${args.decision} draft: ${updated.title}`,
      metadata: JSON.stringify({ draft_id: updated.id, source: args.source, reason: args.reason }),
    },
  });

  emit('draft.update', {
    id: updated.id,
    status: updated.status,
    approved_by: updated.approvedBy,
    approved_at: updated.approvedAt?.toISOString(),
    source: args.source,
    actor: args.actor,
  });

  // Forward to Hermes (best effort)
  const hermesRes = await postDecision({
    draft_id: updated.id,
    decision: args.decision,
    approved_text: args.decision === 'approved' ? args.editedText ?? updated.draftText : undefined,
    reason: args.reason,
    approved_by: args.source,
  });

  // Update Slack message if we have one
  if (updated.slackChannelId && updated.slackMessageTs) {
    await updateDraftDecisionMessage({
      channel: updated.slackChannelId,
      ts: updated.slackMessageTs,
      agentName: updated.agent.name,
      draft: { id: updated.id, title: updated.title, draftText: updated.draftText, priority: updated.priority },
      decision: args.decision,
      source: args.source,
      actor: args.actor,
      whenIso: now.toISOString(),
    });
  }

  // If approved & forwarded, mark sent
  if (args.decision === 'approved' && hermesRes.ok) {
    await prisma.draft.update({ where: { id: updated.id }, data: { status: 'SENT', sentAt: new Date() } });
    emit('draft.update', { id: updated.id, status: 'SENT', source: args.source });
  }

  return { ok: true as const, draft: updated, hermes: hermesRes };
}
