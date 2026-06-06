/**
 * Discover agents from a Hermes install and seed the Agent table.
 *
 * Hermes-agent doesn't (today) define one "agent" per skill — its skills live
 * in ~/.hermes/skills/ and act as procedural memory shared across one chat.
 * But for Mission Control's UI we still want a list of named agents that
 * surface in the client view, so:
 *
 *  1. If Hermes' config.yaml has a top-level `agents:` block, use that.
 *  2. Otherwise, if no agents exist in the DB yet, seed the four default
 *     templates (hermes-inbox, concierge, echo, atlas) so the dashboard
 *     isn't empty on first boot.
 *  3. If agents already exist in the DB, do nothing (don't clobber owner edits).
 */
import { prisma } from './db';
import { readConfigRaw, hermesInstalled } from './hermes-fs';
import { DEFAULT_AGENTS } from './agents';

let didRun = false;

export async function syncOnce(): Promise<{ created: number; existed: number }> {
  if (didRun) return { created: 0, existed: -1 };
  didRun = true;

  const existing = await prisma.agent.count();
  if (existing > 0) return { created: 0, existed: existing };

  // Try to read agents out of config.yaml first
  const fromConfig = await readAgentsFromConfig();
  const toCreate = fromConfig.length > 0 ? fromConfig : DEFAULT_AGENTS;

  let created = 0;
  for (const a of toCreate) {
    try {
      await prisma.agent.create({
        data: {
          slug: a.slug,
          name: a.name,
          role: a.role,
          icon: a.icon,
          color: a.color,
          tint: a.tint,
          status: 'idle',
          uptimeSince: new Date(),
        },
      });
      created++;
    } catch {/* duplicate slug, ignore */}
  }
  return { created, existed: 0 };
}

/** Very forgiving YAML-ish parser for an `agents:` block.
 *  Avoids adding a YAML dep — we look for `- slug: ...` blocks under `agents:`.
 *  If anyone needs richer parsing later, swap in `js-yaml`. */
async function readAgentsFromConfig(): Promise<typeof DEFAULT_AGENTS> {
  if (!(await hermesInstalled())) return [];
  const raw = await readConfigRaw();
  if (!raw) return [];
  const lines = raw.split('\n');
  const out: typeof DEFAULT_AGENTS = [];
  let inAgents = false;
  let current: Partial<(typeof DEFAULT_AGENTS)[number]> | null = null;
  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, '');
    if (/^agents:\s*$/.test(line)) { inAgents = true; continue; }
    if (inAgents && /^[A-Za-z_]+:\s*/.test(line) && !/^\s/.test(line)) {
      // Left agents block — new top-level key
      inAgents = false;
      if (current?.slug && current.name) out.push(current as (typeof DEFAULT_AGENTS)[number]);
      current = null;
      continue;
    }
    if (!inAgents) continue;
    const itemMatch = /^\s*-\s*(.*)$/.exec(line);
    if (itemMatch) {
      if (current?.slug && current.name) out.push(current as (typeof DEFAULT_AGENTS)[number]);
      current = { icon: 'activity', color: '#C0603C', tint: '#F6E9E2', role: 'AI Agent' };
      const rest = itemMatch[1].trim();
      if (rest) {
        const kv = /^(\w+):\s*(.*)$/.exec(rest);
        if (kv) (current as any)[kv[1]] = kv[2].replace(/^["']|["']$/g, '');
      }
      continue;
    }
    if (current) {
      const kv = /^\s+(\w+):\s*(.*)$/.exec(line);
      if (kv) (current as any)[kv[1]] = kv[2].replace(/^["']|["']$/g, '');
    }
  }
  if (inAgents && current?.slug && current.name) out.push(current as (typeof DEFAULT_AGENTS)[number]);
  return out;
}
