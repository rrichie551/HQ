'use client';

import { useState } from 'react';
import { Icon } from '@/components/Icon';

export function InstallApprovalSkillButton() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  async function install() {
    setBusy(true);
    setResult(null);
    const res = await fetch('/api/admin/approval-skill', { method: 'POST' });
    setBusy(false);
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.ok) {
      setResult({ ok: false, msg: j.error ?? `HTTP ${res.status}` });
      return;
    }
    // New shape returns { paths: string[], alreadyExisted: boolean[] }
    const paths: string[] = j.paths ?? (j.path ? [j.path] : []);
    const existed: boolean[] = j.alreadyExisted ?? [];
    const lines = paths.map((p, i) => `${existed[i] ? 'Refreshed' : 'Installed'}: ${p}`);
    setResult({ ok: true, msg: lines.join(' · ') });
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <button className="btn btn-primary" onClick={install} disabled={busy} style={{ flex: 'none' }}>
        <Icon name="check" /> {busy ? 'Installing…' : 'Install routing skills'}
      </button>
      {result && (
        <div style={{
          fontSize: 12,
          padding: '8px 12px',
          borderRadius: 8,
          background: result.ok ? 'var(--running-tint)' : 'var(--danger-tint)',
          color: result.ok ? '#15803D' : '#B91C1C',
          border: `1px solid ${result.ok ? '#CBEBD6' : '#F3CFCF'}`,
        }}>
          {result.ok ? '✓' : '✗'} {result.msg}
        </div>
      )}
    </div>
  );
}
