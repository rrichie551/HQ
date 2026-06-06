'use client';

import { useState } from 'react';
import { AdminFileEditor } from '@/components/AdminFileEditor';
import { Icon } from '@/components/Icon';

type Skill = { name: string; size: number; modified: string; preview?: string };

export function SkillsClient({ initialSkills, initialName }: { initialSkills: Skill[]; initialName?: string }) {
  return (
    <>
      <InstallFromRegistry />
      <AdminFileEditor
        items={initialSkills}
        initialName={initialName}
        createLabel="+ New skill"
        emptyMessage="No skills found. Create your first one above, or install one from the registry."
        fetchItem={async (name) => {
          const res = await fetch(`/api/admin/skills/${encodeURIComponent(name)}`);
          if (!res.ok) return null;
          const j = await res.json();
          return { content: j.content };
        }}
        saveItem={async (name, content) => {
          const res = await fetch('/api/admin/skills', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ name, content }),
          });
          if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            return { ok: false, error: j.error ?? 'save failed' };
          }
          return { ok: true };
        }}
        deleteItem={async (name) => {
          const res = await fetch(`/api/admin/skills/${encodeURIComponent(name)}`, { method: 'DELETE' });
          if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            return { ok: false, error: j.error ?? 'delete failed' };
          }
          return { ok: true };
        }}
      />
    </>
  );
}

function InstallFromRegistry() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [output, setOutput] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [installName, setInstallName] = useState('');

  async function search() {
    setBusy(true); setOutput(null);
    const url = q.trim() ? `/api/admin/skills/install?q=${encodeURIComponent(q.trim())}` : '/api/admin/skills/install';
    const res = await fetch(url);
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setOutput(`Error: ${j.error ?? `HTTP ${res.status}`}${j.detail ? ` (${j.detail})` : ''}`);
      return;
    }
    const j = await res.json();
    setOutput(j.stdout || j.stderr || '(no output)');
  }

  async function install() {
    if (!installName.trim()) return;
    setBusy(true); setOutput(null);
    const res = await fetch('/api/admin/skills/install', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: installName.trim() }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setOutput(`Error: ${j.error ?? `HTTP ${res.status}`}`);
      return;
    }
    const j = await res.json();
    setOutput(j.stdout || j.stderr || '(no output)');
    if (j.ok) setTimeout(() => location.reload(), 1200);
  }

  return (
    <div className="draft-section" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-3)', margin: 0 }}>
          Hermes skill registry
        </h3>
        <button className="fchip" onClick={() => setOpen((o) => !o)}>{open ? 'Hide' : 'Browse / install'}</button>
      </div>
      {open && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input
              placeholder="Search registry (e.g. gmail, calendar, telegram)…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }}
            />
            <button className="btn btn-outline" onClick={search} disabled={busy} style={{ flex: 'none' }}>
              {busy ? '…' : 'Search'}
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input
              placeholder="Exact skill name to install"
              value={installName}
              onChange={(e) => setInstallName(e.target.value)}
              style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }}
            />
            <button className="btn btn-primary" onClick={install} disabled={busy || !installName.trim()} style={{ flex: 'none' }}>
              <Icon name="check" /> {busy ? '…' : 'Install'}
            </button>
          </div>
          {output && (
            <pre style={{ background: 'var(--bg)', padding: 12, borderRadius: 8, fontSize: 12, maxHeight: 280, overflow: 'auto', margin: 0 }}>
              {output}
            </pre>
          )}
          <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8 }}>
            Runs <code>hermes skills search</code> / <code>install</code> on the host via the bridge. Needs the bridge to be online.
          </p>
        </div>
      )}
    </div>
  );
}
