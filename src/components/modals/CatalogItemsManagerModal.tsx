import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import clsx from "clsx";

import { AnimateCollapse } from "../ui/AnimateCollapse";
import { AnimateResize } from "../ui/AnimateResize";
import { adminPanelClass } from "../admin/AdminManagerLayout";
import { productCategoriesApi, productsApi } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { productNamesValid } from "../../lib/langInput";
import {
  categoryDisplayName,
  categoryPickerCategories,
  nextProductSku,
  ProductItemIcon,
} from "../../lib/productIcons";
import { productDisplayName } from "../../lib/productDisplayName";
import {
  catalogDepartmentFilterCodes,
  catalogDepartmentRows,
  departmentEnglishName,
  useDepartments,
} from "../../lib/departments";
import type { Department, Product } from "../../lib/types";

type DeptFilter = "all" | Department;
type KindFilter = "all" | "service" | "stock";

export function CatalogItemsManager() {
  const { t, i18n } = useTranslation();
  const { current } = useAuth();
  const qc = useQueryClient();
  const actorId = current?.id;
  const { departments } = useDepartments();
  const catalogDepts = useMemo(
    () => catalogDepartmentRows(departments),
    [departments],
  );
  const deptFilterCodes = useMemo(
    () => catalogDepartmentFilterCodes(departments),
    [departments],
  );
  const defaultCatalogDept = catalogDepts[0]?.code ?? "housekeeping";

  const [filter, setFilter] = useState("");
  const [deptFilter, setDeptFilter] = useState<DeptFilter>("all");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [editingId, setEditingId] = useState<number | null>(null);

  const [newDept, setNewDept] = useState<Department>(defaultCatalogDept);
  const [newService, setNewService] = useState(false);
  const [newGroup, setNewGroup] = useState("SVC");
  const [newName, setNewName] = useState("");
  const [newNameEn, setNewNameEn] = useState("");
  const [newUnit, setNewUnit] = useState("");

  const [draftName, setDraftName] = useState("");
  const [draftNameEn, setDraftNameEn] = useState("");
  const [draftUnit, setDraftUnit] = useState("");
  const [draftActive, setDraftActive] = useState(true);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: productsApi.list,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["product-categories"],
    queryFn: () => productCategoriesApi.list(),
  });

  const activeCategories = useMemo(
    () => categoryPickerCategories(categories, newDept, newGroup),
    [categories, newDept, newGroup],
  );

  useEffect(() => {
    const codes = activeCategories.map((c) => c.code);
    if (!codes.includes(newGroup)) {
      const fallback = newService
        ? (codes.includes("SVC") ? "SVC" : codes[0] ?? "SVC")
        : codes[0] ?? "GST";
      setNewGroup(fallback);
    }
  }, [newDept, activeCategories, newService, newGroup]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return rows.filter((p) => {
      if (deptFilter !== "all" && p.department !== deptFilter) return false;
      if (kindFilter === "service" && !p.is_service) return false;
      if (kindFilter === "stock" && p.is_service) return false;
      if (!q) return true;
      const label = productDisplayName(p, i18n.language).toLowerCase();
      return (
        p.sku.toLowerCase().includes(q) ||
        label.includes(q) ||
        p.name.toLowerCase().includes(q)
      );
    });
  }, [rows, filter, deptFilter, kindFilter, i18n.language]);

  const previewSku = useMemo(
    () => nextProductSku(rows.map((p) => p.sku), newDept, newGroup),
    [rows, newDept, newGroup],
  );

  const createMut = useMutation({
    mutationFn: () =>
      productsApi.create({
        sku: previewSku,
        name: newName.trim(),
        name_en: newNameEn.trim() || null,
        department: newDept,
        unit: newService ? null : newUnit.trim() || "ชิ้น",
        on_hand: newService ? null : 0,
        reorder_at: newService ? null : 10,
        is_service: newService,
        icon_emoji: newService
          ? newDept === "maintenance"
            ? "🔧"
            : "✨"
          : undefined,
        actor_id: actorId,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["products"] });
      setNewName("");
      setNewNameEn("");
      setNewUnit("");
    },
  });

  const updateMut = useMutation({
    mutationFn: (args: {
      id: number;
      name: string;
      name_en: string | null;
      unit: string | null;
      active: boolean;
    }) =>
      productsApi.update(args.id, {
        name: args.name,
        name_en: args.name_en,
        unit: args.unit,
        active: args.active,
        actor_id: actorId,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["products"] });
      setEditingId(null);
    },
  });

  const removeMut = useMutation({
    mutationFn: (id: number) => productsApi.remove(id, actorId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["products"] }),
  });

  const startEdit = (p: Product) => {
    setEditingId(p.id);
    setDraftName(p.name);
    setDraftNameEn(p.name_en ?? "");
    setDraftUnit(p.unit ?? "");
    setDraftActive(p.active);
  };

  const canCreate =
    productNamesValid({ th: newName, en: newNameEn }) &&
    (newService || newUnit.trim().length > 0);

  const fieldClass =
    "w-full rounded-lg border border-[color:var(--color-line)] bg-white px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--color-ink)]/10";

  return (
    <section className={adminPanelClass}>
        <div className="shrink-0 space-y-4 border-b border-[color:var(--color-line)] px-4 py-4 sm:px-5">
          <div className="flex flex-wrap gap-2">
            {(["all", ...deptFilterCodes] as DeptFilter[]).map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={deptFilter === d}
                onClick={() => setDeptFilter(d)}
                className={clsx(
                  "rounded-full border px-3 py-1 text-xs font-medium",
                  deptFilter === d
                    ? "border-[color:var(--color-ink)] bg-[color:var(--color-ink)] text-white"
                    : "border-[color:var(--color-line)] bg-white",
                )}
              >
                {d === "all"
                  ? t("admin.filter_all_dept")
                  : departmentEnglishName(
                      catalogDepts.find((row) => row.code === d) ?? {
                        code: d,
                        name: d,
                      },
                    )}
              </button>
            ))}
            {(["all", "service", "stock"] as const).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={kindFilter === k}
                onClick={() => setKindFilter(k)}
                className={clsx(
                  "rounded-full border px-3 py-1 text-xs font-medium",
                  kindFilter === k
                    ? "border-[color:var(--color-ink)] bg-[color:var(--color-ink)] text-white"
                    : "border-[color:var(--color-line)] bg-white",
                )}
              >
                {t(`admin.filter_kind_${k}`)}
              </button>
            ))}
          </div>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t("admin.catalog_search_ph")}
            className={fieldClass}
          />

          <div className="space-y-3 rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-paper-2)]/35 p-4">
            <p className="text-sm font-semibold text-[color:var(--color-ink)]">
              {t("admin.catalog_add")}
            </p>
            <div className="flex flex-wrap gap-2">
              <select
                value={newDept}
                onChange={(e) => setNewDept(e.target.value as Department)}
                className="rounded-lg border border-[color:var(--color-line)] px-2 py-1.5 text-sm"
              >
                {catalogDepts.map((d) => (
                  <option key={d.code} value={d.code}>
                    {departmentEnglishName(d)}
                  </option>
                ))}
              </select>
              <label className="inline-flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={newService}
                  onChange={(e) => setNewService(e.target.checked)}
                />
                {t("stock.is_service")}
              </label>
              <select
                value={newGroup}
                onChange={(e) => setNewGroup(e.target.value)}
                className="rounded-lg border border-[color:var(--color-line)] px-2 py-1.5 text-sm"
              >
                {activeCategories.map((cat) => (
                  <option key={cat.code} value={cat.code}>
                    {`${categoryDisplayName(cat, i18n.language)} · ${cat.code}`}
                  </option>
                ))}
              </select>
              <span className="text-xs font-mono text-[color:var(--color-ink-muted)] self-center">
                {previewSku}
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t("admin.catalog_name_th_ph")}
                className={fieldClass}
              />
              <input
                value={newNameEn}
                onChange={(e) => setNewNameEn(e.target.value)}
                placeholder={t("admin.catalog_name_en_ph")}
                className={fieldClass}
              />
              <AnimateCollapse show={!newService} className="sm:col-span-2">
                <input
                  value={newUnit}
                  onChange={(e) => setNewUnit(e.target.value)}
                  placeholder={t("admin.catalog_unit_ph")}
                  className={fieldClass}
                />
              </AnimateCollapse>
            </div>
            <button
              type="button"
              disabled={!canCreate || createMut.isPending}
              onClick={() => createMut.mutate()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-paper-2)] px-3 py-2 text-sm font-medium text-[color:var(--color-ink)] hover:bg-[color:var(--color-line)]/30 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" aria-hidden />
              {t("admin.catalog_add_btn")}
            </button>
          </div>
        </div>

        <ul className="min-h-0 flex-1 overflow-auto divide-y divide-[color:var(--color-line)] text-sm">
          {isLoading && (
            <li className="px-4 py-6 text-[color:var(--color-ink-muted)]">
              {t("common.loading")}
            </li>
          )}
          {!isLoading && filtered.length === 0 && (
            <li className="px-4 py-6 text-center text-[color:var(--color-ink-muted)]">
              {t("admin.catalog_empty")}
            </li>
          )}
          {filtered.map((p) => (
            <li
              key={p.id}
              className={clsx(
                "px-4 py-3 sm:px-5",
                !p.active && "bg-[color:var(--color-paper-2)]/60",
              )}
            >
              <AnimateResize>
                {editingId === p.id ? (
                  <div className="space-y-3 rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-paper-2)]/35 p-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[color:var(--color-ink-muted)]">
                    <ProductItemIcon
                      sku={p.sku}
                      name={p.name}
                      iconEmoji={p.icon_emoji}
                      size="sm"
                    />
                    <span className="font-mono font-medium tabular-nums">{p.sku}</span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      placeholder={t("admin.catalog_name_th_ph")}
                      className={clsx(fieldClass, "sm:col-span-2")}
                    />
                    <input
                      value={draftNameEn}
                      onChange={(e) => setDraftNameEn(e.target.value)}
                      placeholder={t("admin.catalog_name_en_ph")}
                      className={fieldClass}
                    />
                    {!p.is_service && (
                      <input
                        value={draftUnit}
                        onChange={(e) => setDraftUnit(e.target.value)}
                        placeholder={t("admin.catalog_unit_ph")}
                        className={fieldClass}
                      />
                    )}
                    <label className="inline-flex items-center gap-2 text-sm text-[color:var(--color-ink-soft)] sm:col-span-2">
                      <input
                        type="checkbox"
                        checked={draftActive}
                        onChange={(e) => setDraftActive(e.target.checked)}
                        className="rounded border-[color:var(--color-line)]"
                      />
                      {t("settings.hotel_locations_active")}
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-lg bg-[color:var(--color-ink)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                      disabled={!draftName.trim() || updateMut.isPending}
                      onClick={() =>
                        updateMut.mutate({
                          id: p.id,
                          name: draftName.trim(),
                          name_en: draftNameEn.trim() || null,
                          unit: p.is_service ? null : draftUnit.trim() || null,
                          active: draftActive,
                        })
                      }
                    >
                      {t("common.save")}
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-[color:var(--color-line)] bg-white px-4 py-2 text-sm font-medium text-[color:var(--color-ink)] hover:bg-[color:var(--color-paper-2)]"
                      onClick={() => setEditingId(null)}
                    >
                      {t("common.cancel")}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 min-w-0">
                  <ProductItemIcon
                    sku={p.sku}
                    name={p.name}
                    iconEmoji={p.icon_emoji}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="font-mono text-xs text-[color:var(--color-ink-muted)] tabular-nums">
                        {p.sku}
                      </span>
                      <span className="font-medium text-[color:var(--color-ink)]">
                        {productDisplayName(p, i18n.language)}
                      </span>
                    </p>
                  </div>
                  <span className="hidden shrink-0 text-xs text-[color:var(--color-ink-muted)] sm:inline">
                    {t(`departments.${p.department}`)}
                    {p.is_service ? ` · ${t("stock.is_service")}` : ""}
                  </span>
                  {!p.active && (
                    <span className="shrink-0 rounded-md bg-[color:var(--color-paper-2)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--color-ink-muted)]">
                      {t("settings.hotel_locations_inactive")}
                    </span>
                  )}
                  <div className="flex shrink-0 gap-1.5">
                    <button
                      type="button"
                      onClick={() => startEdit(p)}
                      className="grid h-9 w-9 place-items-center rounded-lg border border-[color:var(--color-line)] bg-white hover:bg-[color:var(--color-paper-2)]"
                      aria-label={t("admin.catalog_edit")}
                    >
                      <Pencil className="w-4 h-4 text-[color:var(--color-ink-muted)]" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          !window.confirm(
                            t("admin.catalog_delete_confirm", {
                              name: productDisplayName(p, i18n.language),
                            }),
                          )
                        ) {
                          return;
                        }
                        removeMut.mutate(p.id);
                      }}
                      className="grid h-9 w-9 place-items-center rounded-lg border border-red-200/90 bg-white text-red-700 hover:bg-red-50"
                      aria-label={t("admin.catalog_delete")}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  </div>
                )}
              </AnimateResize>
            </li>
          ))}
        </ul>

        {(createMut.isError || updateMut.isError || removeMut.isError) && (
          <p className="shrink-0 border-t border-[color:var(--color-line)] px-4 py-2 text-sm text-red-600">
            {(
              (createMut.error ?? updateMut.error ?? removeMut.error) as Error
            ).message}
          </p>
        )}
    </section>
  );
}

