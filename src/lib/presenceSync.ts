import { useEffect } from "react";

import { getAuthToken } from "./api";
import { usePresenceStatus } from "../hooks/usePresenceStatus";
import type { PresenceStatus } from "./presence";

type PresenceListener = (status: PresenceStatus) => void;

let presenceListener: PresenceListener | null = null;

/** Called from realtime.ts when the socket opens or reconnects. */
export function bindPresenceSender(send: PresenceListener | null) {
  presenceListener = send;
}

export function pushPresenceStatus(status: PresenceStatus) {
  presenceListener?.(status);
}

/** Heartbeat + tab-focus presence to the backend via WebSocket. */
export function usePresenceSync(isLoggedIn: boolean) {
  const status = usePresenceStatus(isLoggedIn);

  useEffect(() => {
    if (!isLoggedIn) return;
    pushPresenceStatus(status);
    const id = window.setInterval(() => pushPresenceStatus(status), 30_000);
    return () => window.clearInterval(id);
  }, [isLoggedIn, status]);
}

export function wsUrlWithAuth(): string {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const token = getAuthToken();
  const qs = token ? `?token=${encodeURIComponent(token)}` : "";
  return `${proto}://${location.host}/ws${qs}`;
}
