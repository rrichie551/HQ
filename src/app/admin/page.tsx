import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { AdminNav } from '@/components/AdminNav';
import { getClientConfig } from '@/lib/client-config';
import { getHermesStatus } from '@/lib/hermes-fs';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function AdminOverviewPage() {
  const client = getClientConfig();
  const [hermes, pending, agentCount, eventCount] = await Promise.all([
    getHermesStatus(),
    prisma.draft.count({ where: { status: 'PENDING' } }),
    prisma.agent.count(),
    prisma.event.count(),
  ]);

  return (
    <div className="app">
      <Header client={client} attentionCount={pending} notifications={pending} />
      <AdminNav />
      <div className="main" style={{ display: 'block', overflow: 'auto', padding: '24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px' }}>Owner panel</h1>
          <p style={{ color: 'var(--text-2)', margin: '0 0 24px' }}>
            Manage this client's Hermes install — agents, skills, memory, crons. The client never sees this page.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 24 }}>
            <div className="draft-section">
              <h3 style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-3)', margin: '0 0 12px' }}>
                Hermes install
              </h3>
              {hermes.installed ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <span className="dot-label st-running"><span className="dot" />Installed</span>
                  </div>
                  <table style={{ width: '100%', fontSize: 13, color: 'var(--text-2)' }}>
                    <tbody>
                      <tr><td style={{ padding: '4px 0' }}>Root</td><td style={{ fontFamily: 'monospace' }}>{hermes.root}</td></tr>
                      <tr><td style={{ padding: '4px 0' }}>config.yaml</td><td style={{ fontFamily: 'monospace' }}>{hermes.configPath ? '✓ present' : '— missing'}</td></tr>
                      <tr><td style={{ padding: '4px 0' }}>Skills</td><td>{hermes.skillsCount}</td></tr>
                      <tr><td style={{ padding: '4px 0' }}>Memory files</td><td>{hermes.memoryCount}</td></tr>
                      <tr><td style={{ padding: '4px 0' }}>SOUL.md</td><td>{hermes.hasSoul ? '✓ present' : '— missing'}</td></tr>
                      <tr><td style={{ padding: '4px 0' }}>Crons file</td><td>{hermes.hasCronFile ? '✓ present' : '— not found (use hermes cron CLI)'}</td></tr>
                    </tbody>
                  </table>
                </>
              ) : (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span className="dot-label st-error"><span className="dot" />Not installed</span>
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-2)', margin: 0 }}>
                    Mission Control couldn't find a Hermes install at <code>{hermes.root}</code>. Install it on this host:
                  </p>
                  <pre style={{ background: 'var(--bg)', padding: 12, borderRadius: 8, fontSize: 12, overflow: 'auto', marginTop: 8 }}>
{`curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash`}
                  </pre>
                  <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '8px 0 0' }}>
                    Then restart this container — it will detect the install automatically. If Hermes is at a different path, update <code>HERMES_DIR</code> in <code>.env</code>.
                  </p>
                </div>
              )}
            </div>

            <div className="draft-section">
              <h3 style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-3)', margin: '0 0 12px' }}>
                Dashboard state
              </h3>
              <table style={{ width: '100%', fontSize: 13, color: 'var(--text-2)' }}>
                <tbody>
                  <tr><td style={{ padding: '4px 0' }}>Agents</td><td>{agentCount}</td></tr>
                  <tr><td style={{ padding: '4px 0' }}>Events logged</td><td>{eventCount.toLocaleString()}</td></tr>
                  <tr><td style={{ padding: '4px 0' }}>Pending approvals</td><td>{pending}</td></tr>
                  <tr><td style={{ padding: '4px 0' }}>Client</td><td>{client.name}</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="draft-section">
            <h3 style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-3)', margin: '0 0 12px' }}>
              What you can do here
            </h3>
            <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8, fontSize: 13, color: 'var(--text-2)' }}>
              <li><b>Agents</b> — see what's defined for this client, edit names/roles, pause/resume.</li>
              <li><b>Skills</b> — read, edit, and create files under <code>~/.hermes/skills/</code>.</li>
              <li><b>Memory</b> — edit <code>MEMORY.md</code> and <code>USER.md</code> directly.</li>
              <li><b>Crons</b> — view scheduled jobs Hermes runs (if defined in a config file).</li>
              <li><b>Config</b> — inspect <code>config.yaml</code> for this Hermes install.</li>
            </ul>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
