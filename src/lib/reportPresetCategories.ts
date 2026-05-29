import type { ReportPresetMeta } from "./types";

export const REPORT_CATEGORY_ORDER = [
  "executive",
  "operations",
  "staff",
  "inventory",
  "audit",
] as const;

export type ReportCategory = (typeof REPORT_CATEGORY_ORDER)[number];

export function groupPresetsByCategory(presets: ReportPresetMeta[]) {
  const map = new Map<string, ReportPresetMeta[]>();
  for (const p of presets) {
    const list = map.get(p.category) ?? [];
    list.push(p);
    map.set(p.category, list);
  }
  return REPORT_CATEGORY_ORDER.filter((c) => map.has(c)).map((category) => ({
    category,
    items: map.get(category)!,
  }));
}
