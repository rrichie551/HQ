import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { AdminNav } from '@/components/AdminNav';
import { getClientConfig } from '@/lib/client-config';
import { readCronFileRaw, getHermesStatus } from '@/lib/hermes-fs';
import { isHealthy as bridgeHealth, exec as bridgeExec } from '@/lib/hermes-bridge';
import { prisma } from '@/lib/db';
import { CronsClient } from './client';

export const dynamic = 'force-dynamic';

export default async function AdminCronsPage() {
  const client = getClientConfig();
  const [cron, status, pending, bridge] = await Promise.all([
    readCronFileRaw(),
    getHermesStatus(),
    prisma.draft.count({ where: { status: 'PENDING' } }),
    bridgeHealth(),
  ]);

  // If the bridge is healthy, also prefetch `hermes cron list` so the user
  // sees the canonical list straight away.
  let cliList: string | null = null;
  if (bridge.ok) {
    const r = await bridgeExec('cron', ['list']);
    cliList = r.stdout || r.stderr || null;
  }

  return (
    <div className="app">
      <Header client={client} attentionCount={pending} notifications={pending} />
      <AdminNav />
      <div className="main" style={{ display: 'block', overflow: 'auto', padding: '24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px' }}>Scheduled jobs</h1>
          <p style={{ color: 'var(--text-2)', margin: '0 0 20px' }}>
            Natural-language crons Hermes runs on a schedule (daily reports, nightly backups, weekly audits).
          </p>
          <CronsClient
            initialFile={cron?.content ?? ''}
            cronPath={cron?.path ?? null}
            root={status.root}
            bridge={bridge}
            cliList={cliList}
          />
        </div>
      </div>
      <Footer />
    </div>
  );
}
