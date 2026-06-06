/**
 * Dashboard-side client for the Hermes Bridge service running on the host.
 *
 * The bridge is OPTIONAL — if it's not configured or unreachable, isHealthy()
 * returns false and the calling code should fall back to the file-only flow.
 *
 * Configured via two env vars:
 *   HERMES_BRIDGE_URL   default: http://host.docker.internal:7181
 *   HERMES_BRIDGE_TOKEN required if the bridge is reachable
 */

export type BridgeResult =
  | { ok: true; code: number; stdout: string; stderr: string }
  | { ok: false; code: number; stdout: string; stderr: string; error?: string };

export function bridgeUrl(): string {
  return process.env.HERMES_BRIDGE_URL ?? 'http://host.docker.internal:7181';
}

export function bridgeConfigured(): boolean {
  return Boolean(process.env.HERMES_BRIDGE_TOKEN);
}

export async function isHealthy(): Promise<{ ok: boolean; hermes_bin?: string; hermes_cwd?: string; error?: string }> {
  if (!bridgeConfigured()) return { ok: false, error: 'HERMES_BRIDGE_TOKEN not set' };
  try {
    const res = await fetch(`${bridgeUrl()}/healthz`, { cache: 'no-store', signal: AbortSignal.timeout(2000) });
    if (!res.ok) return { ok: false, error: `bridge HTTP ${res.status}` };
    return await res.json();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function exec(subcommand: string, args: string[] = []): Promise<BridgeResult> {
  if (!bridgeConfigured()) {
    return { ok: false, code: -1, stdout: '', stderr: '', error: 'bridge not configured' };
  }
  try {
    const res = await fetch(`${bridgeUrl()}/exec`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${process.env.HERMES_BRIDGE_TOKEN}`,
      },
      body: JSON.stringify({ subcommand, args }),
      signal: AbortSignal.timeout(35_000),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      return { ok: false, code: res.status, stdout: '', stderr: t, error: `bridge HTTP ${res.status}` };
    }
    return await res.json();
  } catch (e) {
    return { ok: false, code: -1, stdout: '', stderr: '', error: (e as Error).message };
  }
}
