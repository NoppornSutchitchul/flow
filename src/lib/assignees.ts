import type { User } from "./types";
import { findRoom, HK_SPECIAL, isPublicAreaCode, type Room } from "./rooms";

export type AssignableDept =
  | "housekeeping"
  | "maintenance"
  | "front_office"
  | "bell_boy";

export function assignableUsers(dept: AssignableDept, list: User[]) {
  return list.filter((u) => {
    if (!u.active) return false;
    // Bell staff sit under Front Office org; service SKUs use department bell_boy.
    if (dept === "bell_boy") {
      return (
        u.role === "bellboy" &&
        (u.department === "bell_boy" || u.department === "front_office")
      );
    }
    if (u.department !== dept) return false;
    if (dept === "maintenance") return u.role === "maintenance";
    if (dept === "front_office") {
      return u.role === "frontdesk" || u.role === "manager";
    }
    return ["housekeeper", "hk_supervisor", "manager"].includes(u.role);
  });
}

/** Keep current assignee visible in reassign picker even if off-shift or legacy data. */
export function withAssigneeInPool(pool: User[], assignee: User | null | undefined): User[] {
  if (!assignee?.id) return pool;
  if (pool.some((u) => u.id === assignee.id)) return pool;
  return [...pool, assignee];
}

/** Zone label used in user.work_zone, e.g. "ตึก 1 · ชั้น 4". */
export function workZoneForGuestRoom(building: number, floor: number): string {
  return `ตึก ${building} · ชั้น ${floor}`;
}

/** Staff name without legacy zone suffix embedded in old seed data (e.g. " · T2-5"). */
export function staffDisplayName(name: string): string {
  return name.replace(/\s*·\s*T\d+-\d+\s*$/, "").split("·")[0]?.trim() ?? name;
}

/** Parse a stored work_zone back to building + floor. */
export function parseWorkZone(
  zone: string | null | undefined,
): { building: number; floor: number } | null {
  const z = zone?.trim();
  if (!z) return null;
  const m = z.match(/^ตึก\s+(\d+)\s*·\s*ชั้น\s+(\d+)$/);
  if (!m) return null;
  const building = parseInt(m[1]!, 10);
  const floor = parseInt(m[2]!, 10);
  if (building < 1 || floor < 1) return null;
  return { building, floor };
}

/** Resolve the HK floor zone for a guest room code, if known. */
export function workZoneForRoomCode(
  room: string,
  guestRooms: Room[] = [],
): string | null {
  const code = room.trim();
  if (!code) return null;

  const found = findRoom(code, guestRooms);
  if (found) return workZoneForGuestRoom(found.building, found.floor);

  if (/^\d{4}$/.test(code)) {
    const building = parseInt(code[0]!, 10);
    const floor = parseInt(code[1]!, 10);
    if (building >= 1 && floor >= 1) {
      return workZoneForGuestRoom(building, floor);
    }
  }

  return null;
}

/** Lower score = closer to the request room (same tower/floor wins). */
export function zoneProximityScore(
  room: string,
  guestRooms: Room[],
  userZone: string | null | undefined,
): number {
  const roomLoc = parseWorkZone(workZoneForRoomCode(room, guestRooms));
  const staffLoc = parseWorkZone(userZone);
  if (!roomLoc) return 0;
  if (!staffLoc) return 10_000;
  if (staffLoc.building !== roomLoc.building) {
    return (
      1_000 * Math.abs(staffLoc.building - roomLoc.building) +
      Math.abs(staffLoc.floor - roomLoc.floor)
    );
  }
  return Math.abs(staffLoc.floor - roomLoc.floor);
}

function compareStaffByProximity(
  a: User,
  b: User,
  room: string,
  guestRooms: Room[],
): number {
  const da = zoneProximityScore(room, guestRooms, a.work_zone);
  const db = zoneProximityScore(room, guestRooms, b.work_zone);
  if (da !== db) return da - db;
  return `${a.job_title ?? ""} ${staffDisplayName(a.name)}`.localeCompare(
    `${b.job_title ?? ""} ${staffDisplayName(b.name)}`,
    undefined,
    { sensitivity: "base" },
  );
}

export function isPublicAreaHousekeeper(
  u: Pick<User, "role" | "job_title">,
): boolean {
  if (u.role !== "housekeeper") return false;
  const jt = (u.job_title ?? "").trim().toLowerCase();
  return jt.includes("public area") || jt.includes("พื้นที่สาธารณะ");
}

export function isGuestRoomRequest(room: string, guestRooms: Room[] = []): boolean {
  return workZoneForRoomCode(room, guestRooms) !== null;
}

export function isPublicAreaRequest(
  room: string,
  hotelCodes: string[] = [],
  guestRooms: Room[] = [],
): boolean {
  const code = room.trim();
  if (!code || isGuestRoomRequest(code, guestRooms)) return false;
  if (code === HK_SPECIAL.OFFICE) return false;
  return isPublicAreaCode(code, hotelCodes);
}

/** HK routing: PA ↔ hotel zones; floor staff ↔ guest rooms. Supervisors/managers: all. */
export function staffHandlesHkRequest(
  u: User,
  room: string,
  guestRooms: Room[] = [],
  hotelCodes: string[] = [],
): boolean {
  if (u.role === "hk_supervisor" || u.role === "manager") return true;
  if (isPublicAreaHousekeeper(u)) {
    return isPublicAreaRequest(room, hotelCodes, guestRooms);
  }
  const code = room.trim();
  return isGuestRoomRequest(code, guestRooms) || code === HK_SPECIAL.OFFICE;
}

/** All assignable HK staff for a room, nearest work zones first. */
export function assignableUsersForRoom(
  dept: AssignableDept,
  list: User[],
  room: string,
  guestRooms: Room[] = [],
  hotelCodes: string[] = [],
): User[] {
  const pool = assignableUsers(dept, list);
  if (dept !== "housekeeping") return pool;
  return [...pool]
    .filter((u) => staffHandlesHkRequest(u, room, guestRooms, hotelCodes))
    .sort((a, b) => compareStaffByProximity(a, b, room, guestRooms));
}

export function sortedZoneGroups(
  users: User[],
  noZoneLabel: string,
  roomProximity?: { room: string; guestRooms: Room[] },
) {
  const m = new Map<string, User[]>();
  for (const u of users) {
    const z = u.work_zone?.trim() || noZoneLabel;
    if (!m.has(z)) m.set(z, []);
    m.get(z)!.push(u);
  }
  for (const arr of m.values()) {
    arr.sort((a, b) =>
      `${a.job_title ?? ""} ${staffDisplayName(a.name)}`.localeCompare(
        `${b.job_title ?? ""} ${staffDisplayName(b.name)}`,
        undefined,
        { sensitivity: "base" },
      ),
    );
  }
  const entries = [...m.entries()];
  if (roomProximity) {
    const { room, guestRooms } = roomProximity;
    entries.sort(([zoneA], [zoneB]) => {
      const scoreA = zoneProximityScore(
        room,
        guestRooms,
        zoneA === noZoneLabel ? null : zoneA,
      );
      const scoreB = zoneProximityScore(
        room,
        guestRooms,
        zoneB === noZoneLabel ? null : zoneB,
      );
      if (scoreA !== scoreB) return scoreA - scoreB;
      return zoneA.localeCompare(zoneB, "th"); // zone codes are Thai numerals
    });
    return entries;
  }
  return entries.sort(([a], [b]) => a.localeCompare(b, "th"));
}

export function canReassignRequest(role?: string) {
  return !!role && ["admin", "manager", "hk_supervisor", "frontdesk"].includes(role);
}

export function canEditScheduledHoldRequest(role?: string) {
  return canReassignRequest(role);
}
