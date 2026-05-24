import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import type { TFunction } from "i18next";

import { departmentsApi } from "./api";
import i18n from "./i18n";
import { normalizeLanguage } from "./language";
import { DEPT_GROUPS } from "./userProfileForm";
import type { OrgDepartment } from "./types";

const ORG_DEPT_CODES = new Set(["executive_management", "front_office", "bell_boy"]);
const OPS_DEPT_CODES = new Set(["housekeeping", "maintenance"]);

/** Executive dept has no operational catalog items. */
export const CATALOG_EXCLUDED_DEPARTMENT_CODES = new Set(["executive_management"]);

const DEPT_ACCENT_BAR: Record<string, string> = {
  housekeeping: "bg-emerald-600/90",
  maintenance: "bg-slate-600/90",
  front_office: "bg-sky-600/90",
  bell_boy: "bg-amber-700/90",
};

export function deptAccentBarClass(code: string): string {
  return DEPT_ACCENT_BAR[code] ?? "bg-violet-600/90";
}

/** Departments that can own catalog items / quick-request lines. */
export function catalogDepartmentRows(departments: OrgDepartment[]): OrgDepartment[] {
  return [...departments]
    .filter((d) => !CATALOG_EXCLUDED_DEPARTMENT_CODES.has(d.code))
    .sort(
      (a, b) =>
        a.sort_order - b.sort_order ||
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
}

export function buildCatalogDepartmentPickerGroups(
  departments: OrgDepartment[],
  sectionTitle: string,
) {
  const items = catalogDepartmentRows(departments).map((d) => ({
    value: d.code,
    label: departmentEnglishName(d),
    accentBarClass: deptAccentBarClass(d.code),
  }));
  if (!items.length) return [];
  return [
    {
      title: sectionTitle,
      sectionDotClass: "bg-emerald-600",
      items,
    },
  ];
}

export function catalogDepartmentFilterCodes(departments: OrgDepartment[]): string[] {
  return catalogDepartmentRows(departments).map((d) => d.code);
}

export interface CatalogDeptOption {
  value: string;
  code: string;
  label: string;
}

export function catalogDeptOptions(
  departments: OrgDepartment[],
  _lang: string,
  skuPrefix: (code: string) => string,
): CatalogDeptOption[] {
  return catalogDepartmentRows(departments).map((d) => ({
    value: d.code,
    code: skuPrefix(d.code),
    label: departmentEnglishName(d),
  }));
}

export function departmentDisplayName(
  row: Pick<OrgDepartment, "name" | "code">,
  lang?: string,
): string {
  const ui = normalizeLanguage(lang ?? i18n.language ?? "th");
  const key = `departments.${row.code}`;
  if (i18n.exists(key, { lng: ui })) return i18n.t(key, { lng: ui });
  return row.name;
}

/** English canonical name — org admin (departments / job titles management). */
export function departmentEnglishName(
  row: Pick<OrgDepartment, "name" | "code">,
): string {
  const name = row.name.trim();
  return name || departmentCodeFallbackLabel(row.code);
}

/** English fallback when API list has not loaded yet. */
export function departmentCodeFallbackLabel(code: string): string {
  return code
    .split("_")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
    .join(" ");
}

/** Legacy rows may still use `bell_boy`; show as Front Office in UI. */
const DEPARTMENT_LABEL_CODE_ALIASES: Record<string, string> = {
  bell_boy: "front_office",
};

/** Org codes hidden from user-list department filters (duplicate label / unused). */
const USER_DEPT_FILTER_EXCLUDE = new Set(["bell_boy"]);

/** Department chips on Users admin — one chip per visible label. */
export function departmentFilterCodesForUsers(
  departments: OrgDepartment[],
  departmentLabel: (code: string) => string,
): string[] {
  const seenLabels = new Set<string>();
  const out: string[] = [];
  for (const d of [...departments].sort(
    (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name),
  )) {
    if (USER_DEPT_FILTER_EXCLUDE.has(d.code)) continue;
    const label = departmentLabel(d.code);
    if (seenLabels.has(label)) continue;
    seenLabels.add(label);
    out.push(d.code);
  }
  return out;
}

/** Staff / org department label — English canonical `OrgDepartment.name` only. */
export function departmentLabelForCode(
  code: string | null | undefined,
  departments: OrgDepartment[],
): string {
  if (!code) return "";
  const resolved = DEPARTMENT_LABEL_CODE_ALIASES[code] ?? code;
  const row = departments.find((d) => d.code === resolved);
  if (row) return departmentEnglishName(row);
  return departmentCodeFallbackLabel(resolved);
}

export function useDepartments(enabled = true) {
  const q = useQuery({
    queryKey: ["departments"],
    queryFn: () => departmentsApi.list(),
    enabled,
    staleTime: 60_000,
  });

  const departments = useMemo(() => q.data ?? [], [q.data]);

  const labelFor = useCallback(
    (code: string | null | undefined) => departmentLabelForCode(code, departments),
    [departments],
  );

  return { ...q, departments, departmentLabel: labelFor };
}

export function buildDepartmentPickerGroups(
  departments: OrgDepartment[],
  t: TFunction,
) {
  const toItem = (d: OrgDepartment) => ({
    value: d.code,
    label: departmentEnglishName(d),
    accentBarClass: "bg-transparent" as const,
  });
  if (departments.length === 0) {
    return DEPT_GROUPS.map((g) => ({
      title: t(g.labelKey),
      sectionDotClass:
        g.labelKey === "users.dept_group_org" ? "bg-amber-500" : "bg-teal-600",
      items: g.departments.map((code) => ({
        value: code,
        label: departmentCodeFallbackLabel(code),
        accentBarClass: "bg-transparent" as const,
      })),
    }));
  }
  const org = departments.filter((d) => ORG_DEPT_CODES.has(d.code)).map(toItem);
  const ops = departments.filter((d) => OPS_DEPT_CODES.has(d.code)).map(toItem);
  const other = departments
    .filter((d) => !ORG_DEPT_CODES.has(d.code) && !OPS_DEPT_CODES.has(d.code))
    .map(toItem);
  const groups: {
    title: string;
    sectionDotClass: string;
    items: { value: string; label: string; accentBarClass: string }[];
  }[] = [];
  if (org.length) {
    groups.push({
      title: t("users.dept_group_org"),
      sectionDotClass: "bg-amber-500",
      items: org,
    });
  }
  if (ops.length) {
    groups.push({
      title: t("users.dept_group_ops"),
      sectionDotClass: "bg-teal-600",
      items: ops,
    });
  }
  if (other.length) {
    groups.push({
      title: t("users.dept_group_other"),
      sectionDotClass: "bg-violet-500",
      items: other,
    });
  }
  return groups;
}

export function useDepartmentPickerGroups(enabled = true) {
  const { t } = useTranslation();
  const { departments, isLoading, departmentLabel } = useDepartments(enabled);
  const groups = useMemo(
    () => buildDepartmentPickerGroups(departments, t),
    [departments, t],
  );
  return { groups, departments, isLoading, departmentLabel };
}
