/**
 * Static room inventory for the prototype.
 *
 * 4-digit room numbers in the form `BFRR`:
 *   - B  → building number (1 or 2)
 *   - F  → floor (1–5, five floors per tower)
 *   - RR → room sequence on that floor (01–30)
 *
 * Yields 2 × 5 × 30 = 300 rooms across two towers.
 *
 * Room types and views are mixed across every floor using a small
 * deterministic hash so the same room always gets the same metadata,
 * but no single floor is locked to one product (more like a real hotel).
 * Approximate mix: 60% Superior, 30% Deluxe, 10% Suite.
 *   - Tower 1 leans ocean / garden views.
 *   - Tower 2 leans pool / garden views.
 */

import type { TFunction } from "i18next";

export const FLOORS: readonly number[] = [1, 2, 3, 4, 5];
export const UNITS_PER_FLOOR = 30;

export type RoomType = "Superior" | "Deluxe" | "Suite";
export type RoomView = "sea" | "garden" | "pool";
export type Building = 1 | 2;

export interface Room {
  number: string; // e.g. "1205"
  building: Building;
  floor: number;
  type: RoomType;
  view: RoomView;
}

/** Bed inventory for deterministic display (prototype data). */
export type BedArrangement = "king" | "twin";

export interface RoomFacts {
  /** Approximate area for staff context. */
  areaSqm: number;
  bed: BedArrangement;
  /** Neighbour room code when a statutory connecting pair exists. */
  connectingPeer: string | null;
}

// LCG-style hash that returns a stable float in [0, 1) for a room key.
function hash01(building: number, floor: number, n: number, salt: number): number {
  const seed = (building * 1009 + floor * 53 + n) * 9301 + 49297 + salt * 131;
  return (((seed % 233280) + 233280) % 233280) / 233280;
}

function seqFromRoomNumber(roomNumber: string): number {
  return parseInt(roomNumber.slice(-2), 10);
}

function connectingNeighbor(r: Room): string | null {
  const seq = seqFromRoomNumber(r.number);
  const hConnect = hash01(r.building, r.floor, seq, 23);
  // ~⅕ of corridors have true interconnecting pairs on adjacent numbers.
  if (hConnect > 0.2) return null;
  const { building: b, floor: f } = r;
  if (seq % 2 === 1 && seq < 30) {
    return `${b}${f}${String(seq + 1).padStart(2, "0")}`;
  }
  if (seq % 2 === 0 && seq >= 2) {
    return `${b}${f}${String(seq - 1).padStart(2, "0")}`;
  }
  return null;
}

/** Extra room attributes derived from tower / floor / number (deterministic mock). */
export function roomFacts(r: Room): RoomFacts {
  const seq = seqFromRoomNumber(r.number);
  const hArea = hash01(r.building, r.floor, seq, 41);
  let minA: number;
  let maxA: number;
  switch (r.type) {
    case "Superior":
      minA = 29;
      maxA = 38;
      break;
    case "Deluxe":
      minA = 37;
      maxA = 47;
      break;
    default:
      minA = 54;
      maxA = 76;
      break;
  }
  const areaSqm = Math.round(minA + (maxA - minA) * hArea);

  const hBed = hash01(r.building, r.floor, seq, 43);
  const bed: BedArrangement =
    r.type === "Suite"
      ? hBed < 0.92
        ? "king"
        : "twin"
      : hBed < 0.5
        ? "twin"
        : "king";

  const connectingPeer = connectingNeighbor(r);
  return { areaSqm, bed, connectingPeer };
}

export function guestRoomToRoom(g: {
  number: string;
  building: number;
  floor: number;
  type: string;
  view: string;
}): Room {
  return {
    number: g.number,
    building: g.building as Building,
    floor: g.floor,
    type: g.type as RoomType,
    view: g.view as RoomView,
  };
}

/** Stored room fields with deterministic fallbacks for legacy rows. */
export function guestRoomDisplayFacts(g: {
  number: string;
  building: number;
  floor: number;
  type: string;
  view: string;
  area_sqm?: number | null;
  bed?: string | null;
  connecting_peer?: string | null;
}): RoomFacts {
  const derived = roomFacts(guestRoomToRoom(g));
  const peer = g.connecting_peer?.trim();
  return {
    areaSqm: g.area_sqm ?? derived.areaSqm,
    bed: (g.bed ?? derived.bed) as BedArrangement,
    connectingPeer: peer ? peer : derived.connectingPeer,
  };
}

export function findRoom(number: string, rooms: Room[] = []): Room | undefined {
  const target = number.trim();
  return rooms.find((r) => r.number === target);
}

/** Virtual locations for housekeeping (stored as `Request.room`). */
export const HK_SPECIAL = {
  /** Housekeeping office / back office. */
  OFFICE: "HK-OFFICE",
} as const;

export type HkSpecialCode = (typeof HK_SPECIAL)[keyof typeof HK_SPECIAL];

/** Legacy public-area codes (display only for old requests). */
export const HK_LEGACY_PUBLIC = "HK-PUBLIC";

/** Hotel public areas (non–guest-room). Legacy combined zones for old requests. */
export const HK_PUBLIC_ZONE_OPTIONS: readonly { code: string; zoneKey: string }[] = [
  { code: HK_LEGACY_PUBLIC, zoneKey: "general" },
  { code: "HK-AREA-LOBBY", zoneKey: "lobby" },
  { code: "HK-AREA-FNB", zoneKey: "fnb" },
  { code: "HK-AREA-POOL", zoneKey: "pool" },
  { code: "HK-AREA-SPA", zoneKey: "spa" },
  { code: "HK-AREA-MICE", zoneKey: "mice" },
  { code: "HK-AREA-PARK", zoneKey: "parking" },
  { code: "HK-AREA-OUTDOOR", zoneKey: "garden" },
] as const;

export function isPublicAreaCode(code: string, dynamicCodes?: string[]): boolean {
  const c = code.trim();
  if (c === HK_LEGACY_PUBLIC) return false;
  if (HK_PUBLIC_ZONE_OPTIONS.some((z) => z.code === c)) return true;
  return dynamicCodes?.includes(c) ?? false;
}

export function publicZoneTranslationKey(
  code: string,
): `rooms.public_zone.${string}` | null {
  const c = code.trim();
  const opt = HK_PUBLIC_ZONE_OPTIONS.find((z) => z.code === c);
  return opt ? (`rooms.public_zone.${opt.zoneKey}` as const) : null;
}

export function isHkSpecialRoom(code: string, hotelCodes?: string[]): boolean {
  const c = code.trim();
  return c === HK_SPECIAL.OFFICE || isPublicAreaCode(c, hotelCodes);
}

/** Quick Request / ops: guest room code or HK virtual location. */
export function isValidQuickRoomLocation(
  code: string,
  hotelCodes?: string[],
  guestRooms: Room[] = [],
): boolean {
  const c = code.trim();
  return Boolean(findRoom(c, guestRooms) || isHkSpecialRoom(c, hotelCodes));
}

/** UI label for queue, tables, and detail (translated for special codes). */
export function roomDisplayLabel(
  room: string,
  t: TFunction,
  labelByCode?: Record<string, string>,
): string {
  const c = room.trim();
  if (labelByCode?.[c]) return labelByCode[c];
  const zoneTk = publicZoneTranslationKey(c);
  if (zoneTk) return t(zoneTk);
  if (c === HK_SPECIAL.OFFICE) return t("rooms.location_hk_office");
  return room;
}

export interface RequestLocationView {
  primary: string;
  secondary?: string;
  stacked: boolean;
}

/** Primary location label; front-desk pickup shows front desk + guest room caption. */
export function requestLocationDisplay(
  room: string,
  deliveryMethod: string | undefined,
  t: TFunction,
  opts?: {
    labelByCode?: Record<string, string>;
    guestRooms?: Room[];
  },
): RequestLocationView {
  const c = room.trim();
  if (deliveryMethod === "front_desk" && c) {
    const guestRooms = opts?.guestRooms ?? [];
    const secondary = findRoom(c, guestRooms)
      ? t("rooms.guest_room_caption", { room: c })
      : t("rooms.guest_location_caption", {
          location: roomDisplayLabel(c, t, opts?.labelByCode),
        });
    return {
      primary: t("rooms.front_desk_location"),
      secondary,
      stacked: true,
    };
  }
  return {
    primary: roomDisplayLabel(c, t, opts?.labelByCode),
    stacked: false,
  };
}

/** Line headline: "Room 1205" vs full special label (no "Room" prefix). */
export function requestLocationHeadline(
  room: string,
  t: TFunction,
  labelByCode?: Record<string, string>,
  guestRooms: Room[] = [],
  deliveryMethod?: string,
): string {
  if (deliveryMethod === "front_desk" && room.trim()) {
    return t("rooms.front_desk_location");
  }
  const c = room.trim();
  if (labelByCode?.[c]) return labelByCode[c];
  const zoneTk = publicZoneTranslationKey(c);
  if (zoneTk) return t(zoneTk);
  if (c === HK_SPECIAL.OFFICE) return t("rooms.location_hk_office");
  if (findRoom(c, guestRooms)) return t("rooms.headline_guest", { room: c });
  return c;
}
