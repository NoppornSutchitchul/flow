/** Minimum length for new passwords (matches backend). */
export const PASSWORD_MIN_LENGTH = 4;

/** Printable ASCII except space: A–Z, a–z, 0–9, and special characters. */
const PASSWORD_CHARS_RE = /^[\x21-\x7E]+$/;

export type PasswordValidation = "ok" | "too_short" | "invalid_chars";

/** True when the value contains characters outside A–Z, a–z, 0–9, or ASCII special. */
export function passwordContainsInvalidChars(raw: string): boolean {
  if (!raw) return false;
  return /[^\x21-\x7E]/.test(raw);
}

export function validateNewPassword(raw: string): PasswordValidation {
  const pw = raw.trim();
  if (!pw.length) return "too_short";
  if (passwordContainsInvalidChars(pw)) return "invalid_chars";
  if (pw.length < PASSWORD_MIN_LENGTH) return "too_short";
  if (!PASSWORD_CHARS_RE.test(pw)) return "invalid_chars";
  return "ok";
}

export function newPasswordMeetsRules(raw: string): boolean {
  if (!raw.trim()) return false;
  return validateNewPassword(raw) === "ok";
}
