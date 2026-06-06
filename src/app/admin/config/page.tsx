import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { AdminNav } from '@/components/AdminNav';
import { getClientConfig } from '@/lib/client-config';
import { getHermesStatus, readConfigRaw } from '@/lib/hermes-fs';
import { prisma } from '@/lib/db';
import { ConfigClient } from './client';

export const dynamic = 'force-dynamic';

export default async function AdminConfigPage() {
  const client = getClientConfig();
  const [content, status, pending] = await Promise.all([
    readConfigRaw(),
    getHermesStatus(),
    prisma.draft.count({ where: { status: 'PENDING' } }),
  ]);
  return (
    <div className="app">
      <Header client={client} attentionCount={pending} notifications={pending} />
      <AdminNav />
      <div className="main" style={{ display: 'block', overflow: 'auto', padding: '24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px' }}>Hermes config</h1>
          <p style={{ color: 'var(--text-2)', margin: '0 0 20px' }}>
            <code>{status.configPath ?? `${status.root}/config.yaml`}</code> — careful, this controls Hermes' provider, tools, and gateways.
          </p>
          <ConfigClient initial={content ?? ''} configExists={!!status.configPath} root={status.root} />
        </div>
      </div>
      <Footer />
    </div>
  );
}
