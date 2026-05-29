import type { User } from "./types";

/** One row per display name (keeps lowest id) — avoids duplicate seed users in pickers. */
export function dedupeUsersByDisplayName(users: Iterable<User>): User[] {
  const byName = new Map<string, User>();
  for (const u of users) {
    const key = u.name.trim().toLowerCase();
    if (!key) continue;
    const prev = byName.get(key);
    if (!prev || u.id < prev.id) {
      byName.set(key, u);
    }
  }
  return [...byName.values()];
}
