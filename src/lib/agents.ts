export type AgentVisual = {
  slug: string;
  name: string;
  role: string;
  icon: string;
  color: string;
  tint: string;
};

/**
 * Visual defaults — agents inherit these on first ingest if not specified.
 * Hermes can override color/icon by sending them in the agent record.
 */
export const DEFAULT_AGENTS: AgentVisual[] = [
  { slug: 'hermes-inbox', name: 'Hermes-Inbox', role: 'Email Reply Drafting', icon: 'mail', color: '#C0603C', tint: '#F6E9E2' },
  { slug: 'concierge', name: 'Concierge', role: 'Booking & Scheduling', icon: 'calendar', color: '#3B82F6', tint: '#E7F0FE' },
  { slug: 'echo', name: 'Echo', role: 'Community & Comments', icon: 'chat', color: '#8B5CF6', tint: '#EFE9FC' },
  { slug: 'atlas', name: 'Atlas', role: 'Knowledge & Memory', icon: 'brain', color: '#0EA5A4', tint: '#DEF5F4' },
];

export function defaultVisualFor(slug: string): Partial<AgentVisual> {
  const match = DEFAULT_AGENTS.find((a) => a.slug === slug);
  if (match) return match;
  // Fallback: brand color
  return { slug, name: slug, role: 'AI Agent', icon: 'activity', color: '#C0603C', tint: '#F6E9E2' };
}

export function statusFromActionType(actionType: string): 'running' | 'idle' {
  if (['READ', 'DRAFT', 'SEND', 'MEMORY_UPDATE', 'AGENT_COMM', 'FLAG'].includes(actionType)) return 'running';
  return 'idle';
}

export function uptimeLabel(start: Date | null): string {
  if (!start) return '—';
  const secs = Math.max(0, Math.floor((Date.now() - start.getTime()) / 1000));
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  if (d > 0) return `${d}d ${h}h`;
  const m = Math.floor((secs % 3600) / 60);
  return `${h}h ${m}m`;
}

export function relTimeSeconds(date: Date | null): number {
  if (!date) return 0;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
}

export function relTime(secs: number): string {
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}
