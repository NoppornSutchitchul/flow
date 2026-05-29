import { useQuery } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";

import { refDataQueryOptions } from "./queryOptions";
import {
  Bath,
  Briefcase,
  Building2,
  Bus,
  CalendarDays,
  CarFront,
  ChefHat,
  CircleParking,
  ClipboardList,
  Coffee,
  DoorOpen,
  Droplets,
  Dumbbell,
  Fence,
  Flame,
  Flower2,
  Footprints,
  Gamepad2,
  HeartPulse,
  Landmark,
  Lock,
  MoveVertical,
  Package2,
  PartyPopper,
  Presentation,
  Scissors,
  Shirt,
  ShoppingBag,
  Sofa,
  Store,
  Sun,
  Trash2,
  Trees,
  Truck,
  UtensilsCrossed,
  Warehouse,
  Waves,
  Wine,
  Zap,
} from "lucide-react";

import { hotelLocationsApi } from "./api";
import { hotelLocationDisplayLabel } from "./hotelLocationDisplayName";
import i18n from "./i18n";
import { normalizeLanguage } from "./language";
import type { HotelLocation } from "./types";

const HOTEL_LOCATION_ICONS: Record<string, LucideIcon> = {
  "HK-LOC-HALL": DoorOpen,
  "HK-LOC-LOBBY": Sofa,
  "HK-LOC-FRONT-DESK": ClipboardList,
  "HK-LOC-CONCIERGE": ClipboardList,
  "HK-LOC-BELL-DESK": Package2,
  "HK-LOC-LUGGAGE": Package2,
  "HK-LOC-BUSINESS": Briefcase,
  "HK-LOC-VIP-LOUNGE": Sofa,
  "HK-LOC-LIFT": MoveVertical,
  "HK-LOC-RESTAURANT": UtensilsCrossed,
  "HK-LOC-BAR": Wine,
  "HK-LOC-CAFE": Coffee,
  "HK-LOC-ROOM-SERVICE": Package2,
  "HK-LOC-POOL": Waves,
  "HK-LOC-POOL-DECK": Sun,
  "HK-LOC-FITNESS": Dumbbell,
  "HK-LOC-SPA": Flower2,
  "HK-LOC-SAUNA": Flame,
  "HK-LOC-SALON": Scissors,
  "HK-LOC-KIDS": PartyPopper,
  "HK-LOC-MEETING": Presentation,
  "HK-LOC-BALLROOM": PartyPopper,
  "HK-LOC-EVENT": CalendarDays,
  "HK-LOC-PRE-FUNC": CalendarDays,
  "HK-LOC-PARKING": CircleParking,
  "HK-LOC-PORTICO": Landmark,
  "HK-LOC-DRIVEWAY": CarFront,
  "HK-LOC-GARDEN": Trees,
  "HK-LOC-TERRACE": Fence,
  "HK-LOC-WALKWAY": Footprints,
  "HK-LOC-ROOFTOP": Building2,
  "HK-LOC-LOBBY-WR-F": Bath,
  "HK-LOC-LOBBY-WR-M": Bath,
  "HK-LOC-POOL-WR-F": Bath,
  "HK-LOC-POOL-WR-M": Bath,
  "HK-LOC-STAFF-WR-F": Bath,
  "HK-LOC-STAFF-WR-M": Bath,
  "HK-LOC-FRONT-OFFICE": Briefcase,
  "HK-LOC-OFF-HK": Briefcase,
  "HK-LOC-OFF-MT": Briefcase,
  "HK-LOC-OFF-FNB": Briefcase,
  "HK-LOC-OFF-SALES": Briefcase,
  "HK-LOC-OFF-HR": Briefcase,
  "HK-LOC-OFF-FIN": Briefcase,
  "HK-LOC-OFF-ENG": Briefcase,
  "HK-LOC-OFF-SEC": Briefcase,
  "HK-LOC-OFF-GM": Briefcase,
  "HK-LOC-KITCH-HOT": ChefHat,
  "HK-LOC-KITCH-COLD": ChefHat,
  "HK-LOC-BANQUET-PREP": ChefHat,
  "HK-LOC-STEWARD": UtensilsCrossed,
  "HK-LOC-LINEN": Shirt,
  "HK-LOC-LAUNDRY": Shirt,
  "HK-LOC-LOCKER": Lock,
  "HK-LOC-CANTEEN": UtensilsCrossed,
  "HK-LOC-UNIFORM": Shirt,
  "HK-LOC-LOADING": Truck,
  "HK-LOC-GARBAGE": Trash2,
  "HK-LOC-STAFF-ENT": DoorOpen,
  "HK-LOC-STORAGE": Warehouse,
  "HK-LOC-T1-STAIR": Footprints,
  "HK-LOC-T2-STAIR": Footprints,
  "HK-LOC-WAITING": Sofa,
  "HK-LOC-GIFT-SHOP": ShoppingBag,
  "HK-LOC-MINI-MART": Store,
  "HK-LOC-EXEC-LOUNGE": Sofa,
  "HK-LOC-CLUB-LOUNGE": Sofa,
  "HK-LOC-REST-WR-F": Bath,
  "HK-LOC-REST-WR-M": Bath,
  "HK-LOC-SPA-WR-F": Bath,
  "HK-LOC-SPA-WR-M": Bath,
  "HK-LOC-FIT-WR-F": Bath,
  "HK-LOC-FIT-WR-M": Bath,
  "HK-LOC-BALL-WR-F": Bath,
  "HK-LOC-BALL-WR-M": Bath,
  "HK-LOC-TERRACE-REST": UtensilsCrossed,
  "HK-LOC-LOTUS-GARDEN": UtensilsCrossed,
  "HK-LOC-RIVERSIDE-GRILL": UtensilsCrossed,
  "HK-LOC-SKY-BAR": Wine,
  "HK-LOC-POOL-BAR": Wine,
  "HK-LOC-LOBBY-LOUNGE": Wine,
  "HK-LOC-BAKERY": Coffee,
  "HK-LOC-INROOM-PICKUP": Package2,
  "HK-LOC-TEA-LOUNGE": Coffee,
  "HK-LOC-POOL-KIDS": Waves,
  "HK-LOC-JACUZZI": Waves,
  "HK-LOC-POOL-TOWEL": Shirt,
  "HK-LOC-SPA-RECEPT": Flower2,
  "HK-LOC-YOGA": Dumbbell,
  "HK-LOC-GAME-ROOM": Gamepad2,
  "HK-LOC-MEET-EMERALD": Presentation,
  "HK-LOC-MEET-SAPPHIRE": Presentation,
  "HK-LOC-MEET-RUBY": Presentation,
  "HK-LOC-BOARDROOM": Briefcase,
  "HK-LOC-BRIDAL": Flower2,
  "HK-LOC-VALET": CarFront,
  "HK-LOC-TAXI": CarFront,
  "HK-LOC-SHUTTLE": Bus,
  "HK-LOC-EV-CHARGE": Zap,
  "HK-LOC-SMOKING": Fence,
  "HK-LOC-FIRST-AID": HeartPulse,
  "HK-LOC-PRAYER": Landmark,
  "HK-LOC-WATER-FEATURE": Droplets,
};

function corridorOrLiftIcon(code: string): LucideIcon | null {
  if (code.includes("-CORR")) return Footprints;
  if (code.includes("-LIFT-")) return MoveVertical;
  if (code.includes("-PANTRY-")) return Warehouse;
  return null;
}

export function hotelLocationIcon(code: string): LucideIcon {
  const c = code.trim();
  return HOTEL_LOCATION_ICONS[c] ?? corridorOrLiftIcon(c) ?? Building2;
}

import { inferHotelLocationEmoji } from "./hotelLocationEmojiMap";

export { inferHotelLocationEmoji };

export function hotelLocationEmoji(
  loc: Pick<HotelLocation, "code" | "icon_emoji">,
): string {
  const stored = loc.icon_emoji?.trim();
  if (stored) return stored;
  return inferHotelLocationEmoji(loc.code);
}

export function useHotelLocations(activeOnly = false) {
  return useQuery({
    queryKey: ["hotel-locations", { activeOnly }],
    queryFn: () => hotelLocationsApi.list(activeOnly),
    ...refDataQueryOptions(),
  });
}

export function hotelLocationLabelMap(
  rows: HotelLocation[],
  lang?: string,
): Record<string, string> {
  return Object.fromEntries(
    rows.map((r) => [r.code, hotelLocationDisplayLabel(r, lang)]),
  );
}

export function isKnownHotelLocation(
  code: string,
  rows: HotelLocation[],
): boolean {
  const c = code.trim();
  return rows.some((r) => r.code === c);
}

/** Turn stored location code (e.g. HK-LOC-POOL-DECK) into a user-facing label. */
export function formatLocationCode(
  code: string,
  labelByCode: Record<string, string>,
  lang?: string,
): string {
  const c = code.trim();
  if (!c) return c;
  if (labelByCode[c]) return labelByCode[c];
  const ui = normalizeLanguage(lang ?? i18n.language ?? "th");
  const i18nKey = `hotelLocations.${c.replace(/-/g, "_")}.label`;
  if (i18n.exists(i18nKey, { lng: ui })) return i18n.t(i18nKey, { lng: ui });
  if (/^HK-LOC-/i.test(c)) {
    return c
      .replace(/^HK-LOC-/i, "")
      .split("-")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(" ");
  }
  return c;
}

/** Replace leading location code in request display names (`CODE · items`). */
export function formatRequestLocationName(
  name: string,
  labelByCode: Record<string, string>,
  lang?: string,
): string {
  const sep = " · ";
  const idx = name.indexOf(sep);
  if (idx < 0) {
    const trimmed = name.trim();
    if (labelByCode[trimmed] || /^HK-LOC-/i.test(trimmed)) {
      return formatLocationCode(trimmed, labelByCode, lang);
    }
    return name;
  }
  const loc = name.slice(0, idx).trim();
  const suffix = name.slice(idx);
  return `${formatLocationCode(loc, labelByCode, lang)}${suffix}`;
}
