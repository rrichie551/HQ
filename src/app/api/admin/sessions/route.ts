import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isOwner } from '@/lib/auth';
import { exec as bridgeExec, isHealthy } from '@/lib/hermes-bridge';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/sessions
 *
 * Calls `hermes sessions list` via the bridge and returns:
 *   { ok, sessions: [{ id, title, timestamp, raw }], raw_stdout, raw_stderr }
 *
 * Hermes' output format isn't stable enough to parse strictly, so we keep
 * the raw stdout for the UI to show as a fallback and do a best-effort
 * line-per-session split. Each "line" with content becomes a candidate
 * session that the user can resume with whatever ID Hermes accepts
 * (it accepts both session_id and title for --resume).
 */
export async function GET() {
  const s = await getServerSession(authOptions);
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!isOwner(s)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const bridge = await isHealthy();
  if (!bridge.ok) {
    return NextResponse.json({ ok: false, error: 'bridge-offline', detail: bridge.error, sessions: [] });
  }

  const r = await bridgeExec('sessions', ['list']);
  const sessions = parseSessions(r.stdout);
  return NextResponse.json({
    ok: r.ok,
    code: r.code,
    sessions,
    raw_stdout: r.stdout,
    raw_stderr: r.stderr,
  });
}

type SessionRow = { id: string; title?: string; timestamp?: string; raw: string };

/** Best-effort parser. Hermes' format varies; we extract whatever we can. */
function parseSessions(stdout: string): SessionRow[] {
  if (!stdout) return [];
  const out: SessionRow[] = [];
  const lines = stdout.split('\n');
  for (const raw of lines) {
    const line = raw.replace(/\x1b\[[0-9;]*m/g, '').trim(); // strip ANSI
    if (!line) continue;
    if (/^(session|id|title|date|time|---)/i.test(line)) continue; // header rows
    // Try common shapes: "<id>  <title>  <time>" or just "<id>"
    // ID is usually a UUID-ish or ULID-ish hex/alnum 16+ chars, or
    // a date-timestamp like 20260606_080011_4fbb4a.
    const idMatch = line.match(/\b([0-9a-z]{6,}(?:_[0-9a-z]+){0,4})\b/i);
    if (!idMatch) {
      // Not a parseable row; skip but keep the raw text accessible upstream
      continue;
    }
    const id = idMatch[1];
    // Try to find a timestamp (YYYY-MM-DD or YYYYMMDD)
    const tsMatch = line.match(/\b(\d{4}-?\d{2}-?\d{2}(?:[T_ ]\d{2}:?\d{2}(?::?\d{2})?)?)\b/);
    const timestamp = tsMatch?.[1];
    // Title is whatever is left after stripping id and timestamp
    let title = line
      .replace(id, '')
      .replace(timestamp ?? '', '')
      .replace(/^\s*[|·•:\-]+\s*/, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (title.length > 80) title = title.slice(0, 80) + '…';
    out.push({ id, title: title || undefined, timestamp, raw: line });
  }
  return out;
}
