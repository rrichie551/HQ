'use client';

import { useState } from 'react';
import { AgentAvatar } from '@/components/AgentVisuals';
import { Icon } from '@/components/Icon';

type Agent = { slug: string; name: string; role: string; icon: string; color: string; tint: string; status: string };

const ICON_OPTIONS = ['mail', 'calendar', 'chat', 'brain', 'activity', 'inbox'];
const PALETTE: { color: string; tint: string }[] = [
  { color: '#C0603C', tint: '#F6E9E2' },
  { color: '#3B82F6', tint: '#E7F0FE' },
  { color: '#8B5CF6', tint: '#EFE9FC' },
  { color: '#0EA5A4', tint: '#DEF5F4' },
  { color: '#F59E0B', tint: '#FDF1DC' },
  { color: '#DC2626', tint: '#FBE9E9' },
];

const TEMPLATES: Agent[] = [
  { slug: 'hermes-inbox', name: 'Hermes-Inbox', role: 'Email Reply Drafting', icon: 'mail', color: '#C0603C', tint: '#F6E9E2', status: 'idle' },
  { slug: 'concierge', name: 'Concierge', role: 'Booking & Scheduling', icon: 'calendar', color: '#3B82F6', tint: '#E7F0FE', status: 'idle' },
  { slug: 'echo', name: 'Echo', role: 'Community & Comments', icon: 'chat', color: '#8B5CF6', tint: '#EFE9FC', status: 'idle' },
  { slug: 'atlas', name: 'Atlas', role: 'Knowledge & Memory', icon: 'brain', color: '#0EA5A4', tint: '#DEF5F4', status: 'idle' },
];

export function AgentsAdminClient({ initial }: { initial: Agent[] }) {
  const [agents, setAgents] = useState<Agent[]>(initial);
  const [editing, setEditing] = useState<Agent | null>(null);
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [scaffoldNote, setScaffoldNote] = useState<string | null>(null);

  async function saveAgent(a: Agent, isNew: boolean) {
    setErr(null);
    setScaffoldNote(null);
    const url = isNew ? '/api/admin/agents' : `/api/admin/agents/${encodeURIComponent(a.slug)}`;
    const method = isNew ? 'POST' : 'PATCH';
    const res = await fetch(url, {
      method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(a),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error ?? 'save failed');
      return;
    }
    const saved = await res.json();
    setAgents((cur) => {
      const exists = cur.find((x) => x.slug === a.slug);
      const next = exists ? cur.map((x) => (x.slug === a.slug ? { ...x, ...saved } : x)) : [...cur, saved];
      return next;
    });
    setEditing(null);
    setCreating(false);

    if (isNew && saved.scaffold) {
      const parts: string[] = [];
      if (saved.scaffold.skillCreated) {
        parts.push(saved.scaffold.skillCreated.alreadyExisted
          ? `skill kept: ${saved.scaffold.skillCreated.path}`
          : `skill scaffolded: ${saved.scaffold.skillCreated.path}`);
      }
      if (saved.scaffold.configUpdated) {
        parts.push(`config.yaml ${saved.scaffold.configUpdated.action}`);
      }
      if (saved.scaffold.notes?.length) parts.push(...saved.scaffold.notes);
      setScaffoldNote(parts.join(' · '));
      setTimeout(() => setScaffoldNote(null), 8000);
    }
  }

  async function deleteAgent(slug: string) {
    if (!confirm(`Delete ${slug}? This removes their events and drafts too.`)) return;
    const res = await fetch(`/api/admin/agents/${encodeURIComponent(slug)}`, { method: 'DELETE' });
    if (!res.ok) {
      setErr('delete failed');
      return;
    }
    setAgents((cur) => cur.filter((a) => a.slug !== slug));
  }

  return (
    <div>
      {err && <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 8 }}>{err}</div>}
      {scaffoldNote && (
        <div style={{ background: 'var(--running-tint)', border: '1px solid #CBEBD6', color: '#15803D', borderRadius: 8, padding: '10px 14px', fontSize: 12, marginBottom: 12 }}>
          ✓ {scaffoldNote}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button className="btn btn-primary" onClick={() => { setEditing({ slug: '', name: '', role: '', icon: 'activity', color: '#C0603C', tint: '#F6E9E2', status: 'idle' }); setCreating(true); }}>
          <Icon name="check" /> New agent
        </button>
        <span style={{ color: 'var(--text-3)', fontSize: 12, alignSelf: 'center', marginLeft: 4 }}>or quick-add a template:</span>
        {TEMPLATES.map((t) => (
          <button
            key={t.slug}
            className="fchip"
            onClick={() => saveAgent(t, true)}
            disabled={agents.some((a) => a.slug === t.slug)}
            title={agents.some((a) => a.slug === t.slug) ? 'Already added' : ''}
          >
            <span className="fdot" style={{ background: t.color }} /> {t.name}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {agents.length === 0 && (
          <div className="lane-empty" style={{ gridColumn: '1 / -1' }}>
            <p>No agents yet. Pick a template above or create one.</p>
          </div>
        )}
        {agents.map((a) => (
          <div key={a.slug} className="agent-card" style={{ cursor: 'default' }}>
            <div className="agent-top">
              <AgentAvatar agent={a} withStatus />
              <div className="agent-meta">
                <div className="agent-name">{a.name}</div>
                <div className="agent-role">{a.role}</div>
              </div>
            </div>
            <div className="agent-bottom">
              <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'monospace' }}>{a.slug}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="fchip" onClick={() => { setEditing(a); setCreating(false); }}>Edit</button>
                <button className="fchip" onClick={() => deleteAgent(a.slug)}>Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <AgentEditor
          agent={editing}
          isNew={creating}
          onSave={(a) => saveAgent(a, creating)}
          onClose={() => { setEditing(null); setCreating(false); }}
        />
      )}
    </div>
  );
}

function AgentEditor({ agent, isNew, onSave, onClose }: {
  agent: Agent; isNew: boolean;
  onSave: (a: Agent) => void; onClose: () => void;
}) {
  const [a, setA] = useState<Agent>(agent);
  const set = <K extends keyof Agent>(k: K, v: Agent[K]) => setA((cur) => ({ ...cur, [k]: v }));
  return (
    <div className="overlay-backdrop show" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'var(--surface)', borderRadius: 12, padding: 24, width: 480, maxWidth: '95vw', boxShadow: 'var(--shadow-lg)', zIndex: 102 }}
      >
        <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700 }}>{isNew ? 'New agent' : `Edit ${agent.name}`}</h2>
        <div style={{ display: 'grid', gap: 12 }}>
          <Field label="Slug (unique id)">
            <input value={a.slug} onChange={(e) => set('slug', e.target.value)} disabled={!isNew} placeholder="hermes-inbox" />
          </Field>
          <Field label="Name">
            <input value={a.name} onChange={(e) => set('name', e.target.value)} placeholder="Hermes-Inbox" />
          </Field>
          <Field label="Role">
            <input value={a.role} onChange={(e) => set('role', e.target.value)} placeholder="Email Reply Drafting" />
          </Field>
          <Field label="Icon">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {ICON_OPTIONS.map((ic) => (
                <button
                  key={ic}
                  type="button"
                  onClick={() => set('icon', ic)}
                  className="fchip"
                  style={{ background: a.icon === ic ? a.tint : 'var(--surface)', color: a.icon === ic ? a.color : 'var(--text-2)', borderColor: a.icon === ic ? a.color : 'var(--border)' }}
                >
                  <AgentAvatar agent={{ ...a, icon: ic }} size={22} />
                  {ic}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Color">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {PALETTE.map((p) => (
                <button
                  key={p.color}
                  type="button"
                  onClick={() => { set('color', p.color); set('tint', p.tint); }}
                  style={{ width: 32, height: 32, borderRadius: 8, background: p.tint, border: a.color === p.color ? `2px solid ${p.color}` : '1px solid var(--border)', cursor: 'pointer' }}
                >
                  <span style={{ display: 'block', width: 14, height: 14, borderRadius: '50%', background: p.color, margin: '0 auto' }} />
                </button>
              ))}
            </div>
          </Field>
          <Field label="Status">
            <select value={a.status} onChange={(e) => set('status', e.target.value)} style={{ padding: 8, borderRadius: 8, border: '1px solid var(--border)' }}>
              <option value="running">Running</option>
              <option value="idle">Idle</option>
              <option value="paused">Paused</option>
              <option value="error">Error</option>
            </select>
          </Field>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
          <button className="btn btn-outline" onClick={onClose} style={{ flex: 'none' }}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSave(a)} disabled={!a.slug || !a.name} style={{ flex: 'none' }}>
            <Icon name="check" /> {isNew ? 'Create' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</span>
      <style>{`
        label input { width: 100%; padding: 8px 10px; border-radius: 8px; border: 1px solid var(--border); font-size: 13px; font-family: inherit; }
        label input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-tint-2); }
      `}</style>
      {children}
    </label>
  );
}
