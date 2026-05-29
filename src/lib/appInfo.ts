import { normalizeLanguage, SUPPORTED_LANGS, type AppLang } from "./language";

export { normalizeLanguage };

/** Display version (keep in sync with release notes). */
export const APP_VERSION = "0.1.0";

export const LANGUAGE_NATIVE_LABELS: Record<AppLang, string> = {
  th: "ไทย",
  en: "English",
};

export function supportedLanguagesLabel(): string {
  return SUPPORTED_LANGS.map((code) => LANGUAGE_NATIVE_LABELS[code]).join(" · ");
}
