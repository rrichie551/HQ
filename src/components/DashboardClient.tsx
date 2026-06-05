'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { ClientConfig } from '@/lib/client-config';

import { Header } from './Header';
import { Footer } from './Footer';
import { AgentsColumn, AgentStrip, type AgentLite } from './AgentCard';
import { MissionBoard, type DraftLite, type EventLite } from './MissionBoard';
import { RightColumn, FeedBody, type FeedItem } from './ActivityFeed';
import { MetricCard, type MetricItem } from './MetricCard';
import { CommsPanel, type CommThread } from './CommsPanel';
import { Toast, type ToastItem } from './Toast';
import { StatusPill } from './StatusPill';
import { Icon } from './Icon';

type DashboardData = {
  agents: AgentLite[];
  pendingDrafts: DraftLite[];
  completed: { id: string; agent_slug: string; agent_name: string; agent_icon: string; agent_color: string; agent_tint: string; title: string; time: string; outcome: string }[];
  inProgress: EventLite[];
  feed: FeedItem[];
  metrics: MetricItem[];
  sparklines: Record<string, number[]>;
  comms: { id: string; from: any; to: any; topic: string; question: string; answer: string; created_at: string }[];
  memoryPct: number;
};

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${url} ${res.status}`);
  return res.json() as Promise<T>;
}

function eventToFeedItem(e: any, recentComms: any[] = []): FeedItem {
  const map: Record<string, FeedItem['kind']> = {
    READ: 'email',
    DRAFT: 'email',
    SEND: 'email',
    AGENT_COMM: 'comms',
    MEMORY_UPDATE: 'memory',
    FLAG: 'flag',
  };
  const kind = (map[e.action_type] ?? 'task') as FeedItem['kind'];
  const item: FeedItem = {
    id: e.id,
    kind,
    agent_slug: e.agent_slug,
    agent_name: e.agent_name,
    agent_color: e.agent_color,
    agent_tint: e.agent_tint,
    agent_icon: e.agent_icon,
    description: e.description.startsWith('<') ? e.description : `<b>${e.agent_name}</b> ${e.description.replace(new RegExp(`^${e.agent_name}\\s*`, 'i'), '')}`,
    created_at: e.created_at,
  };
  if (kind === 'comms') {
    const meta = typeof e.metadata === 'string' ? safeParse(e.metadata) : e.metadata;
    if (meta?.to) {
      const peer = recentComms.find((c) => c.topic === meta.topic && (c.to.slug === meta.to || c.from.slug === meta.to));
      if (peer) {
        const to = peer.to.slug === e.agent_slug ? peer.from : peer.to;
        item.comm = {
          to_slug: to.slug,
          to_name: to.name,
          to_color: to.color,
          to_tint: to.tint,
          to_icon: to.icon,
          topic: meta.topic ?? peer.topic,
        };
      }
    }
  }
  return item;
}

function safeParse(s: string | null | undefined): any {
  if (!s) return null;
  try { return JSON.parse(s); } catch { return null; }
}

export function DashboardClient({
  client,
  initial,
  filters,
}: {
  client: ClientConfig;
  initial: DashboardData;
  filters: { id: string; label: string; color?: string }[];
}) {
  const [agents, setAgents] = useState<AgentLite[]>(initial.agents);
  const [drafts, setDrafts] = useState<DraftLite[]>(initial.pendingDrafts);
  const [completed, setCompleted] = useState(initial.completed);
  const [inProgress, setInProgress] = useState<EventLite[]>(initial.inProgress);
  const [feed, setFeed] = useState<FeedItem[]>(initial.feed);
  const [metrics, setMetrics] = useState<MetricItem[]>(initial.metrics);
  const [memoryPct, setMemoryPct] = useState<number>(initial.memoryPct);
  const [recentComms, setRecentComms] = useState(initial.comms);
  const [filter, setFilter] = useState<string>('all');
  const [comms, setComms] = useState<{ open: boolean; thread: CommThread | null }>({ open: false, thread: null });
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [sheet, setSheet] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [freshId, setFreshId] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const pushToast = useCallback((msg: string, icon = 'check') => {
    const id = `t${Date.now()}${Math.random()}`;
    setToasts((t) => [...t, { id, msg, icon }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  }, []);

  const refreshDrafts = useCallback(async () => {
    try {
      const list = await fetchJSON<DraftLite[]>('/api/approvals?status=PENDING');
      setDrafts(list);
    } catch {/* ignore */}
  }, []);

  const refreshCompleted = useCallback(async () => {
    try {
      const all = await fetchJSON<DraftLite[]>('/api/approvals?status=ALL');
      setCompleted(
        all
          .filter((d) => d.status === 'APPROVED' || d.status === 'SENT' || d.status === 'REJECTED')
          .slice(0, 12)
          .map((d) => ({
            id: d.id,
            agent_slug: d.agent_slug,
            agent_name: d.agent_name,
            agent_icon: d.agent_icon,
            agent_color: d.agent_color,
            agent_tint: d.agent_tint,
            title: d.title,
            time: new Date(d.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
            outcome: d.status === 'SENT' ? 'Approved · sent' : d.status === 'APPROVED' ? 'Approved' : 'Rejected',
          })),
      );
    } catch {/* ignore */}
  }, []);

  const refreshMetrics = useCallback(async () => {
    try {
      const w = await fetchJSON<{ metrics: MetricItem[] }>('/api/metrics/week');
      const s = await fetchJSON<Record<string, number[]>>('/api/metrics/sparklines');
      const series: Record<string, number[]> = {
        msg: s.messages_handled,
        draft: s.drafts_created,
        appr: s.approvals_completed,
        rt: s.avg_response_secs,
      };
      setMetrics(w.metrics.map((m) => ({ ...m, spark: series[m.id] ?? [] })));
    } catch {/* ignore */}
  }, []);

  /* socket.io */
  useEffect(() => {
    const socket = io({ path: '/socket.io/' });
    socketRef.current = socket;
    socket.emit('join', 'dashboard');

    socket.on('event.new', (payload: any) => {
      const item: FeedItem = {
        id: payload.id,
        kind: 'task',
        agent_slug: payload.agent_slug,
        agent_name: payload.agent_name,
        agent_color: '#C0603C',
        agent_tint: '#F6E9E2',
        agent_icon: 'activity',
        description: `<b>${payload.agent_name}</b> ${payload.description}`,
        created_at: payload.created_at,
      };
      const fresh = { ...item, id: `live-${payload.id}` };
      setFeed((prev) => [fresh, ...prev].slice(0, 50));
      setFreshId(fresh.id);
      setTimeout(() => setFreshId(null), 1200);
    });

    socket.on('draft.new', () => {
      refreshDrafts();
    });

    socket.on('draft.update', () => {
      refreshDrafts();
      refreshCompleted();
      refreshMetrics();
    });

    socket.on('comm.new', () => {
      // refresh comms list
      fetchJSON<typeof initial.comms>('/api/comms').then(setRecentComms).catch(() => {});
    });

    socket.on('agent.update', (payload: any) => {
      setAgents((prev) => prev.map((a) => (a.slug === payload.slug ? { ...a, status: payload.status, last: 0 } : a)));
    });

    socket.on('memory.update', (payload: any) => {
      if (typeof payload.pct === 'number') setMemoryPct(payload.pct);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [refreshDrafts, refreshCompleted, refreshMetrics, initial.comms]);

  const onSelectAgent = (id: string) => setFilter((f) => (f === id ? 'all' : id));

  const onApprove = useCallback(
    async (m: DraftLite) => {
      setBusyId(m.id);
      try {
        const res = await fetch(`/api/approvals/${m.id}/approve`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
        if (!res.ok) {
          pushToast('Approve failed', 'x');
        } else {
          pushToast(`Approved — ${m.agent_name} is sending it now`);
        }
      } finally {
        setBusyId(null);
        refreshDrafts();
        refreshCompleted();
        refreshMetrics();
      }
    },
    [pushToast, refreshDrafts, refreshCompleted, refreshMetrics],
  );

  const onReject = useCallback(
    async (m: DraftLite) => {
      setBusyId(m.id);
      try {
        const res = await fetch(`/api/approvals/${m.id}/reject`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
        if (!res.ok) {
          pushToast('Reject failed', 'x');
        } else {
          pushToast('Rejected — agent will discard the draft');
        }
      } finally {
        setBusyId(null);
        refreshDrafts();
        refreshCompleted();
        refreshMetrics();
      }
    },
    [pushToast, refreshDrafts, refreshCompleted, refreshMetrics],
  );

  const openComms = useCallback(
    (entry: FeedItem) => {
      const peer = entry.comm
        ? recentComms.find((c) => c.topic === entry.comm!.topic && (c.from.slug === entry.agent_slug || c.to.slug === entry.agent_slug))
        : recentComms[0];
      if (!peer) return;
      const thread: CommThread = {
        from: peer.from,
        to: peer.to,
        topic: peer.topic,
        summary: `${peer.from.name} checked shared knowledge with ${peer.to.name} before acting.`,
        log: [
          { who: 'a', time: new Date(peer.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }), msg: peer.question },
          { who: 'b', time: new Date(peer.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }), msg: peer.answer },
        ],
      };
      setComms({ open: true, thread });
    },
    [recentComms],
  );

  const closeComms = () => setComms((c) => ({ ...c, open: false }));

  /* Esc closes overlays */
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { closeComms(); setSheet(false); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  /* periodically refresh server-derived metrics / agents */
  useEffect(() => {
    const t = setInterval(() => {
      refreshMetrics();
      fetchJSON<AgentLite[]>('/api/agents').then(setAgents).catch(() => {});
    }, 30_000);
    return () => clearInterval(t);
  }, [refreshMetrics]);

  const attentionCount = drafts.length;
  const selected = filter === 'all' ? null : filter;
  const metricsNodes = useMemo(() => metrics.map((m) => <MetricCard key={m.id} m={m} />), [metrics]);

  return (
    <div className="app">
      <Header client={client} attentionCount={attentionCount} notifications={drafts.length} />

      <div className="main">
        <AgentsColumn agents={agents} selected={selected} onSelect={onSelectAgent} />

        <div className="col col-board">
          <div className="m-statusbar mobile-only"><StatusPill attentionCount={attentionCount} /></div>
          <AgentStrip agents={agents} selected={selected} onSelect={onSelectAgent} />

          <MissionBoard
            drafts={drafts}
            inProgress={inProgress}
            completed={completed}
            filter={filter}
            filters={filters}
            setFilter={setFilter}
            onApprove={onApprove}
            onReject={onReject}
            busyId={busyId}
          />

          <div className="mobile-metrics mobile-only">
            <div className="col-head">
              <span className="col-title">This Week</span>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>vs. last week</span>
            </div>
            <div className="metrics-grid">{metricsNodes}</div>
          </div>
        </div>

        <RightColumn metrics={metricsNodes} feed={feed} freshId={freshId} onOpenComms={openComms} />
      </div>

      <Footer memPct={memoryPct} />

      <button className="mobile-fab" onClick={() => setSheet(true)}>
        <Icon name="activity" /> Live Feed
        <span style={{ background: 'rgba(255,255,255,.25)', borderRadius: 999, padding: '1px 7px', fontSize: 11 }}>live</span>
      </button>
      <div className={`sheet-backdrop${sheet ? ' show' : ''}`} onClick={() => setSheet(false)} />
      <div className={`bottom-sheet${sheet ? ' show' : ''}`}>
        <div className="sheet-grab" />
        <div className="feed-head">
          <span className="col-title">Live Feed</span>
          <button className="cp-close" onClick={() => setSheet(false)} style={{ width: 28, height: 28 }}><Icon name="close" /></button>
        </div>
        <FeedBody feed={feed} onOpenComms={(e) => { setSheet(false); openComms(e); }} freshId={freshId} />
      </div>

      <CommsPanel open={comms.open} thread={comms.thread} onClose={closeComms} />
      <Toast toasts={toasts} />
    </div>
  );
}
