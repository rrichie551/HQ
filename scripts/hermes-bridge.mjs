#!/usr/bin/env node
/**
 * Hermes Bridge — a tiny HTTP + WebSocket service that runs on the HOST
 * (not in Docker) and lets the Mission Control container talk to Hermes.
 *
 *   Dashboard (in container) ─POST /exec─▶ Bridge ─spawn─▶ hermes
 *   Dashboard (in container) ─WS  /term─▶ Bridge ─PTY──▶ hermes (interactive)
 *
 * Why a bridge?  The dashboard container can't run `hermes` directly:
 *   - alpine has no Python, hermes has Python deps
 *   - the user's hermes binary lives at ~/.local/bin/hermes (or similar)
 *
 * Security:
 *   - Listens on 0.0.0.0:7181 by default (only reachable via Docker host
 *     gateway since the dashboard's container has extra_hosts mapping)
 *   - Bearer token (HERMES_BRIDGE_TOKEN) required on every request
 *   - Whitelist of allowed `hermes` subcommands (no shell escape)
 *   - Regex-guarded args (no command injection)
 */
import http from 'node:http';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import * as pty from 'node-pty';

const PORT = Number(process.env.HERMES_BRIDGE_PORT ?? 7181);
const HOST = process.env.HERMES_BRIDGE_HOST ?? '0.0.0.0';
const TOKEN = process.env.HERMES_BRIDGE_TOKEN ?? '';
const HERMES_BIN = process.env.HERMES_BIN ?? `${os.homedir()}/.local/bin/hermes`;
const HERMES_CWD = process.env.HERMES_DIR ?? `${os.homedir()}/.hermes`;

// Make sure node-pty's prebuild can find a writable home for caches even
// when running under systemd with a minimal env.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.env.HOME = process.env.HOME ?? os.homedir();

if (!TOKEN) {
  console.error('[hermes-bridge] refusing to start without HERMES_BRIDGE_TOKEN');
  process.exit(1);
}

/* ───────────────────────── exec (HTTP) ───────────────────────── */

const WHITELIST = {
  doctor:   { args: 'none' },
  update:   { args: 'none' },
  version:  { args: 'none' },
  status:   { args: 'none' },
  cron:     { args: 'limited', subcommands: new Set(['list', 'add', 'remove', 'rm', 'enable', 'disable', 'show']) },
  tools:    { args: 'limited', subcommands: new Set(['list']) },
  model:    { args: 'limited', subcommands: new Set(['list', 'show']) },
  skills:   { args: 'limited', subcommands: new Set(['list', 'install', 'remove', 'show', 'search', 'enable', 'disable']) },
  sessions: { args: 'limited', subcommands: new Set(['list', 'show', 'export', 'rename']) },
  config:   { args: 'limited', subcommands: new Set(['show', 'get']) },
};

// Allow letters, digits, common punctuation, spaces. Reject shell metacharacters.
const SAFE_ARG = /^[\w\s./@:'"=\-+,!?*#%&()‘’“”]+$/;

function authOk(req) {
  const headerToken = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '').trim();
  if (headerToken && headerToken === TOKEN) return true;
  // Also allow token via query string for WebSocket connections (browsers
  // can't easily set Authorization on a WS upgrade).
  try {
    const u = new URL(req.url, 'http://x');
    const q = u.searchParams.get('token') ?? '';
    return q && q === TOKEN;
  } catch { return false; }
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
      timeout: 60_000,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', (err) => resolve({ ok: false, code: -1, stdout, stderr: stderr + `\nbridge: ${err.message}` }));
    child.on('close', (code) => resolve({ ok: code === 0, code: code ?? -1, stdout, stderr }));
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

/* ──────────────────── terminal (WebSocket) ─────────────────────
 *
 * Protocol on the WS:
 *   client → server : raw stdin bytes  (string, text frame)
 *                    OR JSON control: { "type": "resize", "cols": N, "rows": N }
 *   server → client : raw stdout bytes (string, text frame)
 *
 * On disconnect the PTY is killed.
 */
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
  if (url.pathname !== '/term') { socket.destroy(); return; }
  if (!authOk(req)) { socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n'); socket.destroy(); return; }
  wss.handleUpgrade(req, socket, head, (ws) => { wss.emit('connection', ws, req); });
});

wss.on('connection', (ws, req) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
  const cols = Math.max(40, Math.min(400, Number(url.searchParams.get('cols') ?? 120)));
  const rows = Math.max(10, Math.min(120, Number(url.searchParams.get('rows') ?? 32)));
  const sessionFlag = url.searchParams.get('resume');

  // Build args: optionally resume a session. Otherwise just start fresh.
  const args = sessionFlag ? ['--resume', sessionFlag] : [];

  console.log(`[term] spawning hermes ${args.join(' ')} (${cols}x${rows})`);

  let term;
  try {
    term = pty.spawn(HERMES_BIN, args, {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: HERMES_CWD,
      env: { ...process.env, HOME: os.homedir(), TERM: 'xterm-256color' },
    });
  } catch (e) {
    ws.send(`bridge: failed to spawn hermes: ${e.message}\r\n`);
    ws.close();
    return;
  }

  term.onData((data) => {
    if (ws.readyState === ws.OPEN) ws.send(data);
  });
  term.onExit(({ exitCode }) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(`\r\n\x1b[2m[hermes exited with code ${exitCode}]\x1b[0m\r\n`);
      ws.close();
    }
  });

  ws.on('message', (msg, isBinary) => {
    if (isBinary) { try { term.write(msg); } catch {} return; }
    const text = msg.toString();
    // JSON control frame?
    if (text.startsWith('{') && text.length < 200) {
      try {
        const o = JSON.parse(text);
        if (o.type === 'resize' && Number.isInteger(o.cols) && Number.isInteger(o.rows)) {
          term.resize(Math.max(40, Math.min(400, o.cols)), Math.max(10, Math.min(120, o.rows)));
          return;
        }
      } catch { /* fall through to raw write */ }
    }
    try { term.write(text); } catch { /* ignore */ }
  });

  ws.on('close', () => {
    try { term.kill(); } catch { /* already dead */ }
  });

  ws.on('error', () => {
    try { term.kill(); } catch {}
  });
});

server.listen(PORT, HOST, () => {
  console.log(`[hermes-bridge] listening on http://${HOST}:${PORT}`);
  console.log(`[hermes-bridge] hermes binary: ${HERMES_BIN}`);
  console.log(`[hermes-bridge] hermes cwd:    ${HERMES_CWD}`);
  console.log(`[hermes-bridge] terminal WS:   ws://${HOST}:${PORT}/term`);
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => { console.log(`[hermes-bridge] ${sig} — shutting down`); server.close(() => process.exit(0)); });
}
