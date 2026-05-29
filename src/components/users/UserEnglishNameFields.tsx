import { useTranslation } from "react-i18next";
import clsx from "clsx";

import {
  englishLabelHasBlockedChars,
  personNameAlertMessage,
  personNameFieldInvalid,
} from "../../lib/langInput";

const fieldClass =
  "rounded-xl border bg-white px-3 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--color-ink)]/15";

interface Props {
  firstName: string;
  lastName: string;
  showErrors: boolean;
  onFirstNameChange: (value: string) => void;
  onLastNameChange: (value: string) => void;
}

export function UserEnglishNameFields({
  firstName,
  lastName,
  showErrors,
  onFirstNameChange,
  onLastNameChange,
}: Props) {
  const { t } = useTranslation();

  const firstLangError = englishLabelHasBlockedChars(firstName);
  const lastLangError = englishLabelHasBlockedChars(lastName);
  const firstInvalid =
    firstLangError || personNameFieldInvalid(firstName, showErrors);
  const lastInvalid =
    lastLangError || personNameFieldInvalid(lastName, showErrors);
  const firstAlert = firstLangError
    ? t("users.form_error_name_en_lang")
    : personNameAlertMessage(t, firstName, showErrors, "first");
  const lastAlert = lastLangError
    ? t("users.form_error_name_en_lang")
    : personNameAlertMessage(t, lastName, showErrors, "last");

  const inputClass = (invalid: boolean) =>
    clsx(
      fieldClass,
      invalid
        ? "border-red-400 focus:ring-red-400/25"
        : "border-[color:var(--color-line)]",
    );

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <label className="flex min-w-0 flex-col gap-2">
        <span className="text-xs font-semibold text-[color:var(--color-ink-soft)]">
          {t("users.form_first_name")}
        </span>
        <input
          value={firstName}
          onChange={(e) => onFirstNameChange(e.target.value)}
          autoComplete="given-name"
          lang="en"
          className={inputClass(firstInvalid)}
          aria-invalid={firstInvalid}
          aria-describedby={firstAlert ? "user-first-name-error" : undefined}
        />
        {firstAlert ? (
          <p
            id="user-first-name-error"
            role="alert"
            className="text-xs text-red-600"
          >
            {firstAlert}
          </p>
        ) : null}
      </label>
      <label className="flex min-w-0 flex-col gap-2">
        <span className="text-xs font-semibold text-[color:var(--color-ink-soft)]">
          {t("users.form_last_name")}
        </span>
        <input
          value={lastName}
          onChange={(e) => onLastNameChange(e.target.value)}
          autoComplete="family-name"
          lang="en"
          className={inputClass(lastInvalid)}
          aria-invalid={lastInvalid}
          aria-describedby={lastAlert ? "user-last-name-error" : undefined}
        />
        {lastAlert ? (
          <p
            id="user-last-name-error"
            role="alert"
            className="text-xs text-red-600"
          >
            {lastAlert}
          </p>
        ) : null}
      </label>
    </div>
  );
}
