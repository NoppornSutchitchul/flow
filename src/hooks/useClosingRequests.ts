import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { requestsApi } from "../lib/api";
import type { RequestRead, RequestStatus } from "../lib/types";

export type ClosingOutcome = "pending" | "delivered" | "cancelled";
export type ClosingPhase = "flash" | "collapse";

export type ClosingRequest = {
  snapshot: RequestRead;
  outcome: ClosingOutcome;
  startedAt: number;
  orderIndex: number;
  phase: ClosingPhase;
};

export const CLOSING_FLASH_MS = 3000;
export const CLOSING_COLLAPSE_MS = 400;

function toDisplayRow(c: ClosingRequest): RequestRead {
  const status: RequestStatus =
    c.outcome === "cancelled"
      ? "cancelled"
      : c.outcome === "delivered"
        ? "delivered"
        : c.snapshot.status;
  return { ...c.snapshot, status };
}

function findActiveSortInsertIndex(
  result: RequestRead[],
  row: RequestRead,
  sort: (a: RequestRead, b: RequestRead) => number,
  closingIds: Set<number>,
): number {
  for (let i = 0; i < result.length; i++) {
    if (closingIds.has(result[i].id)) continue;
    if (sort(row, result[i]) < 0) return i;
  }
  return result.length;
}

export function requestClosingRowClass(
  id: number,
  closingOutcomes: Map<number, ClosingOutcome>,
  closingPhases: Map<number, ClosingPhase>,
): string | undefined {
  const outcome = closingOutcomes.get(id);
  if (!outcome) return undefined;
  const phase = closingPhases.get(id);
  const base =
    outcome === "cancelled" ? "row-closing-cancelled" : "row-closing-delivered";
  if (phase === "collapse") return `${base} row-closing-collapse`;
  return base;
}

export function requestClosingCardClass(
  id: number,
  closingOutcomes: Map<number, ClosingOutcome>,
  closingPhases: Map<number, ClosingPhase>,
): string | undefined {
  const outcome = closingOutcomes.get(id);
  if (!outcome) return undefined;
  const phase = closingPhases.get(id);
  const base =
    outcome === "cancelled" ? "card-closing-cancelled" : "card-closing-delivered";
  if (phase === "collapse") return `${base} card-closing-collapse`;
  return base;
}

/**
 * When rows disappear from an active list (delivered / cancelled), keep them
 * visible in place with a flash, collapse, then remove so siblings slide up.
 */
export function useClosingRequests(
  rows: RequestRead[],
  flashMs = CLOSING_FLASH_MS,
  collapseMs = CLOSING_COLLAPSE_MS,
  activeSort?: (a: RequestRead, b: RequestRead) => number,
  enabled = true,
) {
  const prevRowsRef = useRef<Map<number, RequestRead>>(new Map());
  /** Last painted row order — updated in layout effect after `displayRows` is computed. */
  const [displayOrder, setDisplayOrder] = useState<number[]>([]);
  const [closing, setClosing] = useState<Map<number, ClosingRequest>>(new Map());
  const totalMs = flashMs + collapseMs;

  useLayoutEffect(() => {
    if (!enabled) {
      prevRowsRef.current = new Map(rows.map((r) => [r.id, r]));
      setDisplayOrder(rows.map((r) => r.id));
      setClosing(new Map());
      return;
    }

    const currentMap = new Map(rows.map((r) => [r.id, r]));
    const prevMap = prevRowsRef.current;
    const prevOrder = displayOrder;
    const removed: number[] = [];

    for (const id of prevMap.keys()) {
      if (!currentMap.has(id)) removed.push(id);
    }

    if (removed.length > 0) {
      setClosing((prev) => {
        const next = new Map(prev);
        let changed = false;
        for (const id of removed) {
          const snapshot = prevMap.get(id);
          if (!snapshot || next.has(id)) continue;
          // Filter/search changes hide finished rows — not a live completion.
          if (snapshot.status === "delivered" || snapshot.status === "cancelled") {
            continue;
          }
          const orderIndex = prevOrder.indexOf(id);
          next.set(id, {
            snapshot,
            outcome: "pending",
            startedAt: Date.now(),
            orderIndex: orderIndex >= 0 ? orderIndex : prevOrder.length,
            phase: "flash",
          });
          changed = true;
        }
        return changed ? next : prev;
      });

      for (const id of removed) {
        const snapshot = prevMap.get(id);
        if (
          !snapshot ||
          snapshot.status === "delivered" ||
          snapshot.status === "cancelled"
        ) {
          continue;
        }
        void requestsApi
          .get(id)
          .then((detail) => {
            const outcome: ClosingOutcome =
              detail.status === "cancelled" ? "cancelled" : "delivered";
            setClosing((prev) => {
              const cur = prev.get(id);
              if (!cur) return prev;
              const next = new Map(prev);
              next.set(id, { ...cur, outcome });
              return next;
            });
          })
          .catch(() => {
            setClosing((prev) => {
              const cur = prev.get(id);
              if (!cur) return prev;
              const next = new Map(prev);
              next.set(id, { ...cur, outcome: "delivered" });
              return next;
            });
          });
      }
    }

    prevRowsRef.current = new Map(rows.map((r) => [r.id, r]));
  }, [rows, enabled, displayOrder]);

  useEffect(() => {
    if (!enabled || closing.size === 0) return;
    const id = window.setInterval(() => {
      const now = Date.now();
      setClosing((prev) => {
        let changed = false;
        const next = new Map(prev);
        for (const [rowId, row] of prev) {
          const elapsed = now - row.startedAt;
          if (row.phase === "flash" && elapsed >= flashMs) {
            if (collapseMs > 0) {
              next.set(rowId, { ...row, phase: "collapse" });
            } else {
              next.delete(rowId);
            }
            changed = true;
          } else if (collapseMs > 0 && elapsed >= totalMs) {
            next.delete(rowId);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 50);
    return () => window.clearInterval(id);
  }, [closing.size, flashMs, collapseMs, totalMs, enabled]);

  const closingOutcomes = useMemo(() => {
    const m = new Map<number, ClosingOutcome>();
    for (const [id, c] of closing) m.set(id, c.outcome);
    return m;
  }, [closing]);

  const closingPhases = useMemo(() => {
    const m = new Map<number, ClosingPhase>();
    for (const [id, c] of closing) m.set(id, c.phase);
    return m;
  }, [closing]);

  const closingIds = useMemo(
    () => new Set(closing.keys()),
    [closing],
  );

  const displayRows = useMemo(() => {
    if (!enabled) {
      return activeSort ? [...rows].sort(activeSort) : rows;
    }

    const activeMap = new Map(rows.map((r) => [r.id, r]));
    const result: RequestRead[] = [];
    const seen = new Set<number>();
    if (displayOrder.length === 0) {
      const initial = activeSort ? [...rows].sort(activeSort) : [...rows];
      for (const r of initial) {
        result.push(r);
        seen.add(r.id);
      }
    } else {
      for (const id of displayOrder) {
        if (activeMap.has(id)) {
          result.push(activeMap.get(id)!);
          seen.add(id);
        } else if (closing.has(id)) {
          result.push(toDisplayRow(closing.get(id)!));
          seen.add(id);
        }
      }
    }

    const newcomers = rows.filter((r) => !seen.has(r.id));
    if (newcomers.length > 0) {
      const sorted = activeSort ? [...newcomers].sort(activeSort) : newcomers;
      for (const r of sorted) {
        if (activeSort) {
          const idx = findActiveSortInsertIndex(result, r, activeSort, closingIds);
          result.splice(idx, 0, r);
        } else {
          result.push(r);
        }
        seen.add(r.id);
      }
    }

    const pendingInserts = [...closing.entries()]
      .filter(([id]) => !seen.has(id))
      .sort((a, b) => a[1].orderIndex - b[1].orderIndex);

    for (const [, c] of pendingInserts) {
      const idx = Math.min(c.orderIndex, result.length);
      result.splice(idx, 0, toDisplayRow(c));
      seen.add(c.snapshot.id);
    }

    return result;
  }, [rows, closing, activeSort, closingIds, enabled, displayOrder]);

  useLayoutEffect(() => {
    const next = displayRows.map((r) => r.id);
    setDisplayOrder((prev) => {
      if (prev.length === next.length && prev.every((id, i) => id === next[i])) {
        return prev;
      }
      return next;
    });
  }, [displayRows]);

  const snapshotFor = useCallback(
    (id: number): RequestRead | undefined =>
      closing.get(id)?.snapshot ?? rows.find((r) => r.id === id),
    [closing, rows],
  );

  return {
    displayRows,
    closingOutcomes,
    closingPhases,
    closingIds,
    isClosing: (id: number) => closingIds.has(id),
    snapshotFor,
  };
}
