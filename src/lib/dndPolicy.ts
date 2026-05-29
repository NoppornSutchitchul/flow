import type { Role, User } from "./types";

function canWorkAsFieldOnRequest(
  user: User,
  assigneeId: number | null | undefined,
): boolean {
  if (assigneeId == null || assigneeId !== user.id) return false;
  if (user.role === "housekeeper" || user.role === "maintenance") return true;
  return (
    user.department === "housekeeping" &&
    (user.role === "hk_supervisor" || user.role === "manager")
  );
}

/** Roles that may clear / defer DND after front desk has contacted the guest. */
const RESOLVE_DND_ROLES: ReadonlySet<Role> = new Set(["frontdesk", "admin", "manager"]);

export function canReportDndAtDoor(
  user: User | null | undefined,
  assigneeId: number | null | undefined,
): boolean {
  if (!user) return false;
  return canWorkAsFieldOnRequest(user, assigneeId);
}

/** Assigned field staff may deliver when they meet the guest during DND wait. */
export function canDeliverFromDnd(
  user: User | null | undefined,
  assigneeId: number | null | undefined,
): boolean {
  return canReportDndAtDoor(user, assigneeId);
}

export function canResolveDnd(user: User | null | undefined): boolean {
  if (!user) return false;
  return RESOLVE_DND_ROLES.has(user.role);
}
