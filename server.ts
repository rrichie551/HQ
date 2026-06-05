/**
 * Custom Next.js server with Socket.io for live dashboard updates.
 *
 * We expose globalThis.__ioEmit so that any route handler (running in the
 * same Node process) can publish events to connected dashboards without
 * having to thread a server reference through Next.
 */
import { createServer } from 'node:http';
import next from 'next';
import { Server as IOServer } from 'socket.io';

const dev = process.env.NODE_ENV !== 'production';
const port = Number(process.env.PORT ?? 3000);

const app = next({ dev });
const handle = app.getRequestHandler();

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

    // Expose a global emitter so API routes can push without holding `io`.
    (globalThis as any).__ioEmit = (channel: string, event: string, payload: unknown) => {
      io.to(channel).emit(event, payload);
    };

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
