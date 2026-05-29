import type { RequestFilters } from "./api";
import { isoDateLocal } from "./reportPresetFilters";
import type { RequestRead } from "./types";

export const REQUEST_FILTERS = [
  "all",
  "today",
  "active",
  "pending",
  "in_progress",
  "paused",
  "dnd",
  "delivered",
  "delivered_today",
  "cancelled",
  "cancelled_today",
  "overdue",
] as const;

export type RequestFilter = (typeof REQUEST_FILTERS)[number];

export function isRequestFilter(value: string): value is RequestFilter {
  return (REQUEST_FILTERS as readonly string[]).includes(value);
}

export function parseFiltersParam(raw: string | null): RequestFilter[] {
  if (!raw?.trim()) return [];
  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter(isRequestFilter);
  if (parts.length === 0) return [];
  if (parts.includes("all")) return [];
  return parts;
}

/** Parse `date` URL param; default and cap at today (local calendar). */
export function parseViewDateParam(raw: string | null, todayIso = isoDateLocal()): string {
  if (!raw?.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) return todayIso;
  const d = raw.trim();
  return d > todayIso ? todayIso : d;
}

export function filtersToParam(filters: Iterable<RequestFilter>): string | null {
  const list = [...filters].filter((f) => f !== "all");
  if (list.length === 0) return null;
  return list.join(",");
}

function startOfUtcDay(d = new Date()): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

function isOverdue(r: RequestRead): boolean {
  if (!["pending", "assigned", "in_progress"].includes(r.status)) return false;
  return r.age_seconds > r.response_minutes * 60;
}

/** True when a row matches a single filter chip (OR-combined by caller). */
export function requestMatchesFilter(
  r: RequestRead,
  filter: RequestFilter,
  todayStart = startOfUtcDay(),
): boolean {
  switch (filter) {
    case "all":
      return true;
    case "today":
      return new Date(r.created_at) >= todayStart;
    case "active":
      return ["pending", "assigned", "in_progress", "paused", "dnd"].includes(
        r.status,
      );
    case "pending":
      return r.status === "pending";
    case "in_progress":
      return r.status === "in_progress";
    case "paused":
      return r.status === "paused";
    case "dnd":
      return r.status === "dnd";
    case "delivered":
      return r.status === "delivered";
    case "delivered_today":
      return (
        r.status === "delivered" &&
        r.delivered_at != null &&
        new Date(r.delivered_at) >= todayStart
      );
    case "cancelled":
      return r.status === "cancelled";
    case "cancelled_today":
      return (
        r.status === "cancelled" &&
        r.cancelled_at != null &&
        new Date(r.cancelled_at) >= todayStart
      );
    case "overdue":
      return isOverdue(r);
    default:
      return true;
  }
}

export function requestMatchesAnyFilter(
  r: RequestRead,
  filters: RequestFilter[],
): boolean {
  const active = filters.filter((f) => f !== "all");
  if (active.length === 0) return true;
  const todayStart = startOfUtcDay();
  return active.some((f) => requestMatchesFilter(r, f, todayStart));
}

export function isMultiFilter(filters: RequestFilter[]): boolean {
  return filters.filter((f) => f !== "all").length > 1;
}

/** Single-filter API params — skip when combining multiple chips client-side. */
export function singleFilterApiParams(
  filters: RequestFilter[],
): Pick<RequestFilters, "status" | "scope"> | null {
  const active = filters.filter((f) => f !== "all");
  if (active.length !== 1) return null;
  const f = active[0]!;
  switch (f) {
    case "today":
      return { scope: "today" };
    case "delivered_today":
      return { scope: "delivered_today" };
    case "cancelled_today":
      return { scope: "cancelled_today" };
    case "overdue":
      return { scope: "overdue" };
    case "active":
      return { status: "active" };
    default:
      return { status: f };
  }
}
