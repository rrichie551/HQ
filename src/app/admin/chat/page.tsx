import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { AdminNav } from '@/components/AdminNav';
import { getClientConfig } from '@/lib/client-config';
import { isHealthy as bridgeHealth } from '@/lib/hermes-bridge';
import { ChatTerminal } from './client';

export const dynamic = 'force-dynamic';

export default async function AdminChatPage() {
  const client = getClientConfig();
  const bridge = await bridgeHealth();
  return (
    <div className="app">
      <Header client={client} attentionCount={0} />
      <AdminNav />
      <div className="main" style={{ display: 'block', overflow: 'auto', padding: '12px 16px 16px' }}>
        <div style={{ maxWidth: 1600, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Chat with Hermes</h1>
              <p style={{ color: 'var(--text-2)', margin: '4px 0 0', fontSize: 13 }}>
                The same TUI you get from <code>hermes</code> on the host — type messages, tools execute, skills spawn, crons get scheduled. Drafts route to <code>/dashboard/approvals</code>.
              </p>
            </div>
          </div>
          {!bridge.ok && (
            <div style={{ background: 'var(--danger-tint)', border: '1px solid #F3CFCF', color: '#B91C1C', borderRadius: 8, padding: '10px 14px', fontSize: 12, marginBottom: 12 }}>
              <b>Bridge offline.</b> {bridge.error ?? 'unreachable'} — chat needs the bridge. Install: <code>sudo ./scripts/install-hermes-bridge.sh</code>
            </div>
          )}
          <ChatTerminal bridgeOk={bridge.ok} />
        </div>
      </div>
      <Footer />
    </div>
  );
}
