import type { TFunction } from "i18next";

import { ApiError, NetworkError } from "./api";

/** Map login API errors to localized messages. */
export function loginErrorMessage(err: unknown, t: TFunction): string {
  if (err instanceof NetworkError) {
    return t("auth.login_error_server_unreachable");
  }
  if (err instanceof ApiError) {
    return t("auth.login_error_invalid");
  }
  const msg = err instanceof Error ? err.message : "";
  if (
    msg === "Failed to fetch" ||
    msg === "NetworkError when attempting to fetch resource."
  ) {
    return t("auth.login_error_server_unreachable");
  }
  return msg || t("auth.login_error_invalid");
}

/** Map change-password API errors to localized messages. */
export function changePasswordErrorMessage(err: unknown, t: TFunction): string {
  if (err instanceof ApiError) {
    switch (err.message) {
      case "wrong_current_password":
        return t("auth.change_password_wrong_current");
      case "password_too_short":
        return t("auth.password_min_length");
      case "password_invalid_chars":
        return t("auth.password_invalid_chars");
      default:
        break;
    }
  }
  const msg = err instanceof Error ? err.message : "";
  const legacy: Record<string, string> = {
    "current password is incorrect": t("auth.change_password_wrong_current"),
    "new password must be at least 4 characters": t("auth.password_min_length"),
    "password invalid characters": t("auth.password_invalid_chars"),
  };
  if (msg && legacy[msg]) return legacy[msg];
  return msg || t("auth.change_password_failed");
}
