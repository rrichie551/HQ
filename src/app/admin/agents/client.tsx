'use client';

import { useState } from 'react';
import { AgentAvatar } from '@/components/AgentVisuals';
import { Icon } from '@/components/Icon';

type Agent = {
  slug: string;
  name: string;
  role: string;
  icon: string;
  color: string;
  tint: string;
  status: string;
  schedule?: string | null;
  task?: string | null;
  skill?: string | null;
  cronId?: string | null;
  enabled?: boolean;
};

const ICON_OPTIONS = ['mail', 'calendar', 'chat', 'brain', 'activity', 'inbox'];
const PALETTE: { color: string; tint: string }[] = [
  { color: '#C0603C', tint: '#F6E9E2' },
  { color: '#3B82F6', tint: '#E7F0FE' },
  { color: '#8B5CF6', tint: '#EFE9FC' },
  { color: '#0EA5A4', tint: '#DEF5F4' },
  { color: '#F59E0B', tint: '#FDF1DC' },
  { color: '#DC2626', tint: '#FBE9E9' },
];

const STARTERS: Partial<Agent>[] = [
  { name: 'Daily Inbox Triage', role: 'Email reply drafting', icon: 'mail', color: '#C0603C', tint: '#F6E9E2',
    schedule: 'every weekday at 9am', task: 'Triage overnight inbox: read each unread email, draft a reply, and route any customer-facing reply through mission-control-approval.' },
  { name: 'Booking Concierge', role: 'Scheduling and bookings', icon: 'calendar', color: '#3B82F6', tint: '#E7F0FE',
    schedule: 'every hour from 8am to 8pm', task: 'Check booking requests, hold provisional slots, and draft confirmations for approval.' },
  { name: 'Community Echo', role: 'Comments and DMs', icon: 'chat', color: '#8B5CF6', tint: '#EFE9FC',
    schedule: 'every 2 hours during business hours', task: 'Sweep social comments and DMs. Draft replies in our voice and queue them for approval.' },
];

export function AgentsAdminClient({ initial }: { initial: Agent[] }) {
  const [agents, setAgents] = useState<Agent[]>(initial);
  const [editing, setEditing] = useState<Agent | null>(null);
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function saveAgent(a: Agent, isNew: boolean) {
    setErr(null); setNote(null);
    const url = isNew ? '/api/admin/agents' : `/api/admin/agents/${encodeURIComponent(a.slug)}`;
    const method = isNew ? 'POST' : 'PATCH';
    const res = await fetch(url, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(a) });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error ?? 'save failed');
      return;
    }
    const saved = await res.json();
    setAgents((cur) => {
      const exists = cur.find((x) => x.slug === a.slug);
      return exists ? cur.map((x) => (x.slug === a.slug ? { ...x, ...saved } : x)) : [...cur, saved];
    });
    setEditing(null);
    setCreating(false);

    const bits: string[] = [];
    if (saved.scaffold?.skillCreated) {
      bits.push(saved.scaffold.skillCreated.alreadyExisted ? `skill kept (${saved.scaffold.skillCreated.path})` : `skill written (${saved.scaffold.skillCreated.path})`);
    }
    if (saved.scaffold?.configUpdated) bits.push(`config.yaml ${saved.scaffold.configUpdated.action}`);
    if (saved.cron) {
      if (saved.cron.ok) bits.push(saved.cron.cronId ? `cron scheduled: ${saved.cron.cronId}` : 'cron scheduled (id not parsed)');
      else bits.push(`cron failed: ${saved.cron.error}`);
    }
    if (bits.length) {
      setNote(bits.join(' · '));
      setTimeout(() => setNote(null), 9000);
    }
  }

  async function deleteAgent(slug: string) {
    if (!confirm(`Delete ${slug}? This removes the Hermes cron job AND the agent row + events.`)) return;
    setErr(null); setNote(null);
    const res = await fetch(`/api/admin/agents/${encodeURIComponent(slug)}`, { method: 'DELETE' });
    if (!res.ok) { setErr('delete failed'); return; }
    const j = await res.json().catch(() => ({}));
    setAgents((cur) => cur.filter((a) => a.slug !== slug));
    if (j.cron?.error) {
      setNote(`agent removed, but cron removal failed: ${j.cron.error}`);
      setTimeout(() => setNote(null), 9000);
    }
  }

  async function togglePause(a: Agent) {
    if (!a.cronId) {
      setErr('this agent has no cron id stored — edit and re-save to create one.');
      return;
    }
    await saveAgent({ ...a, enabled: !a.enabled }, false);
  }

  return (
    <div>
      {err && <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 8 }}>{err}</div>}
      {note && (
        <div style={{ background: 'var(--running-tint)', border: '1px solid #CBEBD6', color: '#15803D', borderRadius: 8, padding: '10px 14px', fontSize: 12, marginBottom: 12 }}>
          ✓ {note}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={() => { setEditing(blankAgent()); setCreating(true); }} style={{ flex: 'none' }}>
          <Icon name="check" /> New agent
        </button>
        <span style={{ color: 'var(--text-3)', fontSize: 12, alignSelf: 'center', marginLeft: 4 }}>or start from a template:</span>
        {STARTERS.map((s) => (
          <button
            key={s.name}
            className="fchip"
            onClick={() => { setEditing({ ...blankAgent(), ...s, slug: slugify(s.name ?? '') }); setCreating(true); }}
          >
            <span className="fdot" style={{ background: s.color }} /> {s.name}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
        {agents.length === 0 && (
          <div className="lane-empty" style={{ gridColumn: '1 / -1' }}>
            <p>No agents yet. Click "+ New agent" above or pick a template.</p>
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

            {(a.schedule || a.task) && (
              <div style={{ marginTop: 12, padding: 10, background: 'var(--bg)', borderRadius: 8, fontSize: 11.5, color: 'var(--text-2)' }}>
                {a.schedule && (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                    <Icon name="calendar" style={{ width: 11, height: 11, color: 'var(--text-3)' }} />
                    <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11 }}>{a.schedule}</span>
                  </div>
                )}
                {a.task && (
                  <div style={{ fontSize: 11, color: 'var(--text-2)', lineHeight: 1.4, maxHeight: 38, overflow: 'hidden' }}>
                    {a.task}
                  </div>
                )}
              </div>
            )}

            <div className="agent-bottom" style={{ marginTop: 10, paddingTop: 10 }}>
              <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'monospace' }}>
                {a.slug}
                {a.cronId ? <span style={{ marginLeft: 6, color: a.enabled ? 'var(--running)' : 'var(--attention)' }}>● {a.enabled ? 'live' : 'paused'}</span> : <span style={{ marginLeft: 6, color: 'var(--text-3)' }}>● no cron</span>}
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                {a.cronId && (
                  <button className="fchip" onClick={() => togglePause(a)}>{a.enabled ? 'Pause' : 'Resume'}</button>
                )}
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

function blankAgent(): Agent {
  return { slug: '', name: '', role: '', icon: 'activity', color: '#C0603C', tint: '#F6E9E2', status: 'idle', schedule: '', task: '', skill: '', enabled: true };
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
}

function AgentEditor({ agent, isNew, onSave, onClose }: {
  agent: Agent; isNew: boolean;
  onSave: (a: Agent) => void; onClose: () => void;
}) {
  const [a, setA] = useState<Agent>(agent);
  const set = <K extends keyof Agent>(k: K, v: Agent[K]) => setA((cur) => ({ ...cur, [k]: v }));
  const [advanced, setAdvanced] = useState(false);

  return (
    <div className="overlay-backdrop show" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'var(--surface)', borderRadius: 12, padding: 24, width: 600, maxWidth: '95vw', maxHeight: '92vh', overflow: 'auto', boxShadow: 'var(--shadow-lg)', zIndex: 102 }}
      >
        <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700 }}>{isNew ? 'New agent' : `Edit ${agent.name}`}</h2>
        <p style={{ margin: '0 0 16px', color: 'var(--text-2)', fontSize: 12.5 }}>
          An agent is a scheduled Hermes cronjob. The dashboard creates the row, scaffolds a skill, and adds the cron via the bridge.
        </p>

        <div style={{ display: 'grid', gap: 12 }}>
          <Row label="Name">
            <input value={a.name} onChange={(e) => {
              const v = e.target.value;
              const newSlug = isNew && !a.slug ? slugify(v) : a.slug;
              setA((cur) => ({ ...cur, name: v, slug: newSlug }));
            }} placeholder="Daily Inbox Triage" />
          </Row>
          <Row label="Slug (cannot change after create)">
            <input value={a.slug} onChange={(e) => set('slug', e.target.value)} disabled={!isNew} placeholder="daily-inbox-triage" />
          </Row>
          <Row label="Role">
            <input value={a.role} onChange={(e) => set('role', e.target.value)} placeholder="Email reply drafting" />
          </Row>

          <Row label="Schedule (natural language)">
            <input value={a.schedule ?? ''} onChange={(e) => set('schedule', e.target.value)} placeholder="every weekday at 9am" />
            <Hint>e.g. "every hour", "weekdays at 8am", "every Sunday at 6pm". Hermes parses it.</Hint>
          </Row>
          <Row label="Task — what should the agent DO each tick?">
            <textarea
              rows={5}
              value={a.task ?? ''}
              onChange={(e) => set('task', e.target.value)}
              placeholder="Triage overnight inbox. For each unread email, draft a reply and route customer-facing replies through mission-control-approval."
              style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--border)', fontFamily: 'inherit', fontSize: 13 }}
            />
            <Hint>The agent will use the dashboard&apos;s mission-control-approval skill automatically if it&apos;s installed.</Hint>
          </Row>
          <Row label="Skill to invoke (optional)">
            <input value={a.skill ?? ''} onChange={(e) => set('skill', e.target.value)} placeholder="(blank = Hermes picks)" />
            <Hint>Name of a file under <code>~/.hermes/skills/</code>, without the extension.</Hint>
          </Row>

          <button type="button" onClick={() => setAdvanced((x) => !x)} style={{ background: 'transparent', border: 'none', color: 'var(--accent)', fontSize: 12, cursor: 'pointer', textAlign: 'left', padding: 0 }}>
            {advanced ? '▾ Hide visuals' : '▸ Visual settings (icon, colour)'}
          </button>
          {advanced && (
            <>
              <Row label="Icon">
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {ICON_OPTIONS.map((ic) => (
                    <button
                      key={ic}
                      type="button"
                      onClick={() => set('icon', ic)}
                      className="fchip"
                      style={{ background: a.icon === ic ? a.tint : 'var(--surface)', color: a.icon === ic ? a.color : 'var(--text-2)', borderColor: a.icon === ic ? a.color : 'var(--border)' }}
                    >
                      <AgentAvatar agent={{ ...a, icon: ic }} size={22} /> {ic}
                    </button>
                  ))}
                </div>
              </Row>
              <Row label="Colour">
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
              </Row>
            </>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
          <button className="btn btn-outline" onClick={onClose} style={{ flex: 'none' }}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSave(a)} disabled={!a.slug || !a.name} style={{ flex: 'none' }}>
            <Icon name="check" /> {isNew ? 'Create & schedule' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</span>
      <style>{`
        label input { width: 100%; padding: 8px 10px; border-radius: 8px; border: 1px solid var(--border); font-size: 13px; font-family: inherit; }
        label input:focus, label textarea:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-tint-2); }
      `}</style>
      {children}
    </label>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>{children}</div>;
}
