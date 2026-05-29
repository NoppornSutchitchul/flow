import i18n from "./i18n";
import { normalizeLanguage } from "./language";

export type NamedProduct = {
  name: string;
  name_en?: string | null;
};

const TH_SUFFIXES = [" (ยืม)", " (เติม)"];
const EN_PAREN_SUFFIX_RE = /\s+\((?:loan(?:er)?|refill)\)\s*$/i;
const EN_TRAILING_WORD_SUFFIX_RE = /\s+(?:loan(?:er)?|refill)\s*$/i;
const EN_SKIP_TRAILING_RE = /\band\b|\/|,/i;

/** Strip legacy (ยืม)/(เติม) labels from display text. */
export function stripLegacyProductSuffix(name: string): string {
  let out = name.trim();
  if (!out) return out;
  for (const suffix of TH_SUFFIXES) {
    out = out.split(suffix).join("");
  }
  out = out.replace(EN_PAREN_SUFFIX_RE, "");
  if (!EN_SKIP_TRAILING_RE.test(out)) {
    out = out.replace(EN_TRAILING_WORD_SUFFIX_RE, "");
  }
  return out.trim() || name.trim();
}

/** Pick the catalog label for the active UI language (Thai or English only). */
export function productDisplayName(
  item: NamedProduct,
  lang?: string,
): string {
  const code = normalizeLanguage(lang ?? i18n.language ?? "th");
  const raw =
    code === "en"
      ? (item.name_en?.trim() || item.name)
      : item.name;
  return stripLegacyProductSuffix(raw);
}
