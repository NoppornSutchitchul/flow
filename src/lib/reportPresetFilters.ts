import { periodDaysInclusive } from "./reportFormat";

/** Maximum inclusive calendar days for one report date range (1 year). */
export const REPORT_MAX_RANGE_DAYS = 365;

/** Which filters each preset report supports in the hub toolbar. */
export type ReportFilterKey =
  | "department"
  | "status"
  | "priority"
  | "assignee"
  | "action"
  | "limit"
  | "dateRange"
  | "shift"
  | "stockStatus";

export function isoDateLocal(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isoDateDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return isoDateLocal(d);
}

/** Period immediately before `dateFrom`–`dateTo` with the same inclusive span. */
export function defaultCompareRangeBefore(
  dateFrom: string,
  dateTo: string,
): { compareDateFrom: string; compareDateTo: string } {
  const start = new Date(`${dateFrom}T12:00:00`);
  const end = new Date(`${dateTo}T12:00:00`);
  const spanMs = end.getTime() - start.getTime();
  const prevEnd = new Date(start);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd.getTime() - spanMs);
  return {
    compareDateFrom: isoDateLocal(prevStart),
    compareDateTo: isoDateLocal(prevEnd),
  };
}

/** First day of the current calendar year (for report default range). */
export function isoDateYearStart(d = new Date()): string {
  return isoDateLocal(new Date(d.getFullYear(), 0, 1));
}

export const PRESET_FILTER_KEYS: Record<string, ReportFilterKey[]> = {
  "executive-dashboard": ["department", "status", "priority", "dateRange"],
  "sla-performance": ["department", "status", "priority", "dateRange"],
  "department-comparison": ["status", "priority", "dateRange"],
  "volume-trend": ["department", "status", "priority", "dateRange"],
  "operations-overview": ["department", "status", "priority", "dateRange"],
  "status-breakdown": ["department", "priority", "dateRange"],
  "priority-analysis": ["department", "status", "dateRange"],
  "top-items": ["department", "status", "priority", "dateRange"],
  "busy-periods": ["department", "status", "priority", "dateRange"],
  "room-demand": ["department", "status", "priority", "dateRange"],
  "cancellation-summary": ["department", "priority", "dateRange"],
  "delivery-methods": ["department", "status", "priority", "dateRange"],
  "staff-workload": ["department", "assignee", "priority", "dateRange"],
  "stock-movements": ["department", "dateRange"],
  "inventory-health": ["department", "dateRange"],
  "activity-log": ["dateRange"],
  "request-timeline": ["department", "status", "priority", "assignee", "dateRange"],
  "sla-compliance": ["department", "priority", "dateRange", "limit"],
  "response-time-analysis": ["department", "shift", "dateRange"],
  "request-volume-forecast": ["department", "dateRange"],
  "staff-performance-scorecard": ["department", "assignee", "dateRange", "limit"],
  "workload-distribution": ["department", "dateRange"],
  "auto-assignment-effectiveness": ["department", "dateRange"],
  "stock-consumption-analysis": ["department", "dateRange"],
  "low-stock-stockout": ["department", "stockStatus"],
  "stock-movement-audit": ["department", "dateRange", "limit"],
  "request-lifecycle-activity": ["department", "status", "priority", "assignee", "dateRange"],
  "timeline-activity-log": ["department", "status", "priority", "assignee", "dateRange", "limit"],
  "service-only-room-requests": ["department", "status", "priority", "dateRange", "limit"],
  "stock-only-room-requests": ["department", "status", "priority", "dateRange", "limit"],
  "cancellation-analysis": ["department", "dateRange", "limit"],
  "pause-delay-analysis": ["department", "dateRange", "limit"],
  "dnd-incident-report": ["status", "dateRange", "limit"],
  "month-over-month-comparison": ["department"],
};

export type ReportFiltersState = {
  department: string;
  status: string;
  priority: string;
  assigneeId: string;
  action: string;
  dateFrom: string;
  dateTo: string;
  compareDateFrom: string;
  compareDateTo: string;
  limit: number;
  shift: string;
  stockStatus: string;
};

/** Default report window: last 30 calendar days through today (inclusive). */
export const DEFAULT_REPORT_RANGE_DAYS = 30;

export const DEFAULT_REPORT_FILTERS: ReportFiltersState = {
  department: "all",
  status: "all",
  priority: "all",
  assigneeId: "all",
  action: "all",
  dateFrom: isoDateDaysAgo(DEFAULT_REPORT_RANGE_DAYS - 1),
  dateTo: isoDateLocal(),
  compareDateFrom: "",
  compareDateTo: "",
  limit: 100,
  shift: "all",
  stockStatus: "all",
};

/** `0` in limit filter = fetch all rows (table uses client pagination). */
export const REPORT_LIMIT_ALL = 0;

export function reportDateRangeTooLong(dateFrom: string, dateTo: string): boolean {
  if (!dateFrom?.trim() || !dateTo?.trim()) return false;
  const days = periodDaysInclusive(dateFrom, dateTo);
  if (days <= 0) return false;
  return days > REPORT_MAX_RANGE_DAYS;
}

/** True when the active preset's date range(s) exceed one year. */
export function reportFiltersDateRangeInvalid(
  filters: ReportFiltersState,
  slug: string | null,
): boolean {
  if (!slug) return false;
  if (slug === "month-over-month-comparison") {
    return (
      reportDateRangeTooLong(filters.dateFrom, filters.dateTo) ||
      reportDateRangeTooLong(filters.compareDateFrom, filters.compareDateTo)
    );
  }
  const keys = PRESET_FILTER_KEYS[slug] ?? [];
  if (!keys.includes("dateRange")) return false;
  return reportDateRangeTooLong(filters.dateFrom, filters.dateTo);
}

export function defaultFiltersForPreset(slug: string | null): ReportFiltersState {
  const base = { ...DEFAULT_REPORT_FILTERS };
  if (slug === "month-over-month-comparison") {
    const { compareDateFrom, compareDateTo } = defaultCompareRangeBefore(
      base.dateFrom,
      base.dateTo,
    );
    return { ...base, compareDateFrom, compareDateTo };
  }
  if (
    slug === "timeline-activity-log" ||
    slug === "stock-movement-audit" ||
    slug === "service-only-room-requests" ||
    slug === "stock-only-room-requests" ||
    slug === "cancellation-analysis" ||
    slug === "pause-delay-analysis" ||
    slug === "sla-compliance" ||
    slug === "dnd-incident-report"
  ) {
    return { ...base, limit: REPORT_LIMIT_ALL };
  }
  return base;
}

export const REPORT_SHIFT_OPTIONS = [
  "all",
  "morning_early",
  "morning_late",
  "afternoon",
  "night",
] as const;

export const REPORT_STOCK_STATUS_OPTIONS = ["all", "low", "critical", "out"] as const;

export const REPORT_STATUS_OPTIONS = [
  "all",
  "pending",
  "assigned",
  "in_progress",
  "paused",
  "delivered",
  "cancelled",
  "dnd",
] as const;

export const REPORT_PRIORITY_OPTIONS = ["all", "normal", "rush"] as const;

export const REPORT_ACTION_OPTIONS = [
  "all",
  "auth.login",
  "auth.logout",
  "user.create",
  "user.update",
  "stock.adjust",
  "request.create",
  "request.update",
] as const;

export const REPORT_LIMIT_OPTIONS = [0, 50, 100, 200, 300, 500] as const;
