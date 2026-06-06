/**
 * Custom Next.js server with Socket.io for live dashboard updates AND
 * a WebSocket proxy for the admin terminal.
 *
 *   /socket.io/*       — dashboard live-feed (Socket.io)
 *   /api/admin/term    — proxied WS to the host-side hermes-bridge PTY,
 *                        gated on next-auth session role=owner
 */
import { createServer, type IncomingMessage } from 'node:http';
import next from 'next';
import { parse as parseCookie } from 'node:url';
import { Server as IOServer } from 'socket.io';
import { WebSocketServer, WebSocket } from 'ws';
import { getToken } from 'next-auth/jwt';

const dev = process.env.NODE_ENV !== 'production';
const port = Number(process.env.PORT ?? 3000);

const app = next({ dev });
const handle = app.getRequestHandler();

const BRIDGE_URL = process.env.HERMES_BRIDGE_URL ?? 'http://host.docker.internal:7181';
const BRIDGE_TOKEN = process.env.HERMES_BRIDGE_TOKEN ?? '';

function bridgeWsUrl(query: string): string {
  // Convert http://host:7181 → ws://host:7181/term?…
  const u = new URL(BRIDGE_URL);
  u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
  u.pathname = '/term';
  if (BRIDGE_TOKEN) u.searchParams.set('token', BRIDGE_TOKEN);
  if (query) {
    // Forward client-supplied params (cols, rows, resume) onto the upstream URL
    const inbound = new URLSearchParams(query.replace(/^\?/, ''));
    for (const [k, v] of inbound) {
      if (k === 'token') continue; // never trust caller-supplied bridge token
      u.searchParams.set(k, v);
    }
  }
  return u.toString();
}

async function isOwnerRequest(req: IncomingMessage): Promise<boolean> {
  try {
    // next-auth's getToken reads the next-auth JWT cookie from the request.
    const token = await getToken({
      req: req as any,
      secret: process.env.NEXTAUTH_SECRET,
    });
    if (!token) return false;
    const role = (token as any).role;
    return role === 'owner';
  } catch {
    return false;
  }
}

app
  .prepare()
  .then(() => {
    const httpServer = createServer((req, res) => handle(req, res));

    const io = new IOServer(httpServer, {
      path: '/socket.io/',
      cors: { origin: false },
    });

    io.on('connection', (socket) => {
      socket.on('join', (channel: string) => {
        if (typeof channel === 'string' && channel.length < 64) socket.join(channel);
      });
    });

    (globalThis as any).__ioEmit = (channel: string, event: string, payload: unknown) => {
      io.to(channel).emit(event, payload);
    };

    /* ─── Terminal WebSocket proxy ─────────────────────────────────────
     * /api/admin/term — owner-only. We accept the WS, verify the session
     * cookie, then open an outbound WS to the bridge and pipe bytes both
     * ways. If the bridge is unreachable or auth fails, send a clear
     * error frame and close.
     */
    const wss = new WebSocketServer({ noServer: true });

    httpServer.on('upgrade', async (req, socket, head) => {
      const url = parseCookie(req.url ?? '/', true);
      // Let Socket.io handle its own upgrades
      if ((url.pathname ?? '').startsWith('/socket.io/')) return;
      if (url.pathname !== '/api/admin/term') return;

      if (!BRIDGE_TOKEN) {
        socket.write('HTTP/1.1 503 Service Unavailable\r\n\r\nHERMES_BRIDGE_TOKEN not set');
        socket.destroy();
        return;
      }

      const isOwner = await isOwnerRequest(req);
      if (!isOwner) {
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
        socket.destroy();
        return;
      }

      wss.handleUpgrade(req, socket, head, (clientWs) => {
        const upstreamUrl = bridgeWsUrl(req.url?.split('?')[1] ?? '');
        const upstream = new WebSocket(upstreamUrl);
        let upstreamOpen = false;
        const pendingFromClient: any[] = [];

        upstream.on('open', () => {
          upstreamOpen = true;
          for (const m of pendingFromClient) upstream.send(m);
          pendingFromClient.length = 0;
        });
        upstream.on('message', (data, isBinary) => {
          if (clientWs.readyState === clientWs.OPEN) clientWs.send(data, { binary: isBinary });
        });
        upstream.on('close', () => {
          if (clientWs.readyState === clientWs.OPEN) clientWs.close();
        });
        upstream.on('error', (err) => {
          if (clientWs.readyState === clientWs.OPEN) {
            clientWs.send(`\r\n\x1b[31m[bridge unreachable: ${err.message}]\x1b[0m\r\n`);
            clientWs.close();
          }
        });

        clientWs.on('message', (data, isBinary) => {
          if (upstreamOpen) upstream.send(data, { binary: isBinary });
          else pendingFromClient.push(data);
        });
        clientWs.on('close', () => { try { upstream.close(); } catch {} });
        clientWs.on('error', () => { try { upstream.close(); } catch {} });
      });
    });

    httpServer.listen(port, () => {
      // eslint-disable-next-line no-console
      console.log(`[mission-control] ready on http://localhost:${port}`);
    });
  })
  .catch((err: unknown) => {
    // eslint-disable-next-line no-console
    console.error('[mission-control] failed to start', err);
    process.exit(1);
  });
