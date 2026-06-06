import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { AdminNav } from '@/components/AdminNav';
import { getClientConfig } from '@/lib/client-config';
import { listMemoryFiles, hermesInstalled } from '@/lib/hermes-fs';
import { prisma } from '@/lib/db';
import { MemoryClient } from './client';

export const dynamic = 'force-dynamic';

export default async function AdminMemoryPage({ searchParams }: { searchParams: { name?: string } }) {
  const client = getClientConfig();
  const [files, installed, pending] = await Promise.all([
    listMemoryFiles(),
    hermesInstalled(),
    prisma.draft.count({ where: { status: 'PENDING' } }),
  ]);
  return (
    <div className="app">
      <Header client={client} attentionCount={pending} notifications={pending} />
      <AdminNav />
      <div className="main" style={{ display: 'block', overflow: 'auto', padding: '24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px' }}>Memory</h1>
          <p style={{ color: 'var(--text-2)', margin: '0 0 20px' }}>
            <code>MEMORY.md</code> and <code>USER.md</code> at <code>~/.hermes/memory/</code>. These shape what Hermes remembers across conversations.
          </p>
          {!installed && (
            <div className="draft-section" style={{ borderLeft: '3px solid var(--attention)', marginBottom: 16 }}>
              <b>Hermes not installed</b> — install it on this host first.
            </div>
          )}
          <MemoryClient initialFiles={files.map(({ content, ...rest }) => rest)} initialName={searchParams.name} />
        </div>
      </div>
      <Footer />
    </div>
  );
}
