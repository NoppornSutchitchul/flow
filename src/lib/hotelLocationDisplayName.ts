import i18n from "./i18n";
import { normalizeLanguage } from "./language";
import type { HotelLocation } from "./types";
import { productNameLangOk, type ProductNameLocale } from "./langInput";

function locationKey(code: string, field: "label" | "hint"): string {
  return `hotelLocations.${code.replace(/-/g, "_")}.${field}`;
}

type LocFields = Pick<HotelLocation, "code" | "label" | "label_en">;

export type HotelLocationLabels = {
  th: string;
  en: string;
};

function i18nLabel(code: string, lng: ProductNameLocale): string {
  const key = locationKey(code, "label");
  const chain: ProductNameLocale[] = lng === "en" ? ["en"] : ["th", "en"];
  for (const loc of chain) {
    if (i18n.exists(key, { lng: loc })) return i18n.t(key, { lng: loc });
  }
  return "";
}

function dbLabelOrI18n(
  db: string | null | undefined,
  locale: ProductNameLocale,
  code: string,
): string {
  const v = (db ?? "").trim();
  if (v && productNameLangOk(locale, v)) return v;
  return i18nLabel(code, locale);
}

export function hotelLocationLabels(loc: LocFields): HotelLocationLabels {
  return {
    th: loc.label,
    en: dbLabelOrI18n(loc.label_en, "en", loc.code),
  };
}

function normForDup(locale: ProductNameLocale, value: string): string {
  const v = value.trim();
  return locale === "en" ? v.toLowerCase() : v;
}

export function hotelLocationLabelDuplicate(
  locale: ProductNameLocale,
  value: string,
  rows: HotelLocation[],
  excludeId?: number,
): boolean {
  const needle = normForDup(locale, value);
  if (!needle) return false;
  return rows.some((row) => {
    if (excludeId != null && row.id === excludeId) return false;
    const labels = hotelLocationLabels(row);
    return normForDup(locale, labels[locale]) === needle;
  });
}

export function hotelLocationDisplayLabel(
  loc: Pick<HotelLocation, "code" | "label" | "label_en">,
  lang?: string,
): string {
  const ui = normalizeLanguage(lang ?? i18n.language ?? "th");
  const labels = hotelLocationLabels(loc);
  if (ui === "en") return labels.en || labels.th;
  return labels.th;
}

export function hotelLocationDisplayHint(
  loc: LocFields,
  lang?: string,
  fallback = "",
): string {
  const ui = normalizeLanguage(lang ?? i18n.language ?? "th");
  const key = locationKey(loc.code, "hint");
  const chain: ProductNameLocale[] = ui === "en" ? ["en"] : ["th", "en"];
  for (const lng of chain) {
    if (i18n.exists(key, { lng })) return i18n.t(key, { lng });
  }
  return fallback;
}

export function hotelLocationSearchText(loc: LocFields, lang?: string): string {
  const labels = hotelLocationLabels(loc);
  const ui = normalizeLanguage(lang ?? i18n.language ?? "th");
  const parts = [
    loc.code,
    labels.th,
    labels.en,
    hotelLocationDisplayLabel(loc, ui),
    hotelLocationDisplayHint(loc, ui),
  ];
  return parts.join(" ").toLowerCase();
}
