'use client';

import { useEffect, useMemo, useState } from 'react';
import { AgentChip } from '@/components/AgentVisuals';
import { Icon } from '@/components/Icon';

type DraftRow = {
  id: string;
  agent_slug: string;
  agent_name: string;
  agent_color: string;
  agent_tint: string;
  agent_icon: string;
  title: string;
  original_message: string;
  draft_text: string;
  edited_text: string | null;
  priority: string;
  channel: string;
  status: string;
  created_at: string;
  approved_at: string | null;
  approved_by: string | null;
};

export function ApprovalsClient({ drafts, initialDraftId }: { drafts: DraftRow[]; initialDraftId: string | null }) {
  const [tab, setTab] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL'>('PENDING');
  const visible = useMemo(() => {
    if (tab === 'ALL') return drafts;
    if (tab === 'APPROVED') return drafts.filter((d) => d.status === 'APPROVED' || d.status === 'SENT');
    return drafts.filter((d) => d.status === tab);
  }, [drafts, tab]);

  const [active, setActive] = useState<string | null>(
    initialDraftId ?? (visible[0]?.id ?? null),
  );
  const draft = visible.find((d) => d.id === active) ?? visible[0] ?? null;

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px' }}>Approvals</h1>
      <p style={{ color: 'var(--text-2)', margin: '0 0 16px' }}>
        Review drafts before they go out. Approve in dashboard or Slack — either updates the other.
      </p>

      <div className="board-toolbar" style={{ padding: '0 0 16px' }}>
        {(['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as const).map((t) => (
          <button key={t} className={`fchip${tab === t ? ' on' : ''}`} onClick={() => { setTab(t); setActive(null); }}>{t}</button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {visible.length === 0 && (
            <div className="lane-empty"><Icon name="sparkleEmpty" /><p>Nothing here.</p></div>
          )}
          {visible.map((d) => (
            <button key={d.id} onClick={() => setActive(d.id)} className="mission" style={{
              textAlign: 'left',
              borderLeft: d.status === 'PENDING' ? '3px solid var(--attention)' : '3px solid transparent',
              borderColor: draft?.id === d.id ? 'var(--accent)' : 'var(--border-soft)',
              padding: 12,
            }}>
              <div className="m-top">
                <AgentChip agent={{ name: d.agent_name, icon: d.agent_icon, color: d.agent_color, tint: d.agent_tint }} />
                <span className={`prio ${d.priority.toLowerCase()}`}>{d.priority}</span>
              </div>
              <div className="m-title" style={{ fontSize: 12.5 }}>{d.title}</div>
              <div className="m-time" style={{ marginTop: 6 }}>
                {d.status} · {new Date(d.created_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
              </div>
            </button>
          ))}
        </div>

        {draft && <DraftEditor key={draft.id} draft={draft} />}
      </div>
    </div>
  );
}

function DraftEditor({ draft }: { draft: DraftRow }) {
  const [edited, setEdited] = useState(draft.edited_text ?? draft.draft_text);
  const [busy, setBusy] = useState<null | 'approve' | 'reject'>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { setEdited(draft.edited_text ?? draft.draft_text); }, [draft.id, draft.edited_text, draft.draft_text]);

  const dirty = edited !== (draft.edited_text ?? draft.draft_text);

  async function approve() {
    setBusy('approve'); setErr(null);
    const res = await fetch(`/api/approvals/${draft.id}/approve`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ edited_text: dirty ? edited : undefined }),
    });
    setBusy(null);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error ?? 'approve failed');
    } else {
      location.reload();
    }
  }

  async function reject() {
    setBusy('reject'); setErr(null);
    const res = await fetch(`/api/approvals/${draft.id}/reject`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    setBusy(null);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error ?? 'reject failed');
    } else {
      location.reload();
    }
  }

  const isPending = draft.status === 'PENDING';
  return (
    <div className="draft-editor">
      <div className="draft-section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--text-3)' }}>
              {draft.channel} · {draft.priority}
            </div>
            <h2 style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 700 }}>{draft.title}</h2>
          </div>
          <AgentChip agent={{ name: draft.agent_name, icon: draft.agent_icon, color: draft.agent_color, tint: draft.agent_tint }} />
        </div>
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-3)' }}>
          Status: <b style={{ color: 'var(--text)' }}>{draft.status}</b>
          {draft.approved_at && (<> · resolved {new Date(draft.approved_at).toLocaleString('en-GB')} by {draft.approved_by ?? 'unknown'}</>)}
        </div>
      </div>

      <div className="draft-section">
        <h3>Original message</h3>
        <pre>{draft.original_message}</pre>
      </div>

      <div className="draft-section">
        <h3>{isPending ? 'Draft reply (editable)' : 'Draft reply'}</h3>
        <textarea rows={10} value={edited} onChange={(e) => setEdited(e.target.value)} disabled={!isPending} />
      </div>

      {err && <div style={{ color: 'var(--danger)', fontSize: 12 }}>{err}</div>}

      {isPending && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={approve} disabled={busy !== null}>
            <Icon name="check" /> {busy === 'approve' ? 'Approving…' : dirty ? 'Approve edited' : 'Approve'}
          </button>
          <button className="btn btn-outline" onClick={reject} disabled={busy !== null}>
            <Icon name="x" /> {busy === 'reject' ? 'Rejecting…' : 'Reject'}
          </button>
        </div>
      )}
    </div>
  );
}
