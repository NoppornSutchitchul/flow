/**
 * Shared WebSocket → silent cache updates.
 * Request rows patch in place; other topics prefetch only observed queries.
 */
import { useEffect } from "react";
import type { QueryClient } from "@tanstack/react-query";

import { prefetchObservedQueries } from "./queryRefresh";
import {
  scheduleRemoteRequestSync,
} from "./requestCache";
import { bindPresenceSender, wsUrlWithAuth } from "./presenceSync";
import {
  markRealtimeConnected,
  markRealtimeDisconnectedNow,
  scheduleRealtimeDisconnected,
} from "./realtimeConnection";
import type { PresenceStatus } from "./presence";

type Topic =
  | "requests.changed"
  | "products.changed"
  | "users.changed"
  | string;

let socket: WebSocket | null = null;
let retryTimer: number | null = null;
let invalidateFlush: number | null = null;
/** Ignore onclose while replacing the socket (reconnect / login). */
let socketSwap = false;
let   pendingInvalidations: {
  products: boolean;
  users: boolean;
  departments: boolean;
  hotelLocations: boolean;
  guestRooms: boolean;
  roomOptions: boolean;
} = {
  products: false,
  users: false,
  departments: false,
  hotelLocations: false,
  guestRooms: false,
  roomOptions: false,
};

function scheduleCacheFlush(qc: QueryClient) {
  if (invalidateFlush !== null) window.clearTimeout(invalidateFlush);
  invalidateFlush = window.setTimeout(() => {
    invalidateFlush = null;
    const tasks: Promise<void>[] = [];
    if (pendingInvalidations.products) {
      tasks.push(prefetchObservedQueries(qc, ["products"]));
    }
    if (pendingInvalidations.users) {
      tasks.push(prefetchObservedQueries(qc, ["users"]));
    }
    if (pendingInvalidations.departments) {
      tasks.push(prefetchObservedQueries(qc, ["departments"]));
    }
    if (pendingInvalidations.hotelLocations) {
      tasks.push(prefetchObservedQueries(qc, ["hotel-locations"]));
    }
    if (pendingInvalidations.guestRooms) {
      tasks.push(prefetchObservedQueries(qc, ["guest-rooms"]));
    }
    if (pendingInvalidations.roomOptions) {
      tasks.push(prefetchObservedQueries(qc, ["room-options"]));
    }
    pendingInvalidations = {
      products: false,
      users: false,
      departments: false,
      hotelLocations: false,
      guestRooms: false,
      roomOptions: false,
    };
    void Promise.all(tasks);
  }, 300);
}

function topicToInvalidations(qc: QueryClient, topic: Topic) {
  if (topic.startsWith("requests")) {
    return;
  }
  if (topic.startsWith("products")) {
    pendingInvalidations.products = true;
    scheduleCacheFlush(qc);
    return;
  }
  if (topic.startsWith("users")) {
    pendingInvalidations.users = true;
    scheduleCacheFlush(qc);
    return;
  }
  if (topic.startsWith("departments")) {
    pendingInvalidations.departments = true;
    scheduleCacheFlush(qc);
    return;
  }
  if (topic.startsWith("hotel-locations")) {
    pendingInvalidations.hotelLocations = true;
    scheduleCacheFlush(qc);
    return;
  }
  if (topic.startsWith("guest-rooms")) {
    pendingInvalidations.guestRooms = true;
    scheduleCacheFlush(qc);
    return;
  }
  if (topic.startsWith("room-options")) {
    pendingInvalidations.roomOptions = true;
    pendingInvalidations.guestRooms = true;
    scheduleCacheFlush(qc);
  }
}

function sendPresence(status: PresenceStatus) {
  if (socket?.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify({ type: "presence", status }));
}

function open(qc: QueryClient) {
  socketSwap = Boolean(socket);
  if (socket) {
    socket.onerror = null;
    socket.onclose = null;
    socket.close();
    socket = null;
  }
  socket = new WebSocket(wsUrlWithAuth());
  bindPresenceSender(sendPresence);
  socket.onopen = () => {
    socketSwap = false;
    markRealtimeConnected();
    sendPresence("online");
  };
  socket.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data) as {
        topic: Topic;
        data?: { id?: number; request?: import("./types").RequestRead };
      };
      const requestId = msg.data?.id;
      if (msg.topic.startsWith("requests")) {
        if (requestId != null) {
          scheduleRemoteRequestSync(qc, requestId, msg.data?.request);
        }
        return;
      }
      topicToInvalidations(qc, msg.topic);
    } catch {
      // ignore malformed
    }
  };
  socket.onclose = () => {
    bindPresenceSender(null);
    socket = null;
    const intentional = socketSwap;
    socketSwap = false;
    if (!intentional) {
      scheduleRealtimeDisconnected();
    }
    if (retryTimer) window.clearTimeout(retryTimer);
    retryTimer = window.setTimeout(() => open(qc), 1500);
  };
  socket.onerror = () => socket?.close();
}

export function useRealtime(qc: QueryClient, enabled = true) {
  useEffect(() => {
    if (!enabled) {
      socketSwap = true;
      socket?.close();
      socket = null;
      markRealtimeDisconnectedNow();
      return;
    }
    open(qc);
    return () => {
      // keep the socket open across navigations — App lives for the whole session.
    };
  }, [qc, enabled]);
}
