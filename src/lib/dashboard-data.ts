import { prisma } from './db';
import { uptimeLabel, relTimeSeconds } from './agents';
import { currentWeek, sparklines, pctTrend, formatSeconds } from './metrics';

export async function loadDashboardData() {
  const [agents, drafts, recentEvents, recentComms, memSnap, all, week, sparks] = await Promise.all([
    prisma.agent.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.draft.findMany({
      where: { status: 'PENDING' },
      include: { agent: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.event.findMany({
      include: { agent: true },
      orderBy: { createdAt: 'desc' },
      take: 80,
    }),
    prisma.agentComm.findMany({
      include: { fromAgent: true, toAgent: true },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
    prisma.memorySnapshot.findFirst({ orderBy: { createdAt: 'desc' } }),
    prisma.draft.findMany({
      where: { status: { in: ['APPROVED', 'SENT', 'REJECTED'] } },
      include: { agent: true },
      orderBy: { approvedAt: 'desc' },
      take: 12,
    }),
    currentWeek(),
    sparklines(),
  ]);

  const fiveMin = Date.now() - 5 * 60 * 1000;
  const inProgress = recentEvents
    .filter((e) => e.createdAt.getTime() >= fiveMin)
    .filter((e) => ['DRAFT', 'READ', 'MEMORY_UPDATE'].includes(e.actionType))
    .slice(0, 8)
    .map((e) => ({
      id: e.id,
      agent_slug: e.agent.slug,
      agent_name: e.agent.name,
      agent_color: e.agent.color,
      agent_tint: e.agent.tint,
      agent_icon: e.agent.icon,
      action_type: e.actionType,
      description: e.description,
      created_at: e.createdAt.toISOString(),
    }));

  const completed = all.map((d) => ({
    id: d.id,
    agent_slug: d.agent.slug,
    agent_name: d.agent.name,
    agent_icon: d.agent.icon,
    agent_color: d.agent.color,
    agent_tint: d.agent.tint,
    title: d.title,
    time: d.approvedAt
      ? d.approvedAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
      : d.createdAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    outcome: d.status === 'SENT' ? 'Approved · sent' : d.status === 'APPROVED' ? 'Approved' : 'Rejected',
  }));

  const feed = recentEvents.slice(0, 30).map((e) => {
    const map: Record<string, 'task' | 'email' | 'comms' | 'memory' | 'flag'> = {
      READ: 'email',
      DRAFT: 'email',
      SEND: 'email',
      AGENT_COMM: 'comms',
      MEMORY_UPDATE: 'memory',
      FLAG: 'flag',
    };
    const kind = map[e.actionType] ?? 'task';
    const item: any = {
      id: e.id,
      kind,
      agent_slug: e.agent.slug,
      agent_name: e.agent.name,
      agent_color: e.agent.color,
      agent_tint: e.agent.tint,
      agent_icon: e.agent.icon,
      description: `<b>${e.agent.name}</b> ${e.description.replace(new RegExp(`^${e.agent.name}\\s*`, 'i'), '')}`,
      created_at: e.createdAt.toISOString(),
    };
    if (kind === 'comms' && e.metadata) {
      try {
        const meta = JSON.parse(e.metadata);
        const peer = recentComms.find((c) => c.topic === meta.topic && (c.toAgent.slug === meta.to || c.fromAgent.slug === meta.to));
        if (peer) {
          const partner = peer.toAgent.slug === e.agent.slug ? peer.fromAgent : peer.toAgent;
          item.comm = {
            to_slug: partner.slug,
            to_name: partner.name,
            to_color: partner.color,
            to_tint: partner.tint,
            to_icon: partner.icon,
            topic: peer.topic,
          };
        }
      } catch {/* ignore */}
    }
    return item;
  });

  const sparkMap: Record<string, number[]> = {
    msg: sparks.messages_handled,
    draft: sparks.drafts_created,
    appr: sparks.approvals_completed,
    rt: sparks.avg_response_secs,
  };

  const metrics = [
    {
      id: 'msg', label: 'Messages handled',
      value: week.this_week.messages_handled.toLocaleString(),
      ...pctTrend(week.this_week.messages_handled, week.last_week.messages_handled),
      spark: sparkMap.msg,
    },
    {
      id: 'draft', label: 'Drafts for approval',
      value: week.this_week.drafts_created.toLocaleString(),
      ...pctTrend(week.this_week.drafts_created, week.last_week.drafts_created),
      spark: sparkMap.draft,
    },
    {
      id: 'appr', label: 'Approvals completed',
      value: week.this_week.approvals_completed.toLocaleString(),
      ...pctTrend(week.this_week.approvals_completed, week.last_week.approvals_completed),
      spark: sparkMap.appr,
    },
    {
      id: 'rt', label: 'Avg response time',
      value: formatSeconds(week.this_week.avg_response_secs),
      ...pctTrend(week.this_week.avg_response_secs, week.last_week.avg_response_secs),
      spark: sparkMap.rt,
    },
  ];

  return {
    agents: agents.map((a) => ({
      slug: a.slug,
      name: a.name,
      role: a.role,
      icon: a.icon,
      color: a.color,
      tint: a.tint,
      status: a.status,
      last: relTimeSeconds(a.lastActionAt),
      uptime: uptimeLabel(a.uptimeSince),
    })),
    pendingDrafts: drafts.map((d) => ({
      id: d.id,
      agent_slug: d.agent.slug,
      agent_name: d.agent.name,
      agent_color: d.agent.color,
      agent_tint: d.agent.tint,
      agent_icon: d.agent.icon,
      title: d.title,
      draft_text: d.draftText,
      original_message: d.originalMessage,
      priority: d.priority,
      status: d.status,
      created_at: d.createdAt.toISOString(),
    })),
    completed,
    inProgress,
    feed,
    metrics,
    sparklines: sparkMap,
    comms: recentComms.map((c) => ({
      id: c.id,
      from: { slug: c.fromAgent.slug, name: c.fromAgent.name, role: c.fromAgent.role, color: c.fromAgent.color, tint: c.fromAgent.tint, icon: c.fromAgent.icon },
      to: { slug: c.toAgent.slug, name: c.toAgent.name, role: c.toAgent.role, color: c.toAgent.color, tint: c.toAgent.tint, icon: c.toAgent.icon },
      topic: c.topic,
      question: c.question,
      answer: c.answer,
      created_at: c.createdAt.toISOString(),
    })),
    memoryPct: memSnap ? Math.round((memSnap.memoryMdChars / memSnap.memoryMdLimit) * 100) : 0,
  };
}
