import i18n from "./i18n";
import { normalizeLanguage } from "./language";
import { TH_UNIT_TO_EN } from "./productUnitMaps";

type UnitProduct = {
  unit: string | null;
  unit_en?: string | null;
};

const THAI_RE = /[\u0E00-\u0E7F]/;

/** Pick the unit label for the active UI language (Thai or English). */
export function productDisplayUnit(
  item: UnitProduct,
  lang?: string,
): string {
  const code = normalizeLanguage(lang ?? i18n.language ?? "th");
  const th = (item.unit ?? "").trim();
  if (code === "en") {
    const en = (item.unit_en ?? "").trim();
    if (en) return en;
    if (th && THAI_RE.test(th)) return TH_UNIT_TO_EN[th] ?? th;
    return th;
  }
  return th;
}
