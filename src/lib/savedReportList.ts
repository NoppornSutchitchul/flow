import { calendarMonthTitle } from "./locale";
import {
  parseSavedReportSnapshotLayout,
  snapshotListSubtitle,
  snapshotPresetShortLabel,
} from "./savedReportSnapshot";
import type { CustomReportRead, ReportPresetMeta } from "./types";

export type SavedReportSort = "newest" | "oldest" | "title" | "code";

export type SavedReportMineFilter = "all" | "shared_everyone" | "private";

export type SavedReportSharedFilter = "all" | "by_me" | "public" | "direct";

export function isReportSharedOut(row: CustomReportRead): boolean {
  return Boolean(row.shared_with_all) || (row.individual_share_count ?? 0) > 0;
}

/** รายงานที่คนอื่นแชร์ให้ + รายงานของเราที่แชร์ออกไปแล้ว */
export function buildSharedTabReports(
  myReports: CustomReportRead[],
  fromOthers: CustomReportRead[],
): CustomReportRead[] {
  const mineOut = myReports.filter(isReportSharedOut);
  const seen = new Set<number>();
  const out: CustomReportRead[] = [];
  for (const r of [...mineOut, ...fromOthers]) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    out.push(r);
  }
  return out;
}

export function savedReportSavedAt(row: CustomReportRead): string {
  const layout = parseSavedReportSnapshotLayout(row.layout_json);
  return layout?.snapshot_at ?? row.updated_at ?? row.created_at;
}

export function savedReportPresetCode(
  row: CustomReportRead,
  presets: ReportPresetMeta[],
  translate: (key: string) => string,
): string {
  const layout = parseSavedReportSnapshotLayout(row.layout_json);
  if (!layout) return "";
  return snapshotPresetShortLabel(layout, presets, translate);
}

export function savedReportSearchHaystack(
  row: CustomReportRead,
  presets: ReportPresetMeta[],
  translate: (key: string) => string,
  lang: string,
): string {
  const layout = parseSavedReportSnapshotLayout(row.layout_json);
  const parts = [
    row.title,
    row.owner_name,
    savedReportPresetCode(row, presets, translate),
    layout?.preset_slug,
    layout?.preset_code,
    layout?.filters.dateFrom,
    layout?.filters.dateTo,
    snapshotListSubtitle(row.layout_json, lang, presets, translate),
    row.updated_at,
    row.created_at,
    savedReportSavedAt(row),
  ];
  return parts.filter(Boolean).join(" ").toLowerCase();
}

export function filterMineReports(
  rows: CustomReportRead[],
  filter: SavedReportMineFilter,
): CustomReportRead[] {
  if (filter === "all") return rows;
  if (filter === "shared_everyone") return rows.filter((r) => r.shared_with_all);
  return rows.filter((r) => !r.shared_with_all);
}

export function filterSharedReports(
  rows: CustomReportRead[],
  filter: SavedReportSharedFilter,
  currentUserId?: number,
): CustomReportRead[] {
  if (filter === "all") return rows;
  if (filter === "public") return rows.filter((r) => r.shared_with_all);
  if (filter === "by_me" && currentUserId != null) {
    return rows.filter((r) => r.owner_user_id === currentUserId && isReportSharedOut(r));
  }
  if (filter === "direct" && currentUserId != null) {
    return rows.filter(
      (r) => r.owner_user_id !== currentUserId && !r.shared_with_all,
    );
  }
  return rows.filter((r) => !r.shared_with_all);
}

export function sortSavedReports(
  rows: CustomReportRead[],
  sort: SavedReportSort,
  presets: ReportPresetMeta[],
  translate: (key: string) => string,
): CustomReportRead[] {
  const list = [...rows];
  const byTime = (a: CustomReportRead, b: CustomReportRead) =>
    new Date(savedReportSavedAt(b)).getTime() - new Date(savedReportSavedAt(a)).getTime();
  if (sort === "newest") return list.sort(byTime);
  if (sort === "oldest") return list.sort((a, b) => -byTime(a, b));
  if (sort === "title") {
    return list.sort((a, b) =>
      a.title.localeCompare(b.title, undefined, { sensitivity: "base" }),
    );
  }
  return list.sort((a, b) => {
    const ca = savedReportPresetCode(a, presets, translate);
    const cb = savedReportPresetCode(b, presets, translate);
    const cmp = ca.localeCompare(cb, undefined, { sensitivity: "base" });
    return cmp !== 0 ? cmp : byTime(a, b);
  });
}

export function savedReportMonthKey(iso: string): string {
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return "unknown";
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function formatSavedReportMonthLabel(monthKey: string, lang: string): string {
  if (monthKey === "unknown") return "—";
  const [y, m] = monthKey.split("-").map(Number);
  return calendarMonthTitle(y, m - 1, lang);
}

export function groupSavedReportsByMonth(
  rows: CustomReportRead[],
): { key: string; items: CustomReportRead[] }[] {
  const map = new Map<string, CustomReportRead[]>();
  for (const row of rows) {
    const key = savedReportMonthKey(savedReportSavedAt(row));
    const bucket = map.get(key);
    if (bucket) bucket.push(row);
    else map.set(key, [row]);
  }
  return [...map.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, items]) => ({ key, items }));
}

export function processSavedReportList(args: {
  rows: CustomReportRead[];
  search: string;
  sort: SavedReportSort;
  presets: ReportPresetMeta[];
  translate: (key: string) => string;
  lang: string;
  mineFilter?: SavedReportMineFilter;
  sharedFilter?: SavedReportSharedFilter;
  currentUserId?: number;
}): CustomReportRead[] {
  let list = args.rows;
  if (args.mineFilter) list = filterMineReports(list, args.mineFilter);
  if (args.sharedFilter) {
    list = filterSharedReports(list, args.sharedFilter, args.currentUserId);
  }
  const q = args.search.trim().toLowerCase();
  if (q) {
    list = list.filter((r) =>
      savedReportSearchHaystack(r, args.presets, args.translate, args.lang).includes(q),
    );
  }
  return sortSavedReports(list, args.sort, args.presets, args.translate);
}
