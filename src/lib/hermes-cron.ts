/**
 * Higher-level Hermes cron helpers used by the admin/agents flow.
 * All of these call through the host-side bridge. If the bridge is offline,
 * each returns `{ ok: false, error: ... }` so the caller can still update the
 * dashboard DB and surface the failure in the UI.
 */
import { exec as bridgeExec, isHealthy as bridgeHealth } from './hermes-bridge';

// Hermes cron ids look like `cron_<hex>_<datestamp>_<time>` (visible in
// `hermes sessions list` output). Anchor on that exact shape so we don't grab
// random hex tokens from log noise.
const CRON_ID = /\bcron_[0-9a-f]+_\d{8}_\d{6}\b/i;

export type CronResult =
  | { ok: true; cronId: string | null; stdout: string }
  | { ok: false; error: string; stdout?: string; stderr?: string };

/**
 * Build the natural-language prompt Hermes' cron parser expects.
 * Example: addCron({ schedule: "every weekday at 9am", task: "Summarise inbox" })
 *   → hermes cron add "every weekday at 9am: Summarise inbox"
 */
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
  const m = CRON_ID.exec(r.stdout) ?? CRON_ID.exec(r.stderr);
  return { ok: true, cronId: m?.[0] ?? null, stdout: r.stdout };
}

export async function removeCron(cronId: string): Promise<CronResult> {
  const health = await bridgeHealth();
  if (!health.ok) return { ok: false, error: `bridge offline: ${health.error ?? 'unreachable'}` };
  if (!CRON_ID.test(cronId)) return { ok: false, error: `invalid cron id: ${cronId}` };

  const r = await bridgeExec('cron', ['remove', cronId]);
  if (!r.ok) {
    return { ok: false, error: r.stderr || `hermes cron remove exited with code ${r.code}` };
  }
  return { ok: true, cronId: null, stdout: r.stdout };
}

export async function setCronEnabled(cronId: string, enabled: boolean): Promise<CronResult> {
  const health = await bridgeHealth();
  if (!health.ok) return { ok: false, error: `bridge offline: ${health.error ?? 'unreachable'}` };
  if (!CRON_ID.test(cronId)) return { ok: false, error: `invalid cron id: ${cronId}` };

  const r = await bridgeExec('cron', [enabled ? 'enable' : 'disable', cronId]);
  if (!r.ok) {
    return { ok: false, error: r.stderr || `hermes cron ${enabled ? 'enable' : 'disable'} exited with code ${r.code}` };
  }
  return { ok: true, cronId, stdout: r.stdout };
}
