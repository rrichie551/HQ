/**
 * Filesystem adapter for the Nous Research `hermes-agent` install.
 *
 * Hermes lives at HERMES_DIR (default /hermes when running in Docker, since
 * docker-compose mounts the host's ~/.hermes -> /hermes). This module reads
 * and writes files under that root: config.yaml, skills/*, memory/*, etc.
 *
 * Public layout we read/write (from hermes-agent docs):
 *   config.yaml                — main settings
 *   skills/                    — agent skill definitions (procedural memory)
 *   skills/openclaw-imports/   — imported OpenClaw skills (read-only respect)
 *   memory/MEMORY.md           — long-term agent memory
 *   memory/USER.md             — what Hermes knows about the user
 *   SOUL.md                    — personality (root or per-skill)
 *   crons.yaml                 — best-effort: Hermes may store cron defs here
 *
 * Everything is best-effort: if Hermes isn't installed yet, every getter
 * returns null / [] and writes throw. The /admin UI handles that gracefully.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { constants as fsc } from 'node:fs';

export function hermesRoot(): string {
  return process.env.HERMES_DIR ?? '/hermes';
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p, fsc.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function hermesInstalled(): Promise<boolean> {
  const root = hermesRoot();
  if (!(await exists(root))) return false;
  // Be lenient — any of these existing is enough to count as "installed"
  for (const candidate of ['config.yaml', 'skills', 'memory']) {
    if (await exists(path.join(root, candidate))) return true;
  }
  return false;
}

export type HermesStatus = {
  installed: boolean;
  root: string;
  configPath: string | null;
  skillsCount: number;
  memoryCount: number;
  hasSoul: boolean;
  hasCronFile: boolean;
};

export async function getHermesStatus(): Promise<HermesStatus> {
  const root = hermesRoot();
  const installed = await hermesInstalled();
  const configPath = (await exists(path.join(root, 'config.yaml'))) ? path.join(root, 'config.yaml') : null;
  let skillsCount = 0;
  let memoryCount = 0;
  if (await exists(path.join(root, 'skills'))) {
    try {
      const entries = await fs.readdir(path.join(root, 'skills'));
      skillsCount = entries.filter((n) => !n.startsWith('.')).length;
    } catch {/* ignore */}
  }
  if (await exists(path.join(root, 'memory'))) {
    try {
      const entries = await fs.readdir(path.join(root, 'memory'));
      memoryCount = entries.filter((n) => !n.startsWith('.')).length;
    } catch {/* ignore */}
  }
  const hasSoul = await exists(path.join(root, 'SOUL.md'));
  const hasCronFile =
    (await exists(path.join(root, 'crons.yaml'))) ||
    (await exists(path.join(root, 'cron.yaml'))) ||
    (await exists(path.join(root, 'crons.json')));
  return { installed, root, configPath, skillsCount, memoryCount, hasSoul, hasCronFile };
}

/* ------------------------------------------------------------------ */
/* Config                                                              */
/* ------------------------------------------------------------------ */

export async function readConfigRaw(): Promise<string | null> {
  const p = path.join(hermesRoot(), 'config.yaml');
  if (!(await exists(p))) return null;
  return fs.readFile(p, 'utf-8');
}

export async function writeConfigRaw(content: string): Promise<void> {
  const p = path.join(hermesRoot(), 'config.yaml');
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, content, 'utf-8');
}

/* ------------------------------------------------------------------ */
/* Skills                                                              */
/* ------------------------------------------------------------------ */

export type SkillFile = {
  name: string;            // filename without extension, used as id
  path: string;            // absolute path
  size: number;
  modified: string;        // ISO
  isImported: boolean;     // under openclaw-imports/
  preview: string;         // first ~280 chars
};

export type SkillContent = SkillFile & { content: string };

function sanitizeSkillName(name: string): string {
  // Allow word chars, dash, underscore. Strip path traversal.
  return name.replace(/[^\w-]/g, '_').slice(0, 80);
}

function skillsDir(): string {
  return path.join(hermesRoot(), 'skills');
}

async function* walkSkills(dir: string, base: string): AsyncGenerator<{ rel: string; abs: string }> {
  let entries: { name: string; isDir: boolean; isFile: boolean }[] = [];
  try {
    const raw = await fs.readdir(dir, { withFileTypes: true });
    entries = raw.map((e) => ({ name: e.name, isDir: e.isDirectory(), isFile: e.isFile() }));
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    const abs = path.join(dir, e.name);
    const rel = path.relative(base, abs);
    if (e.isDir) {
      yield* walkSkills(abs, base);
    } else if (e.isFile && /\.(md|yaml|yml|txt)$/i.test(e.name)) {
      yield { rel, abs };
    }
  }
}

export async function listSkills(): Promise<SkillFile[]> {
  const dir = skillsDir();
  if (!(await exists(dir))) return [];
  const results: SkillFile[] = [];
  for await (const f of walkSkills(dir, dir)) {
    try {
      const stat = await fs.stat(f.abs);
      const content = await fs.readFile(f.abs, 'utf-8').catch(() => '');
      results.push({
        name: f.rel,
        path: f.abs,
        size: stat.size,
        modified: stat.mtime.toISOString(),
        isImported: f.rel.startsWith('openclaw-imports'),
        preview: content.slice(0, 280),
      });
    } catch {/* ignore */}
  }
  results.sort((a, b) => a.name.localeCompare(b.name));
  return results;
}

export async function readSkill(relName: string): Promise<SkillContent | null> {
  const dir = skillsDir();
  const abs = path.resolve(dir, relName);
  // Guard against path traversal
  if (!abs.startsWith(dir + path.sep) && abs !== dir) return null;
  if (!(await exists(abs))) return null;
  const stat = await fs.stat(abs);
  if (!stat.isFile()) return null;
  const content = await fs.readFile(abs, 'utf-8');
  return {
    name: relName,
    path: abs,
    size: stat.size,
    modified: stat.mtime.toISOString(),
    isImported: relName.startsWith('openclaw-imports'),
    preview: content.slice(0, 280),
    content,
  };
}

export async function writeSkill(relName: string, content: string): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const dir = skillsDir();
  // For new skills, allow user-provided name; sanitize it
  const safe = relName
    .split('/')
    .filter((seg) => seg && seg !== '..' && seg !== '.')
    .map((seg, i, arr) => (i === arr.length - 1 ? sanitizeSkillName(seg.replace(/\.[^.]+$/, '')) + path.extname(seg || '.md') : sanitizeSkillName(seg)))
    .join('/');
  const finalName = /\.(md|yaml|yml|txt)$/i.test(safe) ? safe : `${safe}.md`;
  const abs = path.resolve(dir, finalName);
  if (!abs.startsWith(dir + path.sep)) return { ok: false, error: 'invalid-path' };
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, content, 'utf-8');
  return { ok: true, path: abs };
}

export async function deleteSkill(relName: string): Promise<{ ok: boolean; error?: string }> {
  const dir = skillsDir();
  const abs = path.resolve(dir, relName);
  if (!abs.startsWith(dir + path.sep)) return { ok: false, error: 'invalid-path' };
  if (!(await exists(abs))) return { ok: false, error: 'not-found' };
  await fs.unlink(abs);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Memory                                                              */
/* ------------------------------------------------------------------ */

export type MemoryFile = { name: string; path: string; size: number; modified: string; content: string };

const MEMORY_FILES = ['MEMORY.md', 'USER.md'];

export async function listMemoryFiles(): Promise<MemoryFile[]> {
  const dir = path.join(hermesRoot(), 'memory');
  if (!(await exists(dir))) return [];
  const all: MemoryFile[] = [];
  let entries: string[] = [];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return [];
  }
  for (const name of entries) {
    if (name.startsWith('.') || !/\.(md|txt)$/i.test(name)) continue;
    const abs = path.join(dir, name);
    try {
      const stat = await fs.stat(abs);
      if (!stat.isFile()) continue;
      const content = await fs.readFile(abs, 'utf-8');
      all.push({ name, path: abs, size: stat.size, modified: stat.mtime.toISOString(), content });
    } catch {/* ignore */}
  }
  // Bring canonical files first
  all.sort((a, b) => {
    const ai = MEMORY_FILES.indexOf(a.name);
    const bi = MEMORY_FILES.indexOf(b.name);
    if (ai !== -1 || bi !== -1) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    return a.name.localeCompare(b.name);
  });
  return all;
}

export async function readMemoryFile(name: string): Promise<MemoryFile | null> {
  const dir = path.join(hermesRoot(), 'memory');
  const abs = path.resolve(dir, name);
  if (!abs.startsWith(dir + path.sep)) return null;
  if (!(await exists(abs))) return null;
  const stat = await fs.stat(abs);
  if (!stat.isFile()) return null;
  const content = await fs.readFile(abs, 'utf-8');
  return { name, path: abs, size: stat.size, modified: stat.mtime.toISOString(), content };
}

export async function writeMemoryFile(name: string, content: string): Promise<{ ok: boolean; error?: string }> {
  const dir = path.join(hermesRoot(), 'memory');
  const safe = name.replace(/[^\w.-]/g, '_').slice(0, 80);
  if (!/\.(md|txt)$/i.test(safe)) return { ok: false, error: 'extension-must-be-md-or-txt' };
  const abs = path.resolve(dir, safe);
  if (!abs.startsWith(dir + path.sep)) return { ok: false, error: 'invalid-path' };
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(abs, content, 'utf-8');
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* SOUL.md                                                             */
/* ------------------------------------------------------------------ */

export async function readSoul(): Promise<{ path: string; content: string } | null> {
  const candidates = [path.join(hermesRoot(), 'SOUL.md'), path.join(hermesRoot(), 'soul.md')];
  for (const p of candidates) {
    if (await exists(p)) {
      const content = await fs.readFile(p, 'utf-8');
      return { path: p, content };
    }
  }
  return null;
}

export async function writeSoul(content: string): Promise<{ ok: boolean }> {
  const p = path.join(hermesRoot(), 'SOUL.md');
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, content, 'utf-8');
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Crons (best-effort; Hermes' actual format may differ)               */
/* ------------------------------------------------------------------ */

export type CronEntry = { id: string; schedule: string; description: string; raw: string };

const CRON_CANDIDATES = ['crons.yaml', 'cron.yaml', 'crons.json'];

async function findCronFile(): Promise<string | null> {
  for (const name of CRON_CANDIDATES) {
    const p = path.join(hermesRoot(), name);
    if (await exists(p)) return p;
  }
  return null;
}

export async function readCronFileRaw(): Promise<{ path: string; content: string } | null> {
  const p = await findCronFile();
  if (!p) return null;
  const content = await fs.readFile(p, 'utf-8');
  return { path: p, content };
}

export async function writeCronFileRaw(content: string): Promise<{ ok: boolean; path: string }> {
  const existing = await findCronFile();
  const p = existing ?? path.join(hermesRoot(), 'crons.yaml');
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, content, 'utf-8');
  return { ok: true, path: p };
}
