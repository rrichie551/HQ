'use client';

import { useState } from 'react';
import { AgentChip } from './AgentVisuals';
import { Icon } from './Icon';

export type DraftLite = {
  id: string;
  agent_slug: string;
  agent_name: string;
  agent_color: string;
  agent_tint: string;
  agent_icon: string;
  title: string;
  draft_text?: string;
  original_message?: string;
  priority: string;
  status: string;
  created_at: string;
};

export type EventLite = {
  id: string;
  agent_slug: string;
  agent_name: string;
  agent_color: string;
  agent_tint: string;
  agent_icon: string;
  action_type: string;
  description: string;
  created_at: string;
};

function relTime(iso: string): string {
  const secs = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

function PriorityBadge({ p }: { p: string }) {
  const cls = p.toLowerCase();
  return <span className={`prio ${cls}`}>{p.toUpperCase()}</span>;
}

export function MissionAttention({
  draft,
  onApprove,
  onReject,
  busy,
}: {
  draft: DraftLite;
  onApprove: (d: DraftLite) => void;
  onReject: (d: DraftLite) => void;
  busy?: boolean;
}) {
  const agent = {
    name: draft.agent_name,
    icon: draft.agent_icon,
    color: draft.agent_color,
    tint: draft.agent_tint,
  };
  return (
    <div className="mission attn">
      <div className="m-top">
        <AgentChip agent={agent} />
        <PriorityBadge p={draft.priority} />
      </div>
      <div className="m-title">{draft.title}</div>
      {draft.draft_text && (
        <div className="m-desc">
          {draft.draft_text.length > 160 ? `${draft.draft_text.slice(0, 160)}…` : draft.draft_text}
        </div>
      )}
      <div className="m-time" style={{ marginTop: 8 }}>{relTime(draft.created_at)}</div>
      <div className="m-actions">
        <button className="btn btn-primary" onClick={() => onApprove(draft)} disabled={busy}>
          <Icon name="check" /> Approve
        </button>
        <button className="btn btn-outline" onClick={() => onReject(draft)} disabled={busy}>
          <Icon name="x" /> Reject
        </button>
      </div>
    </div>
  );
}

export function MissionProgress({ event }: { event: EventLite }) {
  const agent = {
    name: event.agent_name,
    icon: event.agent_icon,
    color: event.agent_color,
    tint: event.agent_tint,
  };
  return (
    <div className="mission">
      <div className="m-top">
        <AgentChip agent={agent} />
        <span className="m-time">{relTime(event.created_at)}</span>
      </div>
      <div className="m-title">{event.description}</div>
      <div className="m-progress">
        <div className="m-progress-track">
          <div className="m-progress-bar" style={{ width: '64%' }} />
        </div>
        <div className="m-progress-meta">
          <span>{event.action_type}</span>
          <span>working</span>
        </div>
      </div>
    </div>
  );
}

export function MissionDone({ item }: { item: { id: string; agent_name: string; agent_icon: string; agent_color: string; agent_tint: string; title: string; time: string; outcome: string } }) {
  const agent = { name: item.agent_name, icon: item.agent_icon, color: item.agent_color, tint: item.agent_tint };
  return (
    <div className="mission done">
      <div className="m-top">
        <AgentChip agent={agent} />
        <span className="m-time">{item.time}</span>
      </div>
      <div className="m-title">{item.title}</div>
      <div className="m-outcome"><Icon name="checkSmall" /> {item.outcome}</div>
    </div>
  );
}

export function Lane({ dot, name, count, children, empty }: { dot: string; name: string; count: number; children: React.ReactNode; empty: React.ReactNode }) {
  return (
    <div className="lane">
      <div className="lane-head">
        <span className="dot" style={{ background: dot }} />
        <span className="lane-name">{name}</span>
        <span className="lane-count">{count}</span>
      </div>
      <div className="lane-scroll scroll">
        {count === 0 ? empty : children}
      </div>
    </div>
  );
}

export function EmptyAttention() {
  return (
    <div className="lane-empty">
      <Icon name="sparkleEmpty" />
      <p>Nothing needs you right now.</p>
      <span style={{ fontSize: 11 }}>Your agents will flag anything that needs a decision.</span>
    </div>
  );
}

export function MissionBoard({
  drafts,
  inProgress,
  completed,
  filter,
  filters,
  setFilter,
  onApprove,
  onReject,
  busyId,
}: {
  drafts: DraftLite[];
  inProgress: EventLite[];
  completed: { id: string; agent_name: string; agent_icon: string; agent_color: string; agent_tint: string; agent_slug: string; title: string; time: string; outcome: string }[];
  filter: string;
  filters: { id: string; label: string; color?: string }[];
  setFilter: (id: string) => void;
  onApprove: (d: DraftLite) => void;
  onReject: (d: DraftLite) => void;
  busyId: string | null;
}) {
  const f = <T extends { agent_slug: string }>(list: T[]) => (filter === 'all' ? list : list.filter((m) => m.agent_slug === filter));
  const attn = f(drafts);
  const prog = f(inProgress);
  const done = f(completed);
  return (
    <>
      <div className="col-head desktop-only">
        <span className="col-title">Missions Board</span>
        <span style={{ fontSize: 11.5, color: 'var(--text-2)' }}>
          {drafts.length + inProgress.length} open · {completed.length} done today
        </span>
      </div>
      <div className="board-toolbar">
        {filters.map((ff) => (
          <button key={ff.id} className={`fchip${filter === ff.id ? ' on' : ''}`} onClick={() => setFilter(ff.id)}>
            {ff.color && <span className="fdot" style={{ background: ff.color }} />}
            {ff.label}
          </button>
        ))}
      </div>
      <div className="board">
        <Lane dot="#F59E0B" name="Needs Attention" count={attn.length} empty={<EmptyAttention />}>
          {attn.map((d) => (
            <MissionAttention key={d.id} draft={d} onApprove={onApprove} onReject={onReject} busy={busyId === d.id} />
          ))}
        </Lane>
        <Lane dot="#3B82F6" name="In Progress" count={prog.length}
          empty={<div className="lane-empty"><Icon name="activity" /><p>No active work.</p></div>}>
          {prog.map((e) => <MissionProgress key={e.id} event={e} />)}
        </Lane>
        <Lane dot="#16A34A" name="Completed" count={done.length}
          empty={<div className="lane-empty"><Icon name="checkSmall" /><p>Nothing completed yet.</p></div>}>
          {done.map((c) => <MissionDone key={c.id} item={c} />)}
        </Lane>
      </div>
    </>
  );
}
