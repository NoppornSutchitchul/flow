import type { ReportPresetMeta } from "./types";

/** Display label: code + localized title (e.g. OP01 · รายงานการส่งมอบตรงกำหนด). */
export function reportPresetDisplayLabel(
  preset: Pick<ReportPresetMeta, "code" | "title_key">,
  translate: (key: string) => string,
): string {
  const title = translate(preset.title_key);
  if (preset.code?.trim()) {
    return `${preset.code.trim()} · ${title}`;
  }
  return title;
}

/** Lowercase string for combobox search (code + title + category label). */
export function reportPresetSearchHaystack(
  preset: ReportPresetMeta,
  translate: (key: string) => string,
  categoryLabel?: string,
): string {
  return [preset.code, translate(preset.title_key), categoryLabel]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}
