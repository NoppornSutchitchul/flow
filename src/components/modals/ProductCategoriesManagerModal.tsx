import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ChevronDown, Layers, Pencil, Plus, Trash2, X } from "lucide-react";
import clsx from "clsx";

import { productCategoriesApi } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import {
  catalogDeptOptions,
  departmentEnglishName,
  useDepartments,
} from "../../lib/departments";
import {
  productLangAlertMessages,
  productNameLangOk,
} from "../../lib/langInput";
import { categoryDisplayName, deptSkuPrefix } from "../../lib/productIcons";
import type { Department, ProductCategory } from "../../lib/types";
import { AnimateResize } from "../ui/AnimateResize";
import { EmojiIconPickerModal } from "../catalog/ProductIconCarouselPicker";

interface Props {
  open: boolean;
  onClose: () => void;
}

function CategorySkuPreview({
  code,
  department,
  title,
  categoryLabel,
}: {
  code: string;
  department: Department;
  title: string;
  categoryLabel: string;
}) {
  const deptPrefix = deptSkuPrefix(department);
  const middle = code.trim().toUpperCase() || "···";
  const middleEmpty = !code.trim();

  return (
    <div className="rounded-xl border border-[color:var(--color-line)]/80 bg-[color:var(--color-paper-2)]/50 px-4 py-3">
      <p className="text-center text-[11px] font-medium uppercase tracking-wide text-[color:var(--color-ink-muted)]">
        {title}
      </p>
      <div
        className="mt-2.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 font-mono text-xl font-semibold tabular-nums tracking-tight sm:text-2xl"
        aria-label={`${deptPrefix}-${middle}-001`}
      >
        <span className="rounded-lg bg-white px-3 py-1.5 shadow-sm ring-1 ring-[color:var(--color-line)]/80">
          {deptPrefix}
        </span>
        <span className="select-none text-[color:var(--color-ink-muted)]" aria-hidden>
          –
        </span>
        <span
          className={clsx(
            "rounded-lg px-3 py-1.5 transition-all duration-200",
            middleEmpty
              ? "bg-white/60 text-[color:var(--color-ink-muted)] ring-1 ring-dashed ring-[color:var(--color-line)]"
              : "bg-white text-[color:var(--color-ink)] shadow-sm ring-2 ring-[color:var(--color-ink)]/20",
          )}
        >
          {middle}
        </span>
        <span className="select-none text-[color:var(--color-ink-muted)]" aria-hidden>
          –
        </span>
        <span className="rounded-lg bg-[color:var(--color-ink)] px-3 py-1.5 text-white shadow-sm">
          001
        </span>
      </div>
      <p className="mt-2 text-center text-[10px] text-[color:var(--color-ink-muted)]">
        {categoryLabel}
      </p>
    </div>
  );
}

function IconPickerButton({
  emoji,
  onClick,
  label,
  hint,
  prominent = false,
}: {
  emoji: string;
  onClick: () => void;
  label: string;
  hint: string;
  /** Emoji rises ~50% above the box top; box stays h-11 to align with neighbors. */
  prominent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={hint}
      className={clsx(
        "group relative flex h-11 w-full flex-col items-center justify-end overflow-visible rounded-xl border-2 border-[color:var(--color-line)]/80 bg-white px-3 pb-1.5 shadow-sm transition hover:border-[color:var(--color-ink)]/35 hover:bg-[color:var(--color-paper-2)]/80 hover:shadow-md active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-ink)]/25",
        prominent ? "min-w-[7rem]" : "min-w-[6.5rem] gap-0.5",
      )}
    >
      <span
        className={clsx(
          "pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 leading-none transition group-hover:scale-110",
          prominent ? "text-[2rem]" : "text-2xl",
        )}
        aria-hidden
      >
        {emoji || "📦"}
      </span>
      <span className="flex items-center gap-0.5 text-[10px] font-semibold text-[color:var(--color-ink-muted)] group-hover:text-[color:var(--color-ink)]">
        {label}
        <ChevronDown className="h-3 w-3 opacity-60" aria-hidden />
      </span>
    </button>
  );
}

interface LangFieldInlineProps {
  code: string;
  lang: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  invalid?: boolean;
  required?: boolean;
  errorText?: string;
}

function CategoryFormFooter({
  alerts,
  children,
}: {
  alerts: string[];
  children: ReactNode;
}) {
  return (
    <div className="space-y-3 pt-4">
      {alerts.length > 0 && (
        <div
          className="min-w-0"
          role="alert"
          aria-live="polite"
        >
          <div className="space-y-0.5 text-[11px] font-medium leading-snug text-red-600">
            {alerts.map((msg, i) => (
              <p key={`${i}-${msg}`}>{msg}</p>
            ))}
          </div>
        </div>
      )}
      <div className="flex w-full gap-2">{children}</div>
    </div>
  );
}

function LangFieldInline({
  code,
  lang,
  value,
  onChange,
  placeholder,
  invalid,
  required,
  errorText,
}: LangFieldInlineProps) {
  return (
    <label
      className={clsx(
        "group flex h-11 items-stretch overflow-hidden rounded-lg border bg-white shadow-sm transition focus-within:ring-2",
        invalid
          ? "border-red-300 focus-within:border-red-400 focus-within:ring-red-200/70"
          : "border-[color:var(--color-line)]/80 focus-within:border-[color:var(--color-ink)]/30 focus-within:ring-[color:var(--color-ink)]/12",
      )}
      title={errorText}
    >
      <span
        className={clsx(
          "inline-flex w-10 shrink-0 items-center justify-center border-r font-mono text-[10px] font-bold tracking-[0.08em] transition",
          invalid
            ? "border-red-200 bg-red-50 text-red-700"
            : "border-[color:var(--color-line)]/60 bg-[color:var(--color-paper-2)]/70 text-[color:var(--color-ink-muted)] group-focus-within:bg-[color:var(--color-paper-2)] group-focus-within:text-[color:var(--color-ink)]",
        )}
        aria-hidden
      >
        {code}
      </span>
      <div className="relative flex min-w-0 flex-1 items-center">
        <input
          lang={lang}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-invalid={invalid}
          required={required}
          className="h-full w-full min-w-0 bg-transparent px-3 text-sm focus:outline-none"
        />
        {required && (
          <span
            aria-hidden
            className="pointer-events-none absolute right-2.5 text-base leading-none text-red-500/70"
          >
            *
          </span>
        )}
      </div>
    </label>
  );
}

interface Draft {
  code: string;
  department: string;
  name: string;
  name_en: string;
  icon_emoji: string;
}

const EMPTY_DRAFT: Draft = {
  code: "",
  department: "housekeeping",
  name: "",
  name_en: "",
  icon_emoji: "📦",
};


function categoryNameValidation(names: { th: string; en: string }) {
  const th = names.th.trim();
  const en = names.en.trim();
  return {
    th,
    en,
    thOk: th.length > 0 && productNameLangOk("th", th),
    enOk: en.length > 0 && productNameLangOk("en", en),
  };
}

function categoryNameAlertMessages(
  t: (key: string) => string,
  names: { th: string; en: string },
  showErrors: boolean,
): string[] {
  return productLangAlertMessages(t, names, showErrors, "name");
}

function CategoryEditFormModal({
  category,
  departmentLabel,
  onClose,
  actorId,
}: {
  category: ProductCategory;
  departmentLabel: string;
  onClose: () => void;
  actorId?: number;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Draft>(() => ({
    code: category.code,
    department: category.department,
    name: category.name,
    name_en: category.name_en ?? "",
    icon_emoji: category.icon_emoji ?? "📦",
  }));
  const [showErrors, setShowErrors] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);

  useEffect(() => {
    setDraft({
      code: category.code,
      department: category.department,
      name: category.name,
      name_en: category.name_en ?? "",
      icon_emoji: category.icon_emoji ?? "📦",
    });
    setShowErrors(false);
    setErrorBanner(null);
  }, [category]);

  const names = useMemo(
    () =>
      categoryNameValidation({
        th: draft.name,
        en: draft.name_en,
              }),
    [draft.name, draft.name_en],
  );

  const canSave =
    names.thOk && names.enOk;

  const alerts = useMemo(() => {
    const msgs = showErrors ? categoryNameAlertMessages(t, { th: draft.name, en: draft.name_en }, true) : [];
    if (errorBanner) msgs.push(errorBanner);
    return msgs;
  }, [showErrors, errorBanner, t, draft.name, draft.name_en]);

  const saveMut = useMutation({
    mutationFn: () =>
      productCategoriesApi.update(category.id, {
        name: draft.name.trim(),
        name_en: draft.name_en.trim() || null,
        icon_emoji: draft.icon_emoji.trim() || null,
        actor_id: actorId,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["product-categories"] });
      onClose();
    },
    onError: (err: unknown) => {
      setShowErrors(true);
      setErrorBanner(err instanceof Error ? err.message : String(err));
    },
  });

  const trySave = () => {
    if (!canSave || saveMut.isPending) {
      setShowErrors(true);
      return;
    }
    setErrorBanner(null);
    saveMut.mutate();
  };

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !saveMut.isPending) onClose();
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose, saveMut.isPending]);

  return (
    <>
      <div
        className="fixed inset-0 z-[110] grid place-items-center bg-black/45 px-4 py-6"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget && !saveMut.isPending) onClose();
        }}
      >
        <div
          role="dialog"
          aria-modal
          aria-labelledby="category-edit-title"
          className="flex max-h-[min(36rem,92vh)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[color:var(--color-line)] bg-white shadow-xl"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex shrink-0 items-center gap-2 border-b border-[color:var(--color-line)] px-4 py-3 sm:px-5">
            <Layers className="h-5 w-5 shrink-0 text-[color:var(--color-ink-soft)]" aria-hidden />
            <h2 id="category-edit-title" className="text-base font-semibold sm:text-lg">
              {t("stock.categories.edit_title")}
            </h2>
            <button
              type="button"
              onClick={onClose}
              disabled={saveMut.isPending}
              className="ml-auto grid h-9 w-9 place-items-center rounded-lg hover:bg-[color:var(--color-paper-2)] disabled:opacity-50"
              aria-label={t("common.close")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-0 overflow-y-auto p-4 sm:p-5">
            <CategorySkuPreview
              code={category.code}
              department={category.department as Department}
              title={t("stock.categories.sku_preview_title")}
              categoryLabel={t("stock.categories.sku_preview_locked")}
            />

            <div className="border-t border-[color:var(--color-line)]/80 py-4">
              <div className="flex justify-center overflow-visible">
                <IconPickerButton
                  prominent
                  emoji={draft.icon_emoji}
                  onClick={() => setIconPickerOpen(true)}
                  label={t("stock.categories.icon_picker_short")}
                  hint={t("stock.icon_click_to_change")}
                />
              </div>
            </div>

            <div className="border-t border-[color:var(--color-line)]/80 py-3">
              <p className="text-center text-[11px] font-medium text-[color:var(--color-ink-muted)]">
                {t("stock.categories.field_department")}
              </p>
              <p className="mt-1 text-center text-sm font-semibold text-[color:var(--color-ink)]">
                {departmentLabel}
              </p>
            </div>

            <div className="border-y border-[color:var(--color-line)]/50 py-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <LangFieldInline
                  code="TH"
                  required
                  lang="th"
                  value={draft.name}
                  onChange={(v) => setDraft((d) => ({ ...d, name: v }))}
                  placeholder={t("stock.categories.field_name_th_ph")}
                  invalid={showErrors && !names.thOk}
                />
                <LangFieldInline
                  code="EN"
                  required
                  lang="en"
                  value={draft.name_en}
                  onChange={(v) => setDraft((d) => ({ ...d, name_en: v }))}
                  placeholder={t("stock.categories.field_name_en_ph")}
                  invalid={showErrors && !names.enOk}
                />
              </div>
            </div>

            {alerts.length > 0 && (
              <div
                className="space-y-0.5 pb-2 text-[11px] font-medium leading-snug text-red-600"
                role="alert"
              >
                {alerts.map((msg, i) => (
                  <p key={`${i}-${msg}`}>{msg}</p>
                ))}
              </div>
            )}
          </div>

          <div className="grid w-full shrink-0 grid-cols-4 gap-2 border-t border-[color:var(--color-line)] px-4 py-3 sm:px-5">
            <button
              type="button"
              onClick={onClose}
              disabled={saveMut.isPending}
              className="col-span-1 flex h-10 w-full items-center justify-center rounded-xl border border-[color:var(--color-line)] bg-white text-sm font-medium shadow-sm hover:bg-[color:var(--color-paper-2)] disabled:opacity-50"
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              disabled={saveMut.isPending}
              onClick={trySave}
              className="col-span-3 flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-[color:var(--color-ink)] text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
            >
              <Pencil className="h-4 w-4 shrink-0" aria-hidden />
              {saveMut.isPending ? t("common.loading") : t("common.save")}
            </button>
          </div>
        </div>
      </div>

      {iconPickerOpen && (
        <EmojiIconPickerModal
          value={draft.icon_emoji || "📦"}
          onSelect={(emoji) => {
            setDraft((d) => ({ ...d, icon_emoji: emoji }));
            setIconPickerOpen(false);
          }}
          onClose={() => setIconPickerOpen(false)}
        />
      )}
    </>
  );
}

function CategoryInUseWarningModal({
  category,
  onClose,
}: {
  category: ProductCategory;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const displayName = categoryDisplayName(category, i18n.language);
  const emoji = category.icon_emoji ?? "📦";
  const count = category.product_count;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[120] grid place-items-center bg-black/50 px-4 py-6 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="alertdialog"
        aria-modal
        aria-labelledby="category-in-use-title"
        aria-describedby="category-in-use-desc"
        className="w-full max-w-md overflow-hidden rounded-2xl border border-[color:var(--color-line)] bg-white shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="relative border-b border-amber-200/50 bg-gradient-to-b from-amber-50/95 via-amber-50/40 to-white px-5 pb-5 pt-5 text-center">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg text-[color:var(--color-ink-muted)] hover:bg-white/80 hover:text-[color:var(--color-ink)]"
            aria-label={t("common.close")}
          >
            <X className="h-4 w-4" />
          </button>

          <div className="mx-auto grid h-[4.5rem] w-[4.5rem] place-items-center rounded-2xl bg-white text-4xl shadow-md ring-1 ring-amber-200/60">
            <span className="leading-none select-none" aria-hidden>
              {emoji}
            </span>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <span className="rounded-lg bg-white px-2.5 py-1 font-mono text-xs font-bold tracking-[0.14em] text-[color:var(--color-ink)] shadow-sm ring-1 ring-[color:var(--color-line)]/70">
              {category.code}
            </span>
            <p
              id="category-in-use-title"
              className="text-base font-semibold leading-snug text-[color:var(--color-ink)]"
            >
              {displayName}
            </p>
          </div>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div className="flex gap-3 rounded-xl border border-amber-200/80 bg-amber-50/50 p-4">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-700 ring-1 ring-amber-200/80">
              <AlertTriangle className="h-4 w-4" aria-hidden />
            </div>
            <div className="min-w-0 flex-1 text-left">
              <p className="text-sm font-semibold text-amber-950">
                {t("stock.categories.in_use_modal_title")}
              </p>
              <p
                id="category-in-use-desc"
                className="mt-1.5 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-sm text-amber-900/90"
              >
                <span className="text-2xl font-bold tabular-nums leading-none text-amber-800">
                  {count}
                </span>
                <span>{t("stock.categories.in_use_modal_lead")}</span>
              </p>
              <p className="mt-2.5 text-xs leading-relaxed text-[color:var(--color-ink-muted)]">
                {t("stock.categories.in_use_modal_hint")}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-full items-center justify-center rounded-xl border border-[color:var(--color-line)] bg-white text-sm font-semibold text-[color:var(--color-ink)] shadow-sm transition hover:bg-[color:var(--color-paper-2)]"
          >
            {t("common.close")}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ProductCategoriesManagerModal({ open, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const { current } = useAuth();
  const qc = useQueryClient();
  const actorId = current?.id;
  const { departments } = useDepartments(open);
  const deptOptions = useMemo(
    () => catalogDeptOptions(departments, i18n.language, deptSkuPrefix),
    [departments, i18n.language],
  );
  const deptLabelByCode = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of departments) {
      map.set(d.code, departmentEnglishName(d));
    }
    return map;
  }, [departments]);

  const [filterDept, setFilterDept] = useState("");
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [addFormOpen, setAddFormOpen] = useState(false);
  const [addFormShowErrors, setAddFormShowErrors] = useState(false);
  const [editTarget, setEditTarget] = useState<ProductCategory | null>(null);
  const [inUseWarning, setInUseWarning] = useState<ProductCategory | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const codeInputRef = useRef<HTMLInputElement>(null);
  const pendingDeleteRef = useRef<ProductCategory | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["product-categories"],
    queryFn: () => productCategoriesApi.list(),
    enabled: open,
  });

  useEffect(() => {
    if (!open) {
      setFilterDept("");
      setDraft(EMPTY_DRAFT);
      setAddFormOpen(false);
      setAddFormShowErrors(false);
      setEditTarget(null);
      setInUseWarning(null);
      setErrorBanner(null);
      pendingDeleteRef.current = null;
    }
  }, [open]);

  useEffect(() => {
    if (addFormOpen) {
      const t = window.setTimeout(() => codeInputRef.current?.focus(), 0);
      return () => window.clearTimeout(t);
    }
  }, [addFormOpen]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (inUseWarning) {
        setInUseWarning(null);
        return;
      }
      if (editTarget) {
        setEditTarget(null);
        return;
      }
      if (addFormOpen) {
        setAddFormOpen(false);
        setDraft(EMPTY_DRAFT);
        setAddFormShowErrors(false);
        setErrorBanner(null);
        return;
      }
      onClose();
    }
    if (open) document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open, onClose, inUseWarning, editTarget, addFormOpen]);

  const createMut = useMutation({
    mutationFn: () =>
      productCategoriesApi.create({
        code: draft.code,
        department: draft.department,
        name: draft.name.trim(),
        name_en: draft.name_en.trim() || null,
        icon_emoji: draft.icon_emoji.trim() || null,
        sort_order: rows.length,
        actor_id: actorId,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["product-categories"] });
      setDraft(EMPTY_DRAFT);
      setAddFormOpen(false);
      setAddFormShowErrors(false);
      setErrorBanner(null);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      setAddFormOpen(true);
      setAddFormShowErrors(true);
      if (/duplicate/i.test(msg)) {
        setErrorBanner(t("stock.categories.error_duplicate"));
      } else if (/code must/i.test(msg)) {
        setErrorBanner(t("stock.categories.error_code_format"));
      } else {
        setErrorBanner(msg);
      }
    },
  });

  const removeMut = useMutation({
    mutationFn: (id: number) => productCategoriesApi.remove(id, actorId),
    onSuccess: () => {
      pendingDeleteRef.current = null;
      void qc.invalidateQueries({ queryKey: ["product-categories"] });
      setErrorBanner(null);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      if (/in use/i.test(msg)) {
        const cat = pendingDeleteRef.current;
        pendingDeleteRef.current = null;
        if (cat) {
          setInUseWarning(cat);
        } else {
          setErrorBanner(t("stock.categories.error_in_use"));
        }
        return;
      }
      pendingDeleteRef.current = null;
      setErrorBanner(msg);
    },
  });

  const tryDeleteCategory = (r: ProductCategory) => {
    if (r.product_count > 0) {
      setInUseWarning(r);
      return;
    }
    if (window.confirm(t("stock.categories.confirm_delete", { code: r.code }))) {
      pendingDeleteRef.current = r;
      removeMut.mutate(r.id);
    }
  };

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      if (a.department !== b.department) {
        return a.department.localeCompare(b.department);
      }
      if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
      return a.code.localeCompare(b.code);
    });
  }, [rows]);

  const visibleRows = useMemo(() => {
    if (!filterDept) return sorted;
    return sorted.filter((r) => r.department === filterDept);
  }, [sorted, filterDept]);

  const codeOk = /^[A-Za-z]{3,4}$/.test(draft.code.trim());
  const draftNames = useMemo(
    () =>
      categoryNameValidation({
        th: draft.name,
        en: draft.name_en,
              }),
    [draft.name, draft.name_en],
  );
  const deptOk = Boolean(draft.department.trim());
  const canCreate =
    codeOk &&
    deptOk &&
    draftNames.thOk &&
    draftNames.enOk &&
    !createMut.isPending;

  const addFormAlerts = useMemo(() => {
    const msgs: string[] = [];
    if (addFormShowErrors) {
      msgs.push(
        ...categoryNameAlertMessages(
          t,
          { th: draft.name, en: draft.name_en },
          true,
        ),
      );
      if (!codeOk) {
        msgs.push(
          draft.code.trim().length === 0
            ? t("stock.categories.error_code_required")
            : t("stock.categories.error_code_format"),
        );
      }
    }
    if (addFormOpen && errorBanner) msgs.push(errorBanner);
    return msgs;
  }, [
    addFormShowErrors,
    codeOk,
    draft.code,
    draft.name,
    draft.name_en,
    addFormOpen,
    errorBanner,
    t,
  ]);

  const tryCreate = () => {
    if (!canCreate) {
      setAddFormShowErrors(true);
      return;
    }
    createMut.mutate();
  };

  const openAddForm = () => {
    setEditTarget(null);
    setDraft({
      ...EMPTY_DRAFT,
      department:
        filterDept ||
        departments[0]?.code ||
        EMPTY_DRAFT.department,
    });
    setErrorBanner(null);
    setAddFormShowErrors(false);
    setAddFormOpen(true);
  };

  const closeAddForm = () => {
    setAddFormOpen(false);
    setDraft(EMPTY_DRAFT);
    setAddFormShowErrors(false);
    setErrorBanner(null);
  };

  const startEdit = (r: ProductCategory) => {
    setAddFormOpen(false);
    setAddFormShowErrors(false);
    setEditTarget(r);
    setErrorBanner(null);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/45 px-4">
      <div
        role="dialog"
        aria-modal
        className="flex max-h-[min(40rem,90vh)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[color:var(--color-line)] bg-white shadow-xl"
      >
        <div className="flex items-center gap-2 border-b border-[color:var(--color-line)] px-4 py-3">
          <Layers className="h-5 w-5 text-[color:var(--color-ink-soft)]" aria-hidden />
          <h2 className="text-base font-semibold">
            {t("stock.categories.modal_title")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto grid h-8 w-8 place-items-center rounded-lg hover:bg-[color:var(--color-paper-2)]"
            aria-label={t("common.close")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-[color:var(--color-line)]/80 px-4 py-2.5">
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setFilterDept("")}
              className={clsx(
                "rounded-lg px-2.5 py-1 text-[11px] font-semibold transition",
                filterDept === ""
                  ? "bg-[color:var(--color-ink)] text-white"
                  : "bg-white text-[color:var(--color-ink-soft)] ring-1 ring-[color:var(--color-line)] hover:bg-[color:var(--color-paper-2)]",
              )}
            >
              {t("stock.categories.filter_all")}
            </button>
            {deptOptions.map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() => setFilterDept(d.value)}
                className={clsx(
                  "rounded-lg px-2.5 py-1 text-[11px] font-semibold transition",
                  filterDept === d.value
                    ? "bg-[color:var(--color-ink)] text-white"
                    : "bg-white text-[color:var(--color-ink-soft)] ring-1 ring-[color:var(--color-line)] hover:bg-[color:var(--color-paper-2)]",
                )}
              >
                {d.code} · {d.label}
              </button>
            ))}
          </div>
        </div>

        <div className="border-b border-[color:var(--color-line)]/80 bg-[color:var(--color-paper-2)]/50 px-4 py-3">
          <AnimateResize>
            {addFormOpen ? (
              <div className="space-y-0 overflow-visible rounded-2xl border border-[color:var(--color-line)]/70 bg-white p-4 shadow-sm">
            <div className="pb-4">
              <CategorySkuPreview
                code={draft.code}
                department={(draft.department || "housekeeping") as Department}
                title={t("stock.categories.sku_preview_title")}
                categoryLabel={t("stock.categories.sku_preview_category")}
              />
            </div>

            <div className="border-t border-[color:var(--color-line)]/80 pt-4 pb-4">
            <label className="block min-w-0 pb-3">
              <span className="mb-1 block text-[11px] font-medium text-[color:var(--color-ink-muted)]">
                {t("stock.categories.field_department")}
              </span>
              <select
                value={draft.department}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, department: e.target.value }))
                }
                className="w-full rounded-xl border border-[color:var(--color-line)] bg-white px-3 py-2.5 text-sm shadow-sm focus:border-[color:var(--color-ink)]/20 focus:outline-none focus:ring-2 focus:ring-[color:var(--color-ink)]/8"
              >
                {deptOptions.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.code} · {d.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-1 items-end gap-3 overflow-visible sm:grid-cols-[1fr_auto]">
              <label className="block min-w-0">
                <span className="mb-1 block text-[11px] font-medium text-[color:var(--color-ink-muted)]">
                  {t("stock.categories.field_code")}
                </span>
                <input
                  ref={codeInputRef}
                  value={draft.code}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      code: e.target.value
                        .toUpperCase()
                        .replace(/[^A-Z]/g, "")
                        .slice(0, 4),
                    }))
                  }
                  placeholder="ACC"
                  className={clsx(
                    "h-11 w-full rounded-xl border bg-white px-3 text-center font-mono text-base font-bold uppercase tracking-[0.12em] shadow-sm transition focus:outline-none focus:ring-2 placeholder:text-[color:var(--color-ink-muted)]/45 sm:max-w-[8rem]",
                    addFormShowErrors && !codeOk
                      ? "border-red-400 focus:border-red-400 focus:ring-red-200/70"
                      : "border-[color:var(--color-line)]/80 focus:border-[color:var(--color-ink)]/30 focus:ring-[color:var(--color-ink)]/12",
                  )}
                  aria-invalid={addFormShowErrors && !codeOk}
                />
              </label>
              <div className="flex justify-center sm:justify-center">
                <IconPickerButton
                  prominent
                  emoji={draft.icon_emoji}
                  onClick={() => setIconPickerOpen(true)}
                  label={t("stock.categories.icon_picker_short")}
                  hint={t("stock.icon_click_to_change")}
                />
              </div>
            </div>
            </div>

            <div className="border-y border-[color:var(--color-line)]/50 py-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <LangFieldInline
                code="TH"
                required
                lang="th"
                value={draft.name}
                onChange={(v) => setDraft((d) => ({ ...d, name: v }))}
                placeholder={t("stock.categories.field_name_th_ph")}
                invalid={addFormShowErrors && !draftNames.thOk}
              />
              <LangFieldInline
                code="EN"
                required
                lang="en"
                value={draft.name_en}
                onChange={(v) => setDraft((d) => ({ ...d, name_en: v }))}
                placeholder={t("stock.categories.field_name_en_ph")}
                invalid={addFormShowErrors && !draftNames.enOk}
              />
              </div>
            </div>

                <CategoryFormFooter alerts={addFormAlerts}>
                  <button
                    type="button"
                    onClick={closeAddForm}
                    disabled={createMut.isPending}
                    className="flex h-10 w-1/4 shrink-0 items-center justify-center rounded-xl border border-[color:var(--color-line)] bg-white text-sm font-medium shadow-sm hover:bg-[color:var(--color-paper-2)] disabled:opacity-50"
                  >
                    {t("common.cancel")}
                  </button>
                  <button
                    type="button"
                    disabled={createMut.isPending || !canCreate}
                    onClick={tryCreate}
                    className={clsx(
                      "flex h-10 w-3/4 min-w-0 flex-[3] items-center justify-center gap-1.5 rounded-xl bg-[color:var(--color-ink)] text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-50",
                      !canCreate && !createMut.isPending && "opacity-60",
                    )}
                  >
                    <Plus className="h-4 w-4 shrink-0" aria-hidden />
                    {createMut.isPending
                      ? t("common.loading")
                      : t("stock.categories.add")}
                  </button>
                </CategoryFormFooter>
              </div>
            ) : (
              <button
                type="button"
                onClick={openAddForm}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[color:var(--color-line)]/80 bg-white px-4 text-sm font-semibold text-[color:var(--color-ink)] shadow-sm transition hover:border-[color:var(--color-ink)]/30 hover:bg-[color:var(--color-paper-2)]/80"
              >
                <Plus className="h-4 w-4 shrink-0" aria-hidden />
                {t("stock.categories.show_add")}
              </button>
            )}
          </AnimateResize>
        </div>

        <ul className="min-h-0 flex-1 overflow-auto divide-y divide-[color:var(--color-line)]/70 text-sm">
          {errorBanner && !addFormOpen && editTarget === null && (
            <li
              role="alert"
              className="px-4 py-2 text-[11px] font-medium leading-snug text-red-600"
            >
              {errorBanner}
            </li>
          )}
          {isLoading && (
            <li className="px-4 py-6 text-[color:var(--color-ink-muted)]">
              {t("common.loading")}
            </li>
          )}
          {!isLoading &&
            visibleRows.map((r) => (
              <li
                key={r.id}
                className="px-4 py-2.5 hover:bg-[color:var(--color-paper-2)]/60"
              >
                <div className="flex items-center gap-3">
                    <span className="grid h-9 w-12 shrink-0 place-items-center rounded-md bg-[color:var(--color-paper-2)] font-mono text-xs font-semibold tracking-wider text-[color:var(--color-ink)]">
                      {r.code}
                    </span>
                    {!filterDept && (
                      <span
                        className="hidden shrink-0 rounded-md bg-[color:var(--color-ink)]/6 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[color:var(--color-ink-soft)] sm:inline"
                        title={deptLabelByCode.get(r.department) ?? r.department}
                      >
                        {deptSkuPrefix(r.department as Department)}
                      </span>
                    )}
                    <span
                      className="text-lg leading-none"
                      aria-hidden
                      title={r.icon_emoji ?? ""}
                    >
                      {r.icon_emoji ?? "📦"}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {categoryDisplayName(r, i18n.language)}
                      {r.name_en && i18n.language.startsWith("th") && (
                        <span className="ml-1.5 text-[11px] font-normal text-[color:var(--color-ink-muted)]">
                          · {r.name_en}
                        </span>
                      )}
                      {!filterDept && (
                        <span className="mt-0.5 block truncate text-[10px] font-normal text-[color:var(--color-ink-muted)] sm:hidden">
                          {deptLabelByCode.get(r.department) ?? r.department}
                        </span>
                      )}
                    </span>
                    {r.product_count > 0 ? (
                      <span
                        className="shrink-0 rounded-full bg-[color:var(--color-ink)]/8 px-2 py-0.5 text-[10px] font-medium text-[color:var(--color-ink-soft)]"
                        title={t("stock.categories.in_use_hint", {
                          count: r.product_count,
                        })}
                      >
                        {t("stock.categories.in_use_count", {
                          count: r.product_count,
                        })}
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                        {t("stock.categories.unused")}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => startEdit(r)}
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-[color:var(--color-line)] hover:bg-white"
                      aria-label={t("common.edit")}
                    >
                      <Pencil className="h-3.5 w-3.5 text-[color:var(--color-ink-muted)]" />
                    </button>
                    <button
                      type="button"
                      onClick={() => tryDeleteCategory(r)}
                      disabled={removeMut.isPending}
                      className={clsx(
                        "grid h-8 w-8 shrink-0 place-items-center rounded-md border border-[color:var(--color-line)] hover:bg-red-50",
                        r.product_count > 0 && "opacity-90",
                      )}
                      aria-label={t("common.delete")}
                      title={
                        r.product_count > 0
                          ? t("stock.categories.in_use_hint", {
                              count: r.product_count,
                            })
                          : undefined
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-600/90" />
                    </button>
                </div>
              </li>
            ))}
          {!isLoading && visibleRows.length === 0 && (
            <li className="px-4 py-6 text-center text-[color:var(--color-ink-muted)]">
              {filterDept
                ? t("stock.categories.empty_for_dept")
                : t("stock.categories.empty")}
            </li>
          )}
        </ul>
      </div>

      {iconPickerOpen && (
        <EmojiIconPickerModal
          value={draft.icon_emoji || "📦"}
          onSelect={(emoji) => {
            setDraft((d) => ({ ...d, icon_emoji: emoji }));
            setIconPickerOpen(false);
          }}
          onClose={() => setIconPickerOpen(false)}
        />
      )}

      {editTarget && (
        <CategoryEditFormModal
          category={editTarget}
          departmentLabel={
            deptLabelByCode.get(editTarget.department) ?? editTarget.department
          }
          actorId={actorId}
          onClose={() => setEditTarget(null)}
        />
      )}

      {inUseWarning && (
        <CategoryInUseWarningModal
          category={inUseWarning}
          onClose={() => setInUseWarning(null)}
        />
      )}
    </div>
  );
}
