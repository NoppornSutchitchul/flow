/** Login username: English letters, digits, and . _ - only. */
export const USERNAME_MIN_LENGTH = 2;

const USERNAME_CHARS_RE = /^[A-Za-z0-9._-]+$/;

export type UsernameValidation = "ok" | "empty" | "too_short" | "invalid_chars";

export function filterUsernameInput(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]/g, "");
}

export function validateUsername(raw: string): UsernameValidation {
  const u = raw.trim();
  if (!u) return "empty";
  if (!USERNAME_CHARS_RE.test(u)) return "invalid_chars";
  if (u.length < USERNAME_MIN_LENGTH) return "too_short";
  return "ok";
}

export function usernameMeetsRules(raw: string): boolean {
  return validateUsername(raw) === "ok";
}
