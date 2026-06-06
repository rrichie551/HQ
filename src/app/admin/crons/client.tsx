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
`;

type Bridge = { ok: boolean; hermes_bin?: string; hermes_cwd?: string; error?: string };

export function CronsClient({
  initialFile,
  cronPath,
  root,
  bridge,
  cliList,
}: {
  initialFile: string;
  cronPath: string | null;
  root: string;
  bridge: Bridge;
  cliList: string | null;
}) {
  const [mode, setMode] = useState<'bridge' | 'file'>(bridge.ok ? 'bridge' : 'file');
  return (
    <>
      <BridgeStatus bridge={bridge} />
      <div className="board-toolbar" style={{ padding: '0 0 16px' }}>
        <button className={`fchip${mode === 'bridge' ? ' on' : ''}`} onClick={() => setMode('bridge')} disabled={!bridge.ok}>
          {bridge.ok ? 'Live (hermes cron CLI)' : 'Live mode (bridge offline)'}
        </button>
        <button className={`fchip${mode === 'file' ? ' on' : ''}`} onClick={() => setMode('file')}>
          File (crons.yaml)
        </button>
      </div>
      {mode === 'bridge' ? (
        <LiveMode initialList={cliList} />
      ) : (
        <FileMode initial={initialFile} cronPath={cronPath} root={root} />
      )}
    </>
  );
}

function BridgeStatus({ bridge }: { bridge: Bridge }) {
  if (bridge.ok) {
    return (
      <div style={{ background: 'var(--running-tint)', border: '1px solid #CBEBD6', color: '#15803D', borderRadius: 8, padding: '10px 14px', fontSize: 12, marginBottom: 16 }}>
        ✓ Hermes Bridge online — running <code>hermes cron …</code> on the host.
        {bridge.hermes_bin && <> Binary: <code>{bridge.hermes_bin}</code>.</>}
      </div>
    );
  }
  return (
    <div style={{ background: 'var(--accent-tint-2)', border: '1px solid #F0DDD3', color: 'var(--accent-600)', borderRadius: 8, padding: '10px 14px', fontSize: 12, marginBottom: 16 }}>
      <b>Bridge offline.</b> {bridge.error ?? 'unreachable'} — running the bridge unlocks <code>hermes cron list/add/remove</code> from this page.
      <br />Set it up: <code>sudo ./scripts/install-hermes-bridge.sh</code> on the host.
    </div>
  );
}

function LiveMode({ initialList }: { initialList: string | null }) {
  const [list, setList] = useState<string | null>(initialList);
  const [task, setTask] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function refresh() {
    setBusy(true); setErr(null);
    const res = await fetch('/api/admin/crons', { cache: 'no-store' });
    setBusy(false);
    if (!res.ok) { setErr(`fetch failed (HTTP ${res.status})`); return; }
    const j = await res.json();
    if (j.cliList) setList(j.cliList.stdout || j.cliList.stderr || '');
  }

  async function add() {
    if (!task.trim()) return;
    setBusy(true); setErr(null);
    const res = await fetch('/api/admin/crons', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'add', task: task.trim() }),
    });
    setBusy(false);
    if (!res.ok) { setErr(`add failed (HTTP ${res.status})`); return; }
    const j = await res.json();
    if (!j.ok) { setErr(j.stderr || j.error || 'hermes cron add returned non-zero'); return; }
    setTask('');
    refresh();
  }

  return (
    <>
      <div className="draft-section" style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-3)', margin: '0 0 12px' }}>
          Add a cron
        </h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={task}
            onChange={(e) => setTask(e.target.value)}
            placeholder={`e.g. "every weekday at 9am, summarise yesterday's inbox and post to #ops"`}
            style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }}
          />
          <button className="btn btn-primary" onClick={add} disabled={busy || !task.trim()} style={{ flex: 'none' }}>
            <Icon name="check" /> Add
          </button>
        </div>
        {err && <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: 8 }}>{err}</div>}
      </div>

      <div className="draft-section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-3)', margin: 0 }}>
            hermes cron list
          </h3>
          <button className="fchip" onClick={refresh} disabled={busy}>{busy ? 'Refreshing…' : 'Refresh'}</button>
        </div>
        <pre style={{ background: 'var(--bg)', padding: 16, borderRadius: 8, fontSize: 12, lineHeight: 1.5, overflow: 'auto', minHeight: 200, margin: 0 }}>
          {list || '(no output yet)'}
        </pre>
        <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8 }}>
          Remove a cron via SSH (<code>hermes cron remove &lt;id&gt;</code>), or use the file editor.
        </p>
      </div>
    </>
  );
}

function FileMode({ initial, cronPath, root }: { initial: string; cronPath: string | null; root: string }) {
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
      {err && <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 8 }}>{err}</div>}
      <textarea
        rows={24}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        spellCheck={false}
        style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13 }}
      />
    </div>
  );
}
