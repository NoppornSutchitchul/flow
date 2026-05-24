import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bed,
  BellRing,
  Building2,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  DoorClosed,
  Minus,
  Package2,
  Plus,
  Search,
  Wrench,
  X,
} from "lucide-react";
import clsx from "clsx";
import type { ComponentType, CSSProperties } from "react";

import { ApiError, assignableStaffApi, productsApi, requestsApi, stockApi, usersApi } from "../../lib/api";
import { syncRequestAfterMutation } from "../../lib/requestCache";
import { isInsufficientStockDetail } from "../../lib/stockErrors";
import { isNoStaffAvailableError } from "../../lib/staffAvailabilityErrors";
import {
  assignableUsers,
  assignableUsersForRoom,
  sortedZoneGroups,
  type AssignableDept,
} from "../../lib/assignees";
import { useHotelLocations } from "../../lib/hotelLocations";
import { useGuestRooms } from "../../lib/guestRooms";
import { isValidQuickRoomLocation } from "../../lib/rooms";
import { ProductItemIcon } from "../../lib/productIcons";
import { sortLocaleForApp } from "../../lib/locale";
import { productDisplayName } from "../../lib/productDisplayName";
import type { DeliveryMethod, Product, RequestDetail } from "../../lib/types";
import { DeliverySchedulePicker } from "../requests/DeliverySchedulePicker";
import { AnimateCollapse, COLLAPSE_DURATION_MS } from "../ui/AnimateCollapse";
import { AnimateResize } from "../ui/AnimateResize";
import { RoomCombobox } from "../hotel/RoomCombobox";
import { StaffAssigneePicker } from "../users/StaffAssigneePicker";
import {
  buildScheduleApiFields,
  type ScheduleMode,
} from "../../lib/requestSchedule";

// Icon + label key per delivery method. Keeps both the dropdown and the
// split-button face in sync.
const QUICK_DEPT_HEADER_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  housekeeping: Bed,
  maintenance: Wrench,
  front_office: Building2,
  bell_boy: BellRing,
};

const METHODS: { value: DeliveryMethod; icon: ComponentType<{ className?: string }> }[] = [
  { value: "ring_bell", icon: BellRing },
  { value: "leave_at_door", icon: DoorClosed },
  { value: "front_desk", icon: Building2 },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (req: RequestDetail) => void;
  creatorId?: number;
}

interface PickedItem {
  product: Product;
  qty: number;
  note: string;
}

/** Items per carousel page before the list would crowd the modal. */
const PICKED_ITEMS_PER_PAGE = 3;
/** Visible width per page — remainder peeks the next page on the right. */
const PICKED_PAGE_WIDTH = "88%";

export function QuickRequestModal({ open, onClose, onCreated, creatorId }: Props) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [room, setRoom] = useState("");
  const [picked, setPicked] = useState<PickedItem[]>([]);
  const [search, setSearch] = useState("");
  const [showList, setShowList] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outOfStockIds, setOutOfStockIds] = useState<Set<number>>(() => new Set());
  const [removingProductIds, setRemovingProductIds] = useState<Set<number>>(
    () => new Set(),
  );
  const [method, setMethod] = useState<DeliveryMethod>("ring_bell");
  const [methodOpen, setMethodOpen] = useState(false);
  const [prefHkId, setPrefHkId] = useState<number | "">("");
  const [prefMtId, setPrefMtId] = useState<number | "">("");
  const [prefFoId, setPrefFoId] = useState<number | "">("");
  const [prefBbId, setPrefBbId] = useState<number | "">("");
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>("immediate");
  const [delayMinutes, setDelayMinutes] = useState(30);
  const [atTime, setAtTime] = useState("10:00");
  const [pickedPage, setPickedPage] = useState(0);
  const productPickerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const productListPortalRef = useRef<HTMLUListElement>(null);
  const methodMenuRef = useRef<HTMLDivElement>(null);
  const methodTriggerRef = useRef<HTMLButtonElement>(null);
  const methodMenuPortalRef = useRef<HTMLUListElement>(null);
  const scheduleTriggerRef = useRef<HTMLButtonElement>(null);
  const prevPickedLenRef = useRef(0);
  const [methodMenuStyle, setMethodMenuStyle] = useState<CSSProperties | null>(null);
  const [productListStyle, setProductListStyle] = useState<CSSProperties | null>(null);

  const updateMethodMenuPosition = useCallback(() => {
    const el = methodTriggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setMethodMenuStyle({
      position: "fixed",
      right: window.innerWidth - rect.right,
      top: rect.bottom + 6,
      minWidth: "14rem",
      zIndex: 200,
    });
  }, []);

  const updateProductListPosition = useCallback(() => {
    const el = searchInputRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const maxH = Math.min(320, window.innerHeight - rect.bottom - 16);
    setProductListStyle({
      position: "fixed",
      left: rect.left,
      top: rect.bottom + 4,
      width: rect.width,
      maxHeight: Math.max(120, maxH),
      zIndex: 200,
    });
  }, []);

  // Close the method menu when clicking outside of it.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const target = e.target as Node;
      if (
        methodMenuRef.current?.contains(target) ||
        methodMenuPortalRef.current?.contains(target)
      ) {
        return;
      }
      setMethodOpen(false);
    }
    if (methodOpen) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [methodOpen, updateMethodMenuPosition]);

  useLayoutEffect(() => {
    if (!methodOpen) {
      setMethodMenuStyle(null);
      return;
    }
    updateMethodMenuPosition();
    window.addEventListener("resize", updateMethodMenuPosition);
    window.addEventListener("scroll", updateMethodMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateMethodMenuPosition);
      window.removeEventListener("scroll", updateMethodMenuPosition, true);
    };
  }, [methodOpen, updateMethodMenuPosition]);

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: productsApi.list,
    enabled: open,
  });

  const { data: userList = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => usersApi.list(),
    enabled: open,
  });

  const { data: hotelLocations = [] } = useHotelLocations(true);
  const { data: guestRooms = [] } = useGuestRooms(true);
  const hotelCodes = useMemo(
    () => hotelLocations.map((loc) => loc.code),
    [hotelLocations],
  );

  // Reset state on close
  useEffect(() => {
    if (!open) {
      setRoom("");
      setPicked([]);
      setSearch("");
      setShowList(false);
      setError(null);
      setOutOfStockIds(new Set());
      setRemovingProductIds(new Set());
      setMethod("ring_bell");
      setMethodOpen(false);
      setProductListStyle(null);
      setPrefHkId("");
      setPrefMtId("");
      setScheduleMode("immediate");
      setDelayMinutes(30);
      setAtTime("10:00");
      setPickedPage(0);
      prevPickedLenRef.current = 0;
    }
  }, [open]);

  // ESC closes the delivery picker first so it does not silently eat the keystroke.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (methodOpen) {
        setMethodOpen(false);
        return;
      }
      if (showList) {
        setShowList(false);
        return;
      }
      onClose();
    }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, methodOpen, showList, onClose]);

  // Group picked items by department to decide whether we need 1 or 2 requests
  const byDept = useMemo(() => {
    const groups = new Map<string, PickedItem[]>();
    for (const p of picked) {
      const dept = p.product.department;
      if (!groups.has(dept)) groups.set(dept, []);
      groups.get(dept)!.push(p);
    }
    return groups;
  }, [picked]);

  const willSplit = byDept.size > 1;

  const AssignHeaderIcon = useMemo(() => {
    if (willSplit) return Package2;
    const sole = Array.from(byDept.keys())[0];
    if (sole) return QUICK_DEPT_HEADER_ICONS[sole] ?? Package2;
    return Bed;
  }, [byDept, willSplit]);

  const showHkAssign =
    picked.length === 0 || byDept.has("housekeeping");
  const showMtAssign = byDept.has("maintenance");
  const showFoAssign = byDept.has("front_office");
  const showBbAssign = byDept.has("bell_boy");

  const deptsNeedingStaff = useMemo((): AssignableDept[] => {
    const out: AssignableDept[] = [];
    if (showHkAssign) out.push("housekeeping");
    if (showMtAssign) out.push("maintenance");
    if (showFoAssign) out.push("front_office");
    if (showBbAssign) out.push("bell_boy");
    return out;
  }, [showHkAssign, showMtAssign, showFoAssign, showBbAssign]);

  const roomReady = isValidQuickRoomLocation(room.trim(), hotelCodes, guestRooms);

  const pickedProductIds = useMemo(
    () => picked.map((p) => p.product.id),
    [picked],
  );

  const { data: assignableStaff } = useQuery({
    queryKey: [
      "assignable-staff",
      room.trim(),
      deptsNeedingStaff.join(","),
      pickedProductIds.join(","),
    ],
    queryFn: () =>
      assignableStaffApi.check(room.trim(), deptsNeedingStaff, pickedProductIds),
    enabled: open && roomReady && deptsNeedingStaff.length > 0,
    refetchInterval: open ? 15_000 : false,
  });

  const onlineStaffIds = (dept: AssignableDept): Set<number> | null => {
    if (!assignableStaff) return null;
    return new Set(assignableStaff.departments[dept]?.user_ids ?? []);
  };

  const filterOnlinePool = (pool: typeof userList, dept: AssignableDept) => {
    const ids = onlineStaffIds(dept);
    if (!ids) return pool;
    return pool.filter((u) => ids.has(u.id));
  };

  const hkPool = filterOnlinePool(
    assignableUsersForRoom(
      "housekeeping",
      userList,
      room,
      guestRooms,
      hotelCodes,
    ),
    "housekeeping",
  );
  const mtPool = filterOnlinePool(
    assignableUsers("maintenance", userList),
    "maintenance",
  );
  const foPool = filterOnlinePool(
    assignableUsers("front_office", userList),
    "front_office",
  );
  const bbPool = filterOnlinePool(
    assignableUsers("bell_boy", userList),
    "bell_boy",
  );

  const hkZoneGroups = sortedZoneGroups(hkPool, t("quick.zone_no"), {
    room,
    guestRooms,
  });
  const mtZoneGroups = sortedZoneGroups(mtPool, t("quick.zone_no"));
  const foZoneGroups = sortedZoneGroups(foPool, t("quick.zone_no"));
  const bbZoneGroups = sortedZoneGroups(bbPool, t("quick.zone_no"));

  const preferredAssigneeForDept = (dept: string): number | "" => {
    switch (dept) {
      case "housekeeping":
        return prefHkId;
      case "maintenance":
        return prefMtId;
      case "front_office":
        return prefFoId;
      case "bell_boy":
        return prefBbId;
      default:
        return "";
    }
  };

  useEffect(() => {
    if (prefHkId === "") return;
    if (!hkPool.some((u) => u.id === prefHkId)) setPrefHkId("");
  }, [room, hkPool, prefHkId]);

  useEffect(() => {
    if (prefFoId === "") return;
    if (!foPool.some((u) => u.id === prefFoId)) setPrefFoId("");
  }, [foPool, prefFoId]);

  useEffect(() => {
    if (prefBbId === "") return;
    if (!bbPool.some((u) => u.id === prefBbId)) setPrefBbId("");
  }, [bbPool, prefBbId]);

  const pickedPages = useMemo(() => {
    const pages: PickedItem[][] = [];
    for (let i = 0; i < picked.length; i += PICKED_ITEMS_PER_PAGE) {
      pages.push(picked.slice(i, i + PICKED_ITEMS_PER_PAGE));
    }
    return pages;
  }, [picked]);

  const pickedPaginated = picked.length > PICKED_ITEMS_PER_PAGE;

  useEffect(() => {
    const lastPage = Math.max(0, pickedPages.length - 1);
    if (picked.length > prevPickedLenRef.current) {
      setPickedPage(lastPage);
    } else {
      setPickedPage((cur) => Math.min(cur, lastPage));
    }
    prevPickedLenRef.current = picked.length;
  }, [picked.length, pickedPages.length]);

  const noStaffAvailable =
    roomReady &&
    deptsNeedingStaff.length > 0 &&
    assignableStaff != null &&
    deptsNeedingStaff.some((dept) => !assignableStaff.departments[dept]?.available);

  const staffCheckReady =
    !roomReady || deptsNeedingStaff.length === 0 || assignableStaff != null;

  const showAssigneeBlock =
    staffCheckReady &&
    !noStaffAvailable &&
    ((showHkAssign && hkPool.length > 0) ||
      (showMtAssign && mtPool.length > 0) ||
      (showFoAssign && foPool.length > 0) ||
      (showBbAssign && bbPool.length > 0));

  // Filter the item picker — services don't get qty controls, supplies do
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const taken = new Set(picked.map((p) => p.product.id));
    return products
      .filter((p) => p.active)
      .filter((p) => !taken.has(p.id))
      .filter(
        (p) =>
          !q ||
          p.name.toLowerCase().includes(q) ||
          (p.name_en ?? "").toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q),
      )
      .sort(
        (a, b) =>
          a.department.localeCompare(b.department) ||
          productDisplayName(a, i18n.language).localeCompare(
            productDisplayName(b, i18n.language),
            sortLocaleForApp(i18n.language),
          ),
      );
  }, [products, picked, search, i18n.language]);

  useLayoutEffect(() => {
    if (!showList || filtered.length === 0) {
      setProductListStyle(null);
      return;
    }
    updateProductListPosition();
    window.addEventListener("resize", updateProductListPosition);
    window.addEventListener("scroll", updateProductListPosition, true);
    return () => {
      window.removeEventListener("resize", updateProductListPosition);
      window.removeEventListener("scroll", updateProductListPosition, true);
    };
  }, [showList, filtered.length, updateProductListPosition]);

  const pickedStockLines = useMemo(
    () => picked
      .filter((p) => !p.product.is_service)
      .map((p) => ({ product_id: p.product.id, qty: p.qty })),
    [picked],
  );
  const pickedStockKey = useMemo(
    () => pickedStockLines.map((p) => `${p.product_id}:${p.qty}`).join(","),
    [pickedStockLines],
  );

  useEffect(() => {
    if (!open) return;
    if (!pickedStockKey) {
      setOutOfStockIds(new Set());
      return;
    }
    const timer = window.setTimeout(() => {
      stockApi
        .check(pickedStockLines)
        .then(() => setOutOfStockIds(new Set()))
        .catch((e) => {
          if (e instanceof ApiError && isInsufficientStockDetail(e.payload)) {
            setOutOfStockIds(
              new Set(e.payload.products.map((x) => x.product_id)),
            );
          }
        });
    }, 200);
    return () => window.clearTimeout(timer);
  }, [open, pickedStockKey, pickedStockLines]);

  const updateQty = (productId: number, delta: number) => {
    setPicked((cur) =>
      cur
        .map((p) =>
          p.product.id === productId
            ? { ...p, qty: Math.max(1, p.qty + delta) }
            : p,
        )
        // Cap qty at 20 to keep the prototype sane
        .map((p) => ({ ...p, qty: Math.min(p.qty, 20) })),
    );
  };

  const updateItemNote = (productId: number, note: string) => {
    setPicked((cur) =>
      cur.map((p) =>
        p.product.id === productId ? { ...p, note } : p,
      ),
    );
  };

  const removePickedItem = (productId: number) => {
    setRemovingProductIds((cur) => new Set(cur).add(productId));
    window.setTimeout(() => {
      setPicked((cur) => cur.filter((x) => x.product.id !== productId));
      setOutOfStockIds((cur) => {
        if (!cur.has(productId)) return cur;
        const next = new Set(cur);
        next.delete(productId);
        return next;
      });
      setRemovingProductIds((cur) => {
        const next = new Set(cur);
        next.delete(productId);
        return next;
      });
    }, COLLAPSE_DURATION_MS);
  };

  const submit = useMutation({
    mutationFn: async () => {
      if (!isValidQuickRoomLocation(room.trim(), hotelCodes, guestRooms)) {
        throw new Error(t("quick.no_room"));
      }

      const scheduleFields = buildScheduleApiFields(
        scheduleMode,
        delayMinutes,
        atTime,
      );

      const groups = Array.from(byDept.values());
      // Free-text fallback when nothing was picked from the catalogue
      if (groups.length === 0) {
        const detail = await requestsApi.create({
          room: room.trim(),
          custom_items: search.trim() || undefined,
          delivery_method: method,
          created_by_id: creatorId,
          auto_assign: true,
          preferred_assignee_id: prefHkId === "" ? undefined : prefHkId,
          ...scheduleFields,
        });
        syncRequestAfterMutation(qc, detail);
        return [detail];
      }

      const allLines = groups.flatMap((group) =>
        group.map((p) => ({ product_id: p.product.id, qty: p.qty })),
      );
      await stockApi.check(allLines);

      // One POST per department so housekeeping & maintenance stay split
      const created: RequestDetail[] = [];
      for (const group of groups) {
        const dept = group[0]!.product.department as AssignableDept;
        const prefId = preferredAssigneeForDept(dept);
        created.push(
          await requestsApi.create({
            room: room.trim(),
            items: group.map((p) => ({
              product_id: p.product.id,
              qty: p.qty,
              ...(p.note.trim() ? { note: p.note.trim() } : {}),
            })),
            delivery_method: method,
            created_by_id: creatorId,
            auto_assign: true,
            preferred_assignee_id: prefId === "" ? undefined : prefId,
            ...scheduleFields,
          }),
        );
        syncRequestAfterMutation(qc, created[created.length - 1]!);
      }
      return created;
    },
    onSuccess: (created) => {
      setError(null);
      setOutOfStockIds(new Set());
      onCreated(created[created.length - 1]!);
    },
    onError: (e: Error) => {
      if (e instanceof ApiError && isInsufficientStockDetail(e.payload)) {
        setOutOfStockIds(
          new Set(e.payload.products.map((x) => x.product_id)),
        );
        setError(null);
        return;
      }
      if (e instanceof ApiError && isNoStaffAvailableError(e.payload)) {
        setError(t("quick.no_staff_available"));
        return;
      }
      setError(e.message);
    },
  });

  if (!open) return null;

  const locationReady = roomReady;

  const hasOutOfStock = outOfStockIds.size > 0;

  const canSubmit =
    locationReady &&
    (picked.length > 0 || search.trim().length > 0) &&
    !hasOutOfStock &&
    !noStaffAvailable &&
    !submit.isPending;

  const renderPickedItem = (p: PickedItem) => {
    const isOutOfStock =
      !p.product.is_service && outOfStockIds.has(p.product.id);

    return (
    <div className="rounded-lg border border-[color:var(--color-line)]/80 bg-[color:var(--color-paper-2)] px-2.5 py-2 text-sm">
      <div className="relative flex min-h-[2rem] items-center gap-1.5">
        <div
          className={clsx(
            "flex min-w-0 flex-1 items-center gap-1.5",
            isOutOfStock && "pointer-events-none select-none opacity-30",
          )}
          aria-hidden={isOutOfStock}
        >
        <ProductItemIcon sku={p.product.sku} name={p.product.name} iconEmoji={p.product.icon_emoji} size="xs" />
        <span className="min-w-0 flex-1 truncate">
          {productDisplayName(p.product, i18n.language)}
        </span>
        <span className="rounded bg-white px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-[color:var(--color-ink-soft)]">
          {t(`departments.${p.product.department}`)}
        </span>
        {p.product.is_service ? (
          <span className="px-2 text-xs text-[color:var(--color-ink-muted)]">×1</span>
        ) : (
          <span className="inline-flex items-center gap-1">
            <button
              type="button"
              onClick={() => updateQty(p.product.id, -1)}
              disabled={isOutOfStock || p.qty <= 1}
              tabIndex={isOutOfStock ? -1 : 0}
              className="grid h-6 w-6 place-items-center rounded border border-[color:var(--color-line)] bg-white disabled:opacity-40"
              aria-label="decrement"
            >
              <Minus className="h-3 w-3" />
            </button>
            <span className="w-6 text-center font-medium tabular-nums">{p.qty}</span>
            <button
              type="button"
              onClick={() => updateQty(p.product.id, 1)}
              disabled={isOutOfStock || p.qty >= 20}
              tabIndex={isOutOfStock ? -1 : 0}
              className="grid h-6 w-6 place-items-center rounded border border-[color:var(--color-line)] bg-white disabled:opacity-40"
              aria-label="increment"
            >
              <Plus className="h-3 w-3" />
            </button>
          </span>
        )}
        {!isOutOfStock ? (
          <button
            type="button"
            onClick={() => removePickedItem(p.product.id)}
            className="ml-1 grid h-6 w-6 place-items-center rounded text-[color:var(--color-ink-muted)] hover:text-[color:var(--color-ink)]"
            aria-label="Remove"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
        </div>
        {isOutOfStock ? (
          <div
            className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
            aria-hidden
          >
            <span className="inline-flex items-center justify-center rounded-lg border-[2.5px] border-red-600 bg-white px-4 py-1 text-base font-extrabold leading-none text-red-600 shadow-sm ring-1 ring-red-600/20">
              {t("quick.out_of_stock_stamp")}
            </span>
          </div>
        ) : null}
      </div>

      {isOutOfStock ? (
        <button
          type="button"
          onClick={() => removePickedItem(p.product.id)}
          className="mt-1.5 flex w-full items-center justify-center gap-1 rounded-lg border border-red-600 bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-red-700 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-600/35"
        >
          <X className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
          {t("quick.remove_out_of_stock")}
        </button>
      ) : (
        <input
          type="text"
          value={p.note}
          onChange={(e) => updateItemNote(p.product.id, e.target.value)}
          placeholder={t("quick.item_note_placeholder")}
          aria-label={t("quick.item_note_label", {
            item: productDisplayName(p.product, i18n.language),
          })}
          className="mt-1.5 w-full rounded-lg border border-[color:var(--color-line)]/80 bg-white px-2.5 py-1.5 text-xs text-[color:var(--color-ink)] placeholder:text-[color:var(--color-ink-muted)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-ink)]/10"
        />
      )}
    </div>
    );
  };

  const renderPickedItemAnimated = (p: PickedItem) => (
    <AnimateCollapse
      key={p.product.id}
      show={!removingProductIds.has(p.product.id)}
      enterOnMount
    >
      {renderPickedItem(p)}
    </AnimateCollapse>
  );

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-[60] overflow-y-auto overflow-x-hidden bg-black/45 backdrop-blur-[2px] overscroll-contain scrollbar-none"
      onMouseDown={(e) => {
        if (submit.isPending) return;
        const panel = (e.currentTarget as HTMLElement).querySelector('[role="dialog"]');
        if (
          panel?.contains(e.target as Node) ||
          methodMenuPortalRef.current?.contains(e.target as Node) ||
          productListPortalRef.current?.contains(e.target as Node)
        ) {
          return;
        }
        onClose();
      }}
    >
      <div className="flex min-h-[100dvh] items-center justify-center px-3 py-3 pt-[max(0.5rem,env(safe-area-inset-top,0px))] pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] sm:px-4 sm:py-4">
      <div
        role="dialog"
        aria-modal
        className="my-auto flex w-full max-w-md min-h-0 max-h-[min(90dvh,calc(100dvh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)-7rem))] flex-col overflow-hidden rounded-2xl border border-[color:var(--color-line)] bg-white shadow-2xl landscape:max-h-[min(88dvh,calc(100dvh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)-1.5rem))]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center gap-2.5 border-b border-[color:var(--color-line)] px-5 py-4">
          <Plus className="h-4 w-4 shrink-0" />
          <h2 className="text-base font-semibold">{t("quick.title")}</h2>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto grid h-8 w-8 place-items-center rounded-lg hover:bg-[color:var(--color-paper-2)]"
            aria-label={t("quick.cancel")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 scrollbar-none [-webkit-overflow-scrolling:touch]">
          <AnimateResize>
          <div className="flex flex-col gap-4">
        <RoomCombobox
          value={room}
          onChange={setRoom}
          onSelected={() => {
            requestAnimationFrame(() => scheduleTriggerRef.current?.focus());
          }}
        />

        <div ref={productPickerRef} className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--color-ink-muted)]" />
          <input
            ref={searchInputRef}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setShowList(true);
            }}
            onFocus={() => setShowList(true)}
            onClick={() => setShowList(true)}
            onBlur={(e) => {
              const next = e.relatedTarget as Node | null;
              if (next && productPickerRef.current?.contains(next)) return;
              window.setTimeout(() => {
                if (productPickerRef.current?.contains(document.activeElement)) return;
                setShowList(false);
              }, 0);
            }}
            placeholder={t("quick.items_placeholder")}
            className="w-full rounded-lg border border-[color:var(--color-line)] bg-white py-2.5 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--color-ink)]/10"
          />
          {showList &&
            filtered.length > 0 &&
            productListStyle &&
            createPortal(
              <ul
                ref={productListPortalRef}
                role="listbox"
                style={productListStyle}
                className="overflow-y-auto scrollbar-none rounded-lg border border-[color:var(--color-line)] bg-white shadow-lg"
              >
                {filtered.map((p) => (
                  <li key={p.id} role="option">
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[color:var(--color-paper-2)]"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setPicked((cur) => [...cur, { product: p, qty: 1, note: "" }]);
                        setSearch("");
                        setShowList(false);
                        searchInputRef.current?.focus();
                      }}
                    >
                      <ProductItemIcon sku={p.sku} name={p.name} iconEmoji={p.icon_emoji} size="sm" />
                      <span className="min-w-0 flex-1 truncate">
                        {productDisplayName(p, i18n.language)}
                      </span>
                      <span className="rounded bg-[color:var(--color-paper-2)] px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-[color:var(--color-ink-soft)]">
                        {t(`departments.${p.department}`)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>,
              document.body,
            )}
        </div>

        {picked.length > 0 ? (
          <div className="overflow-hidden">
          {!pickedPaginated ? (
            <div className="flex flex-col gap-3 py-0.5">
              {picked.map((p) => renderPickedItemAnimated(p))}
            </div>
          ) : (
            <div className="relative">
              {pickedPage > 0 && (
                <button
                  type="button"
                  onClick={() => setPickedPage((p) => p - 1)}
                  aria-label={t("quick.items_prev_page")}
                  className="absolute left-0 top-1/2 z-10 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full border border-[color:var(--color-line)] bg-white shadow-sm hover:bg-[color:var(--color-paper-2)]"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              )}

              <div
                className={clsx(
                  "overflow-hidden",
                  pickedPage > 0 && "pl-9",
                  pickedPage < pickedPages.length - 1 && "pr-9",
                )}
              >
                <div
                  className="flex transition-transform duration-300 ease-out"
                  style={{ transform: `translateX(calc(-${pickedPage} * ${PICKED_PAGE_WIDTH}))` }}
                >
                  {pickedPages.map((pageItems, pageIdx) => (
                    <div
                      key={pageIdx}
                      className="shrink-0 pr-2"
                      style={{ width: PICKED_PAGE_WIDTH }}
                    >
                      <div className="flex flex-col gap-3 py-0.5">
                        {pageItems.map((p) => renderPickedItemAnimated(p))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {pickedPage < pickedPages.length - 1 && (
                <button
                  type="button"
                  onClick={() => setPickedPage((p) => p + 1)}
                  aria-label={t("quick.items_next_page")}
                  className="absolute right-0 top-1/2 z-10 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full border border-[color:var(--color-line)] bg-white shadow-sm hover:bg-[color:var(--color-paper-2)]"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}

              <div
                className="mt-2 flex items-center justify-center gap-1.5"
                aria-hidden
              >
                {pickedPages.map((_, i) => (
                  <span
                    key={i}
                    className={clsx(
                      "h-1.5 rounded-full transition-all",
                      i === pickedPage
                        ? "w-4 bg-[color:var(--color-ink-soft)]"
                        : "w-1.5 bg-[color:var(--color-line)]",
                    )}
                  />
                ))}
              </div>
            </div>
          )}
          </div>
        ) : null}

        <DeliverySchedulePicker
          className="mt-0"
          mode={scheduleMode}
          onModeChange={setScheduleMode}
          delayMinutes={delayMinutes}
          onDelayMinutesChange={setDelayMinutes}
          atTime={atTime}
          onAtTimeChange={setAtTime}
          triggerRef={scheduleTriggerRef}
        />

        <div
          className={clsx(
            "flex flex-col items-center justify-center gap-3 rounded-xl px-3.5 py-4 text-xs transition-colors",
            noStaffAvailable
              ? "bg-red-600 text-white"
              : "bg-[color:var(--color-paper-2)] text-[color:var(--color-ink-soft)]",
          )}
        >
          {noStaffAvailable ? (
            <p className="px-1 text-center text-sm font-semibold leading-snug">
              {t("quick.no_staff_available")}
            </p>
          ) : (
            <>
          <div className="flex w-full items-center justify-center gap-2 text-center">
            <AssignHeaderIcon className="h-4 w-4 shrink-0" aria-hidden />
            {willSplit ? (
              <span className="font-medium leading-snug">
                {t("quick.split_notice", { count: byDept.size })}
              </span>
            ) : (
              <span className="font-medium leading-snug">{t("quick.dept_auto")}</span>
            )}
          </div>

          <AnimateCollapse show={showAssigneeBlock} className="w-full">
            <div className="flex w-full flex-col items-center gap-3">
              {showHkAssign && hkPool.length > 0 ? (
                <div className="mx-auto w-full max-w-sm space-y-1.5">
                  <span className="block text-center text-xs font-medium text-[color:var(--color-ink-muted)]">
                    {t("quick.assign_hk")}
                  </span>
                  <StaffAssigneePicker
                    ariaLabel={t("quick.assign_hk_aria")}
                    autoLabel={t("quick.assign_auto")}
                    value={prefHkId}
                    onChange={setPrefHkId}
                    groups={hkZoneGroups}
                    variant="housekeeping"
                    menuPlacement="below"
                    density="compact"
                  />
                </div>
              ) : null}
              {showMtAssign && mtPool.length > 0 ? (
                <div className="mx-auto w-full max-w-sm space-y-1.5">
                  <span className="block text-center text-xs font-medium text-[color:var(--color-ink-muted)]">
                    {t("quick.assign_mt")}
                  </span>
                  <StaffAssigneePicker
                    ariaLabel={t("quick.assign_mt_aria")}
                    autoLabel={t("quick.assign_auto")}
                    value={prefMtId}
                    onChange={setPrefMtId}
                    groups={mtZoneGroups}
                    variant="maintenance"
                    menuPlacement="below"
                    density="compact"
                  />
                </div>
              ) : null}
              {showFoAssign && foPool.length > 0 ? (
                <div className="mx-auto w-full max-w-sm space-y-1.5">
                  <span className="block text-center text-xs font-medium text-[color:var(--color-ink-muted)]">
                    {t("quick.assign_fo")}
                  </span>
                  <StaffAssigneePicker
                    ariaLabel={t("quick.assign_fo_aria")}
                    autoLabel={t("quick.assign_auto")}
                    value={prefFoId}
                    onChange={setPrefFoId}
                    groups={foZoneGroups}
                    variant="front_office"
                    menuPlacement="below"
                    density="compact"
                  />
                </div>
              ) : null}
              {showBbAssign && bbPool.length > 0 ? (
                <div className="mx-auto w-full max-w-sm space-y-1.5">
                  <span className="block text-center text-xs font-medium text-[color:var(--color-ink-muted)]">
                    {t("quick.assign_bb")}
                  </span>
                  <StaffAssigneePicker
                    ariaLabel={t("quick.assign_bb_aria")}
                    autoLabel={t("quick.assign_auto")}
                    value={prefBbId}
                    onChange={setPrefBbId}
                    groups={bbZoneGroups}
                    variant="bell_boy"
                    menuPlacement="below"
                    density="compact"
                  />
                </div>
              ) : null}
            </div>
          </AnimateCollapse>
            </>
          )}
        </div>
          </div>
          </AnimateResize>
        </div>

        <div className="shrink-0 border-t border-[color:var(--color-line)] px-5 py-4">
        <div className="grid grid-cols-4 gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[color:var(--color-line)] bg-white py-2.5 text-sm hover:bg-[color:var(--color-paper-2)]"
          >
            {t("quick.cancel")}
          </button>

          {hasOutOfStock ? (
            <button
              type="button"
              disabled
              aria-disabled
              className="col-span-3 flex cursor-not-allowed items-center justify-center rounded-lg bg-red-600 px-3 py-2.5 text-center text-sm font-semibold leading-snug text-white"
            >
              {t("quick.submit_blocked_out_of_stock")}
            </button>
          ) : (
            <div
              ref={methodMenuRef}
              className={clsx(
                "col-span-3 relative isolate flex rounded-lg bg-[color:var(--color-ink)] text-white transition-[filter,opacity]",
                !canSubmit && "opacity-45",
              )}
            >
              <button
                type="button"
                disabled={!canSubmit}
                onClick={() => submit.mutate()}
                className={clsx(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-l-lg px-3 py-2.5 text-center text-sm font-semibold leading-snug",
                  !canSubmit ? "cursor-not-allowed" : "hover:brightness-110",
                )}
              >
                {(() => {
                  const Icon = METHODS.find((m) => m.value === method)!.icon;
                  return <Icon className="h-4 w-4 shrink-0" />;
                })()}
                {submit.isPending ? t("common.loading") : t(`delivery.${method}`)}
              </button>

              <button
                ref={methodTriggerRef}
                type="button"
                disabled={!canSubmit}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => setMethodOpen((v) => !v)}
                aria-label={t("quick.delivery_method")}
                aria-haspopup="menu"
                aria-expanded={methodOpen}
                className={clsx(
                  "flex shrink-0 items-center justify-center rounded-r-lg border-l border-white/20 px-3 transition-[filter]",
                  canSubmit && "hover:brightness-110",
                )}
              >
                <ChevronDown
                  className={clsx("h-4 w-4 transition-transform", methodOpen && "rotate-180")}
                />
              </button>

              {methodOpen &&
                methodMenuStyle &&
                createPortal(
                  <ul
                    ref={methodMenuPortalRef}
                    role="menu"
                    style={methodMenuStyle}
                    className="divide-y divide-white/10 overflow-hidden rounded-lg border border-white/15 bg-[color:var(--color-ink)] text-white shadow-xl"
                  >
                    {METHODS.map(({ value, icon: Icon }) => {
                      const active = value === method;
                      return (
                        <li key={value}>
                          <button
                            type="button"
                            onClick={() => {
                              setMethod(value);
                              setMethodOpen(false);
                            }}
                            className={clsx(
                              "flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm",
                              active
                                ? "bg-white/[0.14] font-medium"
                                : "hover:bg-white/10",
                            )}
                          >
                            <Icon className="h-4 w-4 shrink-0 text-white/75" />
                            <span className="flex-1">{t(`delivery.${value}`)}</span>
                            {active && (
                              <Check className="h-4 w-4 shrink-0 text-emerald-400" />
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>,
                  document.body,
                )}
            </div>
          )}
        </div>

        {error && (
          <p className="mt-3 text-center text-sm leading-relaxed text-red-600" role="alert">
            {error}
          </p>
        )}
        </div>
      </div>
      </div>
    </div>
  );
}
