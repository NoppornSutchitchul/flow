import type { TFunction } from "i18next";

import { ApiError } from "./api";

export function createUserErrorMessage(err: unknown, t: TFunction): string {
  const msg = err instanceof Error ? err.message : "";
  const map: Record<string, string> = {
    username_taken: t("users.form_error_username_taken"),
    "username invalid characters": t("users.form_error_username_invalid"),
    "username too short": t("users.form_error_username_short"),
    "password invalid characters": t("auth.password_invalid_chars"),
    "password must be at least 4 characters": t("auth.password_min_length"),
  };
  if (msg && map[msg]) return map[msg];

  if (err instanceof ApiError) {
    switch (err.message) {
      case "username_taken":
        return t("users.form_error_username_taken");
      default:
        break;
    }
  }
  return msg || t("users.form_error_create_failed");
}

export function resetPasswordErrorMessage(err: unknown, t: TFunction): string {
  return createUserErrorMessage(err, t);
}

export function passwordValidationMessage(
  code: import("./passwordRules").PasswordValidation,
  t: TFunction,
): string {
  switch (code) {
    case "invalid_chars":
      return t("auth.password_invalid_chars");
    default:
      return t("auth.password_min_length");
  }
}

export function usernameValidationMessage(
  code: import("./usernameRules").UsernameValidation,
  t: TFunction,
): string {
  switch (code) {
    case "invalid_chars":
      return t("users.form_error_username_invalid");
    case "too_short":
      return t("users.form_error_username_short");
    default:
      return t("users.form_error_username_required");
  }
}
