'use client';

import { useState } from 'react';
import { Icon } from '@/components/Icon';

const TEMPLATE = `# Hermes crons — natural-language schedules.
# Format is best-effort: edit this file directly, or use \`hermes cron\` on the host.
# Example shape (adjust to your Hermes version):
#
# - id: morning-report
#   schedule: "every weekday at 9am"
#   task: "Summarise yesterday's inbox activity and post to Slack #ops"
#
# - id: nightly-backup
#   schedule: "every day at 2am"
#   task: "Run pg_dump on production and upload the snapshot to S3"
`;

export function CronsClient({ initial, cronPath, root }: { initial: string; cronPath: string | null; root: string }) {
  const [content, setContent] = useState(initial || TEMPLATE);
  const [original, setOriginal] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [savedPath, setSavedPath] = useState<string | null>(cronPath);
  const dirty = content !== original;

  async function save() {
    setBusy(true); setErr(null);
    const res = await fetch('/api/admin/crons', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error ?? 'save failed');
    } else {
      const j = await res.json();
      setSavedPath(j.path);
      setOriginal(content);
    }
  }

  return (
    <div className="draft-section">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
        <code style={{ fontSize: 12, color: 'var(--text-3)', wordBreak: 'break-all' }}>
          {savedPath ?? `${root}/crons.yaml (will be created on save)`}
        </code>
        <button className="btn btn-primary" onClick={save} disabled={!dirty || busy} style={{ flex: 'none' }}>
          <Icon name="check" /> {busy ? 'Saving…' : dirty ? 'Save' : 'Saved'}
        </button>
      </div>
      {!cronPath && (
        <div style={{ background: 'var(--accent-tint-2)', border: '1px solid #F0DDD3', padding: 10, borderRadius: 8, fontSize: 12, color: 'var(--accent-600)', marginBottom: 12 }}>
          <b>Note:</b> Hermes' canonical cron storage path depends on your install. This editor writes to <code>crons.yaml</code> in your Hermes root. To use the official CLI instead, SSH in and run <code>hermes cron list</code> / <code>hermes cron add "…"</code>.
        </div>
      )}
      {err && <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 8 }}>{err}</div>}
      <textarea
        rows={26}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        spellCheck={false}
        style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13 }}
      />
    </div>
  );
}
