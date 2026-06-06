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
// Session IDs Hermes uses look like a date-stamped 20260606_080045_abc123 form,
// a cron_<hash>_<datestamp> form, or a ULID-style 20+ char hex. Match the
// LONGEST such token in the line to avoid grabbing a sub-token (e.g. the
// '20260606' inside cron_<hash>_20260606_080045 on its own).
const ID_TOKEN = /\bcron_[0-9a-f]+_\d{8}_\d{6}\b|\b\d{8}_\d{6}(?:_[0-9a-z]+)+\b|\b[0-9a-f]{20,}\b/gi;
const HEADER = /^(session|id|title|date|time|created|--+|==+|sessions:)/i;

/**
 * Best-effort parser. Hermes' output isn't a stable contract, so we keep
 * each row's raw text and extract:
 *   - id    : longest id-like token in the line (used for --resume)
 *   - title : everything that isn't the id (clipped to 80 chars)
 * We deliberately don't try to guess a separate timestamp — the embedded
 * date inside cron_*_YYYYMMDD_HHMMSS ids made that produce garbage.
 */
function parseSessions(stdout: string): SessionRow[] {
  if (!stdout) return [];
  const out: SessionRow[] = [];
  const lines = stdout.split('\n');
  for (const rawLine of lines) {
    const line = rawLine.replace(ANSI, '').trim();
    if (!line) continue;
    if (HEADER.test(line)) continue;
    const ids = line.match(ID_TOKEN);
    if (!ids || ids.length === 0) continue;
    const id = ids.reduce((a, b) => (b.length > a.length ? b : a));
    let title = line.replace(id, '').replace(/\s+/g, ' ').trim();
    title = title.replace(/^[\s|·•:\-"'`\[\]]+/, '').replace(/[\s"'\[\]]+$/, '').trim();
    if (title.length > 80) title = title.slice(0, 80) + '…';
    out.push({ id, title: title || undefined, raw: line });
  }
  return out;
}
