import { createElement, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  BedDouble,
  BedSingle,
  ChevronLeft,
  Droplets,
  Link2,
  Ruler,
  Search,
  Tag,
  Trees,
  Waves,
} from "lucide-react";
import clsx from "clsx";
import type { ComponentType } from "react";

import { AnimateCollapse } from "../ui/AnimateCollapse";
import { AnimateExpand } from "../ui/AnimateExpand";

import {
  FLOORS,
  HK_SPECIAL,
  findRoom,
  isPublicAreaCode,
  roomFacts,
} from "../../lib/rooms";
import { useGuestRooms } from "../../lib/guestRooms";
import {
  hotelLocationDisplayHint,
  hotelLocationDisplayLabel,
  hotelLocationSearchText,
} from "../../lib/hotelLocationDisplayName";
import { useHotelLocations, hotelLocationIcon } from "../../lib/hotelLocations";
import type { Building, RoomView } from "../../lib/rooms";

interface Props {
  value: string;
  onChange: (room: string) => void;
  compact?: boolean;
  /** Called after a room or zone is chosen (e.g. move focus to the next field). */
  onSelected?: () => void;
}

const BUILDINGS: Building[] = [1, 2];

const metaIcon =
  "w-3.5 h-3.5 shrink-0 text-[color:var(--color-ink-muted)] opacity-90";

type LocationHitKind = "guest_flow" | "zone" | "room";

interface LocationHit {
  id: string;
  kind: LocationHitKind;
  code?: string;
  primary: string;
  secondary?: string;
  icon: ComponentType<{ className?: string }>;
}

function ViewGlyph({ view }: { view: RoomView }) {
  switch (view) {
    case "sea":
      return <Waves className={metaIcon} aria-hidden />;
    case "garden":
      return <Trees className={metaIcon} aria-hidden />;
    default:
      return <Droplets className={metaIcon} aria-hidden />;
  }
}

function HotelZoneIcon({ code, className }: { code: string; className?: string }) {
  return createElement(hotelLocationIcon(code), { className, "aria-hidden": true });
}

/**
 * Location picker: search + dropdown for guest rooms and hotel zones,
 * with optional tower → floor → unit drill-down.
 */
export function RoomCombobox({ value, onChange, compact = false, onSelected }: Props) {
  const { t, i18n } = useTranslation();
  const [building, setBuilding] = useState<Building | null>(null);
  const [floor, setFloor] = useState<number | null>(null);
  const [guestFlow, setGuestFlow] = useState(false);
  const [locationQuery, setLocationQuery] = useState("");
  const [locationListOpen, setLocationListOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const v = value.trim();
  const { data: guestRooms = [] } = useGuestRooms(true);
  const resolved = findRoom(value, guestRooms);
  const { data: hotelLocations = [] } = useHotelLocations(true);
  const hotelCodes = useMemo(
    () => hotelLocations.map((loc) => loc.code),
    [hotelLocations],
  );
  const isPublic = isPublicAreaCode(v, hotelCodes);
  const isOffice = v === HK_SPECIAL.OFFICE;

  useEffect(() => {
    if (resolved) {
      setBuilding(resolved.building);
      setFloor(resolved.floor);
      setGuestFlow(true);
    }
  }, [resolved, value]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!searchRef.current?.contains(e.target as Node)) setLocationListOpen(false);
    }
    if (locationListOpen) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [locationListOpen]);

  const facts = useMemo(
    () => (resolved ? roomFacts(resolved) : null),
    [resolved],
  );

  const locationHits = useMemo((): LocationHit[] => {
    const q = locationQuery.trim().toLowerCase();
    const hits: LocationHit[] = [];

    const guestLabel = t("rooms.location_guest");
    const guestSub = t("rooms.location_guest_sub");
    const guestHay = `${guestLabel} ${guestSub} guest room`.toLowerCase();
    if (!q || guestHay.includes(q)) {
      hits.push({
        id: "guest_flow",
        kind: "guest_flow",
        primary: guestLabel,
        secondary: guestSub,
        icon: BedDouble,
      });
    }

    const sortedLocations = [...hotelLocations].sort((a, b) =>
      a.label.localeCompare(b.label, i18n.language, { sensitivity: "base" }),
    );

    for (const loc of sortedLocations) {
      const hay = hotelLocationSearchText(loc, i18n.language);
      if (!q || hay.includes(q)) {
        hits.push({
          id: loc.code,
          kind: "zone",
          code: loc.code,
          primary: hotelLocationDisplayLabel(loc, i18n.language),
          secondary:
            hotelLocationDisplayHint(loc, i18n.language, t("rooms.location_public")) ||
            t("rooms.location_public"),
          icon: hotelLocationIcon(loc.code),
        });
      }
    }

    if (q.length > 0) {
      let roomHits = 0;
      for (const room of guestRooms) {
        if (!room.number.includes(q)) continue;
        hits.push({
          id: room.number,
          kind: "room",
          code: room.number,
          primary: room.number,
          secondary: `${t("rooms.building")} ${room.building} · ${t("rooms.floor")} ${room.floor}`,
          icon: BedDouble,
        });
        roomHits += 1;
        if (roomHits >= 40) break;
      }
    }

    return hits;
  }, [locationQuery, t, i18n.language, hotelLocations, guestRooms]);

  const clearAll = () => {
    onChange("");
    setBuilding(null);
    setFloor(null);
    setGuestFlow(false);
    setLocationQuery("");
    setLocationListOpen(false);
  };

  const pickGuestRoom = () => {
    setGuestFlow(true);
    setBuilding(null);
    setFloor(null);
    setLocationQuery("");
    setLocationListOpen(false);
    onChange("");
  };

  const backToLocationTypes = () => {
    setGuestFlow(false);
    setBuilding(null);
    setFloor(null);
    onChange("");
  };

  const selectUnit = (seq: number) => {
    if (building == null || floor == null) return;
    const num = `${building}${floor}${String(seq).padStart(2, "0")}`;
    if (!findRoom(num, guestRooms)) return;
    onChange(num);
  };

  const unitsOnFloor = useMemo(() => {
    if (building == null || floor == null) return [];
    return guestRooms
      .filter((r) => r.building === building && r.floor === floor)
      .map((r) => parseInt(r.number.slice(-2), 10))
      .sort((a, b) => a - b);
  }, [guestRooms, building, floor]);

  const pickLocationHit = (hit: LocationHit) => {
    if (hit.kind === "guest_flow") {
      pickGuestRoom();
      return;
    }
    if (hit.code) {
      onChange(hit.code);
      setLocationQuery("");
      setLocationListOpen(false);
      onSelected?.();
    }
  };

  const pickBestSearchHit = (): boolean => {
    const q = locationQuery.trim();
    if (!q || locationHits.length === 0) return false;

    const exactRoom = locationHits.find(
      (h) => h.kind === "room" && h.code?.toLowerCase() === q.toLowerCase(),
    );
    if (exactRoom) {
      pickLocationHit(exactRoom);
      return true;
    }

    const roomHit = locationHits.find((h) => h.kind === "room");
    if (roomHit) {
      pickLocationHit(roomHit);
      return true;
    }

    pickLocationHit(locationHits[0]!);
    return true;
  };

  const goBackInGuestFlow = () => {
    if (floor != null) {
      setFloor(null);
    } else if (building != null) {
      setBuilding(null);
    } else {
      backToLocationTypes();
    }
  };

  if (isPublic) {
    const loc = hotelLocations.find((l) => l.code === v);
    return (
      <div key={v} className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 min-w-0">
            <HotelZoneIcon
              code={v}
              className="w-5 h-5 shrink-0 mt-0.5 text-[color:var(--color-ink-muted)]"
            />
            <div className="min-w-0">
              <p className="font-medium text-[color:var(--color-ink)] leading-snug">
                {loc ? hotelLocationDisplayLabel(loc, i18n.language) : v}
              </p>
              <p className="text-xs text-[color:var(--color-ink-muted)] mt-1 leading-relaxed">
                {loc
                  ? hotelLocationDisplayHint(loc, i18n.language, t("rooms.location_public"))
                  : t("rooms.location_public")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={clearAll}
            className="shrink-0 text-xs font-medium rounded-md border border-[color:var(--color-line)] bg-white px-2.5 py-1 hover:bg-[color:var(--color-paper-2)]"
          >
            {t("quick.room_change")}
          </button>
        </div>
      </div>
    );
  }

  if (isOffice) {
    return (
      <div key={v} className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-medium text-[color:var(--color-ink)] leading-snug">
              {t("rooms.location_hk_office")}
            </p>
            <p className="text-xs text-[color:var(--color-ink-muted)] mt-1 leading-relaxed">
              {t("rooms.location_hk_office_hint")}
            </p>
          </div>
          <button
            type="button"
            onClick={clearAll}
            className="shrink-0 text-xs font-medium rounded-md border border-[color:var(--color-line)] bg-white px-2.5 py-1 hover:bg-[color:var(--color-paper-2)]"
          >
            {t("quick.room_change")}
          </button>
        </div>
      </div>
    );
  }

  if (resolved && facts) {
    return (
      <div key={v} className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <span className="font-mono text-lg font-semibold tabular-nums text-[color:var(--color-ink)]">
            {value}
          </span>
          <button
            type="button"
            onClick={clearAll}
            className="shrink-0 text-xs font-medium rounded-md border border-[color:var(--color-line)] bg-white px-2.5 py-1 hover:bg-[color:var(--color-paper-2)]"
          >
            {t("quick.room_change")}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-[color:var(--color-ink-muted)] leading-snug">
          <span className="inline-flex items-center gap-1">
            <Tag className={metaIcon} aria-hidden />
            <span>{t(`rooms.type.${resolved.type}`)}</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <ViewGlyph view={resolved.view} />
            <span>{t(`rooms.view.${resolved.view}`)}</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <Ruler className={metaIcon} aria-hidden />
            <span className="tabular-nums">{t("rooms.sqm", { sqm: facts.areaSqm })}</span>
          </span>
          <span className="inline-flex items-center gap-1">
            {facts.bed === "king"
              ? <BedDouble className={metaIcon} aria-hidden />
              : <BedSingle className={metaIcon} aria-hidden />}
            <span>{t(`rooms.bed.${facts.bed}`)}</span>
          </span>
          {facts.connectingPeer
            ? (
              <span className="inline-flex items-center gap-1">
                <Link2 className={metaIcon} aria-hidden />
                <span className="tabular-nums">{t("rooms.connecting", { peer: facts.connectingPeer })}</span>
              </span>
            )
            : null}
        </div>
      </div>
    );
  }

  return (
    <div className={compact ? "space-y-1" : "space-y-2"}>
      <div ref={searchRef}>
        <p className={clsx(
          "text-xs text-[color:var(--color-ink-muted)]",
          compact ? "mb-0.5" : "mb-1.5",
        )}>
          {t("rooms.location_choose_prompt")}
        </p>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 w-4 h-4 -translate-y-1/2 text-[color:var(--color-ink-muted)]"
            aria-hidden
          />
          <input
            type="search"
            value={locationQuery}
            onChange={(e) => {
              setLocationQuery(e.target.value);
              setLocationListOpen(true);
            }}
            onFocus={() => setLocationListOpen(true)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              pickBestSearchHit();
            }}
            placeholder={t("rooms.location_search_placeholder")}
            aria-label={t("rooms.location_search_placeholder")}
            className={clsx(
              "w-full rounded-lg border border-[color:var(--color-line)] bg-white pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--color-ink)]/10",
              compact ? "py-1.5" : "py-2.5",
            )}
          />
          {locationListOpen && locationHits.length > 0 && (
            <div className="absolute z-20 mt-1 left-0 right-0 flex max-h-[min(28rem,60vh)] flex-col overflow-hidden rounded-lg border border-[color:var(--color-line)] bg-white shadow-lg">
            <ul
              role="listbox"
              aria-label={t("rooms.location_choose_prompt")}
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
            >
              {locationHits.map((hit) => {
                const Icon = hit.icon;
                return (
                  <li key={hit.id} role="option">
                    <button
                      type="button"
                      className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left text-sm hover:bg-[color:var(--color-paper-2)]"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pickLocationHit(hit)}
                    >
                      <Icon className="w-4 h-4 shrink-0 mt-0.5 text-[color:var(--color-ink-muted)]" />
                      <span className="flex-1 min-w-0">
                        <span className="block font-medium text-[color:var(--color-ink)] leading-snug">
                          {hit.primary}
                        </span>
                        {hit.secondary ? (
                          <span className="block text-xs text-[color:var(--color-ink-muted)] leading-snug mt-0.5">
                            {hit.secondary}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            </div>
          )}
          {locationListOpen && locationQuery.trim() && locationHits.length === 0 && (
            <p className="absolute z-20 mt-1 left-0 right-0 rounded-lg border border-[color:var(--color-line)] bg-white px-3 py-2.5 text-sm text-[color:var(--color-ink-muted)] shadow-lg">
              {t("rooms.location_search_empty")}
            </p>
          )}
        </div>
      </div>

      <AnimateCollapse show={guestFlow} enterOnMount>
        <div className="mt-1 space-y-2 rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-paper)]/30 p-3">
          <button
            type="button"
            onClick={goBackInGuestFlow}
            className="inline-flex items-center gap-1 text-xs font-medium text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            {t("quick.room_back")}
          </button>

          <AnimateExpand
            deps={[building, floor, unitsOnFloor.length]}
            similarThreshold={14}
          >
            {building == null ? (
              <div key="room-step-building">
                <p className="mb-2 text-xs text-[color:var(--color-ink-muted)]">
                  {t("quick.room_step_building")}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {BUILDINGS.map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => {
                        setBuilding(b);
                        setFloor(null);
                      }}
                      className="rounded-lg border border-[color:var(--color-line)] bg-white px-3 py-2.5 text-sm font-medium shadow-sm transition-colors hover:bg-[color:var(--color-paper-2)]"
                    >
                      {t("rooms.building")} {b}
                    </button>
                  ))}
                </div>
              </div>
            ) : floor == null ? (
              <div key="room-step-floor">
                <p className="mb-2 text-xs text-[color:var(--color-ink-muted)]">
                  {t("quick.room_step_floor")}
                </p>
                <div className="grid grid-cols-5 gap-2">
                  {FLOORS.map((fl) => (
                    <button
                      key={fl}
                      type="button"
                      onClick={() => setFloor(fl)}
                      className="rounded-lg border border-[color:var(--color-line)] bg-white py-2.5 text-sm font-semibold tabular-nums transition-colors hover:bg-[color:var(--color-paper-2)]"
                    >
                      {fl}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div key="room-step-unit">
                <p className="mb-2.5 text-sm text-[color:var(--color-ink-muted)]">
                  {t("quick.room_step_unit")}
                </p>
                {unitsOnFloor.length === 0 ? (
                  <p className="text-sm text-[color:var(--color-ink-muted)]">
                    {t("settings.guest_rooms_floor_empty")}
                  </p>
                ) : (
                  <div className="grid grid-cols-6 gap-2">
                    {unitsOnFloor.map((seq) => (
                      <button
                        key={seq}
                        type="button"
                        onClick={() => selectUnit(seq)}
                        className={clsx(
                          "min-h-[2.75rem] rounded-lg border border-[color:var(--color-line)] bg-white py-2.5 text-center font-mono text-sm font-semibold tabular-nums leading-none",
                          "transition-colors hover:bg-[color:var(--color-paper-2)]",
                        )}
                      >
                        {String(seq).padStart(2, "0")}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </AnimateExpand>
        </div>
      </AnimateCollapse>
    </div>
  );
}
