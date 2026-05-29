import {
  DEFAULT_REPORT_FILTERS,
  REPORT_LIMIT_ALL,
  defaultFiltersForPreset,
  type ReportFiltersState,
} from "./reportPresetFilters";

export type ReportsHubTab = "presets" | "mine" | "shared";

export type ReportsHubSnapshot = {
  tab: ReportsHubTab;
  preset: string | null;
  filters: ReportFiltersState;
  page: number;
};

const FILTER_KEYS: (keyof ReportFiltersState)[] = [
  "department",
  "status",
  "priority",
  "assigneeId",
  "action",
  "dateFrom",
  "dateTo",
  "compareDateFrom",
  "compareDateTo",
  "limit",
  "shift",
  "stockStatus",
];

function filtersFromParams(
  params: URLSearchParams,
  preset: string | null,
): ReportFiltersState {
  const f = defaultFiltersForPreset(preset);
  const map: Partial<Record<keyof ReportFiltersState, string>> = {
    department: "dept",
    status: "status",
    priority: "priority",
    assigneeId: "assignee",
    action: "action",
    dateFrom: "from",
    dateTo: "to",
    compareDateFrom: "cmp_from",
    compareDateTo: "cmp_to",
    limit: "limit",
    shift: "shift",
    stockStatus: "stock",
  };
  for (const key of FILTER_KEYS) {
    const param = map[key];
    if (!param) continue;
    const raw = params.get(param);
    if (raw == null || raw === "") continue;
    if (key === "limit") {
      const n = Number(raw);
      if (Number.isFinite(n) && n >= 0) f.limit = n;
    } else {
      (f as Record<string, string | number>)[key] = raw;
    }
  }
  return f;
}

/** Restore hub state from `/reports?…` (used on mount and when returning from request detail). */
export function readReportsHubSnapshot(
  params: URLSearchParams,
): ReportsHubSnapshot | null {
  const preset = params.get("preset");
  const tab = (params.get("tab") as ReportsHubTab | null) ?? "presets";
  if (!preset && tab === "presets" && !params.get("from")) {
    return null;
  }
  const page = Math.max(1, Number(params.get("page")) || 1);
  return {
    tab: tab === "mine" || tab === "shared" ? tab : "presets",
    preset,
    filters: filtersFromParams(params, preset),
    page,
  };
}

export function writeReportsHubSearchParams(
  snapshot: ReportsHubSnapshot,
): URLSearchParams {
  const p = new URLSearchParams();
  p.set("tab", snapshot.tab);
  if (snapshot.preset) p.set("preset", snapshot.preset);
  p.set("from", snapshot.filters.dateFrom);
  p.set("to", snapshot.filters.dateTo);
  if (snapshot.filters.compareDateFrom) {
    p.set("cmp_from", snapshot.filters.compareDateFrom);
  }
  if (snapshot.filters.compareDateTo) {
    p.set("cmp_to", snapshot.filters.compareDateTo);
  }
  if (snapshot.filters.department !== "all") p.set("dept", snapshot.filters.department);
  if (snapshot.filters.status !== "all") p.set("status", snapshot.filters.status);
  if (snapshot.filters.priority !== "all") p.set("priority", snapshot.filters.priority);
  if (snapshot.filters.assigneeId !== "all") p.set("assignee", snapshot.filters.assigneeId);
  if (snapshot.filters.action !== "all") p.set("action", snapshot.filters.action);
  if (snapshot.filters.shift !== "all") p.set("shift", snapshot.filters.shift);
  if (snapshot.filters.stockStatus !== "all") p.set("stock", snapshot.filters.stockStatus);
  if (
    snapshot.filters.limit !== DEFAULT_REPORT_FILTERS.limit ||
    snapshot.filters.limit === REPORT_LIMIT_ALL
  ) {
    p.set("limit", String(snapshot.filters.limit));
  }
  if (snapshot.page > 1) p.set("page", String(snapshot.page));
  return p;
}

export function reportsHubReturnPath(snapshot: ReportsHubSnapshot): string {
  const q = writeReportsHubSearchParams(snapshot).toString();
  return q ? `/reports?${q}` : "/reports";
}
