/**
 * POST a draft decision back to the Hermes agent server.
 * If HERMES_API_URL is unset, decisions are stored but not forwarded.
 */
type Decision = {
  draft_id: string;
  decision: 'approved' | 'rejected';
  approved_text?: string;
  reason?: string;
  approved_by?: string;
};

export async function postDecision(decision: Decision): Promise<{ ok: boolean; error?: string }> {
  const url = process.env.HERMES_API_URL;
  if (!url) return { ok: false, error: 'HERMES_API_URL not configured (decision stored locally)' };

  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (process.env.HERMES_API_KEY) headers['authorization'] = `Bearer ${process.env.HERMES_API_KEY}`;

  try {
    const res = await fetch(`${url.replace(/\/+$/, '')}/decision`, {
      method: 'POST',
      headers,
      body: JSON.stringify(decision),
    });
    if (!res.ok) return { ok: false, error: `Hermes responded ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
