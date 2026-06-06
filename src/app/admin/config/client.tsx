'use client';

import { useState } from 'react';
import { Icon } from '@/components/Icon';

export function ConfigClient({ initial, configExists, root }: { initial: string; configExists: boolean; root: string }) {
  const [content, setContent] = useState(initial);
  const [original, setOriginal] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const dirty = content !== original;

  async function save() {
    setBusy(true); setErr(null);
    const res = await fetch('/api/admin/config', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error ?? 'save failed');
    } else {
      setOriginal(content);
    }
  }

  if (!configExists) {
    return (
      <div className="draft-section">
        <p style={{ margin: 0 }}>
          No <code>config.yaml</code> at <code>{root}</code>. Run <code>hermes setup</code> on the host to generate one,
          then refresh this page.
        </p>
      </div>
    );
  }

  return (
    <div className="draft-section">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button className="btn btn-primary" onClick={save} disabled={!dirty || busy} style={{ flex: 'none' }}>
          <Icon name="check" /> {busy ? 'Saving…' : dirty ? 'Save' : 'Saved'}
        </button>
      </div>
      {err && <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 8 }}>{err}</div>}
      <textarea
        rows={28}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        spellCheck={false}
        style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13 }}
      />
    </div>
  );
}
