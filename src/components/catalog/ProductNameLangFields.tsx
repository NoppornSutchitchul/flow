import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import clsx from "clsx";

import {
  productLangFieldAlertMessage,
  productNameFieldInvalid,
  type ProductLangFieldVariant,
  type ProductNameLocale,
} from "../../lib/langInput";

interface Props {
  variant?: ProductLangFieldVariant;
  name: string;
  nameEn: string;
  onNameChange: (value: string) => void;
  onNameEnChange: (value: string) => void;
  fieldLabel: string;
  inputClass: string;
  iconSlot?: ReactNode;
  thAutoFocus?: boolean;
  thRequired?: boolean;
  showErrors?: boolean;
  extraInvalid?: Partial<Record<ProductNameLocale, boolean>>;
  extraHint?: Partial<Record<ProductNameLocale, string>>;
  footerSlot?: ReactNode;
}

function LangInput({
  locale,
  label,
  value,
  onChange,
  fieldLabel,
  inputClass,
  placeholder,
  required,
  autoFocus,
  showErrors,
  extraInvalid,
  hint,
}: {
  locale: ProductNameLocale;
  label: string;
  value: string;
  onChange: (value: string) => void;
  fieldLabel: string;
  inputClass: string;
  placeholder: string;
  required?: boolean;
  autoFocus?: boolean;
  showErrors: boolean;
  extraInvalid?: boolean;
  hint?: string | null;
}) {
  const invalid =
    extraInvalid || productNameFieldInvalid(locale, value, showErrors);
  const hintId = hint ? `lang-hint-${locale}` : undefined;

  return (
    <label className="block min-w-0">
      <span className={clsx(fieldLabel, "inline-flex min-w-0 flex-wrap items-baseline gap-x-1")}>
        <LangLabelWithHint label={label} hint={hint} hintId={hintId} />
      </span>
      <div
        className={clsx(
          inputClass,
          invalid &&
            "!border-red-400 focus-within:!border-red-400 focus-within:!ring-red-200/70",
        )}
      >
        <input
          lang={locale}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-full w-full min-w-0 bg-transparent focus:outline-none"
          required={required}
          autoFocus={autoFocus}
          aria-invalid={invalid}
          aria-describedby={hintId}
          autoComplete="off"
          spellCheck={locale === "en"}
          aria-label={label}
        />
        {required && (
          <span
            aria-hidden
            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-base leading-none text-red-500/70"
          >
            *
          </span>
        )}
      </div>
    </label>
  );
}

function LangLabelWithHint({
  label,
  hint,
  hintId,
}: {
  label: string;
  hint?: string | null;
  hintId?: string;
}) {
  if (!hint) return <>{label}</>;
  const m = label.match(/^(.+?\([^)]+)\)(.*)$/);
  const hintEl = (
    <span id={hintId} className="text-[10px] font-medium normal-case text-red-600">
      {hint}
    </span>
  );
  if (!m) {
    return (
      <>
        {label} {hintEl}
      </>
    );
  }
  return (
    <>
      {m[1]}
      {hintEl}
      {m[2]}
    </>
  );
}

const LABEL_KEYS = {
  name: {
    th: "stock.name_lang_th",
    en: "stock.name_lang_en",
    thPh: "stock.name_lang_th_ph",
    enPh: "stock.name_lang_en_ph",
  },
  unit: {
    th: "stock.unit_lang_th",
    en: "stock.unit_lang_en",
    thPh: "stock.unit_lang_th_ph",
    enPh: "stock.unit_lang_en_ph",
  },
} as const;

export function ProductNameLangFields({
  variant = "name",
  name,
  nameEn,
  onNameChange,
  onNameEnChange,
  fieldLabel,
  inputClass,
  iconSlot,
  thAutoFocus,
  thRequired = true,
  showErrors = false,
  extraInvalid,
  extraHint,
  footerSlot,
}: Props) {
  const { t } = useTranslation();

  const labelKeys = LABEL_KEYS[variant];

  const values = { th: name, en: nameEn };

  const hintFor = (locale: ProductNameLocale) =>
    extraHint?.[locale] ??
    productLangFieldAlertMessage(t, locale, values[locale], showErrors, variant);

  const wrapInputClass = inputClass;

  return (
    <div className="space-y-4">
      {iconSlot ? (
        <div className="flex flex-col items-center gap-1.5">{iconSlot}</div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <LangInput
          locale="th"
          label={t(labelKeys.th)}
          value={name}
          onChange={onNameChange}
          fieldLabel={fieldLabel}
          inputClass={wrapInputClass}
          placeholder={t(labelKeys.thPh)}
          required={thRequired}
          autoFocus={thAutoFocus}
          showErrors={showErrors}
          extraInvalid={extraInvalid?.th}
          hint={hintFor("th")}
        />
        <LangInput
          locale="en"
          label={t(labelKeys.en)}
          value={nameEn}
          onChange={onNameEnChange}
          fieldLabel={fieldLabel}
          inputClass={wrapInputClass}
          placeholder={t(labelKeys.enPh)}
          required
          showErrors={showErrors}
          extraInvalid={extraInvalid?.en}
          hint={hintFor("en")}
        />
      </div>

      {footerSlot ? (
        <div className="flex flex-wrap items-end justify-end gap-3 border-t border-[color:var(--color-line)]/50 pt-3">
          <div className="flex shrink-0 gap-2">{footerSlot}</div>
        </div>
      ) : null}
    </div>
  );
}
