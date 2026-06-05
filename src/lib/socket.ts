/**
 * Dashboard-side helper for emitting Socket.io events to the dashboard UI.
 * The Socket.io server lives in server.ts and exposes a global emitter
 * so route handlers can publish updates without holding a server reference.
 */
type Payload = Record<string, unknown>;

declare global {
  // eslint-disable-next-line no-var
  var __ioEmit: ((channel: string, event: string, payload: Payload) => void) | undefined;
}

export function emit(event: string, payload: Payload, channel = 'dashboard'): void {
  if (typeof globalThis.__ioEmit === 'function') {
    try {
      globalThis.__ioEmit(channel, event, payload);
    } catch {
      /* swallow — UI updates are best-effort */
    }
  }
}
