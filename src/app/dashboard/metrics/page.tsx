import { prisma } from '@/lib/db';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { SubNav } from '@/components/SubNav';
import { getClientConfig } from '@/lib/client-config';
import { addDays, startOfWeek } from '@/lib/metrics';

export const dynamic = 'force-dynamic';

async function weekStats(from: Date, to: Date) {
  const [events, draftsCreated, approvalsCompleted, approvals] = await Promise.all([
    prisma.event.findMany({ where: { createdAt: { gte: from, lt: to } }, select: { actionType: true, minutesSaved: true, revenueEvent: true } }),
    prisma.draft.count({ where: { createdAt: { gte: from, lt: to } } }),
    prisma.draft.count({ where: { approvedAt: { gte: from, lt: to }, status: { in: ['APPROVED', 'SENT'] } } }),
    prisma.draft.findMany({ where: { approvedAt: { gte: from, lt: to } }, select: { createdAt: true, approvedAt: true } }),
  ]);
  const messages = events.filter((e) => ['READ', 'SEND', 'DRAFT'].includes(e.actionType)).length;
  const minutes_saved = events.reduce((s, e) => s + (e.minutesSaved ?? 0), 0);
  const revenue = events.filter((e) => e.revenueEvent).length;
  const responseSecs = approvals
    .map((a) => (a.approvedAt && a.createdAt ? (a.approvedAt.getTime() - a.createdAt.getTime()) / 1000 : 0))
    .filter((s) => s > 0);
  const avg_resp = responseSecs.length === 0 ? 0 : responseSecs.reduce((a, b) => a + b, 0) / responseSecs.length;
  return { messages, draftsCreated, approvalsCompleted, minutes_saved, revenue, avg_resp };
}

export default async function MetricsPage() {
  const client = getClientConfig();
  const today = new Date();
  const weeks: { label: string; from: Date; to: Date }[] = [];
  const wkStart = startOfWeek(today);
  for (let i = 7; i >= 0; i--) {
    const from = addDays(wkStart, -i * 7);
    const to = addDays(from, 7);
    weeks.push({ label: from.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }), from, to });
  }
  const stats = await Promise.all(weeks.map((w) => weekStats(w.from, w.to)));
  const pending = await prisma.draft.count({ where: { status: 'PENDING' } });

  const totals = stats.reduce((acc, s) => ({
    messages: acc.messages + s.messages,
    drafts: acc.drafts + s.draftsCreated,
    approvals: acc.approvals + s.approvalsCompleted,
    minutes_saved: acc.minutes_saved + s.minutes_saved,
    revenue: acc.revenue + s.revenue,
  }), { messages: 0, drafts: 0, approvals: 0, minutes_saved: 0, revenue: 0 });

  const max = Math.max(1, ...stats.map((s) => s.messages));

  return (
    <div className="app">
      <Header client={client} attentionCount={pending} notifications={pending} />
      <SubNav />
      <div className="main" style={{ display: 'block', overflow: 'auto', padding: '24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px' }}>Metrics</h1>
          <p style={{ color: 'var(--text-2)', margin: '0 0 20px' }}>Weekly performance — last 8 weeks</p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
            <div className="metric"><div className="metric-label">Messages handled</div><div className="metric-value">{totals.messages.toLocaleString()}</div></div>
            <div className="metric"><div className="metric-label">Drafts created</div><div className="metric-value">{totals.drafts.toLocaleString()}</div></div>
            <div className="metric"><div className="metric-label">Approvals</div><div className="metric-value">{totals.approvals.toLocaleString()}</div></div>
            <div className="metric"><div className="metric-label">Minutes saved</div><div className="metric-value">{totals.minutes_saved.toLocaleString()}</div></div>
            <div className="metric"><div className="metric-label">Revenue events</div><div className="metric-value">{totals.revenue.toLocaleString()}</div></div>
          </div>

          <div className="draft-section">
            <h3 style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-3)', margin: '0 0 16px' }}>Messages handled by week</h3>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 180 }}>
              {stats.map((s, i) => {
                const h = Math.max(4, Math.round((s.messages / max) * 160));
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    <div style={{ height: h, width: '100%', maxWidth: 64, background: 'var(--accent)', borderRadius: '6px 6px 0 0' }} title={`${s.messages} messages`} />
                    <div style={{ fontSize: 10.5, color: 'var(--text-3)' }}>{weeks[i].label}</div>
                    <div style={{ fontSize: 11, fontWeight: 700 }}>{s.messages}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <a className="fchip on" href="/api/metrics/week" target="_blank" rel="noreferrer">Open JSON</a>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
