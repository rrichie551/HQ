import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { AdminNav } from '@/components/AdminNav';
import { getClientConfig } from '@/lib/client-config';
import { listSkills, hermesInstalled } from '@/lib/hermes-fs';
import { prisma } from '@/lib/db';
import { SkillsClient } from './client';

export const dynamic = 'force-dynamic';

export default async function AdminSkillsPage({ searchParams }: { searchParams: { name?: string } }) {
  const client = getClientConfig();
  const [skills, installed, pending] = await Promise.all([
    listSkills(),
    hermesInstalled(),
    prisma.draft.count({ where: { status: 'PENDING' } }),
  ]);
  return (
    <div className="app">
      <Header client={client} attentionCount={pending} notifications={pending} />
      <AdminNav />
      <div className="main" style={{ display: 'block', overflow: 'auto', padding: '24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px' }}>Skills</h1>
          <p style={{ color: 'var(--text-2)', margin: '0 0 20px' }}>
            Files under <code>~/.hermes/skills/</code>. Edits save immediately — Hermes picks them up on next agent turn.
          </p>
          {!installed && (
            <div className="draft-section" style={{ borderLeft: '3px solid var(--attention)', marginBottom: 16 }}>
              <b>Hermes not installed</b> — install it on this host first. Until then this list will be empty.
            </div>
          )}
          <SkillsClient initialSkills={skills} initialName={searchParams.name} />
        </div>
      </div>
      <Footer />
    </div>
  );
}
