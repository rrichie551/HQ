#!/usr/bin/env node
/**
 * Hermes Bridge — a tiny HTTP service that runs on the HOST (not in Docker)
 * and lets the Mission Control container invoke the `hermes` CLI safely.
 *
 *   Dashboard (in container) ─POST /exec─▶ Bridge (on host) ─spawn─▶ hermes
 *
 * Why a bridge?  The dashboard container can't run `hermes` directly:
 *   - alpine has no Python, hermes has Python deps
 *   - the user's hermes binary lives at ~/.local/bin/hermes on the host
 *   - keeping a duplicate hermes install in the container would drift
 *
 * Security:
 *   - Bound to localhost by default (HOST=127.0.0.1)
 *   - Requires Authorization: Bearer ${HERMES_BRIDGE_TOKEN}
 *   - Only commands in the whitelist (`hermes cron …`, `hermes doctor`, …)
 *     are runnable — no shell, no arbitrary argv
 *
 * Usage:
 *   HERMES_BRIDGE_TOKEN=xxx HERMES_BIN=/root/.local/bin/hermes node hermes-bridge.mjs
 *
 * See scripts/install-hermes-bridge.sh to install it as a systemd service.
 */
import http from 'node:http';
import { spawn } from 'node:child_process';
import os from 'node:os';

const PORT = Number(process.env.HERMES_BRIDGE_PORT ?? 7181);
const HOST = process.env.HERMES_BRIDGE_HOST ?? '0.0.0.0';
const TOKEN = process.env.HERMES_BRIDGE_TOKEN ?? '';
const HERMES_BIN = process.env.HERMES_BIN ?? `${os.homedir()}/.local/bin/hermes`;
const HERMES_CWD = process.env.HERMES_DIR ?? `${os.homedir()}/.hermes`;

if (!TOKEN) {
  console.error('[hermes-bridge] refusing to start without HERMES_BRIDGE_TOKEN');
  process.exit(1);
}

/**
 * Only these `hermes` subcommands can be called. Each one optionally limits
 * the kind of args allowed (so a caller can't pass shell metacharacters).
 */
const WHITELIST = {
  doctor:  { args: 'none' },
  update:  { args: 'none' },
  cron:    { args: 'limited', subcommands: new Set(['list', 'add', 'remove', 'rm', 'enable', 'disable', 'show']) },
  tools:   { args: 'limited', subcommands: new Set(['list']) },
  model:   { args: 'limited', subcommands: new Set(['list', 'show']) },
};

// Validate args: allow letters, digits, common punctuation, spaces.
// Reject anything that could break out (backticks, $, |, ;, &, <, >, newline).
const SAFE_ARG = /^[\w\s./@:'"=\-+,!?*#%&()‘’“”]+$/;

function authOk(req) {
  const h = req.headers.authorization ?? '';
  const t = h.replace(/^Bearer\s+/i, '').trim();
  return t && t === TOKEN;
}

function send(res, code, payload) {
  res.writeHead(code, { 'content-type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

function runHermes({ subcommand, args }) {
  return new Promise((resolve) => {
    const child = spawn(HERMES_BIN, [subcommand, ...args], {
      cwd: HERMES_CWD,
      env: { ...process.env, HOME: os.homedir() },
      timeout: 30_000,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', (err) => {
      resolve({ ok: false, code: -1, stdout, stderr: stderr + `\nbridge: ${err.message}` });
    });
    child.on('close', (code) => {
      resolve({ ok: code === 0, code: code ?? -1, stdout, stderr });
    });
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/healthz') {
    return send(res, 200, { ok: true, hermes_bin: HERMES_BIN, hermes_cwd: HERMES_CWD });
  }

  if (!authOk(req)) return send(res, 401, { error: 'unauthorized' });

  if (req.method === 'POST' && req.url === '/exec') {
    let body;
    try { body = JSON.parse(await readBody(req)); }
    catch { return send(res, 400, { error: 'invalid-json' }); }

    const { subcommand, args = [] } = body ?? {};
    if (typeof subcommand !== 'string') return send(res, 400, { error: 'subcommand required' });
    const rule = WHITELIST[subcommand];
    if (!rule) return send(res, 400, { error: `subcommand "${subcommand}" is not allowed` });

    if (!Array.isArray(args) || args.some((a) => typeof a !== 'string')) {
      return send(res, 400, { error: 'args must be string[]' });
    }
    for (const a of args) {
      if (!SAFE_ARG.test(a)) return send(res, 400, { error: `arg contains forbidden characters: ${a}` });
    }
    if (rule.args === 'none' && args.length > 0) {
      return send(res, 400, { error: `"${subcommand}" takes no arguments` });
    }
    if (rule.args === 'limited' && args.length > 0) {
      const head = args[0];
      if (!rule.subcommands?.has(head)) {
        return send(res, 400, { error: `"${subcommand} ${head}" is not allowed` });
      }
    }

    const result = await runHermes({ subcommand, args });
    return send(res, 200, result);
  }

  send(res, 404, { error: 'not-found' });
});

server.listen(PORT, HOST, () => {
  console.log(`[hermes-bridge] listening on http://${HOST}:${PORT}`);
  console.log(`[hermes-bridge] hermes binary: ${HERMES_BIN}`);
  console.log(`[hermes-bridge] hermes cwd:    ${HERMES_CWD}`);
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => { console.log(`[hermes-bridge] ${sig} — shutting down`); server.close(() => process.exit(0)); });
}
