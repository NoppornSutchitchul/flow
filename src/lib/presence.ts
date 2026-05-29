export type PresenceStatus = "online" | "idle" | "away" | "offline";

export function resolvePresenceStatus(
  isLoggedIn: boolean,
  documentVisible: boolean,
  windowFocused: boolean,
): PresenceStatus {
  if (!isLoggedIn) return "offline";
  if (!documentVisible) return "away";
  if (!windowFocused) return "idle";
  return "online";
}
