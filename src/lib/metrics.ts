import { prisma } from './db';

export function startOfWeek(d: Date = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay(); // 0 Sun..6 Sat
  const diff = (day + 6) % 7; // Monday-based
  x.setDate(x.getDate() - diff);
  return x;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export type WeekStats = {
  messages_handled: number;
  drafts_created: number;
  approvals_completed: number;
  avg_response_secs: number;
  minutes_saved: number;
  revenue_events: number;
};

async function statsBetween(from: Date, to: Date): Promise<WeekStats> {
  const [events, draftsCreated, approvalsCompleted, approvals] = await Promise.all([
    prisma.event.findMany({
      where: { createdAt: { gte: from, lt: to } },
      select: { actionType: true, minutesSaved: true, revenueEvent: true },
    }),
    prisma.draft.count({ where: { createdAt: { gte: from, lt: to } } }),
    prisma.draft.count({
      where: { approvedAt: { gte: from, lt: to }, status: { in: ['APPROVED', 'SENT'] } },
    }),
    prisma.draft.findMany({
      where: { approvedAt: { gte: from, lt: to } },
      select: { createdAt: true, approvedAt: true },
    }),
  ]);

  const messages_handled = events.filter((e) => ['READ', 'SEND', 'DRAFT'].includes(e.actionType)).length;
  const minutes_saved = events.reduce((s, e) => s + (e.minutesSaved ?? 0), 0);
  const revenue_events = events.filter((e) => e.revenueEvent).length;

  const responseSecs = approvals
    .map((a) => (a.approvedAt && a.createdAt ? (a.approvedAt.getTime() - a.createdAt.getTime()) / 1000 : 0))
    .filter((s) => s > 0);
  const avg_response_secs =
    responseSecs.length === 0 ? 0 : responseSecs.reduce((a, b) => a + b, 0) / responseSecs.length;

  return {
    messages_handled,
    drafts_created: draftsCreated,
    approvals_completed: approvalsCompleted,
    avg_response_secs: Math.round(avg_response_secs),
    minutes_saved: Math.round(minutes_saved),
    revenue_events,
  };
}

export async function currentWeek(): Promise<{ this_week: WeekStats; last_week: WeekStats }> {
  const wkStart = startOfWeek();
  const nextWeek = addDays(wkStart, 7);
  const prevWeek = addDays(wkStart, -7);
  const [thisWeek, lastWeek] = await Promise.all([
    statsBetween(wkStart, nextWeek),
    statsBetween(prevWeek, wkStart),
  ]);
  return { this_week: thisWeek, last_week: lastWeek };
}

export async function sparklines(): Promise<Record<keyof WeekStats, number[]>> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days: { from: Date; to: Date }[] = [];
  for (let i = 6; i >= 0; i--) {
    const from = addDays(today, -i);
    const to = addDays(from, 1);
    days.push({ from, to });
  }
  const series = await Promise.all(days.map((d) => statsBetween(d.from, d.to)));
  return {
    messages_handled: series.map((s) => s.messages_handled),
    drafts_created: series.map((s) => s.drafts_created),
    approvals_completed: series.map((s) => s.approvals_completed),
    avg_response_secs: series.map((s) => s.avg_response_secs),
    minutes_saved: series.map((s) => s.minutes_saved),
    revenue_events: series.map((s) => s.revenue_events),
  };
}

export function pctTrend(now: number, prev: number): { trend: string; dir: 'up-good' | 'up-bad' | 'down-good' | 'flat'; goodIfUp: boolean } {
  if (prev === 0) {
    if (now === 0) return { trend: '0%', dir: 'flat', goodIfUp: true };
    return { trend: '+new', dir: 'up-good', goodIfUp: true };
  }
  const diff = ((now - prev) / prev) * 100;
  const sign = diff >= 0 ? '+' : '−';
  const trend = `${sign}${Math.abs(Math.round(diff))}%`;
  if (diff === 0) return { trend: '0%', dir: 'flat', goodIfUp: true };
  const dir = diff > 0 ? 'up-good' : 'down-good';
  return { trend, dir, goodIfUp: true };
}

export function formatSeconds(secs: number): string {
  if (!secs) return '—';
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}
