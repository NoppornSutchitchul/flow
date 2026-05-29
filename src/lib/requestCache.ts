import type { QueryClient } from "@tanstack/react-query";

import { requestsApi } from "./api";
import type { RequestFilters } from "./api";
import { prefetchObservedQueries } from "./queryRefresh";
import { requestMatchesFilter } from "./requestFilters";
import type { RequestDetail, RequestRead } from "./types";

const LOCAL_MUTATION_GRACE_MS = 4_000;
const REMOTE_SYNC_COALESCE_MS = 350;
const DASHBOARD_STATS_COALESCE_MS = 500;

const recentLocalMutations = new Map<number, number>();
const pendingRemoteIds = new Set<number>();
const pendingRemoteSnapshots = new Map<number, RequestRead>();
let remoteFlushTimer: number | null = null;
let dashboardStatsTimer: number | null = null;

/** Skip WebSocket refetch when this client already applied the mutation response. */
export function markLocalRequestMutation(requestId: number) {
  recentLocalMutations.set(requestId, Date.now());
}

export function shouldSkipRemoteRequestInvalidation(requestId: number): boolean {
  const at = recentLocalMutations.get(requestId);
  if (!at) return false;
  if (Date.now() - at > LOCAL_MUTATION_GRACE_MS) {
    recentLocalMutations.delete(requestId);
    return false;
  }
  return true;
}

export function detailToRead(detail: RequestDetail): RequestRead {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- strip detail-only fields
  const { timeline, notes, ...read } = detail;
  return read;
}

function createdOnDate(r: RequestRead, onDate: string): boolean {
  return new Date(r.created_at).toISOString().slice(0, 10) === onDate;
}

/** Whether a cached `["requests", params]` list should contain this row. */
function requestBelongsInList(
  r: RequestRead,
  params: unknown,
): boolean | "partial" {
  if (!params || typeof params !== "object") return "partial";

  const p = params as Record<string, unknown>;

  if (typeof p.assignee === "number") {
    if (r.assignee?.id !== p.assignee) return false;
    if (p.scope === "delivered_today") {
      return requestMatchesFilter(r, "delivered_today");
    }
    return true;
  }

  if (typeof p.dept === "string") {
    if (r.department !== p.dept) return false;
    return requestMatchesFilter(r, "active");
  }

  if (p.status === "active" && !("assignee" in p) && !("dept" in p)) {
    const dept = p.department as string | undefined;
    if (dept && r.department !== dept) return false;
    return requestMatchesFilter(r, "active");
  }

  const filters = params as RequestFilters & { on_date?: string };

  if (filters.department && r.department !== filters.department) return false;
  if (filters.assignee_id != null && r.assignee?.id !== filters.assignee_id) {
    return false;
  }
  if (filters.q) {
    const q = filters.q.toLowerCase();
    if (
      !r.room.toLowerCase().includes(q) &&
      !r.code.toLowerCase().includes(q)
    ) {
      return false;
    }
  }
  if (filters.on_date && !createdOnDate(r, filters.on_date)) return false;

  if (filters.scope) {
    return requestMatchesFilter(r, filters.scope as "delivered_today");
  }
  if (filters.status === "active") {
    return requestMatchesFilter(r, "active");
  }
  if (filters.status) {
    return r.status === filters.status;
  }

  if (filters.on_date || filters.department || filters.q) return true;
  return "partial";
}

function requestRowEqual(a: RequestRead, b: RequestRead): boolean {
  return (
    a.id === b.id &&
    a.status === b.status &&
    a.updated_at === b.updated_at &&
    a.assignee?.id === b.assignee?.id &&
    a.awaiting_staff === b.awaiting_staff &&
    a.priority === b.priority &&
    a.delivered_at === b.delivered_at &&
    a.cancelled_at === b.cancelled_at
  );
}

function upsertInList(list: RequestRead[], read: RequestRead): RequestRead[] {
  const idx = list.findIndex((row) => row.id === read.id);
  if (idx >= 0) {
    if (requestRowEqual(list[idx]!, read)) return list;
    const next = list.slice();
    next[idx] = read;
    return next;
  }
  return [read, ...list];
}

export function patchRequestInListCaches(qc: QueryClient, read: RequestRead) {
  for (const query of qc.getQueryCache().findAll({ queryKey: ["requests"] })) {
    const belongs = requestBelongsInList(read, query.queryKey[1]);
    qc.setQueryData<RequestRead[]>(query.queryKey, (old) => {
      if (!old) return old;
      const idx = old.findIndex((row) => row.id === read.id);

      if (belongs === true) {
        return upsertInList(old, read);
      }
      if (belongs === false) {
        if (idx >= 0) return old.filter((row) => row.id !== read.id);
        return old;
      }
      if (idx >= 0) {
        return upsertInList(old, read);
      }
      if (
        belongs === "partial" &&
        requestMatchesFilter(read, "active") &&
        typeof query.queryKey[1] === "object" &&
        (query.queryKey[1] as Record<string, unknown>).status === "active"
      ) {
        return upsertInList(old, read);
      }
      return old;
    });
  }
}

/** Silent in-place update from a WebSocket row snapshot (no network refetch). */
export function applyRemoteRequestSnapshot(qc: QueryClient, read: RequestRead) {
  qc.setQueryData<RequestDetail>(["request", read.id], (old) =>
    old
      ? { ...old, ...read }
      : ({ ...read, timeline: [], notes: [] } as RequestDetail),
  );
  patchRequestInListCaches(qc, read);
}

/** Update detail + list caches in place (no refetch wave). */
export function patchRequestFromDetail(qc: QueryClient, detail: RequestDetail) {
  qc.setQueryData(["request", detail.id], detail);
  patchRequestInListCaches(qc, detailToRead(detail));
}

function isRequestDetailWatched(qc: QueryClient, requestId: number): boolean {
  const query = qc.getQueryCache().find({ queryKey: ["request", requestId] });
  return Boolean(query && query.getObserversCount() > 0);
}

async function syncRemoteRequest(qc: QueryClient, requestId: number) {
  if (shouldSkipRemoteRequestInvalidation(requestId)) return;
  if (!isRequestDetailWatched(qc, requestId)) return;
  try {
    const detail = await requestsApi.get(requestId);
    patchRequestFromDetail(qc, detail);
  } catch {
    // Keep cached UI; next WS event or user action can refresh.
  }
}

function scheduleDashboardStatsRefresh(qc: QueryClient) {
  if (dashboardStatsTimer != null) window.clearTimeout(dashboardStatsTimer);
  dashboardStatsTimer = window.setTimeout(() => {
    dashboardStatsTimer = null;
    void prefetchObservedQueries(qc, ["dashboard"]);
  }, DASHBOARD_STATS_COALESCE_MS);
}

async function flushRemoteRequestSync(qc: QueryClient) {
  const snapshots = [...pendingRemoteSnapshots.entries()];
  pendingRemoteSnapshots.clear();
  const snapshotIds = new Set<number>();
  for (const [id, read] of snapshots) {
    snapshotIds.add(id);
    applyRemoteRequestSnapshot(qc, read);
  }

  const ids = [...pendingRemoteIds].filter((id) => !snapshotIds.has(id));
  pendingRemoteIds.clear();
  await Promise.all(ids.map((id) => syncRemoteRequest(qc, id)));

  if (snapshots.length > 0 || ids.length > 0) {
    scheduleDashboardStatsRefresh(qc);
  }
}

/**
 * Coalesce WebSocket bursts into silent cache patches.
 * Prefer `snapshot` from the server; fall back to GET only when missing.
 */
export function scheduleRemoteRequestSync(
  qc: QueryClient,
  requestId: number,
  snapshot?: RequestRead,
) {
  if (snapshot) {
    pendingRemoteSnapshots.set(requestId, snapshot);
  } else if (!shouldSkipRemoteRequestInvalidation(requestId)) {
    pendingRemoteIds.add(requestId);
  } else {
    return;
  }
  if (remoteFlushTimer != null) window.clearTimeout(remoteFlushTimer);
  remoteFlushTimer = window.setTimeout(() => {
    remoteFlushTimer = null;
    void flushRemoteRequestSync(qc);
  }, REMOTE_SYNC_COALESCE_MS);
}

/** Apply a mutation response without triggering a full-app refetch wave. */
export function syncRequestAfterMutation(qc: QueryClient, detail: RequestDetail) {
  markLocalRequestMutation(detail.id);
  patchRequestFromDetail(qc, detail);
}

/** Mark + patch helpers for TanStack Query mutations (avoids WS race). */
export function requestMutationHandlers(qc: QueryClient, requestId: number) {
  return {
    onMutate: () => markLocalRequestMutation(requestId),
    onSuccess: (detail: RequestDetail) => syncRequestAfterMutation(qc, detail),
  };
}

export function requestMutationHandlersById(qc: QueryClient) {
  return {
    onMutate: (requestId: number) => markLocalRequestMutation(requestId),
    onSuccess: (detail: RequestDetail) => syncRequestAfterMutation(qc, detail),
  };
}
