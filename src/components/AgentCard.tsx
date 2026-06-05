'use client';

import { AgentAvatar, STATUS_META } from './AgentVisuals';
import { Icon } from './Icon';
import { relTime } from '@/lib/agents';

export type AgentLite = {
  slug: string;
  name: string;
  role: string;
  icon: string;
  color: string;
  tint: string;
  status: string;
  last: number;
  uptime: string;
};

export function AgentCard({ agent, selected, onSelect }: { agent: AgentLite; selected?: boolean; onSelect?: (slug: string) => void }) {
  const status = STATUS_META[agent.status] ?? STATUS_META.idle;
  const running = agent.status === 'running';
  const classes = ['agent-card'];
  if (running) classes.push('active-agent');
  if (selected) classes.push('selected');
  if (agent.status === 'paused') classes.push('is-paused');
  if (agent.status === 'error') classes.push('is-error');

  return (
    <div className={classes.join(' ')} onClick={() => onSelect?.(agent.slug)} role="button" tabIndex={0}>
      <div className="agent-top">
        <AgentAvatar agent={agent} withStatus />
        <div className="agent-meta">
          <div className="agent-name">{agent.name}</div>
          <div className="agent-role">{agent.role}</div>
        </div>
      </div>
      <div className="agent-bottom">
        <span className={`dot-label ${status.cls}`}>
          <span className="dot" />
          {status.label}
          {running && (
            <span className="live-bars" aria-hidden="true"><i /><i /><i /></span>
          )}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="agent-last">{relTime(agent.last)}</span>
          <span className="uptime-chip" title="Uptime"><Icon name="arrowUp" style={{ width: 9, height: 9 }} /> {agent.uptime}</span>
        </div>
      </div>
    </div>
  );
}

export function AgentsColumn({ agents, selected, onSelect }: { agents: AgentLite[]; selected: string | null; onSelect: (slug: string) => void }) {
  const active = agents.filter((a) => a.status === 'running').length;
  return (
    <div className="col col-agents desktop-only">
      <div className="col-head">
        <span className="col-title">My Agents</span>
        <span className="count-badge"><span className="dot" />{active} active · {agents.length} total</span>
      </div>
      <div className="col-body scroll">
        <div className="agents-list">
          {agents.map((a) => (
            <AgentCard key={a.slug} agent={a} selected={selected === a.slug} onSelect={onSelect} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function AgentStrip({ agents, selected, onSelect }: { agents: AgentLite[]; selected: string | null; onSelect: (slug: string) => void }) {
  return (
    <div className="agent-strip">
      {agents.map((a) => (
        <div key={a.slug} className={`strip-chip${selected === a.slug ? ' selected' : ''}`} onClick={() => onSelect(a.slug)}>
          <div className="sc-top">
            <div className="sc-ava" style={{ background: a.tint, color: a.color }}>
              <Icon name={a.icon} />
              <span className="sc-dot" style={{ background: STATUS_META[a.status]?.color ?? '#D1D5DB' }} />
            </div>
            <div className="sc-name">{a.name}</div>
          </div>
          <div className="sc-role">{a.role}</div>
        </div>
      ))}
    </div>
  );
}
