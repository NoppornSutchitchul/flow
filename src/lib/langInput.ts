export type ProductNameLocale = "th" | "en";

const PUNCT = new Set(" -_/.,()&+'\"");

function isDigit(cp: number) {
  return cp >= 0x30 && cp <= 0x39;
}

function isAllowedChar(locale: ProductNameLocale, ch: string): boolean {
  if (ch === " " || ch === "\t") return true;
  if (PUNCT.has(ch)) return locale === "en" || locale === "th";
  const cp = ch.codePointAt(0)!;

  switch (locale) {
    case "th":
      return (cp >= 0x0e00 && cp <= 0x0e7f) || isDigit(cp);
    case "en":
      if (cp >= 0x0e00 && cp <= 0x0e7f) return false;
      if (cp >= 0x1000 && cp <= 0x109f) return false;
      if (cp >= 0x0e80 && cp <= 0x0eff) return false;
      return (
        (cp >= 0x41 && cp <= 0x5a) ||
        (cp >= 0x61 && cp <= 0x7a) ||
        isDigit(cp)
      );
    default:
      return false;
  }
}

/** Strip characters that do not belong in a locale-specific product name field. */
export function filterProductNameInput(
  locale: ProductNameLocale,
  value: string,
): string {
  return [...value].filter((ch) => isAllowedChar(locale, ch)).join("");
}

export const THAI_RE = /[\u0E00-\u0E7F]/;
export const MYANMAR_RE = /[\u1000-\u109F]/;
export const LAO_RE = /[\u0E80-\u0EFF]/;

function labelCharsOk(locale: ProductNameLocale, value: string): boolean {
  return [...value].every((ch) => isAllowedChar(locale, ch));
}

export function productNameLangOk(
  locale: ProductNameLocale,
  value: string,
): boolean {
  const v = value.trim();
  if (!v) return false;
  switch (locale) {
    case "th":
      if (MYANMAR_RE.test(v) || LAO_RE.test(v)) return false;
      if (/[A-Za-z]/.test(v)) return false;
      return labelCharsOk("th", v);
    case "en":
      return (
        !THAI_RE.test(v) && !MYANMAR_RE.test(v) && !LAO_RE.test(v)
      );
    default:
      return false;
  }
}

export function productNamesValid(names: {
  th: string;
  en: string;
}): boolean {
  return (
    productNameLangOk("th", names.th) &&
    productNameLangOk("en", names.en)
  );
}

export function productNameFieldInvalid(
  locale: ProductNameLocale,
  value: string,
  showErrors: boolean,
): boolean {
  const v = value.trim();
  if (!v) return showErrors;
  return !productNameLangOk(locale, value);
}

export const filterJobTitleLabelInput = filterProductNameInput.bind(null, "en");
export const filterPersonNameInput = filterJobTitleLabelInput;

export function englishLabelHasBlockedChars(value: string): boolean {
  return [...value].some((ch) => !isAllowedChar("en", ch));
}

export function jobTitleLabelOk(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  if (englishLabelHasBlockedChars(value)) return false;
  if (!productNameLangOk("en", v)) return false;
  return /[A-Za-z]/.test(v);
}

export const personNameOk = jobTitleLabelOk;

export function jobTitleLabelFieldInvalid(value: string, showErrors: boolean): boolean {
  if (englishLabelHasBlockedChars(value)) return true;
  const v = value.trim();
  if (!v) return showErrors;
  return !jobTitleLabelOk(value);
}

export const personNameFieldInvalid = jobTitleLabelFieldInvalid;

type EnglishLabelErrorKey =
  | "users.job_titles_error_label_required"
  | "users.job_titles_error_label_en_lang"
  | "users.departments_error_name_required"
  | "users.departments_error_name_en_lang";

type PersonNameErrorKey =
  | "users.form_error_first_name_required"
  | "users.form_error_last_name_required"
  | "users.form_error_name_en_lang";

export function personNameAlertMessage(
  t: (key: PersonNameErrorKey) => string,
  value: string,
  showErrors: boolean,
  field: "first" | "last",
): string | null {
  const enLangMsg = t("users.form_error_name_en_lang");
  const requiredMsg =
    field === "first"
      ? t("users.form_error_first_name_required")
      : t("users.form_error_last_name_required");

  if (englishLabelHasBlockedChars(value)) return enLangMsg;

  const v = value.trim();
  if (!v) return showErrors ? requiredMsg : null;
  if (!personNameOk(value)) return enLangMsg;
  return null;
}

export function userEnglishNamesValid(first: string, last: string): boolean {
  return personNameOk(first) && personNameOk(last);
}

export function jobTitleLabelAlertMessage(
  t: (key: EnglishLabelErrorKey) => string,
  value: string,
  showErrors: boolean,
  variant: "job_title" | "department" = "job_title",
): string | null {
  const enLangMsg =
    variant === "department"
      ? t("users.departments_error_name_en_lang")
      : t("users.job_titles_error_label_en_lang");
  const requiredMsg =
    variant === "department"
      ? t("users.departments_error_name_required")
      : t("users.job_titles_error_label_required");

  if (englishLabelHasBlockedChars(value)) return enLangMsg;

  const v = value.trim();
  if (!v) return showErrors ? requiredMsg : null;
  if (!jobTitleLabelOk(value)) return enLangMsg;
  return null;
}

export type ProductLangFieldVariant = "name" | "unit";

type LangAlertKey =
  | "stock.categories.error_name_th_required"
  | "stock.categories.error_name_th_lang"
  | "stock.categories.error_name_en_required"
  | "stock.categories.error_name_en_lang"
  | "stock.error_unit_th_required"
  | "stock.error_unit_th_lang"
  | "stock.error_unit_en_required"
  | "stock.error_unit_en_lang";

const LANG_ALERT_KEYS: Record<
  ProductLangFieldVariant,
  Record<ProductNameLocale, { required: LangAlertKey; lang: LangAlertKey }>
> = {
  name: {
    th: {
      required: "stock.categories.error_name_th_required",
      lang: "stock.categories.error_name_th_lang",
    },
    en: {
      required: "stock.categories.error_name_en_required",
      lang: "stock.categories.error_name_en_lang",
    },
  },
  unit: {
    th: {
      required: "stock.error_unit_th_required",
      lang: "stock.error_unit_th_lang",
    },
    en: {
      required: "stock.error_unit_en_required",
      lang: "stock.error_unit_en_lang",
    },
  },
};

function langFieldAlertKey(
  variant: ProductLangFieldVariant,
  locale: ProductNameLocale,
  value: string,
): LangAlertKey | null {
  const v = value.trim();
  const keys = LANG_ALERT_KEYS[variant][locale];
  if (!v) return keys.required;
  if (locale === "th" && !THAI_RE.test(v)) return keys.lang;
  if (!productNameLangOk(locale, value)) return keys.lang;
  return null;
}

export function productLangFieldAlertMessage(
  t: (key: LangAlertKey) => string,
  locale: ProductNameLocale,
  value: string,
  showErrors: boolean,
  variant: ProductLangFieldVariant = "name",
): string | null {
  if (!showErrors) return null;
  const key = langFieldAlertKey(variant, locale, value);
  return key ? t(key) : null;
}

export function productLangAlertMessages(
  t: (key: LangAlertKey) => string,
  values: { th: string; en: string },
  showErrors: boolean,
  variant: ProductLangFieldVariant = "name",
): string[] {
  if (!showErrors) return [];
  const msgs: string[] = [];
  for (const locale of ["th", "en"] as const) {
    const msg = productLangFieldAlertMessage(
      t,
      locale,
      values[locale],
      true,
      variant,
    );
    if (msg) msgs.push(msg);
  }
  return msgs;
}

export function productNameAlertMessages(
  t: (key: LangAlertKey) => string,
  names: { th: string; en: string },
  showErrors: boolean,
): string[] {
  return productLangAlertMessages(t, names, showErrors, "name");
}
