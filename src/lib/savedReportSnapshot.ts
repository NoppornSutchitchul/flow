import type { ReportFiltersState } from "./reportPresetFilters";
import type { ReportPresetData, ReportPresetMeta } from "./types";

/** Frozen preset report saved to «รายงานของฉัน» (layout_json version 2). */
export interface SavedReportSnapshotLayout {
  version: 2;
  kind: "snapshot";
  preset_slug: string;
  preset_code: string;
  filters: ReportFiltersState;
  snapshot: ReportPresetData;
  snapshot_at: string;
}

export function isSavedReportSnapshotLayout(
  raw: string | null | undefined,
): boolean {
  try {
    const parsed = JSON.parse(raw || "{}") as { version?: number; kind?: string };
    return parsed.version === 2 && parsed.kind === "snapshot";
  } catch {
    return false;
  }
}

export function parseSavedReportSnapshotLayout(
  raw: string | null | undefined,
): SavedReportSnapshotLayout | null {
  try {
    const parsed = JSON.parse(raw || "{}") as Partial<SavedReportSnapshotLayout>;
    if (parsed.version !== 2 || parsed.kind !== "snapshot") return null;
    if (typeof parsed.preset_slug !== "string" || !parsed.snapshot?.data) return null;
    return {
      version: 2,
      kind: "snapshot",
      preset_slug: parsed.preset_slug,
      preset_code: typeof parsed.preset_code === "string" ? parsed.preset_code : "",
      filters: (parsed.filters ?? {}) as ReportFiltersState,
      snapshot: parsed.snapshot as ReportPresetData,
      snapshot_at:
        typeof parsed.snapshot_at === "string"
          ? parsed.snapshot_at
          : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function serializeSavedReportSnapshotLayout(
  layout: SavedReportSnapshotLayout,
): string {
  return JSON.stringify(layout);
}

/** dd/mm or dd/mm/yy (2-digit year; พ.ศ. when lang is Thai) for list subtitles. */
export function formatIsoDateShort(iso: string, lang: string, withYear = false): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const y = Number(m[1]);
  const month = m[2];
  const day = m[3];
  const base = `${day}/${month}`;
  if (!withYear) return base;
  const isTh = lang.startsWith("th");
  const yr = isTh ? (y + 543) % 100 : y % 100;
  return `${base}/${String(yr).padStart(2, "0")}`;
}

/** dd/mm/yyyy (พ.ศ. when lang is Thai) from YYYY-MM-DD filter value. */
export function formatIsoDateForSnapshotTitle(iso: string, lang: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const y = Number(m[1]);
  const month = m[2];
  const day = m[3];
  const isTh = lang.startsWith("th");
  const year = isTh ? y + 543 : y;
  return `${day}/${month}/${year}`;
}

export function defaultSnapshotReportTitle(
  preset: Pick<ReportPresetMeta, "code">,
  filters: Pick<ReportFiltersState, "dateFrom" | "dateTo">,
  lang: string,
): string {
  const code = preset.code?.trim() || "";
  const from = formatIsoDateForSnapshotTitle(filters.dateFrom, lang);
  const to = formatIsoDateForSnapshotTitle(filters.dateTo, lang);
  const range = `${from}-${to}`;
  return code ? `${code} ${range}` : range;
}

export function buildSnapshotLayout(args: {
  preset: ReportPresetMeta;
  filters: ReportFiltersState;
  snapshot: ReportPresetData;
}): SavedReportSnapshotLayout {
  return {
    version: 2,
    kind: "snapshot",
    preset_slug: args.preset.slug,
    preset_code: args.preset.code?.trim() ?? "",
    filters: { ...args.filters },
    snapshot: args.snapshot,
    snapshot_at: new Date().toISOString(),
  };
}

/** Short label for list rows: preset code, else localized title, else slug. */
export function snapshotPresetShortLabel(
  layout: SavedReportSnapshotLayout,
  presets: ReportPresetMeta[],
  translate: (key: string) => string,
): string {
  const code = layout.preset_code?.trim();
  if (code) return code;
  const meta = presets.find((p) => p.slug === layout.preset_slug);
  if (meta) return translate(meta.title_key);
  return layout.preset_slug;
}

/** e.g. OP01 · 24/04–23/05/69 */
export function snapshotListSubtitle(
  layoutJson: string,
  lang: string,
  presets: ReportPresetMeta[],
  translate: (key: string) => string,
): string | null {
  const layout = parseSavedReportSnapshotLayout(layoutJson);
  if (!layout) return null;
  const label = snapshotPresetShortLabel(layout, presets, translate);
  const from = formatIsoDateShort(layout.filters.dateFrom, lang, false);
  const to = formatIsoDateShort(layout.filters.dateTo, lang, true);
  return `${label} · ${from}–${to}`;
}
