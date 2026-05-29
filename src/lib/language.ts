export const SUPPORTED_LANGS = ["th", "en"] as const;
export type AppLang = (typeof SUPPORTED_LANGS)[number];

/** i18n may return regional tags (e.g. en-US). Maps legacy my/lo to Thai. */
export function normalizeLanguage(lng: string): AppLang {
  const base = (lng || "th").split("-")[0]?.toLowerCase() ?? "th";
  if (base === "en") return "en";
  if (base === "th") return "th";
  return "th";
}
