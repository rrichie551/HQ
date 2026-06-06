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

const ANSI = /\x1b\[[0-9;]*m/g;
const ID_TOKEN = /\bcron_[0-9a-f]+_\d{8}_\d{6}\b|\b\d{8}_\d{6}(?:_[0-9a-z]+)+\b|\b[0-9a-f]{20,}\b/gi;
const HEADER = /^(session|id|title|date|time|created|--+|==+|sessions:)/i;
// Relative timestamps Hermes prints near the front of each row:
// "6m ago", "1h ago", "16h ago", "yesterday", "2 days ago", "just now"
const REL_TIME = /\b(\d+\s*(?:s|m|h|d)\s+ago|just\s+now|yesterday|today|\d+\s+(?:second|minute|hour|day|week|month|year)s?\s+ago)\b/i;
// Conversation continuity markers Hermes adds to old session lines
const PREAMBLE = /\[IMPORTANT:[^\]]*\]\s*/i;

/**
 * Best-effort parser. Hermes' output format isn't a stable contract.
 * We extract:
 *   - id        : longest id-like token in the line (used for --resume)
 *   - timestamp : human-readable relative time if Hermes printed one
 *   - title     : whatever's left of the line after stripping id +
 *                 timestamp + [IMPORTANT: …] / "...  preambles
 */
function parseSessions(stdout: string): SessionRow[] {
  if (!stdout) return [];
  const out: SessionRow[] = [];
  for (const rawLine of stdout.split('\n')) {
    const line = rawLine.replace(ANSI, '').trim();
    if (!line) continue;
    if (HEADER.test(line)) continue;

    const ids = line.match(ID_TOKEN);
    if (!ids || ids.length === 0) continue;
    const id = ids.reduce((a, b) => (b.length > a.length ? b : a));

    const ts = REL_TIME.exec(line)?.[0];

    let title = line.replace(id, ' ');
    if (ts) title = title.replace(ts, ' ');
    title = title.replace(PREAMBLE, ' ');
    // Tidy up: collapse whitespace, strip leading dashes/colons/quotes,
    // strip dangling open punctuation at the end.
    title = title
      .replace(/\s+/g, ' ')
      .replace(/^[\s|·•:\-—"'`\[\]]+/, '')
      .replace(/[\s\-"'`\[\(]+$/, '')
      .trim();
    if (!title) title = '(no title)';
    if (title.length > 80) title = title.slice(0, 80) + '…';

    out.push({ id, title, timestamp: ts, raw: line });
  }
  return out;
}
