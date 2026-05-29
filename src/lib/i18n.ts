import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import en from "../locales/en.json";
import th from "../locales/th.json";

import { normalizeLanguage } from "./language";

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      th: { translation: th },
    },
    fallbackLng: {
      en: ["th"],
      default: ["th"],
    },
    supportedLngs: ["th", "en"],
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "hotelops_lang",
    },
  });

i18n.on("initialized", () => {
  const code = normalizeLanguage(i18n.language);
  if (code !== i18n.language) {
    void i18n.changeLanguage(code);
  }
});

export default i18n;
