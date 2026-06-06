/**
 * Higher-level Hermes cron helpers used by the admin/agents flow.
 * All of these call through the host-side bridge. If the bridge is offline,
 * each returns `{ ok: false, error: ... }` so the caller can still update the
 * dashboard DB and surface the failure in the UI.
 */
import { exec as bridgeExec, isHealthy as bridgeHealth } from './hermes-bridge';

// Two id formats Hermes uses, depending on which command emitted the id:
//   - `hermes cron list` prints the SHORT form: 12 hex chars (e.g. b5b659ad2419)
//   - `hermes sessions list` prints the LONG form: cron_<hex>_<datestamp>_<time>
//     (one per run of the cron)
// We store + accept either; the bridge passes whatever is given through to
// `hermes cron <remove|enable|disable>`.
const CRON_ID_SHORT = /\b[0-9a-f]{12}\b/i;
const CRON_ID_LONG = /\bcron_[0-9a-f]+_\d{8}_\d{6}\b/i;
const CRON_ID_ANY = /\bcron_[0-9a-f]+_\d{8}_\d{6}\b|\b[0-9a-f]{12}\b/i;
const CRON_ID_VALID = /^[0-9a-f]{12}$|^cron_[0-9a-f]+_\d{8}_\d{6}$/i;

export type CronResult =
  | { ok: true; cronId: string | null; stdout: string }
  | { ok: false; error: string; stdout?: string; stderr?: string };

function buildCronText(args: { schedule: string; task: string; skill?: string }): string {
  const skillPrefix = args.skill ? `Using the "${args.skill}" skill, ` : '';
  return `${args.schedule}: ${skillPrefix}${args.task.trim()}`.trim();
}

export async function addCron(args: { schedule: string; task: string; skill?: string }): Promise<CronResult> {
  const health = await bridgeHealth();
  if (!health.ok) return { ok: false, error: `bridge offline: ${health.error ?? 'unreachable'}` };

  const text = buildCronText(args);
  const r = await bridgeExec('cron', ['add', text]);
  if (!r.ok) {
    return { ok: false, error: r.stderr || `hermes cron add exited with code ${r.code}`, stdout: r.stdout, stderr: r.stderr };
  }
  // `cron add` likely prints the newly-created cron id — try long form first,
  // fall back to the 12-hex short form. Either is fine; we store as-is.
  const m = CRON_ID_LONG.exec(r.stdout) ?? CRON_ID_LONG.exec(r.stderr)
    ?? CRON_ID_SHORT.exec(r.stdout) ?? CRON_ID_SHORT.exec(r.stderr);
  return { ok: true, cronId: m?.[0] ?? null, stdout: r.stdout };
}

export async function removeCron(cronId: string): Promise<CronResult> {
  const health = await bridgeHealth();
  if (!health.ok) return { ok: false, error: `bridge offline: ${health.error ?? 'unreachable'}` };
  if (!CRON_ID_VALID.test(cronId)) return { ok: false, error: `invalid cron id: ${cronId}` };

  const r = await bridgeExec('cron', ['remove', cronId]);
  if (!r.ok) {
    return { ok: false, error: r.stderr || `hermes cron remove exited with code ${r.code}` };
  }
  return { ok: true, cronId: null, stdout: r.stdout };
}

export async function setCronEnabled(cronId: string, enabled: boolean): Promise<CronResult> {
  const health = await bridgeHealth();
  if (!health.ok) return { ok: false, error: `bridge offline: ${health.error ?? 'unreachable'}` };
  if (!CRON_ID_VALID.test(cronId)) return { ok: false, error: `invalid cron id: ${cronId}` };

  const r = await bridgeExec('cron', [enabled ? 'enable' : 'disable', cronId]);
  if (!r.ok) {
    return { ok: false, error: r.stderr || `hermes cron ${enabled ? 'enable' : 'disable'} exited with code ${r.code}` };
  }
  return { ok: true, cronId, stdout: r.stdout };
}

/* ───────────── listing & importing existing crons ───────────── */

export type DiscoveredCron = {
  cronId: string;          // 12 hex chars from `hermes cron list`
  name?: string;           // from "Name:" line — what the user named it
  schedule?: string;       // from "Schedule:" line — cron syntax ("0 8 * * *")
  task?: string;           // from "Task:" / "Description:" if present
  skills?: string;         // from "Skills:" line
  workdir?: string;        // from "Workdir:" line
  enabled?: boolean;       // header tag: [active] / [paused]
  lastRun?: string;        // from "Last run:" line
  nextRun?: string;        // from "Next run:" line
  raw: string;             // the full multi-line block, for the UI to fall back on
};

const ANSI = /\x1b\[[0-9;]*m/g;
// Header line that opens each cron block: "b5b659ad2419 [active]"
const HEADER_LINE = /^([0-9a-f]{8,16})\s+\[([a-zA-Z]+)\]\s*$/;

/**
 * Parse the output of `hermes cron list`. The real format is multi-line
 * blocks like:
 *
 *   b5b659ad2419 [active]
 *       Name:      daily-trend-watcher
 *       Schedule:  0 8 * * *
 *       Skills:    ai-marketing-sales-agency
 *       Workdir:   /root/agency/agents/trend-watcher
 *       Last run:  2026-06-06T08:05:35.851501+00:00  ok
 *
 * We open a new entry on each header line and accumulate key:value pairs
 * (indented) until we hit a blank line or another header.
 */
export function parseCronList(stdout: string): DiscoveredCron[] {
  if (!stdout) return [];
  const out: DiscoveredCron[] = [];
  let current: DiscoveredCron | null = null;

  for (const rawLine of stdout.split('\n')) {
    const line = rawLine.replace(ANSI, '');
    const stripped = line.trim();

    if (!stripped) {
      if (current) { out.push(current); current = null; }
      continue;
    }

    // Skip framing chars that show up around boxed sections
    if (/^[─━│┃┌┐└┘├┤┬┴┼╭╮╯╰═║╔╗╚╝]+$/u.test(stripped)) continue;
    if (/^(scheduled\s+jobs?|cronjobs?):?$/i.test(stripped)) continue;

    const header = HEADER_LINE.exec(stripped);
    if (header) {
      if (current) out.push(current);
      current = {
        cronId: header[1].toLowerCase(),
        enabled: ['active', 'enabled', 'on', 'running'].includes(header[2].toLowerCase()),
        raw: stripped,
      };
      continue;
    }

    if (!current) continue;

    const idx = line.indexOf(':');
    if (idx <= 0) continue;
    // must be indented under the header
    if (!/^\s/.test(line)) continue;

    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (!value) continue;
    current.raw += '\n' + line;

    switch (key) {
      case 'name':        current.name = value; break;
      case 'schedule':    current.schedule = value; break;
      case 'task':
      case 'description': current.task = value; break;
      case 'skills':
      case 'skill':       current.skills = value; break;
      case 'workdir':     current.workdir = value; break;
      case 'last run':    current.lastRun = value; break;
      case 'next run':    current.nextRun = value; break;
      // ignore Repeat / Deliver / etc. unless we add fields for them
    }
  }
  if (current) out.push(current);
  return out;
}

export async function listCrons(): Promise<{ ok: boolean; crons: DiscoveredCron[]; raw_stdout: string; error?: string }> {
  const health = await bridgeHealth();
  if (!health.ok) return { ok: false, crons: [], raw_stdout: '', error: `bridge offline: ${health.error ?? 'unreachable'}` };
  const r = await bridgeExec('cron', ['list']);
  if (!r.ok) return { ok: false, crons: [], raw_stdout: r.stdout, error: r.stderr || `hermes cron list exited with code ${r.code}` };
  return { ok: true, crons: parseCronList(r.stdout), raw_stdout: r.stdout };
}
