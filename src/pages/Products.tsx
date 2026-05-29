import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate, useSearchParams } from "react-router-dom";
import { Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ClipboardList, Plus, Save, Search, X } from "lucide-react";
import clsx from "clsx";

import { PageSizePicker } from "../components/ui/PageSizePicker";
import { productsApi } from "../lib/api";
import { ProductItemIcon } from "../lib/productIcons";
import { productDisplayName } from "../lib/productDisplayName";
import { productDisplayUnit } from "../lib/productDisplayUnit";
import type { Department, Product, StockWriteOffReason, User } from "../lib/types";
import { useAuth } from "../lib/auth";
import { canEditCatalog, hasAppFeature } from "../lib/appFeatures";

const STATUS_CLASS: Record<Product["status"], string> = {
  ok: "bg-[color:var(--color-stock-ok-bg)] text-[color:var(--color-stock-ok-fg)]",
  low: "bg-[color:var(--color-stock-low-bg)] text-[color:var(--color-stock-low-fg)]",
  out: "bg-[color:var(--color-stock-out-bg)] text-[color:var(--color-stock-out-fg)]",
  service:
    "bg-[color:var(--color-stock-service-bg)] text-[color:var(--color-stock-service-fg)]",
  inactive: "bg-[color:var(--color-paper)] text-[color:var(--color-ink-muted)]",
};

/** Table: 6 cols on sm–md (no dept), 7 cols on lg+ */
const TABLE_GRID =
  "grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,4.75rem)_minmax(0,1.55fr)_minmax(88px,7.5rem)_minmax(0,4rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,0.9fr)_minmax(0,4.75rem)_minmax(0,1.55fr)_minmax(88px,7.5rem)_minmax(0,4rem)]";

const PRODUCTS_MOBILE_GRID =
  "grid min-w-0 items-center gap-x-2 gap-y-1 text-[13px] leading-snug";
/** Row 2: name · restock · status */
const PRODUCTS_MOBILE_ROW2 = "grid-cols-[minmax(0,1fr)_auto_auto]";

const PAGE_SIZE_OPTIONS = [50, 100, 150, 200] as const;
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

type ProductDeptFilter = "all" | Department;
type ProductStatusFilter = "all" | Product["status"];

const PRODUCT_DEPT_FILTERS: ProductDeptFilter[] = ["all", "housekeeping", "maintenance"];
const PRODUCT_STATUS_FILTERS: ProductStatusFilter[] = [
  "all",
  "ok",
  "low",
  "out",
  "service",
  "inactive",
];

/** Housekeepers / maintenance refill items for their department; managers/admin all. */
export function canRestockProduct(user: User | null, p: Product): boolean {
  if (!user || p.is_service || !hasAppFeature(user, "stock")) return false;
  if (user.role === "admin" || user.role === "manager") return true;
  if (
    user.department === p.department &&
    (user.role === "housekeeper" ||
      user.role === "hk_supervisor" ||
      user.role === "maintenance")
  )
    return true;
  return false;
}

export function RestockModal({
  product,
  onClose,
}: {
  product: Product;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const label = productDisplayName(product, i18n.language);
  const unitLabel = productDisplayUnit(product, i18n.language);
  const qc = useQueryClient();
  const { current: me } = useAuth();
  const onHandQty = Number(product.on_hand ?? 0);
  const [qtyStr, setQtyStr] = useState("");
  const [writeOffReason, setWriteOffReason] = useState<StockWriteOffReason | "">("");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const qty =
    qtyStr.trim() === "" || qtyStr === "-" ? NaN : Number(qtyStr);
  const isWriteOff = Number.isFinite(qty) && qty < 0;
  const exceedsOnHand = isWriteOff && Math.abs(qty) > onHandQty;
  const preview = Number.isFinite(qty) ? onHandQty + qty : onHandQty;

  const adjust = useMutation({
    mutationFn: () => {
      const reason = isWriteOff ? writeOffReason : undefined;
      return productsApi.adjust(product.id, qty, me?.id, reason || undefined);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["products"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      void qc.invalidateQueries({ queryKey: ["reports"] });
      onClose();
    },
  });

  const canSubmit =
    Number.isFinite(qty) &&
    qty !== 0 &&
    qty >= -9999 &&
    qty <= 9999 &&
    !exceedsOnHand &&
    (!isWriteOff || writeOffReason !== "") &&
    !adjust.isPending;

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 bg-black/40 grid place-items-center px-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal
        aria-labelledby="restock-title"
        className="w-full max-w-sm rounded-2xl border border-[color:var(--color-line)] bg-white p-4 shadow-xl"
      >
        <div className="flex items-start gap-2 mb-3">
          <ProductItemIcon sku={product.sku} name={product.name} iconEmoji={product.icon_emoji} size="sm" />
          <div className="min-w-0 flex-1">
            <h2 id="restock-title" className="font-semibold text-lg">
              {t("products.restock_title")}
            </h2>
            <p className="text-sm text-[color:var(--color-ink-muted)] mt-0.5">
              {t("products.restock_sub", {
                name: label,
                current: onHandQty,
                unit: unitLabel,
              })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 hover:bg-[color:var(--color-paper-2)]"
            aria-label={t("common.cancel")}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <label className="block text-sm">
          <span className="text-[color:var(--color-ink-soft)]">
            {t("products.restock_qty")}
          </span>
          <div className="relative mt-1">
            <input
              inputMode="numeric"
              autoFocus
              value={qtyStr}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === "" || raw === "-") {
                  setQtyStr(raw);
                  return;
                }
                if (/^-?\d*$/.test(raw)) {
                  setQtyStr(raw.slice(0, 6));
                }
              }}
              placeholder="0"
              className={clsx(
                "w-full rounded-lg border py-2 pl-3 pr-14 text-lg tabular-nums focus:outline-none focus:ring-2 focus:ring-[color:var(--color-ink)]/10",
                exceedsOnHand
                  ? "border-red-400 focus:ring-red-200"
                  : "border-[color:var(--color-line)]",
              )}
            />
            {unitLabel ? (
              <span
                className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm font-medium text-[color:var(--color-ink-muted)]"
                aria-hidden
              >
                {unitLabel}
              </span>
            ) : null}
          </div>
        </label>
        {exceedsOnHand ? (
          <p className="mt-2 text-xs font-medium text-red-600" role="alert">
            {t("products.restock_exceeds_on_hand", { max: onHandQty })}
          </p>
        ) : (
          <p className="mt-2 text-xs text-[color:var(--color-ink-muted)] leading-relaxed">
            {isWriteOff
              ? t("products.restock_writeoff_hint")
              : t("products.restock_qty_hint")}
          </p>
        )}

        {isWriteOff && (
          <fieldset className="mt-3 space-y-2">
            <legend className="text-sm font-medium text-[color:var(--color-ink-soft)]">
              {t("products.restock_reason_label")}
            </legend>
            {(
              [
                ["damaged", "products.restock_reason_damaged"],
                ["overfill", "products.restock_reason_overfill"],
                ["expired", "products.restock_reason_expired"],
                ["lost", "products.restock_reason_lost"],
                ["count_adjust", "products.restock_reason_count_adjust"],
              ] as const
            ).map(([value, labelKey]) => (
              <label
                key={value}
                className={clsx(
                  "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm",
                  writeOffReason === value
                    ? "border-[color:var(--color-ink)] bg-[color:var(--color-paper-2)]"
                    : "border-[color:var(--color-line)]",
                )}
              >
                <input
                  type="radio"
                  name="writeoff-reason"
                  value={value}
                  checked={writeOffReason === value}
                  onChange={() => setWriteOffReason(value)}
                  className="accent-[color:var(--color-ink)]"
                />
                {t(labelKey)}
              </label>
            ))}
          </fieldset>
        )}

        {Number.isFinite(qty) && qty !== 0 && !exceedsOnHand && (
          <p
            className={clsx(
              "mt-3 text-sm font-medium tabular-nums",
              isWriteOff && "text-[color:var(--color-stock-out-bg)]",
            )}
          >
            {t("products.restock_preview", {
              total: Math.max(0, preview),
              unit: unitLabel,
            })}
          </p>
        )}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-[color:var(--color-line)] bg-white py-2.5 text-sm hover:bg-[color:var(--color-paper-2)]"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => adjust.mutate()}
            className={clsx(
              "flex-[2] rounded-lg py-2.5 text-sm font-semibold",
              !canSubmit
                ? "bg-[color:var(--color-paper-2)] text-[color:var(--color-ink-muted)] cursor-not-allowed"
                : "bg-[color:var(--color-ink)] text-white hover:opacity-90",
            )}
          >
            {adjust.isPending ? t("common.loading") : t("products.restock_submit")}
          </button>
        </div>

        {adjust.isError && (
          <p className="mt-2 text-sm text-red-600" role="alert">
            {(adjust.error as Error).message}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Inline editor for a product's reorder threshold. Saves on Enter or via
 * the explicit save button; A tooltip explains what the number does
 * because front-desk staff find "reorder point" jargony.
 */
export function ThresholdCell({
  p,
  editable,
  compact = false,
}: {
  p: Product;
  editable: boolean;
  compact?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const unitLabel = productDisplayUnit(p, i18n.language);
  const qc = useQueryClient();
  const { current } = useAuth();
  const [value, setValue] = useState(p.reorder_at == null ? "" : String(p.reorder_at));
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setValue(p.reorder_at == null ? "" : String(p.reorder_at));
    setDirty(false);
  }, [p.reorder_at]);

  useEffect(() => {
    if (!saved) return;
    const id = window.setTimeout(() => setSaved(false), 1200);
    return () => window.clearTimeout(id);
  }, [saved]);

  const save = useMutation({
    mutationFn: () =>
      productsApi.update(p.id, {
        reorder_at: value.trim() === "" ? null : Number(value),
        ...(current?.id != null ? { actor_id: current.id } : {}),
      }),
    onSuccess: () => {
      setDirty(false);
      setSaved(true);
      void qc.invalidateQueries({ queryKey: ["products"] });
    },
  });

  if (p.is_service) {
    return <span className="text-[color:var(--color-ink-muted)]">—</span>;
  }

  if (!editable) {
    return (
      <span
        className={clsx(
          "inline-flex min-w-0 items-center gap-1 text-[color:var(--color-ink-soft)] tabular-nums",
          compact ? "text-xs justify-start" : "gap-1.5",
        )}
      >
        {p.reorder_at == null ? (
          <span className="text-[color:var(--color-ink-muted)]">—</span>
        ) : (
          <>
            {p.reorder_at}
            {!compact && unitLabel ? ` ${unitLabel}` : null}
          </>
        )}
      </span>
    );
  }

  return (
    <span
      className={clsx(
        "inline-flex min-w-0 items-center gap-1",
        compact ? "flex-nowrap" : "flex-wrap gap-1.5",
      )}
    >
      <input
        inputMode="numeric"
        value={value}
        onChange={(e) => {
          const next = e.target.value.replace(/[^0-9]/g, "");
          setValue(next);
          setDirty(next !== (p.reorder_at == null ? "" : String(p.reorder_at)));
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && dirty) save.mutate();
        }}
        placeholder="—"
        aria-label={t("products.table.threshold")}
        className={clsx(
          "rounded-md border border-[color:var(--color-line)] bg-white py-1 text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-[color:var(--color-ink)]/10",
          compact ? "w-11 px-1.5 text-xs" : "w-16 px-2 text-sm",
        )}
      />
      {!compact && (
        <span className="w-8 text-xs text-[color:var(--color-ink-muted)]">{unitLabel}</span>
      )}
      <button
        type="button"
        onClick={() => save.mutate()}
        disabled={!dirty || save.isPending}
        aria-label={t("products.threshold_save")}
        className={clsx(
          "w-7 h-7 grid place-items-center rounded-md border text-xs",
          dirty
            ? "bg-[color:var(--color-ink)] text-white border-[color:var(--color-ink)] hover:opacity-90"
            : saved
            ? "bg-[color:var(--color-delivered-bg)] text-[color:var(--color-delivered-fg)] border-[color:var(--color-delivered-bg)]"
            : "bg-white text-[color:var(--color-ink-muted)] border-[color:var(--color-line)] cursor-default",
        )}
      >
        {saved && !dirty ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
      </button>
    </span>
  );
}

const ROW_STATUS_CLASS: Partial<Record<Product["status"], string>> = {
  low: "bg-[color:var(--color-row-warning)]",
  out: "bg-[color:var(--color-row-breach)]",
};

function ProductInventoryRow({
  p,
  label,
  unitLabel,
  isFocused,
  canEdit,
  current,
  onRestock,
}: {
  p: Product;
  label: string;
  unitLabel: string;
  isFocused: boolean;
  canEdit: boolean;
  current: User | null;
  onRestock: () => void;
}) {
  const { t } = useTranslation();

  return (
    <li
      id={`product-row-${p.id}`}
      className={clsx(
        "text-sm transition-[box-shadow] duration-300",
        ROW_STATUS_CLASS[p.status],
        isFocused && "ring-2 ring-inset ring-[color:var(--color-ink)]/25 shadow-sm",
      )}
    >
      <div className="flex flex-col gap-1.5 px-3 py-2.5 sm:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 font-mono text-[11px] leading-snug text-[color:var(--color-ink-soft)]">
            {p.sku}
          </span>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
            <ThresholdCell p={p} editable={canEdit} compact />
            <span className="shrink-0 text-right text-xs font-semibold tabular-nums leading-snug text-[color:var(--color-ink)]">
              {p.is_service ? "—" : `${p.on_hand ?? 0} ${unitLabel}`.trim()}
            </span>
          </div>
        </div>
        <div className={clsx(PRODUCTS_MOBILE_GRID, PRODUCTS_MOBILE_ROW2)}>
          <span className="inline-flex min-w-0 items-center gap-1.5 font-medium leading-snug">
            <ProductItemIcon sku={p.sku} name={p.name} iconEmoji={p.icon_emoji} size="xs" />
            <span className="min-w-0 truncate text-sm">{label}</span>
          </span>
          <div className="flex justify-center">
            {canRestockProduct(current, p) ? (
              <button
                type="button"
                onClick={onRestock}
                className={clsx(
                  "inline-flex max-w-full items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold leading-tight whitespace-nowrap shadow-sm transition-[filter,transform] hover:brightness-110 active:scale-[0.98]",
                  p.status === "out" || p.status === "low"
                    ? "bg-[color:var(--color-ink)] text-white"
                    : "border border-[color:var(--color-ink)]/15 bg-[color:var(--color-delivered-bg)] text-[color:var(--color-delivered-fg)]",
                )}
              >
                <Plus className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
                {t("products.restock")}
              </button>
            ) : (
              <span className="text-xs text-[color:var(--color-ink-muted)]">—</span>
            )}
          </div>
          <span className="flex justify-end">
            <span
              className={clsx(
                "inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                STATUS_CLASS[p.status],
              )}
            >
              {t(`products.status.${p.status}`)}
            </span>
          </span>
        </div>
      </div>

      <div className={clsx("hidden items-center gap-3 px-4 py-3 sm:grid", TABLE_GRID)}>
        <span className="truncate font-mono text-[12.5px] text-[color:var(--color-ink-soft)]">
          {p.sku}
        </span>
        <span className="inline-flex min-w-0 items-center gap-2 truncate font-medium">
          <ProductItemIcon sku={p.sku} name={p.name} iconEmoji={p.icon_emoji} size="xs" />
          {label}
        </span>
        <span className="hidden text-[color:var(--color-ink-soft)] lg:block">
          {t(`departments.${p.department}`)}
        </span>
        <span
          className={clsx(
            "text-right tabular-nums text-[color:var(--color-ink)]",
            (p.status === "out" || p.status === "low") && "font-semibold",
          )}
        >
          {p.is_service ? "—" : `${p.on_hand ?? 0} ${unitLabel}`.trim()}
        </span>
        <ThresholdCell p={p} editable={canEdit} />
        <span className="flex justify-center">
          {canRestockProduct(current, p) ? (
            <button
              type="button"
              onClick={onRestock}
              className={clsx(
                "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold whitespace-nowrap shadow-sm transition-[filter,transform] hover:brightness-110 active:scale-[0.98]",
                p.status === "out" || p.status === "low"
                  ? "bg-[color:var(--color-ink)] text-white"
                  : "border border-[color:var(--color-ink)]/15 bg-[color:var(--color-delivered-bg)] text-[color:var(--color-delivered-fg)]",
              )}
            >
              <Plus className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
              {t("products.restock")}
            </button>
          ) : (
            <span className="text-[color:var(--color-ink-muted)]">—</span>
          )}
        </span>
        <span>
          <span
            className={clsx(
              "inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider",
              STATUS_CLASS[p.status],
            )}
          >
            {t(`products.status.${p.status}`)}
          </span>
        </span>
      </div>
    </li>
  );
}

type ProductSortKey = "sku" | "name" | "dept" | "on_hand" | "threshold" | "status";
type SortDir = "asc" | "desc";

const STATUS_SORT_ORDER: Product["status"][] = ["out", "low", "ok", "service", "inactive"];

/** Stocked items first; services (no on-hand qty) always at the bottom. */
function serviceSortTier(p: Product): number {
  return p.is_service ? 1 : 0;
}

function defaultProductOrder(a: Product, b: Product): number {
  const tier = serviceSortTier(a) - serviceSortTier(b);
  if (tier !== 0) return tier;
  const statusCmp =
    STATUS_SORT_ORDER.indexOf(a.status) - STATUS_SORT_ORDER.indexOf(b.status);
  if (statusCmp !== 0) return statusCmp;
  return a.sku.localeCompare(b.sku, undefined, { numeric: true });
}

function compareProducts(
  a: Product,
  b: Product,
  key: ProductSortKey,
  dir: SortDir,
  t: TFunction,
  lang: string,
): number {
  const tier = serviceSortTier(a) - serviceSortTier(b);
  if (tier !== 0) return tier;

  let cmp = 0;
  switch (key) {
    case "sku":
      cmp = a.sku.localeCompare(b.sku, undefined, { numeric: true });
      break;
    case "name":
      cmp = productDisplayName(a, lang).localeCompare(
        productDisplayName(b, lang),
        lang,
        { sensitivity: "base" },
      );
      break;
    case "dept":
      cmp = t(`departments.${a.department}`).localeCompare(
        t(`departments.${b.department}`),
        lang,
        { sensitivity: "base" },
      );
      break;
    case "on_hand":
      cmp = (a.on_hand ?? 0) - (b.on_hand ?? 0);
      break;
    case "threshold": {
      const av = a.reorder_at ?? -1;
      const bv = b.reorder_at ?? -1;
      cmp = av - bv;
      break;
    }
    case "status":
      cmp =
        STATUS_SORT_ORDER.indexOf(a.status) - STATUS_SORT_ORDER.indexOf(b.status);
      break;
  }
  if (cmp !== 0) return dir === "asc" ? cmp : -cmp;
  return a.sku.localeCompare(b.sku, undefined, { numeric: true });
}

function SortableHeader({
  label,
  column,
  sortKey,
  sortDir,
  onSort,
  className,
}: {
  label: string;
  column: ProductSortKey;
  sortKey: ProductSortKey | null;
  sortDir: SortDir;
  onSort: (column: ProductSortKey) => void;
  className?: string;
}) {
  const { t } = useTranslation();
  const active = sortKey === column;
  const Icon = active ? (sortDir === "asc" ? ChevronUp : ChevronDown) : ChevronUp;

  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      className={clsx(
        "group/header inline-flex min-w-0 items-center gap-0.5 rounded-md -mx-1 px-1 py-0.5",
        "text-left font-medium transition-colors",
        "hover:text-[color:var(--color-ink)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-ink)]/15",
        active
          ? "text-[color:var(--color-ink)]"
          : "text-[color:var(--color-ink-muted)]",
        className,
      )}
      aria-label={
        active
          ? t(`requests.table.sort_${sortDir}`, { column: label })
          : t("requests.table.sort_by", { column: label })
      }
    >
      <span className="truncate">{label}</span>
      <Icon
        className={clsx(
          "w-3 h-3 shrink-0 transition-opacity",
          active
            ? "opacity-100"
            : "opacity-0 group-hover/header:opacity-40",
        )}
        aria-hidden
      />
    </button>
  );
}

type ProductsPageProps = {
  /** Render without page header when nested in another layout. */
  embedded?: boolean;
};

export function ProductsPage({ embedded = false }: ProductsPageProps = {}) {
  const { t, i18n } = useTranslation();
  const { current } = useAuth();
  const [restockFor, setRestockFor] = useState<Product | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const focusId = searchParams.get("focus");
  const scrolledRef = useRef(false);
  const tableRef = useRef<HTMLDivElement>(null);
  const skipPaginationScrollRef = useRef(false);
  const paginationScrollReadyRef = useRef(false);
  const [sort, setSort] = useState<{ key: ProductSortKey; dir: SortDir } | null>(
    null,
  );
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState<ProductDeptFilter>("all");
  const [statusFilter, setStatusFilter] = useState<ProductStatusFilter>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(50);

  const onSort = (column: ProductSortKey) => {
    setSort((cur) => {
      if (cur?.key !== column) return { key: column, dir: "asc" };
      return { key: column, dir: cur.dir === "asc" ? "desc" : "asc" };
    });
  };

  const { data = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: productsApi.list,
  });

  useEffect(() => {
    scrolledRef.current = false;
  }, [focusId]);


  const canEdit = Boolean(current && canEditCatalog(current));

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter((p) => {
      if (deptFilter !== "all" && p.department !== deptFilter) return false;
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (!q) return true;
      const name = productDisplayName(p, i18n.language).toLowerCase();
      return (
        p.sku.toLowerCase().includes(q) ||
        name.includes(q) ||
        p.name.toLowerCase().includes(q)
      );
    });
  }, [data, search, deptFilter, statusFilter, i18n.language]);

  const displayRows = useMemo(() => {
    if (!sort) return [...filteredRows].sort(defaultProductOrder);
    return [...filteredRows].sort((a, b) =>
      compareProducts(a, b, sort.key, sort.dir, t, i18n.language),
    );
  }, [filteredRows, sort, t, i18n.language]);

  const showEmptyResults = !isLoading && displayRows.length === 0;

  const totalRows = displayRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const currentPage = Math.min(page, totalPages);

  useEffect(() => {
    setPage(1);
  }, [pageSize, sort?.key, sort?.dir, search, deptFilter, statusFilter]);

  useEffect(() => {
    if (page !== currentPage) setPage(currentPage);
  }, [page, currentPage]);

  useEffect(() => {
    if (!paginationScrollReadyRef.current) {
      paginationScrollReadyRef.current = true;
      return () => {
        paginationScrollReadyRef.current = false;
      };
    }
    if (skipPaginationScrollRef.current) {
      skipPaginationScrollRef.current = false;
      return;
    }
    requestAnimationFrame(() => {
      tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [currentPage, pageSize]);

  const pageRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return displayRows.slice(start, start + pageSize);
  }, [displayRows, currentPage, pageSize]);

  const rangeFrom = totalRows === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeTo = Math.min(currentPage * pageSize, totalRows);

  useEffect(() => {
    if (!focusId || isLoading) return;
    const idx = displayRows.findIndex((p) => String(p.id) === focusId);
    if (idx >= 0) {
      const targetPage = Math.floor(idx / pageSize) + 1;
      if (targetPage !== currentPage) {
        skipPaginationScrollRef.current = true;
        setPage(targetPage);
        scrolledRef.current = false;
        return;
      }
    }
    if (scrolledRef.current) return;
    const row = document.getElementById(`product-row-${focusId}`);
    if (!row) return;
    scrolledRef.current = true;
    requestAnimationFrame(() => {
      row.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    const timer = window.setTimeout(() => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete("focus");
          return next;
        },
        { replace: true },
      );
    }, 900);
    return () => window.clearTimeout(timer);
  }, [focusId, isLoading, displayRows, pageSize, currentPage, setSearchParams]);

  if (!embedded && current && !hasAppFeature(current, "stock")) {
    return <Navigate to="/" replace />;
  }

  if (embedded && current && !hasAppFeature(current, "stock")) {
    return <Navigate to="/admin" replace />;
  }

  return (
    <div className="flex flex-1 flex-col gap-3 min-h-0">
      {!embedded ? (
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("products.title")}
          </h1>
        </header>
      ) : null}

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
              placeholder={t("stock.search_placeholder")}
              className="h-9 w-full rounded-lg border border-[color:var(--color-line)] bg-white py-2 pl-9 pr-9 text-sm transition focus:border-[color:var(--color-ink)]/20 focus:outline-none focus:ring-2 focus:ring-[color:var(--color-ink)]/10"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-[color:var(--color-ink-muted)] hover:bg-[color:var(--color-paper-2)] hover:text-[color:var(--color-ink)]"
                aria-label={t("common.cancel")}
              >
                <X className="h-3.5 w-3.5" strokeWidth={2.25} />
              </button>
            ) : null}
          </div>

          <div className="flex min-w-0 flex-col gap-2.5 lg:flex-row lg:items-start lg:justify-between lg:gap-4">
            <div className="hidden min-w-0 sm:block lg:shrink-0">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--color-ink-muted)]">
                {t("stock.filter_dept_label")}
              </p>
              <div className="flex flex-wrap justify-start gap-1.5">
                {PRODUCT_DEPT_FILTERS.map((d) => {
                  const active = deptFilter === d;
                  return (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setDeptFilter(d)}
                      className={clsx(
                        "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                        active
                          ? "border-[color:var(--color-ink)] bg-[color:var(--color-ink)] text-white shadow-sm"
                          : "border-[color:var(--color-line)] bg-white text-[color:var(--color-ink-soft)] hover:border-[color:var(--color-ink)]/15",
                      )}
                    >
                      {d === "all" ? t("stock.filter_all") : t(`departments.${d}`)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="min-w-0 lg:ml-auto lg:flex lg:flex-1 lg:flex-col lg:items-end">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--color-ink-muted)] lg:text-right">
                {t("stock.filter_status_label")}
              </p>
              <div className="flex flex-wrap justify-start gap-1.5 lg:justify-end">
                {PRODUCT_STATUS_FILTERS.map((s) => {
                  const active = statusFilter === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setStatusFilter(s)}
                      className={clsx(
                        "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                        active
                          ? "border-[color:var(--color-ink)] bg-[color:var(--color-ink)] text-white shadow-sm"
                          : "border-[color:var(--color-line)] bg-white text-[color:var(--color-ink-soft)] hover:border-[color:var(--color-ink)]/15",
                      )}
                    >
                      {s === "all" ? t("stock.filter_all") : t(`products.status.${s}`)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div
        ref={tableRef}
        className={clsx(
          "scroll-mt-4 flex min-h-[18rem] flex-col overflow-x-hidden rounded-xl border border-[color:var(--color-line)] bg-white sm:overflow-x-auto",
          showEmptyResults && "flex-1",
        )}
      >
        <div
          className={clsx(
            "w-full sm:min-w-[40rem] lg:min-w-[52rem]",
            showEmptyResults && "flex min-h-0 flex-1 flex-col",
          )}
        >
          <div
            className={clsx(
              TABLE_GRID,
              "hidden shrink-0 border-b border-[color:var(--color-line)] px-4 py-2 text-xs font-medium text-[color:var(--color-ink-muted)] sm:grid",
            )}
          >
            <SortableHeader
              label={t("products.table.sku")}
              column="sku"
              sortKey={sort?.key ?? null}
              sortDir={sort?.dir ?? "asc"}
              onSort={onSort}
            />
            <SortableHeader
              label={t("products.table.name")}
              column="name"
              sortKey={sort?.key ?? null}
              sortDir={sort?.dir ?? "asc"}
              onSort={onSort}
            />
            <SortableHeader
              label={t("products.table.dept")}
              column="dept"
              sortKey={sort?.key ?? null}
              sortDir={sort?.dir ?? "asc"}
              onSort={onSort}
              className="hidden lg:inline-flex"
            />
            <SortableHeader
              label={t("products.table.on_hand")}
              column="on_hand"
              sortKey={sort?.key ?? null}
              sortDir={sort?.dir ?? "asc"}
              onSort={onSort}
              className="justify-end w-full"
            />
            <SortableHeader
              label={t("products.table.threshold")}
              column="threshold"
              sortKey={sort?.key ?? null}
              sortDir={sort?.dir ?? "asc"}
              onSort={onSort}
            />
            <span className="text-center">{t("products.table.restock_action")}</span>
            <SortableHeader
              label={t("products.table.status")}
              column="status"
              sortKey={sort?.key ?? null}
              sortDir={sort?.dir ?? "asc"}
              onSort={onSort}
            />
          </div>
          <ul
            className={clsx(
              "divide-row",
              showEmptyResults && "flex min-h-0 flex-1 flex-col",
            )}
          >
            {isLoading && (
              <li className="px-4 py-6 text-sm text-[color:var(--color-ink-muted)]">
                {t("common.loading")}
              </li>
            )}
            {showEmptyResults && (
              <li className="flex flex-1 flex-col items-center justify-center px-4 py-10 text-center">
                <ClipboardList
                  className="mx-auto mb-3 h-14 w-14 text-[color:var(--color-ink-muted)]/35"
                  strokeWidth={1.25}
                  aria-hidden
                />
                <p className="text-base font-medium text-[color:var(--color-ink-soft)]">
                  {t("stock.no_results")}
                </p>
                <p className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-[color:var(--color-ink-muted)]">
                  {t("stock.no_results_sub")}
                </p>
              </li>
            )}
            {!isLoading &&
              pageRows.map((p) => (
                <ProductInventoryRow
                  key={p.id}
                  p={p}
                  label={productDisplayName(p, i18n.language)}
                  unitLabel={productDisplayUnit(p, i18n.language)}
                  isFocused={focusId === String(p.id)}
                  canEdit={canEdit}
                  current={current}
                  onRestock={() => setRestockFor(p)}
                />
              ))}
          </ul>
          {!isLoading && totalRows > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--color-line)] px-4 py-3 text-sm">
              <p className="text-[color:var(--color-ink-soft)] tabular-nums">
                {t("products.pagination.showing", {
                  from: rangeFrom,
                  to: rangeTo,
                  total: totalRows,
                })}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-2 text-[color:var(--color-ink-soft)]">
                  <span className="text-xs">{t("products.pagination.per_page")}</span>
                  <PageSizePicker
                    value={pageSize}
                    options={PAGE_SIZE_OPTIONS}
                    onChange={(n) => setPageSize(n as PageSize)}
                    ariaLabel={t("products.pagination.per_page")}
                    placement="up"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[color:var(--color-line)] bg-white disabled:opacity-40 hover:bg-[color:var(--color-paper-2)]"
                    aria-label={t("products.pagination.prev")}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="min-w-[5.5rem] text-center text-xs font-medium tabular-nums text-[color:var(--color-ink-soft)]">
                    {t("products.pagination.page", {
                      current: currentPage,
                      total: totalPages,
                    })}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[color:var(--color-line)] bg-white disabled:opacity-40 hover:bg-[color:var(--color-paper-2)]"
                    aria-label={t("products.pagination.next")}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {restockFor && (
        <RestockModal product={restockFor} onClose={() => setRestockFor(null)} />
      )}
    </div>
  );
}
