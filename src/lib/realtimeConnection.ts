/** Tracks shared WebSocket connectivity for React Query polling fallback. */

let connected = false;
let disconnectTimer: number | null = null;

/** Wait before treating a drop as offline (ignores brief reconnect blips). */
const DISCONNECT_DEBOUNCE_MS = 2_500;

export function isRealtimeConnected(): boolean {
  return connected;
}

export function markRealtimeConnected(): void {
  if (disconnectTimer != null) {
    window.clearTimeout(disconnectTimer);
    disconnectTimer = null;
  }
  connected = true;
}

/** Debounced offline — avoids enabling poll/refetch storms on quick reconnect. */
export function scheduleRealtimeDisconnected(): void {
  if (disconnectTimer != null) window.clearTimeout(disconnectTimer);
  disconnectTimer = window.setTimeout(() => {
    disconnectTimer = null;
    connected = false;
  }, DISCONNECT_DEBOUNCE_MS);
}

/** Immediate offline (logout / app disabled). */
export function markRealtimeDisconnectedNow(): void {
  if (disconnectTimer != null) {
    window.clearTimeout(disconnectTimer);
    disconnectTimer = null;
  }
  connected = false;
}
