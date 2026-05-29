import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BedDouble,
  ChevronDown,
  ChevronUp,
  Pencil,
  Search,
  SearchX,
  Trash2,
  X,
} from "lucide-react";
import clsx from "clsx";

import { GroupedChoicePicker } from "../ui/GroupedChoicePicker";
import { HoverTooltip } from "../ui/HoverTooltip";
import { ListPaginationFooter } from "../ui/ListPaginationFooter";
import { guestRoomsApi } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import {
  displayLabelForRoomField,
  optionsForKind,
  roomOptionLabel,
  useRoomOptions,
} from "../../lib/roomOptions";
import { guestRoomDisplayFacts } from "../../lib/rooms";
import type { GuestRoom, RoomAttributeOption } from "../../lib/types";
import { useClientPagination } from "../../lib/useClientPagination";

type BuildingFilter = string;
type TypeFilter = string;
type BedFilter = string;

const CONNECTING_FILTERS = ["all", "yes", "no"] as const;
type ConnectingFilter = (typeof CONNECTING_FILTERS)[number];

const chipButtonClass = (active: boolean) =>
  clsx(
    "rounded-full border px-3 py-1.5 text-xs font-medium transition",
    active
      ? "border-[color:var(--color-ink)] bg-[color:var(--color-ink)] text-white shadow-sm"
      : "border-[color:var(--color-line)] bg-white text-[color:var(--color-ink-soft)] hover:border-[color:var(--color-ink)]/15",
  );

const ROOM_NUMBER_MIN_LEN = 1;
const ROOM_NUMBER_MAX_LEN = 10;

/** English letters, digits, hyphen — for codes like 1205, A1205, 12B01. */
function filterRoomNumberInput(raw: string): string {
  return raw.replace(/[^A-Za-z0-9-]/g, "").slice(0, ROOM_NUMBER_MAX_LEN);
}

function parseRoomNumberDigits(
  raw: string,
  buildingCodes: Set<string>,
  floorCodes: Set<string>,
): { building: string; floor: string } | null {
  const n = raw.trim();
  if (!/^\d{4}$/.test(n)) return null;
  const building = n[0];
  const floor = n[1];
  if (!buildingCodes.has(building)) return null;
  if (!floorCodes.has(floor)) return null;
  return { building, floor };
}

function roomFieldFallback(
  kind: "type" | "view" | "bed",
  t: TFunction,
): (code: string) => string {
  return (code) => {
    const key = `rooms.${kind}.${code}` as const;
    const translated = t(key);
    return translated === key ? code : translated;
  };
}

const ROOMS_TABLE_GRID =
  "md:grid-cols-[minmax(4.5rem,0.55fr)_3.25rem_3.25rem_minmax(0,0.9fr)_minmax(0,0.85fr)_minmax(5rem,5.75rem)_minmax(3.5rem,4.5rem)_minmax(0,0.85fr)_2.75rem_minmax(5.5rem,auto)]";

type RoomSortKey =
  | "number"
  | "building"
  | "floor"
  | "type"
  | "view"
  | "areaSqm"
  | "bed"
  | "connecting";
type SortDir = "asc" | "desc";

function roomSortFacts(r: GuestRoom) {
  return guestRoomDisplayFacts(r);
}

const formPickerClass = "rounded-xl shadow-sm";

const formLabelClass =
  "mb-1 block text-xs font-medium text-[color:var(--color-ink-muted)]";

function FormField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block min-w-0">
      <span className={formLabelClass}>{label}</span>
      {children}
    </label>
  );
}

function compareRooms(
  a: GuestRoom,
  b: GuestRoom,
  key: RoomSortKey,
  dir: SortDir,
): number {
  let cmp = 0;
  const fa = roomSortFacts(a);
  const fb = roomSortFacts(b);
  switch (key) {
    case "number":
      cmp = a.number.localeCompare(b.number, undefined, { numeric: true });
      break;
    case "building":
      cmp = a.building - b.building;
      break;
    case "floor":
      cmp = a.floor - b.floor;
      break;
    case "type":
      cmp = a.type.localeCompare(b.type);
      break;
    case "view":
      cmp = a.view.localeCompare(b.view);
      break;
    case "areaSqm":
      cmp = fa.areaSqm - fb.areaSqm;
      break;
    case "bed":
      cmp = fa.bed.localeCompare(fb.bed);
      break;
    case "connecting": {
      const ca = fa.connectingPeer ?? "";
      const cb = fb.connectingPeer ?? "";
      cmp = ca.localeCompare(cb, undefined, { numeric: true });
      break;
    }
  }
  return dir === "asc" ? cmp : -cmp;
}

function RoomSortableHeader({
  label,
  column,
  sortKey,
  sortDir,
  onSort,
  align = "start",
}: {
  label: string;
  column: RoomSortKey;
  sortKey: RoomSortKey | null;
  sortDir: SortDir;
  onSort: (column: RoomSortKey) => void;
  align?: "start" | "end" | "center";
}) {
  const { t } = useTranslation();
  const active = sortKey === column;
  const Icon = active ? (sortDir === "asc" ? ChevronUp : ChevronDown) : ChevronUp;
  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      aria-label={
        active
          ? sortDir === "asc"
            ? t("requests.table.sort_asc", { column: label })
            : t("requests.table.sort_desc", { column: label })
          : t("requests.table.sort_by", { column: label })
      }
      className={clsx(
        "group/header inline-flex min-w-0 items-center gap-0.5 rounded-md -mx-1 px-1 py-0.5 text-xs font-medium transition-colors",
        "hover:text-[color:var(--color-ink)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-ink)]/15",
        active
          ? "text-[color:var(--color-ink)]"
          : "text-[color:var(--color-ink-muted)]",
        align === "start" && "justify-start self-start text-left",
        align === "end" && "justify-end self-end text-right",
        align === "center" && "w-full justify-center self-center text-center",
      )}
    >
      <span className="truncate">{label}</span>
      <Icon
        className={clsx(
          "h-3 w-3 shrink-0 transition-opacity",
          active ? "opacity-100" : "opacity-0 group-hover/header:opacity-40",
        )}
        aria-hidden
      />
    </button>
  );
}

function GuestRoomFormModal({
  mode,
  room,
  existingRooms,
  roomOptions,
  onClose,
}: {
  mode: "add" | "edit";
  room: GuestRoom | null;
  existingRooms: GuestRoom[];
  roomOptions: RoomAttributeOption[];
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { current } = useAuth();
  const qc = useQueryClient();
  const [number, setNumber] = useState("");
  const [building, setBuilding] = useState("1");
  const [floor, setFloor] = useState("1");
  const [type, setType] = useState("");
  const [view, setView] = useState("");
  const [areaSqm, setAreaSqm] = useState("");
  const [bed, setBed] = useState("");
  const [connectingPeer, setConnectingPeer] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);

  const trimmedNumber = number.trim();

  const isDuplicate = useMemo(() => {
    if (!trimmedNumber) return false;
    return existingRooms.some(
      (r) =>
        r.number === trimmedNumber && (mode === "add" || room?.id !== r.id),
    );
  }, [trimmedNumber, existingRooms, mode, room?.id]);

  const buildingCodes = useMemo(
    () => new Set(optionsForKind(roomOptions, "building").map((o) => o.code)),
    [roomOptions],
  );
  const floorCodes = useMemo(
    () => new Set(optionsForKind(roomOptions, "floor").map((o) => o.code)),
    [roomOptions],
  );
  const defaultBuilding = optionsForKind(roomOptions, "building")[0]?.code ?? "1";
  const defaultFloor = optionsForKind(roomOptions, "floor")[0]?.code ?? "1";
  const defaultType = optionsForKind(roomOptions, "type")[0]?.code ?? "Superior";
  const defaultView = optionsForKind(roomOptions, "view")[0]?.code ?? "garden";
  const defaultBed = optionsForKind(roomOptions, "bed")[0]?.code ?? "king";
  const defaultSize =
    optionsForKind(roomOptions, "size")[0]?.value_num ??
    Number(optionsForKind(roomOptions, "size")[0]?.code ?? "35");

  useEffect(() => {
    if (mode === "edit" && room) {
      const facts = guestRoomDisplayFacts(room);
      setNumber(room.number);
      setBuilding(String(room.building));
      setFloor(String(room.floor));
      setType(room.type);
      setView(room.view);
      setAreaSqm(
        room.area_sqm != null ? String(room.area_sqm) : String(facts.areaSqm),
      );
      setBed(room.bed ?? facts.bed);
      setConnectingPeer(room.connecting_peer ?? facts.connectingPeer ?? "");
      return;
    }
    setNumber("");
    setBuilding(defaultBuilding);
    setFloor(defaultFloor);
    setType(defaultType);
    setView(defaultView);
    setAreaSqm(String(defaultSize));
    setBed(defaultBed);
    setConnectingPeer("");
  }, [mode, room?.id, defaultBuilding, defaultFloor, defaultType, defaultView, defaultSize, defaultBed]);

  useEffect(() => {
    const parsed = parseRoomNumberDigits(number, buildingCodes, floorCodes);
    if (!parsed) return;
    setBuilding(parsed.building);
    setFloor(parsed.floor);
  }, [number, buildingCodes, floorCodes]);

  useEffect(() => {
    setSaveError(null);
  }, [number]);

  const connectingOptions = useMemo(() => {
    return [...existingRooms]
      .filter((r) => r.number !== trimmedNumber)
      .sort((a, b) =>
        a.number.localeCompare(b.number, undefined, { numeric: true }),
      );
  }, [existingRooms, trimmedNumber]);

  const buildingChoiceGroups = useMemo(
    () => [
      {
        title: "",
        items: optionsForKind(roomOptions, "building").map((o) => ({
          value: o.code,
          label: roomOptionLabel(o, i18n.language),
        })),
      },
    ],
    [roomOptions, i18n.language],
  );

  const floorChoiceGroups = useMemo(
    () => [
      {
        title: "",
        items: optionsForKind(roomOptions, "floor").map((o) => ({
          value: o.code,
          label: roomOptionLabel(o, i18n.language),
        })),
      },
    ],
    [roomOptions, i18n.language],
  );

  const typeChoiceGroups = useMemo(
    () => [
      {
        title: "",
        items: optionsForKind(roomOptions, "type").map((o) => ({
          value: o.code,
          label: roomOptionLabel(o, i18n.language),
        })),
      },
    ],
    [roomOptions, i18n.language],
  );

  const viewChoiceGroups = useMemo(
    () => [
      {
        title: "",
        items: optionsForKind(roomOptions, "view").map((o) => ({
          value: o.code,
          label: roomOptionLabel(o, i18n.language),
        })),
      },
    ],
    [roomOptions, i18n.language],
  );

  const bedChoiceGroups = useMemo(
    () => [
      {
        title: "",
        items: optionsForKind(roomOptions, "bed").map((o) => ({
          value: o.code,
          label: roomOptionLabel(o, i18n.language),
        })),
      },
    ],
    [roomOptions, i18n.language],
  );

  const sizeChoiceGroups = useMemo(() => {
    const items = optionsForKind(roomOptions, "size").map((o) => {
      const sqm = String(o.value_num ?? o.code);
      return {
        value: sqm,
        label: t("rooms.sqm", { sqm }),
      };
    });
    const current = areaSqm.trim();
    if (current && !items.some((i) => i.value === current)) {
      items.push({ value: current, label: t("rooms.sqm", { sqm: current }) });
    }
    return [{ title: "", items }];
  }, [roomOptions, t, areaSqm]);

  const validSizeValues = useMemo(
    () =>
      new Set(
        optionsForKind(roomOptions, "size").map((o) =>
          String(o.value_num ?? o.code),
        ),
      ),
    [roomOptions],
  );

  const connectingChoiceGroups = useMemo(
    () => [
      {
        title: "",
        items: [
          { value: "", label: t("settings.guest_rooms_form_connecting_none") },
          ...connectingOptions.map((r) => ({
            value: r.number,
            label: r.number,
          })),
        ],
      },
    ],
    [connectingOptions, t],
  );

  const areaNum = Number(areaSqm);
  const areaValid =
    areaSqm.trim() !== "" &&
    Number.isFinite(areaNum) &&
    validSizeValues.has(String(areaNum));

  const actorId = current?.id;

  const save = useMutation({
    mutationFn: async () => {
      const base = {
        number: number.trim(),
        building: Number(building),
        floor: Number(floor),
        type,
        view,
        area_sqm: areaNum,
        bed,
        connecting_peer: connectingPeer.trim() || null,
        actor_id: actorId,
      };
      if (mode === "edit" && room) {
        return guestRoomsApi.update(room.id, base);
      }
      return guestRoomsApi.create({ ...base, active: true });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["guest-rooms"] });
      onClose();
    },
    onError: (err: Error) => {
      if (/duplicate/i.test(err.message)) {
        setSaveError(
          t("settings.guest_rooms_error_duplicate", { number: trimmedNumber }),
        );
      }
    },
  });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !save.isPending) onClose();
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose, save.isPending]);

  const title =
    mode === "add" ? t("settings.guest_rooms_add_title") : t("settings.guest_rooms_edit");
  const duplicateWarning =
    isDuplicate || saveError
      ? saveError ?? t("settings.guest_rooms_error_duplicate", { number: trimmedNumber })
      : null;
  const pickersReady =
    buildingChoiceGroups[0].items.length > 0 &&
    floorChoiceGroups[0].items.length > 0 &&
    typeChoiceGroups[0].items.length > 0 &&
    viewChoiceGroups[0].items.length > 0 &&
    bedChoiceGroups[0].items.length > 0 &&
    sizeChoiceGroups[0].items.length > 0;
  const numberValid =
    trimmedNumber.length >= ROOM_NUMBER_MIN_LEN &&
    trimmedNumber.length <= ROOM_NUMBER_MAX_LEN;
  const canSave = numberValid && !isDuplicate && areaValid && pickersReady;

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-black/45 px-4 py-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !save.isPending) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal
        aria-labelledby="guest-room-form-title"
        className="flex max-h-[min(36rem,92vh)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[color:var(--color-line)] bg-white shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[color:var(--color-line)] px-5 py-4">
          <h2
            id="guest-room-form-title"
            className="text-lg font-semibold tracking-tight text-[color:var(--color-ink)]"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={save.isPending}
            className="grid h-9 w-9 place-items-center rounded-lg text-[color:var(--color-ink-soft)] hover:bg-[color:var(--color-paper-2)] disabled:opacity-50"
            aria-label={t("common.close")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
          <label className="mx-auto block w-full max-w-[14rem]">
            <span className="sr-only">{t("settings.guest_rooms_table_number")}</span>
            <div
              className={clsx(
                "rounded-2xl border bg-[color:var(--color-paper)]/50 px-4 py-3.5 shadow-sm transition",
                duplicateWarning
                  ? "border-red-300 bg-red-50/40 focus-within:border-red-400 focus-within:ring-2 focus-within:ring-red-200/80"
                  : "border-[color:var(--color-line)] focus-within:border-[color:var(--color-ink)]/20 focus-within:bg-white focus-within:ring-2 focus-within:ring-[color:var(--color-ink)]/10",
              )}
            >
              <input
                value={number}
                onChange={(e) => setNumber(filterRoomNumberInput(e.target.value))}
                minLength={ROOM_NUMBER_MIN_LEN}
                maxLength={ROOM_NUMBER_MAX_LEN}
                placeholder={t("settings.guest_rooms_number_ph")}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                autoFocus={mode === "add"}
                aria-invalid={Boolean(duplicateWarning)}
                aria-describedby={duplicateWarning ? "guest-room-number-error" : undefined}
                className="w-full min-h-[2.75rem] border-0 bg-transparent text-center font-mono text-2xl font-semibold uppercase tracking-wide text-[color:var(--color-ink)] placeholder:text-lg placeholder:normal-case placeholder:tracking-normal placeholder:text-[color:var(--color-ink-muted)]/45 focus:outline-none"
              />
            </div>
            {duplicateWarning ? (
              <p
                id="guest-room-number-error"
                role="alert"
                className="mt-2 text-center text-sm font-medium text-red-600"
              >
                {duplicateWarning}
              </p>
            ) : null}
          </label>

          <div className="grid grid-cols-3 gap-3">
            <FormField label={t("settings.guest_rooms_table_building")}>
              <GroupedChoicePicker
                value={building}
                onChange={setBuilding}
                groups={buildingChoiceGroups}
                ariaLabel={t("settings.guest_rooms_table_building")}
                className={formPickerClass}
              />
            </FormField>
            <FormField label={t("settings.guest_rooms_table_floor")}>
              <GroupedChoicePicker
                value={floor}
                onChange={setFloor}
                groups={floorChoiceGroups}
                ariaLabel={t("settings.guest_rooms_table_floor")}
                className={formPickerClass}
              />
            </FormField>
            <FormField label={t("settings.guest_rooms_table_type")}>
              <GroupedChoicePicker
                value={type}
                onChange={setType}
                groups={typeChoiceGroups}
                ariaLabel={t("settings.guest_rooms_table_type")}
                className={formPickerClass}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <FormField label={t("settings.guest_rooms_table_view")}>
              <GroupedChoicePicker
                value={view}
                onChange={setView}
                groups={viewChoiceGroups}
                ariaLabel={t("settings.guest_rooms_table_view")}
                className={formPickerClass}
              />
            </FormField>
            <FormField label={t("settings.guest_rooms_table_bed")}>
              <GroupedChoicePicker
                value={bed}
                onChange={setBed}
                groups={bedChoiceGroups}
                ariaLabel={t("settings.guest_rooms_table_bed")}
                className={formPickerClass}
              />
            </FormField>
            <FormField label={t("settings.guest_rooms_table_connecting")}>
              <GroupedChoicePicker
                value={connectingPeer}
                onChange={setConnectingPeer}
                groups={connectingChoiceGroups}
                ariaLabel={t("settings.guest_rooms_table_connecting")}
                className={formPickerClass}
                menuMinWidth={112}
              />
            </FormField>
            <FormField label={t("settings.guest_rooms_table_size")}>
              <GroupedChoicePicker
                value={areaSqm}
                onChange={setAreaSqm}
                groups={sizeChoiceGroups}
                ariaLabel={t("settings.guest_rooms_table_size")}
                className={formPickerClass}
              />
            </FormField>
          </div>

        </div>

        <div className="grid w-full shrink-0 grid-cols-4 gap-2 border-t border-[color:var(--color-line)] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={save.isPending}
            className="col-span-1 flex h-10 w-full items-center justify-center rounded-xl border border-[color:var(--color-line)] bg-white text-sm font-medium shadow-sm hover:bg-[color:var(--color-paper-2)] disabled:opacity-50"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            disabled={!canSave || save.isPending}
            onClick={() => save.mutate()}
            className="col-span-3 flex h-10 w-full items-center justify-center rounded-xl bg-[color:var(--color-ink)] text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
          >
            {save.isPending ? t("common.loading") : t("common.save")}
          </button>
        </div>
      </div>
    </div>
  );
}

function GuestRoomDeleteConfirmModal({
  room,
  pending,
  onClose,
  onConfirm,
}: {
  room: GuestRoom;
  pending?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !pending) onClose();
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose, pending]);

  return (
    <div
      className="fixed inset-0 z-[110] grid place-items-center bg-black/45 px-4 py-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !pending) onClose();
      }}
    >
      <div
        role="alertdialog"
        aria-modal
        aria-labelledby="guest-room-delete-title"
        aria-describedby="guest-room-delete-desc"
        className="w-full max-w-sm rounded-2xl border border-[color:var(--color-line)] bg-white p-5 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          <h2
            id="guest-room-delete-title"
            className="text-lg font-semibold tracking-tight text-[color:var(--color-ink)]"
          >
            {t("settings.guest_rooms_delete_confirm_title")}
          </h2>
          <p className="mt-5 font-mono text-4xl font-semibold tabular-nums tracking-[0.15em] text-[color:var(--color-ink)]">
            {room.number}
          </p>
          <p
            id="guest-room-delete-desc"
            className="mt-4 text-sm leading-relaxed text-[color:var(--color-ink-muted)]"
          >
            {t("settings.guest_rooms_delete_confirm_prompt")}
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-[color:var(--color-ink-muted)]/90">
            {t("settings.guest_rooms_delete_confirm_note")}
          </p>
        </div>
        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="flex-1 rounded-xl border border-[color:var(--color-line)] py-2.5 text-sm font-medium hover:bg-[color:var(--color-paper-2)] disabled:opacity-50"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {pending ? t("common.loading") : t("settings.guest_rooms_delete")}
          </button>
        </div>
      </div>
    </div>
  );
}

type GuestRoomsManagerProps = {
  addOpen: boolean;
  onAddOpenChange: (open: boolean) => void;
};

export function GuestRoomsManager({ addOpen, onAddOpenChange }: GuestRoomsManagerProps) {
  const { t, i18n } = useTranslation();
  const { current } = useAuth();
  const qc = useQueryClient();
  const { data: roomOptions = [] } = useRoomOptions();
  const [search, setSearch] = useState("");
  const [buildingFilter, setBuildingFilter] = useState<BuildingFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [bedFilter, setBedFilter] = useState<BedFilter>("all");
  const [connectingFilter, setConnectingFilter] = useState<ConnectingFilter>("all");
  const [sortKey, setSortKey] = useState<RoomSortKey | null>("number");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [editTarget, setEditTarget] = useState<GuestRoom | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GuestRoom | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["guest-rooms"],
    queryFn: () => guestRoomsApi.list(),
  });

  const actorId = current?.id;

  const removeMut = useMutation({
    mutationFn: (id: number) => guestRoomsApi.remove(id, actorId),
    onSuccess: () => {
      setDeleteTarget(null);
      void qc.invalidateQueries({ queryKey: ["guest-rooms"] });
    },
  });

  const buildingFilters = useMemo(
    () => ["all", ...optionsForKind(roomOptions, "building").map((o) => o.code)],
    [roomOptions],
  );
  const typeFilters = useMemo(
    () => ["all", ...optionsForKind(roomOptions, "type").map((o) => o.code)],
    [roomOptions],
  );
  const bedFilters = useMemo(
    () => ["all", ...optionsForKind(roomOptions, "bed").map((o) => o.code)],
    [roomOptions],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (buildingFilter !== "all" && String(r.building) !== buildingFilter) return false;
      if (typeFilter !== "all" && r.type !== typeFilter) return false;
      const facts = roomSortFacts(r);
      if (bedFilter !== "all" && facts.bed !== bedFilter) return false;
      if (connectingFilter === "yes" && !facts.connectingPeer) return false;
      if (connectingFilter === "no" && facts.connectingPeer) return false;
      if (!q) return true;
      const typeLabel = displayLabelForRoomField(
        roomOptions,
        "type",
        r.type,
        i18n.language,
        roomFieldFallback("type", t),
      );
      const viewLabel = displayLabelForRoomField(
        roomOptions,
        "view",
        r.view,
        i18n.language,
        roomFieldFallback("view", t),
      );
      const bedLabel = displayLabelForRoomField(
        roomOptions,
        "bed",
        facts.bed,
        i18n.language,
        roomFieldFallback("bed", t),
      );
      const buildingLabel =
        displayLabelForRoomField(
          roomOptions,
          "building",
          String(r.building),
          i18n.language,
        ) || `${t("rooms.building")} ${r.building}`;
      const hay = [
        r.number,
        String(r.building),
        String(r.floor),
        r.type,
        typeLabel,
        r.view,
        viewLabel,
        String(facts.areaSqm),
        t("rooms.sqm", { sqm: facts.areaSqm }),
        facts.bed,
        bedLabel,
        facts.connectingPeer ?? "",
        r.active ? t("settings.guest_rooms_active") : t("settings.guest_rooms_inactive"),
        buildingLabel,
        `${t("rooms.floor")} ${r.floor}`,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [
    rows,
    search,
    buildingFilter,
    typeFilter,
    bedFilter,
    connectingFilter,
    roomOptions,
    i18n.language,
    t,
  ]);

  const sorted = useMemo(() => {
    const key = sortKey ?? "number";
    return [...filtered].sort((a, b) => compareRooms(a, b, key, sortDir));
  }, [filtered, sortKey, sortDir]);

  const onSort = (column: RoomSortKey) => {
    if (sortKey === column) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(column);
    setSortDir("asc");
  };

  const {
    pageItems,
    setPage,
    pageSize,
    setPageSize,
    currentPage,
    totalPages,
    totalRows,
    rangeFrom,
    rangeTo,
  } = useClientPagination(sorted, [
    search,
    buildingFilter,
    typeFilter,
    bedFilter,
    connectingFilter,
    sortKey,
    sortDir,
  ]);

  const showEmptyResults = !isLoading && rows.length > 0 && totalRows === 0;
  const showEmptyList = !isLoading && rows.length === 0;

  return (
    <>
      {addOpen && (
        <GuestRoomFormModal
          mode="add"
          room={null}
          existingRooms={rows}
          roomOptions={roomOptions}
          onClose={() => onAddOpenChange(false)}
        />
      )}
      {editTarget && (
        <GuestRoomFormModal
          mode="edit"
          room={editTarget}
          existingRooms={rows}
          roomOptions={roomOptions}
          onClose={() => setEditTarget(null)}
        />
      )}
      {deleteTarget && (
        <GuestRoomDeleteConfirmModal
          room={deleteTarget}
          pending={removeMut.isPending}
          onClose={() => {
            if (!removeMut.isPending) setDeleteTarget(null);
          }}
          onConfirm={() => removeMut.mutate(deleteTarget.id)}
        />
      )}

      <section className="min-w-0 overflow-hidden rounded-xl border border-[color:var(--color-line)] bg-white shadow-sm">
        <div className="flex flex-col gap-3 p-3 sm:p-4">
          <div className="relative w-full">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--color-ink-muted)]"
              aria-hidden
            />
            <input
              type="text"
              role="search"
              autoComplete="off"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("settings.guest_rooms_search_placeholder")}
              className="h-9 w-full rounded-lg border border-[color:var(--color-line)] bg-white py-2 pl-9 pr-9 text-sm transition focus:border-[color:var(--color-ink)]/20 focus:outline-none focus:ring-2 focus:ring-[color:var(--color-ink)]/10"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-[color:var(--color-ink-muted)] hover:bg-[color:var(--color-paper-2)] hover:text-[color:var(--color-ink)]"
                aria-label={t("common.close")}
              >
                <X className="h-3.5 w-3.5" strokeWidth={2.25} />
              </button>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
              <p className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--color-ink-muted)]">
                {t("settings.guest_rooms_filter_building_label")}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {buildingFilters.map((b) => {
                  const active = buildingFilter === b;
                  const opt = roomOptions.find(
                    (o) => o.kind === "building" && o.code === b,
                  );
                  return (
                    <button
                      key={b}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setBuildingFilter(b)}
                      className={chipButtonClass(active)}
                    >
                      {b === "all"
                        ? t("stock.filter_all")
                        : opt
                          ? roomOptionLabel(opt, i18n.language)
                          : `${t("rooms.building")} ${b}`}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
              <p className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--color-ink-muted)]">
                {t("settings.guest_rooms_filter_type_label")}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {typeFilters.map((tp) => {
                  const active = typeFilter === tp;
                  const opt = roomOptions.find(
                    (o) => o.kind === "type" && o.code === tp,
                  );
                  return (
                    <button
                      key={tp}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setTypeFilter(tp)}
                      className={chipButtonClass(active)}
                    >
                      {tp === "all"
                        ? t("stock.filter_all")
                        : opt
                          ? roomOptionLabel(opt, i18n.language)
                          : tp}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
              <p className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--color-ink-muted)]">
                {t("settings.guest_rooms_filter_bed_label")}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {bedFilters.map((bd) => {
                  const active = bedFilter === bd;
                  const opt = roomOptions.find(
                    (o) => o.kind === "bed" && o.code === bd,
                  );
                  return (
                    <button
                      key={bd}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setBedFilter(bd)}
                      className={chipButtonClass(active)}
                    >
                      {bd === "all"
                        ? t("stock.filter_all")
                        : opt
                          ? roomOptionLabel(opt, i18n.language)
                          : bd}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
              <p className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--color-ink-muted)]">
                {t("settings.guest_rooms_filter_connecting_label")}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {CONNECTING_FILTERS.map((cn) => {
                  const active = connectingFilter === cn;
                  return (
                    <button
                      key={cn}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setConnectingFilter(cn)}
                      className={chipButtonClass(active)}
                    >
                      {cn === "all"
                        ? t("stock.filter_all")
                        : cn === "yes"
                          ? t("settings.guest_rooms_filter_connecting_yes")
                          : t("settings.guest_rooms_filter_connecting_no")}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div
        className={clsx(
          "flex min-h-[18rem] flex-col overflow-hidden rounded-xl border border-[color:var(--color-line)] bg-white",
          (showEmptyResults || showEmptyList) && "flex-1",
        )}
      >
        <div
          className={clsx(
            "hidden gap-x-4 gap-y-3 border-b border-[color:var(--color-line)] px-4 py-2 md:grid",
            ROOMS_TABLE_GRID,
          )}
        >
          <RoomSortableHeader
            label={t("settings.guest_rooms_table_number")}
            column="number"
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={onSort}
          />
          <RoomSortableHeader
            label={t("settings.guest_rooms_table_building")}
            column="building"
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={onSort}
            align="center"
          />
          <RoomSortableHeader
            label={t("settings.guest_rooms_table_floor")}
            column="floor"
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={onSort}
            align="center"
          />
          <RoomSortableHeader
            label={t("settings.guest_rooms_table_type")}
            column="type"
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={onSort}
          />
          <RoomSortableHeader
            label={t("settings.guest_rooms_table_view")}
            column="view"
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={onSort}
          />
          <RoomSortableHeader
            label={t("settings.guest_rooms_table_size")}
            column="areaSqm"
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={onSort}
            align="center"
          />
          <RoomSortableHeader
            label={t("settings.guest_rooms_table_bed")}
            column="bed"
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={onSort}
          />
          <RoomSortableHeader
            label={t("settings.guest_rooms_table_connecting")}
            column="connecting"
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={onSort}
          />
          <span aria-hidden className="hidden md:block" />
          <span className="self-center text-right text-xs font-medium text-[color:var(--color-ink-muted)]">
            {t("users.table.actions")}
          </span>
        </div>

        <ul
          className={clsx(
            "min-h-0 flex-1 divide-y divide-[color:var(--color-line)]/90 overflow-y-auto",
            (showEmptyList || showEmptyResults) && "flex flex-col",
          )}
        >
          {isLoading && (
            <li className="px-4 py-6 text-sm text-[color:var(--color-ink-muted)]">
              {t("common.loading")}
            </li>
          )}
          {showEmptyList && (
            <li className="flex flex-1 flex-col items-center justify-center px-4 py-10 text-center">
              <BedDouble
                className="mb-3 h-14 w-14 text-[color:var(--color-ink-muted)]/35"
                strokeWidth={1.25}
                aria-hidden
              />
              <p className="text-base font-medium text-[color:var(--color-ink-soft)]">
                {t("settings.guest_rooms_empty")}
              </p>
            </li>
          )}
          {showEmptyResults && (
            <li className="flex flex-1 flex-col items-center justify-center px-4 py-10 text-center">
              <SearchX
                className="mb-3 h-14 w-14 text-[color:var(--color-ink-muted)]/35"
                strokeWidth={1.25}
                aria-hidden
              />
              <p className="text-base font-medium text-[color:var(--color-ink-soft)]">
                {t("settings.guest_rooms_no_results")}
              </p>
              <p className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-[color:var(--color-ink-muted)]">
                {t("settings.guest_rooms_no_results_sub")}
              </p>
            </li>
          )}
          {!isLoading &&
            !showEmptyList &&
            !showEmptyResults &&
            pageItems.map((r) => {
              const facts = roomSortFacts(r);
              const inactive = !r.active;
              const struck = inactive
                ? "line-through decoration-[color:var(--color-ink-soft)]"
                : undefined;
              return (
                <li
                  key={r.id}
                  className={clsx(inactive && "bg-[color:var(--color-paper-2)]/70")}
                >
                  <div
                    className={clsx(
                      "grid items-center gap-x-4 gap-y-2 px-4 py-3 text-sm",
                      ROOMS_TABLE_GRID,
                      inactive && "text-[color:var(--color-ink-muted)]",
                    )}
                  >
                    <span
                      className={clsx(
                        "min-w-0 truncate font-mono text-base font-semibold tabular-nums",
                        struck,
                      )}
                    >
                      {r.number}
                    </span>
                    <span className={clsx("text-center tabular-nums", struck)}>{r.building}</span>
                    <span className={clsx("text-center tabular-nums", struck)}>{r.floor}</span>
                    <span className={clsx("min-w-0 truncate", struck)}>
                      {displayLabelForRoomField(
                        roomOptions,
                        "type",
                        r.type,
                        i18n.language,
                        roomFieldFallback("type", t),
                      )}
                    </span>
                    <span className={clsx("min-w-0 truncate", struck)}>
                      {displayLabelForRoomField(
                        roomOptions,
                        "view",
                        r.view,
                        i18n.language,
                        roomFieldFallback("view", t),
                      )}
                    </span>
                    <span
                      className={clsx(
                        "block text-center tabular-nums text-xs justify-self-center",
                        struck,
                      )}
                    >
                      {t("rooms.sqm", { sqm: facts.areaSqm })}
                    </span>
                    <span className={clsx("min-w-0 truncate text-xs", struck)}>
                      {displayLabelForRoomField(
                        roomOptions,
                        "bed",
                        facts.bed,
                        i18n.language,
                        roomFieldFallback("bed", t),
                      )}
                    </span>
                    <span className={clsx("min-w-0 truncate font-mono text-xs tabular-nums", struck)}>
                      {facts.connectingPeer ?? "—"}
                    </span>
                    <span aria-hidden className="hidden md:block" />
                    <span className="flex justify-end gap-1">
                      <HoverTooltip label={t("settings.guest_rooms_edit")}>
                        <button
                          type="button"
                          onClick={() => setEditTarget(r)}
                          className="grid h-8 w-8 place-items-center rounded-md border border-[color:var(--color-line)] hover:bg-[color:var(--color-paper-2)]"
                          aria-label={t("settings.guest_rooms_edit")}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </HoverTooltip>
                      <HoverTooltip label={t("settings.guest_rooms_delete")}>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(r)}
                          disabled={removeMut.isPending}
                          className="grid h-8 w-8 place-items-center rounded-md border border-[color:var(--color-line)] hover:bg-red-50 disabled:opacity-50"
                          aria-label={t("settings.guest_rooms_delete")}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-red-600/90" />
                        </button>
                      </HoverTooltip>
                    </span>
                  </div>
                </li>
              );
            })}
        </ul>

        <ListPaginationFooter
          hidden={isLoading || showEmptyList || showEmptyResults}
          totalRows={totalRows}
          rangeFrom={rangeFrom}
          rangeTo={rangeTo}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      </div>
    </>
  );
}
