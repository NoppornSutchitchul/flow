import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ClipboardList, Layers, Package, Pencil, Plus, RotateCcw, Search, X, XCircle } from "lucide-react";
import { Navigate } from "react-router-dom";
import clsx from "clsx";

import {
  AdminHeaderButton,
  AdminPageHeader,
} from "../components/admin/AdminPageHeader";
import { GroupedChoicePicker } from "../components/ui/GroupedChoicePicker";
import { PageSizePicker } from "../components/ui/PageSizePicker";
import { EmojiIconPickerModal } from "../components/catalog/ProductIconCarouselPicker";
import { ProductCategoriesManagerModal } from "../components/modals/ProductCategoriesManagerModal";
import { ProductAssigneeJobTitlesField } from "../components/catalog/ProductAssigneeJobTitlesField";
import { ProductNameLangFields } from "../components/catalog/ProductNameLangFields";
import { productNamesValid } from "../lib/langInput";
import { productCategoriesApi, productsApi } from "../lib/api";
import {
  ProductItemIcon,
  activeCategoriesForDepartment,
  categoryDisplayName,
  categoryPickerCategories,
  deptSkuPrefix,
  emojiForGroup,
  groupBgClass,
  nextProductSku,
  skuGroupAccentBar,
} from "../lib/productIcons";
import { productDisplayName } from "../lib/productDisplayName";
import { productDisplayUnit } from "../lib/productDisplayUnit";
import { emojiFromProductName } from "../lib/productEmojiRules";
import { useAuth } from "../lib/auth";
import {
  buildCatalogDepartmentPickerGroups,
  catalogDepartmentFilterCodes,
  catalogDeptOptions,
  useDepartments,
  type CatalogDeptOption,
} from "../lib/departments";
import { canEditCatalog, hasAppFeature } from "../lib/appFeatures";
import {
  RestockModal,
  ThresholdCell,
  canRestockProduct,
} from "./Products";
import type { Department, Product, ProductCategory, StockAdjustReason, StockWriteOffReason } from "../lib/types";

const STOCK_ROW_GRID =
  "sm:grid-cols-[1.1fr_2fr_1.2fr_1.2fr_1fr_minmax(7.5rem,auto)] lg:grid-cols-[1.1fr_2fr_1fr_1.2fr_1.2fr_1fr_minmax(7.5rem,auto)]";

const STOCK_MOBILE_GRID =
  "grid min-w-0 items-center gap-x-2 gap-y-1 text-[13px] leading-snug";
/** Row 2: name · restock · status */
const STOCK_MOBILE_ROW2 = "grid-cols-[minmax(0,1fr)_auto_auto]";

function inactiveRowClass(active: boolean) {
  return !active && "bg-[color:var(--color-paper-2)] text-[color:var(--color-ink-muted)]";
}

function inactiveTextClass(active: boolean) {
  return !active && "line-through decoration-[color:var(--color-ink-soft)]";
}

const PAGE_SIZE_OPTIONS = [50, 100, 150, 200] as const;
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

type StockSortKey = "sku" | "name" | "dept" | "on_hand" | "reorder_at" | "status";
type SortDir = "asc" | "desc";

const STOCK_STATUS_SORT_ORDER: Product["status"][] = [
  "out",
  "low",
  "ok",
  "service",
  "inactive",
];

function compareStockProducts(
  a: Product,
  b: Product,
  key: StockSortKey,
  dir: SortDir,
  lang: string,
  departmentLabel: (code: string) => string,
): number {
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
      cmp = departmentLabel(a.department).localeCompare(
        departmentLabel(b.department),
        lang,
        { sensitivity: "base" },
      );
      break;
    case "on_hand":
      cmp = (a.on_hand ?? -1) - (b.on_hand ?? -1);
      break;
    case "reorder_at":
      cmp = (a.reorder_at ?? -1) - (b.reorder_at ?? -1);
      break;
    case "status":
      cmp =
        STOCK_STATUS_SORT_ORDER.indexOf(a.status) -
        STOCK_STATUS_SORT_ORDER.indexOf(b.status);
      break;
  }
  if (cmp !== 0) return dir === "asc" ? cmp : -cmp;
  return a.sku.localeCompare(b.sku, undefined, { numeric: true });
}

function StockSortableHeader({
  label,
  column,
  sortKey,
  sortDir,
  onSort,
  align = "start",
  className,
}: {
  label: string;
  column: StockSortKey;
  sortKey: StockSortKey | null;
  sortDir: SortDir;
  onSort: (column: StockSortKey) => void;
  align?: "start" | "end";
  className?: string;
}) {
  const active = sortKey === column;
  const Icon = active ? (sortDir === "asc" ? ChevronUp : ChevronDown) : ChevronUp;
  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      className={clsx(
        "group/header inline-flex min-w-0 items-center gap-0.5 rounded-md -mx-1 px-1 py-0.5 text-left font-medium transition-colors",
        "hover:text-[color:var(--color-ink)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-ink)]/15",
        active
          ? "text-[color:var(--color-ink)]"
          : "text-[color:var(--color-ink-muted)]",
        align === "end" && "justify-end self-end",
        className,
      )}
    >
      <span className="truncate">{label}</span>
      <Icon
        className={clsx(
          "w-3 h-3 shrink-0 transition-opacity",
          active ? "opacity-100" : "opacity-0 group-hover/header:opacity-40",
        )}
        aria-hidden
      />
    </button>
  );
}

function syncIconEmojiFromName(name: string, setIconEmoji: (emoji: string) => void) {
  const inferred = emojiFromProductName(name);
  if (inferred) setIconEmoji(inferred);
}

const DECREASE_REASONS: { value: StockWriteOffReason; labelKey: string }[] = [
  { value: "damaged", labelKey: "products.restock_reason_damaged" },
  { value: "overfill", labelKey: "products.restock_reason_overfill" },
  { value: "expired", labelKey: "products.restock_reason_expired" },
  { value: "lost", labelKey: "products.restock_reason_lost" },
  { value: "count_adjust", labelKey: "products.restock_reason_count_adjust" },
];

const INCREASE_REASONS: { value: StockAdjustReason; labelKey: string }[] = [
  { value: "restock", labelKey: "reports.stock_reason.restock" },
  { value: "count_adjust", labelKey: "products.restock_reason_count_adjust" },
  { value: "overfill", labelKey: "products.restock_reason_overfill" },
];

function StockAdjustReasonModal({
  product,
  currentOnHand,
  targetOnHand,
  onClose,
  onConfirm,
  isPending,
  error,
}: {
  product: Product;
  currentOnHand: number;
  targetOnHand: number;
  onClose: () => void;
  onConfirm: (reason: StockAdjustReason) => void;
  isPending: boolean;
  error: Error | null;
}) {
  const { t, i18n } = useTranslation();
  const label = productDisplayName(product, i18n.language);
  const [reason, setReason] = useState<StockAdjustReason | "">("");
  const delta = targetOnHand - currentOnHand;
  const isDecrease = delta < 0;
  const reasons = isDecrease ? DECREASE_REASONS : INCREASE_REASONS;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal
        aria-labelledby="adjust-reason-title"
        className="w-full max-w-sm rounded-2xl border border-[color:var(--color-line)] bg-white p-4 shadow-xl"
      >
        <div className="mb-3 flex items-start gap-2">
          <ProductItemIcon sku={product.sku} name={product.name} iconEmoji={product.icon_emoji} size="sm" />
          <div className="min-w-0 flex-1">
            <h2 id="adjust-reason-title" className="text-lg font-semibold">
              {t("stock.adjust_reason_label")}
            </h2>
            <p className="mt-0.5 text-sm text-[color:var(--color-ink-muted)]">
              {label}: {currentOnHand} → {targetOnHand} ({delta > 0 ? `+${delta}` : delta})
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 hover:bg-[color:var(--color-paper-2)]"
            aria-label={t("common.cancel")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-xs leading-relaxed text-[color:var(--color-ink-muted)]">
          {t("stock.adjust_reason_hint")}
        </p>

        <fieldset className="mt-3 space-y-2">
          {reasons.map(({ value, labelKey }) => (
            <label
              key={value}
              className={clsx(
                "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm",
                reason === value
                  ? "border-[color:var(--color-ink)] bg-[color:var(--color-paper-2)]"
                  : "border-[color:var(--color-line)]",
              )}
            >
              <input
                type="radio"
                name={`adjust-reason-${product.id}`}
                value={value}
                checked={reason === value}
                onChange={() => setReason(value)}
                className="accent-[color:var(--color-ink)]"
              />
              {t(labelKey)}
            </label>
          ))}
        </fieldset>

        <div className="mt-4 flex w-full gap-2">
          <button
            type="button"
            onClick={onClose}
            className="w-1/4 shrink-0 rounded-lg border border-[color:var(--color-line)] bg-white py-2.5 text-sm font-medium hover:bg-[color:var(--color-paper-2)]"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            disabled={!reason || isPending}
            onClick={() => reason && onConfirm(reason)}
            className={clsx(
              "w-3/4 min-w-0 flex-[3] rounded-lg py-2.5 text-sm font-semibold",
              !reason || isPending
                ? "cursor-not-allowed bg-[color:var(--color-paper-2)] text-[color:var(--color-ink-muted)]"
                : "bg-[color:var(--color-ink)] text-white hover:opacity-90",
            )}
          >
            {isPending ? t("common.loading") : t("common.save")}
          </button>
        </div>

        {error && (
          <p className="mt-2 text-sm text-red-600" role="alert">
            {error.message}
          </p>
        )}
      </div>
    </div>
  );
}

function OnHandDisplay({ p }: { p: Product }) {
  const { i18n } = useTranslation();
  if (p.is_service || !p.active) {
    return (
      <span className="text-right text-[color:var(--color-ink-muted)]">—</span>
    );
  }
  const unitLabel = productDisplayUnit(p, i18n.language);
  return (
    <span className="shrink-0 text-right text-xs font-semibold tabular-nums text-[color:var(--color-ink)]">
      {`${p.on_hand ?? 0} ${unitLabel}`.trim()}
    </span>
  );
}

function ReorderDisplay({ p }: { p: Product }) {
  const { i18n } = useTranslation();
  if (p.is_service || !p.active) {
    return (
      <span className="text-right text-[color:var(--color-ink-muted)]">—</span>
    );
  }
  if (p.reorder_at == null) {
    return (
      <span className="text-right text-[color:var(--color-ink-muted)]">—</span>
    );
  }
  const unitLabel = productDisplayUnit(p, i18n.language);
  return (
    <span className="text-right tabular-nums text-[color:var(--color-ink-soft)]">
      {`${p.reorder_at} ${unitLabel}`.trim()}
    </span>
  );
}

function ProductStatusBadge({ p }: { p: Product }) {
  const { t } = useTranslation();
  return (
    <span
      className={clsx(
        "inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        p.status === "ok" &&
          "bg-[color:var(--color-stock-ok-bg)] text-[color:var(--color-stock-ok-fg)]",
        p.status === "low" &&
          "bg-[color:var(--color-stock-low-bg)] text-[color:var(--color-stock-low-fg)]",
        p.status === "out" &&
          "bg-[color:var(--color-stock-out-bg)] text-[color:var(--color-stock-out-fg)]",
        p.status === "service" &&
          "bg-[color:var(--color-stock-service-bg)] text-[color:var(--color-stock-service-fg)]",
        p.status === "inactive" &&
          "bg-[color:var(--color-paper)] text-[color:var(--color-ink-muted)]",
      )}
    >
      {t(`products.status.${p.status}`)}
    </span>
  );
}

function EditProductModal({
  product,
  onClose,
  canManageCatalog,
  categories,
  catalogDeptOptions: deptOptions,
}: {
  product: Product;
  onClose: () => void;
  canManageCatalog: boolean;
  categories: ProductCategory[];
  catalogDeptOptions: CatalogDeptOption[];
}) {
  const { t, i18n } = useTranslation();
  const { current } = useAuth();
  const qc = useQueryClient();

  const initialGroupCode = useMemo<string>(() => {
    const match = product.sku.match(/^[A-Z]{2}-([A-Z]{3,})-/);
    const code = (match?.[1] ?? "").toUpperCase();
    const codes = activeCategoriesForDepartment(categories, product.department).map(
      (c) => c.code,
    );
    if (code && (codes.includes(code) || product.is_service)) return code;
    return codes[0] ?? (product.is_service ? "SVC" : "GST");
  }, [product, categories]);

  const [name, setName] = useState(product.name);
  const [nameEn, setNameEn] = useState(product.name_en ?? "");
  const [unit, setUnit] = useState(product.unit ?? "");
  const [unitEn, setUnitEn] = useState(product.unit_en ?? "");
  const [iconEmoji, setIconEmoji] = useState(product.icon_emoji ?? "📦");
  const [onHand, setOnHand] = useState(String(product.on_hand ?? 0));
  const [reorderAt, setReorderAt] = useState(
    product.reorder_at == null ? "" : String(product.reorder_at),
  );
  const [dept, setDept] = useState<Department>(product.department);
  const [assigneeJobTitles, setAssigneeJobTitles] = useState<string[] | null>(
    product.assignee_job_titles ?? null,
  );
  const [groupCode, setGroupCode] = useState<string>(initialGroupCode);
  const deptActiveCategories = useMemo(
    () => categoryPickerCategories(categories, dept, groupCode),
    [categories, dept, groupCode],
  );
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [namesShowErrors, setNamesShowErrors] = useState(false);
  const [unitsShowErrors, setUnitsShowErrors] = useState(false);
  const [pendingAdjust, setPendingAdjust] = useState<{
    target: number;
    before: number;
  } | null>(null);

  const { data: allProducts = [] } = useQuery({
    queryKey: ["products"],
    queryFn: productsApi.list,
  });

  useEffect(() => {
    const codes = deptActiveCategories.map((c) => c.code);
    if (!codes.includes(groupCode)) {
      setGroupCode(codes[0] ?? (product.is_service ? "SVC" : "GST"));
    }
  }, [dept, deptActiveCategories, groupCode, product.is_service]);

  const derivedSku = useMemo(() => {
    if (dept === product.department && groupCode === initialGroupCode) {
      return product.sku;
    }
    const otherSkus = allProducts
      .filter((p) => p.id !== product.id)
      .map((p) => p.sku);
    return nextProductSku(otherSkus, dept, groupCode);
  }, [dept, groupCode, allProducts, product, initialGroupCode]);

  const fieldLabel =
    "text-[11px] font-semibold uppercase tracking-wide text-[color:var(--color-ink-muted)]";
  const inputClass =
    "mt-1.5 w-full rounded-xl border border-[color:var(--color-line)] bg-white px-3.5 py-2.5 text-sm shadow-sm transition-[border-color,box-shadow] focus:border-[color:var(--color-ink)]/20 focus:outline-none focus:ring-2 focus:ring-[color:var(--color-ink)]/8";

  const currentOnHand = product.on_hand ?? 0;
  const parsedOnHand = onHand.trim() === "" ? NaN : Number(onHand);
  const onHandValid =
    Number.isFinite(parsedOnHand) && parsedOnHand >= 0 && parsedOnHand <= 99999;
  const parsedReorder = reorderAt.trim() === "" ? null : Number(reorderAt);
  const reorderValid =
    reorderAt.trim() === "" ||
    (Number.isFinite(parsedReorder) && parsedReorder! >= 0 && parsedReorder! <= 99999);

  useEffect(() => {
    setName(product.name);
    setNameEn(product.name_en ?? "");
    setUnit(product.unit ?? "");
    setUnitEn(product.unit_en ?? "");
    setIconEmoji(product.icon_emoji ?? "📦");
    setOnHand(String(product.on_hand ?? 0));
    setReorderAt(product.reorder_at == null ? "" : String(product.reorder_at));
    setDept(product.department);
    setAssigneeJobTitles(product.assignee_job_titles ?? null);
    setGroupCode(initialGroupCode);
    setPendingAdjust(null);
    setNamesShowErrors(false);
    setUnitsShowErrors(false);
  }, [product, initialGroupCode]);

  const namesValid = productNamesValid({ th: name, en: nameEn });
  const unitsValid = productNamesValid({ th: unit, en: unitEn });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const onHandDirty =
    !product.is_service && onHandValid && parsedOnHand !== currentOnHand;
  const reorderDirty =
    !product.is_service &&
    reorderValid &&
    (parsedReorder ?? null) !== (product.reorder_at ?? null);
  const skuDirty = derivedSku !== product.sku;
  const assigneeTitlesDirty = useMemo(() => {
    const a = product.assignee_job_titles ?? null;
    const b = assigneeJobTitles;
    if (a == null && b == null) return false;
    if (a == null || b == null) return true;
    if (a.length !== b.length) return true;
    const sa = [...a].sort();
    const sb = [...b].sort();
    return sa.some((v, i) => v !== sb[i]);
  }, [product.assignee_job_titles, assigneeJobTitles]);

  const catalogDirty =
    canManageCatalog &&
    (name.trim() !== product.name ||
      (nameEn.trim() || null) !== (product.name_en ?? null) ||
      skuDirty ||
      assigneeTitlesDirty ||
      (!product.is_service &&
        (iconEmoji !== (product.icon_emoji ?? "📦") ||
          (unit.trim() || null) !== (product.unit?.trim() || null) ||
          (unitEn.trim() || null) !== (product.unit_en?.trim() || null))));

  const dirty = catalogDirty || onHandDirty || reorderDirty;

  const save = useMutation({
    mutationFn: async (adjustReason?: StockAdjustReason) => {
      const actorId = current?.id;
      const updatePayload: Partial<Product> = {};

      if (canManageCatalog && name.trim() !== product.name) {
        updatePayload.name = name.trim();
      }
      if (canManageCatalog) {
        const nextEn = nameEn.trim() || null;
        if (nextEn !== (product.name_en ?? null)) updatePayload.name_en = nextEn;
      }
      if (canManageCatalog && skuDirty) {
        updatePayload.sku = derivedSku;
        updatePayload.department = dept;
        const catEmoji = categories.find((c) => c.code === groupCode)?.icon_emoji;
        if (product.is_service) {
          updatePayload.icon_emoji =
            catEmoji?.trim() ||
            (groupCode === "SVC" && dept === "maintenance" ? "🔧" : "✨");
        }
      }
      if (canManageCatalog && assigneeTitlesDirty) {
        updatePayload.assignee_job_titles = assigneeJobTitles;
      }
      if (canManageCatalog && !product.is_service) {
        const nextUnit = unit.trim() || null;
        const nextUnitEn = unitEn.trim() || null;
        if (nextUnit !== (product.unit?.trim() || null)) {
          updatePayload.unit = nextUnit;
        }
        if (nextUnitEn !== (product.unit_en?.trim() || null)) {
          updatePayload.unit_en = nextUnitEn;
        }
        if (iconEmoji !== (product.icon_emoji ?? "📦")) {
          updatePayload.icon_emoji = iconEmoji;
        }
      }
      if (reorderDirty) {
        updatePayload.reorder_at = parsedReorder;
      }

      if (Object.keys(updatePayload).length > 0) {
        await productsApi.update(product.id, {
          ...updatePayload,
          ...(actorId != null ? { actor_id: actorId } : {}),
        });
      }

      if (onHandDirty) {
        if (adjustReason == null) {
          throw new Error(t("stock.adjust_reason_hint"));
        }
        await productsApi.adjust(
          product.id,
          parsedOnHand - currentOnHand,
          actorId,
          adjustReason,
        );
      }
    },
    onSuccess: () => {
      setPendingAdjust(null);
      void qc.invalidateQueries({ queryKey: ["products"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      void qc.invalidateQueries({ queryKey: ["reports"] });
      onClose();
    },
  });

  const handleSave = () => {
    if (canManageCatalog && !namesValid) {
      setNamesShowErrors(true);
      return;
    }
    if (canManageCatalog && !product.is_service && !unitsValid) {
      setUnitsShowErrors(true);
      return;
    }
    if (!onHandValid || !reorderValid) return;
    if (onHandDirty) {
      setPendingAdjust({ target: parsedOnHand, before: currentOnHand });
      return;
    }
    save.mutate(undefined);
  };

  return (
    <>
      <div
        role="presentation"
        className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          role="dialog"
          aria-modal
          aria-labelledby="edit-product-title"
          className="flex max-h-[min(48rem,92vh)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-[color:var(--color-line)] bg-white shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-[color:var(--color-line)] px-5 py-4">
            <div>
              <h3 id="edit-product-title" className="text-base font-semibold">
                {t("stock.edit_product_title")}
              </h3>
              <p className="mt-0.5 text-xs text-[color:var(--color-ink-soft)]">
                {t("stock.edit_product_hint")}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-[color:var(--color-ink-soft)] hover:bg-[color:var(--color-paper-2)]"
              aria-label={t("common.cancel")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-[color:var(--color-line)]/70 bg-[color:var(--color-paper)]/40 px-5 py-6">
              <span className={clsx(fieldLabel, "text-center")}>
                {t("stock.sku_label")}
              </span>
              <SkuChips
                sku={derivedSku}
                editable={canManageCatalog}
                dept={dept}
                onDeptChange={setDept}
                deptOptions={deptOptions}
                groupCode={groupCode}
                onGroupChange={setGroupCode}
                categories={deptActiveCategories}
                lang={i18n.language}
                t={t}
              />
            </div>

            {canManageCatalog && (
              <ProductAssigneeJobTitlesField
                department={dept}
                value={assigneeJobTitles}
                onChange={setAssigneeJobTitles}
              />
            )}

            {canManageCatalog ? (
              <div className="rounded-2xl border border-[color:var(--color-line)]/80 bg-[color:var(--color-paper)]/30 p-4 sm:p-5">
                <p className={sectionTitleClass()}>{t("stock.details_section")}</p>
                <div className="mt-3">
                  <ProductNameLangFields
                    name={name}
                    nameEn={nameEn}
                    onNameChange={(next) => {
                      setName(next);
                      syncIconEmojiFromName(next, setIconEmoji);
                    }}
                    onNameEnChange={setNameEn}
                    fieldLabel={fieldLabel}
                    inputClass={inputClass}
                    thAutoFocus
                    showErrors={namesShowErrors}
                    iconSlot={
                      product.is_service ? (
                        <div className="rounded-2xl border border-[color:var(--color-line)]/70 bg-white p-2.5 shadow-sm">
                          <span
                            className={clsx(
                              "inline-flex h-12 w-12 items-center justify-center rounded-xl text-2xl",
                              groupBgClass(groupCode, dept),
                            )}
                          >
                            {emojiForGroup(groupCode, dept)}
                          </span>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => setIconPickerOpen(true)}
                            className="rounded-2xl border border-[color:var(--color-line)]/70 bg-white p-2.5 shadow-sm transition-[box-shadow] hover:ring-2 hover:ring-[color:var(--color-ink)]/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-ink)]/25"
                            aria-label={t("stock.icon_click_to_change")}
                          >
                            <ProductItemIcon
                              sku={product.sku}
                              name={name || product.name}
                              iconEmoji={iconEmoji}
                              size="lg"
                              className="h-12 w-12 rounded-xl [&>span]:text-2xl"
                            />
                          </button>
                          <span className="text-center text-[10px] text-[color:var(--color-ink-muted)]">
                            {t("stock.icon_click_hint")}
                          </span>
                        </>
                      )
                    }
                  />
                </div>
              </div>
            ) : (
              <div className="block">
                <span className={fieldLabel}>{t("products.table.name")}</span>
                <p className={clsx(inputClass, "cursor-default bg-[color:var(--color-paper-2)]/80 shadow-none")}>
                  {productDisplayName(product, i18n.language)}
                </p>
              </div>
            )}

            {!product.is_service && (
              <div className="rounded-2xl border border-[color:var(--color-line)]/80 bg-[color:var(--color-paper)]/30 p-4 sm:p-5">
                <p className={sectionTitleClass()}>{t("stock.stock_section")}</p>
                <div className="mt-3 space-y-4">
                  {canManageCatalog && (
                    <ProductNameLangFields
                      variant="unit"
                      name={unit}
                      nameEn={unitEn}
                      onNameChange={setUnit}
                      onNameEnChange={setUnitEn}
                      fieldLabel={fieldLabel}
                      inputClass={inputClass}
                      showErrors={unitsShowErrors}
                    />
                  )}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className={fieldLabel}>{t("stock.on_hand")}</span>
                      <input
                        inputMode="numeric"
                        value={onHand}
                        onChange={(e) =>
                          setOnHand(e.target.value.replace(/[^0-9]/g, "").slice(0, 5))
                        }
                        className={clsx(
                          inputClass,
                          "tabular-nums",
                          !onHandValid && onHand.trim() !== "" && "border-red-300",
                        )}
                      />
                    </label>
                    <label className="block">
                      <span className={fieldLabel}>{t("stock.reorder_at")}</span>
                      <input
                        inputMode="numeric"
                        value={reorderAt}
                        onChange={(e) =>
                          setReorderAt(e.target.value.replace(/[^0-9]/g, "").slice(0, 5))
                        }
                        placeholder="—"
                        className={clsx(inputClass, "tabular-nums")}
                      />
                    </label>
                  </div>
                </div>
              </div>
            )}

            {save.isError && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {(save.error as Error).message}
              </p>
            )}
          </div>

          <div className="flex w-full gap-2 border-t border-[color:var(--color-line)] bg-[color:var(--color-paper)]/25 px-5 py-4">
            <button
              type="button"
              onClick={onClose}
              className="w-1/4 shrink-0 rounded-xl border border-[color:var(--color-line)] bg-white py-2.5 text-sm font-medium shadow-sm hover:bg-[color:var(--color-paper-2)]"
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              disabled={
                (canManageCatalog && !namesValid) ||
                (canManageCatalog && !product.is_service && !unitsValid) ||
                !dirty ||
                !onHandValid ||
                !reorderValid ||
                save.isPending
              }
              onClick={handleSave}
              className="w-3/4 min-w-0 flex-[3] rounded-xl bg-[color:var(--color-ink)] py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-50 hover:opacity-90"
            >
              {save.isPending ? t("common.loading") : t("common.save")}
            </button>
          </div>
        </div>
      </div>

      {iconPickerOpen && (
        <EmojiIconPickerModal
          value={iconEmoji}
          onSelect={setIconEmoji}
          onClose={() => setIconPickerOpen(false)}
        />
      )}

      {pendingAdjust != null && (
        <StockAdjustReasonModal
          product={product}
          currentOnHand={pendingAdjust.before}
          targetOnHand={pendingAdjust.target}
          onClose={() => setPendingAdjust(null)}
          onConfirm={(reason) => save.mutate(reason)}
          isPending={save.isPending}
          error={save.isError ? (save.error as Error) : null}
        />
      )}
    </>
  );
}

function ProductRow({
  p,
  canManageCatalog,
  categories,
  catalogDeptOptions: deptOptions,
  departmentLabel,
  onRestock,
}: {
  p: Product;
  canManageCatalog: boolean;
  categories: ProductCategory[];
  catalogDeptOptions: CatalogDeptOption[];
  departmentLabel: (code: string | null | undefined) => string;
  onRestock: (product: Product) => void;
}) {
  const { t, i18n } = useTranslation();
  const label = productDisplayName(p, i18n.language);
  const qc = useQueryClient();
  const { current } = useAuth();
  const actorId = current?.id;
  const inactive = !p.active;
  const [editOpen, setEditOpen] = useState(false);

  const update = useMutation({
    mutationFn: (payload: { reorder_at?: number | null; active?: boolean }) =>
      productsApi.update(p.id, {
        ...payload,
        ...(actorId != null ? { actor_id: actorId } : {}),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["products"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const toggleActive = () => {
    update.mutate({ active: !p.active });
  };

  const actionButtons = (
    <>
      <button
        type="button"
        disabled={inactive}
        onClick={() => setEditOpen(true)}
        className="inline-flex items-center gap-1 rounded-md border border-[color:var(--color-line)] bg-white px-2 py-1 text-xs font-medium hover:bg-[color:var(--color-paper)] disabled:cursor-not-allowed disabled:opacity-40"
        aria-label={t("stock.edit_product")}
        title={t("stock.edit_product")}
      >
        <Pencil className="h-3.5 w-3.5" />
        <span className="hidden lg:inline">{t("stock.edit_product")}</span>
      </button>
      {canManageCatalog &&
        (inactive ? (
          <button
            type="button"
            disabled={update.isPending}
            onClick={toggleActive}
            className="inline-flex items-center gap-1 rounded-md border border-[color:var(--color-line)] bg-white px-2 py-1 text-xs font-medium hover:bg-[color:var(--color-paper)] disabled:opacity-40"
            aria-label={t("stock.restore")}
            title={t("stock.restore")}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">{t("stock.restore")}</span>
          </button>
        ) : (
          <button
            type="button"
            disabled={update.isPending}
            onClick={toggleActive}
            className="inline-flex items-center gap-1 rounded-md border border-[color:var(--color-line)] bg-white px-2 py-1 text-xs font-medium text-[color:var(--color-ink-soft)] hover:bg-[color:var(--color-paper)] disabled:opacity-40"
            aria-label={t("stock.deactivate")}
            title={t("stock.deactivate")}
          >
            <XCircle className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">{t("stock.deactivate")}</span>
          </button>
        ))}
    </>
  );

  return (
    <li className={clsx("text-sm", inactiveRowClass(p.active))}>
      <div className="flex flex-col gap-1.5 px-3 py-2.5 sm:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={clsx(
              "shrink-0 font-mono text-[11px] leading-snug text-[color:var(--color-ink-soft)]",
              inactiveTextClass(p.active),
            )}
          >
            {p.sku}
          </span>
          <div
            className={clsx(
              "flex min-w-0 flex-1 items-center justify-end gap-2",
              inactiveTextClass(p.active),
            )}
          >
            <ThresholdCell p={p} editable={canManageCatalog} compact />
            <OnHandDisplay p={p} />
          </div>
        </div>
        <div className={clsx(STOCK_MOBILE_GRID, STOCK_MOBILE_ROW2)}>
          <span
            className={clsx(
              "inline-flex min-w-0 items-center gap-1.5 font-medium leading-snug",
              inactiveTextClass(p.active),
            )}
          >
            <ProductItemIcon sku={p.sku} name={p.name} iconEmoji={p.icon_emoji} size="xs" />
            <span className="min-w-0 truncate text-sm">{label}</span>
          </span>
          <div className="flex justify-center">
            {canRestockProduct(current, p) ? (
              <button
                type="button"
                disabled={inactive}
                onClick={() => onRestock(p)}
                className={clsx(
                  "inline-flex max-w-full items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold leading-tight whitespace-nowrap shadow-sm transition-[filter,transform] hover:brightness-110 active:scale-[0.98] disabled:opacity-40",
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
            <ProductStatusBadge p={p} />
          </span>
        </div>
        {canManageCatalog ? (
          <div className="flex flex-wrap justify-end gap-1 pt-0.5">{actionButtons}</div>
        ) : null}
      </div>

      <div
        className={clsx(
          "hidden items-center gap-3 px-4 py-3 sm:grid",
          STOCK_ROW_GRID,
        )}
      >
        <span
          className={clsx(
            "font-mono text-[12.5px] text-[color:var(--color-ink-soft)]",
            inactiveTextClass(p.active),
          )}
        >
          {p.sku}
        </span>
        <span
          className={clsx(
            "inline-flex min-w-0 items-center gap-2 font-medium",
            inactiveTextClass(p.active),
          )}
        >
          <ProductItemIcon sku={p.sku} name={p.name} iconEmoji={p.icon_emoji} size="xs" />
          <span className="truncate">{label}</span>
        </span>
        <span
          className={clsx(
            "hidden text-[color:var(--color-ink-soft)] lg:block",
            inactiveTextClass(p.active),
          )}
        >
          {departmentLabel(p.department)}
        </span>
        <OnHandDisplay p={p} />
        <ReorderDisplay p={p} />
        <span className="flex justify-center">
          <ProductStatusBadge p={p} />
        </span>
        <span className="flex flex-wrap justify-end gap-1">{actionButtons}</span>
      </div>

      {editOpen && !inactive && (
        <EditProductModal
          product={p}
          canManageCatalog={canManageCatalog}
          onClose={() => setEditOpen(false)}
          categories={categories}
          catalogDeptOptions={deptOptions}
        />
      )}
    </li>
  );
}

function sectionTitleClass() {
  return "text-xs font-semibold uppercase tracking-wide text-[color:var(--color-ink-muted)]";
}

interface SkuChipOption<T extends string> {
  value: T;
  code: string;
  label: string;
}

const STATIC_CHIP_CLASS =
  "select-none rounded-xl bg-white px-4 py-2 shadow-sm ring-1 ring-[color:var(--color-line)]";
const ACTIVE_CHIP_CLASS =
  "select-none rounded-xl bg-white px-4 py-2 shadow-sm ring-1 ring-[color:var(--color-line)] transition-[box-shadow,transform] hover:ring-2 hover:ring-[color:var(--color-ink)]/20 hover:shadow-md active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-ink)]/25";

function ChipPopover<T extends string>({
  label,
  ariaLabel,
  value,
  options,
  onChange,
  align = "center",
}: {
  label: string;
  ariaLabel: string;
  value: T;
  options: SkuChipOption<T>[];
  onChange: (next: T) => void;
  align?: "center" | "start";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={ACTIVE_CHIP_CLASS}
      >
        {label}
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label={ariaLabel}
          className={clsx(
            "absolute top-full z-[60] mt-2 max-h-72 min-w-[14rem] overflow-y-auto rounded-xl border border-[color:var(--color-line)] bg-white py-1 text-sm font-normal tracking-normal shadow-xl",
            align === "center" && "left-1/2 -translate-x-1/2",
            align === "start" && "left-0",
          )}
        >
          {options.map((opt) => {
            const active = opt.value === value;
            return (
              <li key={opt.value} role="option" aria-selected={active}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={clsx(
                    "flex w-full items-center justify-between gap-3 px-3 py-2 text-left font-sans",
                    active
                      ? "bg-[color:var(--color-paper-2)] font-semibold text-[color:var(--color-ink)]"
                      : "text-[color:var(--color-ink-soft)] hover:bg-[color:var(--color-paper-2)]/80",
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="shrink-0 rounded-md bg-[color:var(--color-paper-2)] px-1.5 py-0.5 font-mono text-[11px] text-[color:var(--color-ink)]">
                      {opt.code}
                    </span>
                    <span className="truncate">{opt.label}</span>
                  </span>
                  {active && (
                    <Check className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function SkuChips({
  sku,
  editable = false,
  dept,
  onDeptChange,
  deptOptions = [],
  groupCode,
  onGroupChange,
  categories,
  lang,
  t,
  className,
}: {
  sku: string;
  editable?: boolean;
  dept?: Department;
  onDeptChange?: (next: Department) => void;
  deptOptions?: CatalogDeptOption[];
  groupCode?: string;
  onGroupChange?: (next: string) => void;
  categories?: ProductCategory[];
  lang?: string;
  t?: TFunction;
  className?: string;
}) {
  const [prefix = "", middle = "", seq = ""] = sku.split("-");
  const deptInteractive = Boolean(editable && t && dept && onDeptChange);
  const groupInteractive = Boolean(
    editable && t && groupCode && onGroupChange && categories?.length,
  );

  return (
    <div
      className={clsx(
        "flex flex-wrap items-center justify-center gap-x-3 gap-y-2 font-mono text-xl font-semibold tabular-nums tracking-tight sm:text-2xl",
        className,
      )}
      aria-label={sku}
    >
      {deptInteractive && t && dept && onDeptChange ? (
        <ChipPopover
          label={prefix}
          ariaLabel={t("stock.department")}
          value={dept}
          options={deptOptions.map((d) => ({
            value: d.value,
            code: d.code,
            label: d.label,
          }))}
          onChange={onDeptChange}
          align="start"
        />
      ) : (
        <span className={STATIC_CHIP_CLASS}>{prefix}</span>
      )}

      <span className="select-none text-[color:var(--color-ink-muted)]" aria-hidden>
        –
      </span>

      {groupInteractive && t && groupCode && onGroupChange && categories ? (
        <ChipPopover
          label={middle}
          ariaLabel={t("stock.product_category")}
          value={groupCode}
          options={(categories ?? [])
            .filter((c) => c.active)
            .map((c) => ({
              value: c.code,
              code: c.code,
              label: categoryDisplayName(c, lang ?? "th"),
            }))}
          onChange={onGroupChange}
        />
      ) : (
        <span className={STATIC_CHIP_CLASS}>{middle}</span>
      )}

      <span className="select-none text-[color:var(--color-ink-muted)]" aria-hidden>
        –
      </span>

      <span className="select-none rounded-xl bg-[color:var(--color-ink)] px-4 py-2 text-white shadow-sm">
        {seq}
      </span>
    </div>
  );
}

function SkuCodePreview({
  sku,
  departmentLabel,
  group,
  categories,
  lang,
  t,
}: {
  sku: string;
  departmentLabel: string;
  group: string;
  categories: ProductCategory[];
  lang: string;
  t: TFunction;
}) {
  const [prefix = "", middle = "", seq = ""] = sku.split("-");
  const groupKey = group;
  const groupLabel = (() => {
    const cat = categories.find((c) => c.code === groupKey);
    if (cat) return categoryDisplayName(cat, lang);
    if (groupKey === "SVC") return t("stock.icon_group.SVC");
    return groupKey;
  })();

  return (
    <div className="rounded-xl border border-[color:var(--color-line)]/90 bg-white px-4 py-4">
      <p className="text-sm font-medium text-[color:var(--color-ink)]">
        {t("stock.sku_preview_title")}
      </p>
      <div
        className="mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 font-mono text-xl font-semibold tabular-nums tracking-tight sm:text-2xl"
        aria-label={sku}
      >
        <span className="rounded-lg bg-[color:var(--color-paper-2)] px-3 py-1.5">{prefix}</span>
        <span className="text-[color:var(--color-ink-muted)]" aria-hidden>
          -
        </span>
        <span className="rounded-lg bg-[color:var(--color-paper-2)] px-3 py-1.5">{middle}</span>
        <span className="text-[color:var(--color-ink-muted)]" aria-hidden>
          -
        </span>
        <span className="rounded-lg bg-[color:var(--color-ink)] px-3 py-1.5 text-white">
          {seq}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-[color:var(--color-line)]/70 pt-3 text-center">
        <div>
          <p className={sectionTitleClass()}>{t("stock.sku_part_dept")}</p>
          <p className="mt-1 text-xs font-medium text-[color:var(--color-ink-soft)]">
            {departmentLabel}
          </p>
          <p className="mt-0.5 font-mono text-[11px] text-[color:var(--color-ink-muted)]">{prefix}</p>
        </div>
        <div>
          <p className={sectionTitleClass()}>{t("stock.sku_part_group")}</p>
          <p className="mt-1 text-xs font-medium text-[color:var(--color-ink-soft)]">
            {groupLabel}
          </p>
          <p className="mt-0.5 font-mono text-[11px] text-[color:var(--color-ink-muted)]">{middle}</p>
        </div>
        <div>
          <p className={sectionTitleClass()}>{t("stock.sku_part_seq")}</p>
          <p className="mt-1 text-xs font-medium text-[color:var(--color-ink-soft)]">
            {t("stock.sku_part_seq_hint")}
          </p>
          <p className="mt-0.5 font-mono text-[11px] text-[color:var(--color-ink-muted)]">{seq}</p>
        </div>
      </div>
    </div>
  );
}

function NewSkuForm({
  products,
  categories,
  catalogDeptOptions: deptOptions,
  deptPickerGroups,
  defaultDepartment,
  onDone,
}: {
  products: Product[];
  categories: ProductCategory[];
  catalogDeptOptions: CatalogDeptOption[];
  deptPickerGroups: ReturnType<typeof buildCatalogDepartmentPickerGroups>;
  defaultDepartment: Department;
  onDone: () => void;
}) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const { current } = useAuth();
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [department, setDepartment] = useState<Department>(defaultDepartment);
  const activeCategories = useMemo(
    () => activeCategoriesForDepartment(categories, department),
    [categories, department],
  );
  const defaultServiceCategory = useMemo(() => {
    if (activeCategories.some((c) => c.code === "SVC")) return "SVC";
    return activeCategories[0]?.code ?? "SVC";
  }, [activeCategories]);
  const fallbackCategoryCode = activeCategories[0]?.code ?? "GST";
  const [category, setCategory] = useState<string>(fallbackCategoryCode);
  const [isService, setIsService] = useState(false);

  useEffect(() => {
    if (!activeCategories.some((c) => c.code === category)) {
      setCategory(isService ? defaultServiceCategory : fallbackCategoryCode);
    }
  }, [activeCategories, category, fallbackCategoryCode, isService, defaultServiceCategory]);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [iconEmoji, setIconEmoji] = useState("📦");
  const [unit, setUnit] = useState("");
  const [unitEn, setUnitEn] = useState("");
  const [onHand, setOnHand] = useState("0");
  const [reorderAt, setReorderAt] = useState("");
  const [assigneeJobTitles, setAssigneeJobTitles] = useState<string[] | null>(null);
  const [namesShowErrors, setNamesShowErrors] = useState(false);
  const [unitsShowErrors, setUnitsShowErrors] = useState(false);

  const fieldLabel =
    "text-[11px] font-semibold uppercase tracking-wide text-[color:var(--color-ink-muted)]";
  const inputClass =
    "mt-1.5 w-full rounded-xl border border-[color:var(--color-line)] bg-white px-3.5 py-2.5 text-sm shadow-sm transition-[border-color,box-shadow] focus:border-[color:var(--color-ink)]/20 focus:outline-none focus:ring-2 focus:ring-[color:var(--color-ink)]/8";

  const existingSkus = useMemo(() => products.map((p) => p.sku), [products]);
  const skuGroup = category;

  useEffect(() => {
    setSku(nextProductSku(existingSkus, department, skuGroup));
  }, [existingSkus, department, skuGroup]);

  useEffect(() => {
    setAssigneeJobTitles(null);
  }, [department]);

  const categoryPickerGroups = useMemo(
    () => [
      {
        title: t("stock.product_category"),
        sectionDotClass: "bg-violet-500",
        items: activeCategories.map((cat) => ({
          value: cat.code,
          label: `${categoryDisplayName(cat, i18n.language)} · ${cat.code}`,
          accentBarClass: skuGroupAccentBar(cat.code),
        })),
      },
    ],
    [t, i18n.language, activeCategories],
  );

  const namesValid = productNamesValid({ th: name, en: nameEn });
  const unitsValid = isService || productNamesValid({ th: unit, en: unitEn });

  const create = useMutation({
    mutationFn: () =>
      productsApi.create({
        sku: sku.trim(),
        name: name.trim(),
        name_en: nameEn.trim(),
        department,
        unit: isService ? null : unit.trim(),
        unit_en: isService ? null : unitEn.trim(),
        on_hand: isService ? null : Number(onHand || 0),
        reorder_at: isService || !reorderAt ? null : Number(reorderAt),
        is_service: isService,
        assignee_job_titles: assigneeJobTitles,
        icon_emoji: isService
          ? department === "maintenance"
            ? "🔧"
            : department === "bell_boy"
              ? "🧳"
              : department === "front_office"
                ? "📞"
                : "✨"
          : iconEmoji,
        ...(current?.id != null ? { actor_id: current.id } : {}),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["products"] });
      onDone();
    },
  });

  const tryCreate = () => {
    if (!namesValid) {
      setNamesShowErrors(true);
      return;
    }
    if (!isService && !unitsValid) {
      setUnitsShowErrors(true);
      return;
    }
    create.mutate();
  };

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onDone();
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onDone]);

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-[100] grid place-items-center bg-black/45 px-4 py-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onDone();
      }}
    >
      <section
        role="dialog"
        aria-modal
        className="flex max-h-[min(50rem,92vh)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[color:var(--color-line)] bg-white shadow-xl"
      >
        <div className="flex items-start gap-3 border-b border-[color:var(--color-line)] bg-[color:var(--color-paper)]/40 px-5 py-4">
          <Package
            className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--color-ink-soft)]"
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-[color:var(--color-ink)]">
              {t("stock.new_sku")}
            </h2>
            <p className="mt-0.5 text-xs text-[color:var(--color-ink-soft)]">
              {t("stock.new_sku_hint")}
            </p>
          </div>
          <button
            type="button"
            onClick={onDone}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg hover:bg-[color:var(--color-paper-2)]"
            aria-label={t("common.close")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5">
        <label
          className={clsx(
            "flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 shadow-sm transition-colors",
            isService
              ? "border-[color:var(--color-ink)]/25 bg-white ring-2 ring-[color:var(--color-ink)]/8"
              : "border-[color:var(--color-line)] bg-white hover:bg-[color:var(--color-paper-2)]/40",
          )}
        >
          <input
            type="checkbox"
            checked={isService}
            onChange={(e) => setIsService(e.target.checked)}
            className="h-4 w-4 shrink-0 accent-[color:var(--color-ink)]"
          />
          <span className="min-w-0 leading-snug">
            <span className="block text-sm font-medium text-[color:var(--color-ink)]">
              {t("stock.is_service")}
            </span>
            <span className="mt-0.5 block text-[11px] text-[color:var(--color-ink-muted)]">
              {t("stock.is_service_hint")}
            </span>
          </span>
        </label>

        <div className="space-y-4 rounded-2xl border border-[color:var(--color-line)]/80 bg-[color:var(--color-paper)]/30 p-4 sm:p-5">
          <div>
            <p className={sectionTitleClass()}>{t("stock.sku_section")}</p>
            <p className="mt-1 text-sm text-[color:var(--color-ink-soft)]">
              {t("stock.sku_section_hint")}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="block min-w-0">
              <span className={fieldLabel}>{t("stock.department")}</span>
              <div className="mt-1.5">
                <GroupedChoicePicker
                  ariaLabel={t("stock.department")}
                  value={department}
                  onChange={setDepartment}
                  groups={deptPickerGroups}
                />
              </div>
            </div>

            <div className="block min-w-0">
              <span className={fieldLabel}>{t("stock.product_category")}</span>
              <div className="mt-1.5">
                <GroupedChoicePicker
                  ariaLabel={t("stock.product_category")}
                  value={category}
                  onChange={setCategory}
                  groups={categoryPickerGroups}
                />
              </div>
              <span className="mt-1.5 block text-[11px] leading-snug text-[color:var(--color-ink-muted)]">
                {isService
                  ? t("stock.product_category_service_hint")
                  : t("stock.product_category_hint")}
              </span>
            </div>
          </div>

          <SkuCodePreview
            sku={sku}
            departmentLabel={
              deptOptions.find((d) => d.value === department)?.label ?? department
            }
            group={category}
            categories={categories}
            lang={i18n.language}
            t={t}
          />

          <ProductAssigneeJobTitlesField
            department={department}
            value={assigneeJobTitles}
            onChange={setAssigneeJobTitles}
            className="pt-2"
          />
        </div>

        <div className="space-y-4 rounded-2xl border border-[color:var(--color-line)]/80 bg-[color:var(--color-paper)]/30 p-4 sm:p-5">
          <p className={sectionTitleClass()}>{t("stock.details_section")}</p>

          <ProductNameLangFields
            name={name}
            nameEn={nameEn}
            onNameChange={(next) => {
              setName(next);
              syncIconEmojiFromName(next, setIconEmoji);
            }}
            onNameEnChange={setNameEn}
            fieldLabel={fieldLabel}
            inputClass={inputClass}
            showErrors={namesShowErrors}
            iconSlot={
              !isService ? (
                <>
                  <button
                    type="button"
                    onClick={() => setIconPickerOpen(true)}
                    className="group rounded-2xl border border-[color:var(--color-line)]/70 bg-white p-3 shadow-sm transition-[box-shadow,ring-color] hover:ring-2 hover:ring-[color:var(--color-ink)]/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-ink)]/25"
                    aria-label={t("stock.icon_click_to_change")}
                  >
                    <ProductItemIcon
                      sku={sku}
                      name={name || t("stock.name_placeholder")}
                      iconEmoji={iconEmoji}
                      size="lg"
                      className="h-14 w-14 rounded-2xl [&>span]:text-3xl"
                    />
                  </button>
                  <span className="text-center text-[11px] text-[color:var(--color-ink-muted)]">
                    {t("stock.icon_click_hint")}
                  </span>
                </>
              ) : (
                <div className="rounded-2xl border border-[color:var(--color-line)]/70 bg-white p-3 shadow-sm">
                  <span
                    className={clsx(
                      "inline-flex h-14 w-14 items-center justify-center rounded-2xl text-3xl",
                      groupBgClass("SVC", department),
                    )}
                  >
                    {emojiForGroup("SVC", department)}
                  </span>
                </div>
              )
            }
          />
        </div>

        {!isService && iconPickerOpen && (
          <EmojiIconPickerModal
            value={iconEmoji}
            onSelect={setIconEmoji}
            onClose={() => setIconPickerOpen(false)}
          />
        )}

        {!isService && (
          <div className="rounded-2xl border border-[color:var(--color-line)]/80 bg-[color:var(--color-paper)]/30 p-4 sm:p-5">
            <p className={sectionTitleClass()}>{t("stock.stock_section")}</p>
            <div className="mt-3 space-y-4">
              <ProductNameLangFields
                variant="unit"
                name={unit}
                nameEn={unitEn}
                onNameChange={setUnit}
                onNameEnChange={setUnitEn}
                fieldLabel={fieldLabel}
                inputClass={inputClass}
                showErrors={unitsShowErrors}
              />
              <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-[color:var(--color-ink-soft)]">
                  {t("stock.on_hand")}
                </span>
                <input
                  inputMode="numeric"
                  value={onHand}
                  onChange={(e) => setOnHand(e.target.value.replace(/[^0-9]/g, ""))}
                  className={clsx(inputClass, "tabular-nums")}
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-[color:var(--color-ink-soft)]">
                  {t("stock.reorder_at")}
                </span>
                <input
                  inputMode="numeric"
                  value={reorderAt}
                  onChange={(e) => setReorderAt(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="—"
                  className={clsx(inputClass, "tabular-nums")}
                />
              </label>
              </div>
            </div>
          </div>
        )}

        {create.isError && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            {(create.error as Error).message}
          </p>
        )}
      </div>

        <div className="flex w-full gap-2 border-t border-[color:var(--color-line)] bg-[color:var(--color-paper)]/25 px-5 py-4">
          <button
            type="button"
            onClick={onDone}
            className="w-1/4 shrink-0 rounded-xl border border-[color:var(--color-line)] bg-white py-2.5 text-sm font-medium shadow-sm hover:bg-[color:var(--color-paper-2)]"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            disabled={!sku.trim() || !namesValid || !unitsValid || create.isPending}
            onClick={tryCreate}
            className="w-3/4 min-w-0 flex-[3] rounded-xl bg-[color:var(--color-ink)] py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-50 hover:opacity-90"
          >
            {create.isPending ? t("common.loading") : t("common.save")}
          </button>
        </div>
      </section>
    </div>
  );
}

type StockStatusFilter = "all" | Product["status"];
type StockDeptFilter = "all" | Department;

const STOCK_STATUS_FILTERS: StockStatusFilter[] = [
  "all",
  "ok",
  "low",
  "out",
  "service",
  "inactive",
];

type StockPageProps = {
  /** Render without page header when nested in another layout. */
  embedded?: boolean;
};

export function StockPage({ embedded = false }: StockPageProps = {}) {
  const { t, i18n } = useTranslation();
  const { current } = useAuth();
  const { departments, departmentLabel } = useDepartments();
  const deptFilterCodes = useMemo(
    () => catalogDepartmentFilterCodes(departments),
    [departments],
  );
  const deptOptions = useMemo(
    () => catalogDeptOptions(departments, i18n.language, deptSkuPrefix),
    [departments, i18n.language],
  );
  const deptPickerGroups = useMemo(
    () => buildCatalogDepartmentPickerGroups(departments, t("stock.department")),
    [departments, t],
  );
  const defaultCatalogDept =
    deptFilterCodes[0] ?? ("housekeeping" as Department);
  const { data = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: productsApi.list,
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["product-categories"],
    queryFn: () => productCategoriesApi.list(),
  });
  const [adding, setAdding] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState<StockDeptFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StockStatusFilter>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(50);
  const [restockFor, setRestockFor] = useState<Product | null>(null);
  const [sort, setSort] = useState<{ key: StockSortKey; dir: SortDir }>({
    key: "sku",
    dir: "asc",
  });
  const tableRef = useRef<HTMLDivElement>(null);
  const paginationScrollReadyRef = useRef(false);

  const onSort = (column: StockSortKey) => {
    setSort((cur) =>
      cur.key === column
        ? { key: column, dir: cur.dir === "asc" ? "desc" : "asc" }
        : { key: column, dir: "asc" },
    );
  };

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

  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a, b) =>
      compareStockProducts(a, b, sort.key, sort.dir, i18n.language, departmentLabel),
    );
  }, [filteredRows, sort, i18n.language, departmentLabel]);

  const totalRows = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const currentPage = Math.min(page, totalPages);
  useEffect(() => {
    setPage(1);
  }, [pageSize, sort.key, sort.dir, search, deptFilter, statusFilter]);

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
    requestAnimationFrame(() => {
      tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [currentPage, pageSize]);

  const pageRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, currentPage, pageSize]);

  const rangeFrom = totalRows === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeTo = Math.min(currentPage * pageSize, totalRows);

  const canManageCatalog = Boolean(current && canEditCatalog(current));

  if (!embedded && current) {
    if (current.role === "admin") {
      return <Navigate to="/admin/stock" replace />;
    }
    if (!hasAppFeature(current, "stock")) {
      return <Navigate to="/" replace />;
    }
  }

  const showEmptyResults = !isLoading && totalRows === 0;

  const headerActions = (
    <>
      {canManageCatalog && (
        <AdminHeaderButton variant="secondary" onClick={() => setCategoriesOpen(true)}>
          <Layers className="h-4 w-4" />
          {t("stock.categories.manage")}
        </AdminHeaderButton>
      )}
      <AdminHeaderButton variant="primary" onClick={() => setAdding(true)}>
        <Plus className="h-4 w-4" />
        {t("stock.add_sku")}
      </AdminHeaderButton>
    </>
  );

  return (
    <div className="flex flex-1 flex-col gap-3 min-h-0">
      <AdminPageHeader title={t("stock.title")} actions={headerActions} />

      {adding && (
        <NewSkuForm
          products={data}
          categories={categories}
          catalogDeptOptions={deptOptions}
          deptPickerGroups={deptPickerGroups}
          defaultDepartment={defaultCatalogDept}
          onDone={() => setAdding(false)}
        />
      )}

      <ProductCategoriesManagerModal
        open={categoriesOpen}
        onClose={() => setCategoriesOpen(false)}
      />

      {restockFor && (
        <RestockModal product={restockFor} onClose={() => setRestockFor(null)} />
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
                {(["all", ...deptFilterCodes] as StockDeptFilter[]).map((d) => {
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
                      {d === "all" ? t("stock.filter_all") : departmentLabel(d)}
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
                {STOCK_STATUS_FILTERS.map((s) => {
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
          "flex min-h-[18rem] flex-col overflow-x-hidden rounded-xl border border-[color:var(--color-line)] bg-white sm:overflow-x-auto",
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
            "hidden gap-3 border-b border-[color:var(--color-line)] px-4 py-2 text-xs font-medium text-[color:var(--color-ink-muted)] sm:grid",
            STOCK_ROW_GRID,
          )}
        >
          <StockSortableHeader
            label={t("stock.sku_label")}
            column="sku"
            sortKey={sort.key}
            sortDir={sort.dir}
            onSort={onSort}
          />
          <StockSortableHeader
            label={t("products.table.name")}
            column="name"
            sortKey={sort.key}
            sortDir={sort.dir}
            onSort={onSort}
          />
          <StockSortableHeader
            label={t("products.table.dept")}
            column="dept"
            sortKey={sort.key}
            sortDir={sort.dir}
            onSort={onSort}
            className="hidden lg:flex"
          />
          <StockSortableHeader
            label={t("products.table.on_hand")}
            column="on_hand"
            sortKey={sort.key}
            sortDir={sort.dir}
            onSort={onSort}
            align="end"
          />
          <StockSortableHeader
            label={t("stock.reorder_at")}
            column="reorder_at"
            sortKey={sort.key}
            sortDir={sort.dir}
            onSort={onSort}
            align="end"
          />
          <span className="flex justify-center">
            <StockSortableHeader
              label={t("products.table.status")}
              column="status"
              sortKey={sort.key}
              sortDir={sort.dir}
              onSort={onSort}
            />
          </span>
          <span className="text-right">{t("stock.actions")}</span>
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
              <ProductRow
                key={p.id}
                p={p}
                canManageCatalog={canManageCatalog}
                categories={categories}
                catalogDeptOptions={deptOptions}
                departmentLabel={departmentLabel}
                onRestock={setRestockFor}
              />
            ))}
        </ul>
        {!isLoading && totalRows > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--color-line)] px-4 py-3 text-sm">
            <p className="tabular-nums text-[color:var(--color-ink-soft)]">
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
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[color:var(--color-line)] bg-white hover:bg-[color:var(--color-paper-2)] disabled:opacity-40"
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
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[color:var(--color-line)] bg-white hover:bg-[color:var(--color-paper-2)] disabled:opacity-40"
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
    </div>
  );
}
