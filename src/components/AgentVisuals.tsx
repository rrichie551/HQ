import { Icon } from './Icon';

export type AgentVisualProps = {
  agent: { name?: string; slug?: string; icon?: string; color?: string; tint?: string; status?: string };
  size?: number;
  withStatus?: boolean;
};

export const STATUS_META: Record<string, { color: string; label: string; cls: string }> = {
  running: { color: '#22C55E', label: 'Running', cls: 'st-running' },
  active: { color: '#22C55E', label: 'Running', cls: 'st-running' },
  idle: { color: '#D1D5DB', label: 'Idle', cls: 'st-idle' },
  paused: { color: '#F59E0B', label: 'Paused', cls: 'st-paused' },
  error: { color: '#DC2626', label: 'Error', cls: 'st-error' },
};

export function AgentAvatar({ agent, size = 38, withStatus = false }: AgentVisualProps) {
  const status = agent.status ?? 'idle';
  const tint = agent.tint ?? '#F6E9E2';
  const color = agent.color ?? '#C0603C';
  const icon = agent.icon ?? 'activity';
  return (
    <div className="agent-avatar" style={{ width: size, height: size, background: tint, color }}>
      <Icon name={icon} />
      {withStatus && <span className="agent-status-dot" style={{ background: STATUS_META[status]?.color ?? '#D1D5DB' }} />}
    </div>
  );
}

export function AgentChip({ agent }: { agent: { name?: string; icon?: string; color?: string; tint?: string } }) {
  return (
    <span className="agent-chip">
      <span className="ac-ava" style={{ background: agent.tint ?? '#F6E9E2', color: agent.color ?? '#C0603C' }}>
        <Icon name={agent.icon ?? 'activity'} />
      </span>
      <span className="ac-name">{agent.name}</span>
    </span>
  );
}
