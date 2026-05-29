import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import {
  Briefcase,
  ChevronDown,
  ChevronUp,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Users as UsersIcon,
  X,
} from "lucide-react";
import clsx from "clsx";

import { AddUserModal } from "../components/modals/AddUserModal";
import { EditUserModal } from "../components/modals/EditUserModal";
import { UserRemoveModal } from "../components/modals/UserRemoveModal";
import { ListPaginationFooter } from "../components/ui/ListPaginationFooter";
import { UserFeatureAccess } from "../components/users/UserFeatureAccess";
import {
  AdminHeaderButton,
  AdminPageHeader,
} from "../components/admin/AdminPageHeader";
import { Avatar } from "../components/ui/Avatar";
import { HoverTooltip } from "../components/ui/HoverTooltip";
import { JobTitlesManagerModal } from "../components/modals/JobTitlesManagerModal";
import { jobTitlesApi, usersApi } from "../lib/api";
import {
  jobTitleDepartmentByLabel,
  usersWithJobTitleDeptMismatch,
} from "../lib/jobTitles";
import { canAccessAdminHub } from "../lib/appFeatures";
import { useAuth } from "../lib/auth";
import { departmentFilterCodesForUsers, useDepartments } from "../lib/departments";
import { userPositionSubtitle } from "../lib/format";
import { useClientPagination } from "../lib/useClientPagination";
import type { User } from "../lib/types";

const USER_DEPT_FILTERS = [
  "all",
  "executive_management",
  "front_office",
  "housekeeping",
  "maintenance",
] as const;

type UserDeptFilter = "all" | string;

const USER_STATUS_FILTERS = ["all", "active", "suspended"] as const;

type UserStatusFilter = (typeof USER_STATUS_FILTERS)[number];

/** Extra column between features and actions keeps the two groups visually apart. */
const USER_TABLE_GRID =
  "md:grid-cols-[2fr_1.4fr_1.4fr_1fr_minmax(13rem,1.6fr)_2.75rem_minmax(5.5rem,auto)]";

type UsersPageProps = {
  /** Inside /admin/users — title from AdminManagerLayout. */
  embedded?: boolean;
};

type UserSortKey = "name" | "role" | "department" | "status";
type SortDir = "asc" | "desc";

function compareUsers(
  a: User,
  b: User,
  key: UserSortKey,
  dir: SortDir,
  t: (k: string) => string,
  deptLabel: (code: string | null | undefined) => string,
): number {
  let cmp = 0;
  switch (key) {
    case "name":
      cmp = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      break;
    case "role":
      cmp = userPositionSubtitle(a, t).localeCompare(userPositionSubtitle(b, t), undefined, {
        sensitivity: "base",
      });
      break;
    case "department": {
      const da = deptLabel(a.department);
      const db = deptLabel(b.department);
      cmp = da.localeCompare(db, undefined, { sensitivity: "base" });
      break;
    }
    case "status":
      cmp = Number(a.active) - Number(b.active);
      break;
  }
  return dir === "asc" ? cmp : -cmp;
}

function UserSortableHeader({
  label,
  column,
  sortKey,
  sortDir,
  onSort,
  className,
}: {
  label: string;
  column: UserSortKey;
  sortKey: UserSortKey | null;
  sortDir: SortDir;
  onSort: (column: UserSortKey) => void;
  className?: string;
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
        "group/header inline-flex min-w-0 items-center gap-0.5 rounded-md -mx-1 px-1 py-0.5 text-left text-xs font-medium transition-colors",
        "hover:text-[color:var(--color-ink)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-ink)]/15",
        active
          ? "text-[color:var(--color-ink)]"
          : "text-[color:var(--color-ink-muted)]",
        className,
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

export function UsersPage({ embedded = false }: UsersPageProps = {}) {
  const { t } = useTranslation();
  const { current } = useAuth();
  const qc = useQueryClient();
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [jobTitlesOpen, setJobTitlesOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<User | null>(null);
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState<UserDeptFilter>("all");
  const [statusFilter, setStatusFilter] = useState<UserStatusFilter>("all");
  const [sort, setSort] = useState<{ key: UserSortKey; dir: SortDir } | null>(null);

  const { departments, departmentLabel } = useDepartments();

  const deptFilterOptions = useMemo((): readonly UserDeptFilter[] => {
    if (departments.length === 0) return USER_DEPT_FILTERS;
    return ["all", ...departmentFilterCodesForUsers(departments, departmentLabel)] as readonly UserDeptFilter[];
  }, [departments, departmentLabel]);

  useEffect(() => {
    if (deptFilter !== "all" && !deptFilterOptions.includes(deptFilter)) {
      setDeptFilter("all");
    }
  }, [deptFilter, deptFilterOptions]);

  const { data = [], isLoading } = useQuery<User[]>({
    queryKey: ["users", "admin"],
    queryFn: () => usersApi.list({ includeInactive: true }),
  });

  const { data: jobTitleRows = [] } = useQuery({
    queryKey: ["job-titles"],
    queryFn: () => jobTitlesApi.list(),
  });

  const jobTitleDepts = useMemo(
    () => jobTitleDepartmentByLabel(jobTitleRows),
    [jobTitleRows],
  );

  const onSort = (column: UserSortKey) => {
    setSort((cur) =>
      cur?.key === column
        ? { key: column, dir: cur.dir === "asc" ? "desc" : "asc" }
        : { key: column, dir: "asc" },
    );
  };

  const filteredRows = useMemo(() => {
    let rows = data;
    if (deptFilter !== "all") {
      rows = rows.filter((u) => u.department === deptFilter);
    }
    if (statusFilter === "active") {
      rows = rows.filter((u) => u.active);
    } else if (statusFilter === "suspended") {
      rows = rows.filter((u) => !u.active);
    }
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((u) => {
      const position = userPositionSubtitle(u, (k) => t(k)).toLowerCase();
      const dept = departmentLabel(u.department ?? "").toLowerCase();
      const status = u.active ? t("users.active").toLowerCase() : t("users.suspended").toLowerCase();
      return (
        u.name.toLowerCase().includes(q) ||
        u.initials.toLowerCase().includes(q) ||
        position.includes(q) ||
        dept.includes(q) ||
        u.role.toLowerCase().includes(q) ||
        (u.job_title?.toLowerCase().includes(q) ?? false) ||
        status.includes(q)
      );
    });
  }, [data, search, deptFilter, statusFilter, t, departmentLabel, jobTitleDepts]);

  const tableRows = useMemo(() => {
    const rows = [...filteredRows];
    if (sort) {
      rows.sort((a, b) => compareUsers(a, b, sort.key, sort.dir, t, departmentLabel));
      return rows;
    }
    rows.sort((a, b) => {
      const byName = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      return byName !== 0 ? byName : a.id - b.id;
    });
    return rows;
  }, [filteredRows, sort, t, departmentLabel]);

  const deptMismatchForFilter = useMemo(() => {
    if (deptFilter === "all") return [];
    return usersWithJobTitleDeptMismatch(data, deptFilter, jobTitleDepts);
  }, [data, deptFilter, jobTitleDepts]);

  const syncDeptFromJobTitleMut = useMutation({
    mutationFn: () =>
      usersApi.syncDepartmentsFromJobTitles(
        deptFilter === "all" ? undefined : deptFilter,
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["users", "admin"] });
      void qc.invalidateQueries({ queryKey: ["users"] });
    },
  });

  const restoreUser = useMutation({
    mutationFn: (id: number) => usersApi.restore(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["users", "admin"] }),
  });

  const removeUser = useMutation({
    mutationFn: async ({
      id,
      action,
    }: {
      id: number;
      action: "suspend" | "delete";
    }) => {
      if (action === "suspend") {
        await usersApi.suspend(id);
      } else {
        await usersApi.purge(id);
      }
    },
    onSuccess: () => {
      setRemoveTarget(null);
      void qc.invalidateQueries({ queryKey: ["users", "admin"] });
    },
  });

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
  } = useClientPagination(tableRows, [search, deptFilter, statusFilter, sort?.key, sort?.dir]);

  const showEmptyResults = !isLoading && tableRows.length === 0;
  const deptFilterEmpty =
    showEmptyResults && deptFilter !== "all" && !search.trim() && data.length > 0;
  const sortKey = sort?.key ?? null;
  const sortDir = sort?.dir ?? "asc";

  if (!embedded) {
    if (current && canAccessAdminHub(current)) {
      return <Navigate to="/admin/users" replace />;
    }
    if (current) {
      return <Navigate to="/" replace />;
    }
  }

  const isSystemAdmin = current?.role === "admin";
  const canEditFeatures = (u: User) =>
    isSystemAdmin &&
    current != null &&
    u.active &&
    u.id !== current.id &&
    u.role !== "admin";

  const headerActions = (
    <>
      <AdminHeaderButton variant="secondary" onClick={() => setJobTitlesOpen(true)}>
        <Briefcase className="w-4 h-4 shrink-0" aria-hidden />
        {t("users.job_titles_manage")}
      </AdminHeaderButton>
      {isSystemAdmin && (
        <AdminHeaderButton
          variant="primary"
          onClick={() => setAddUserOpen(true)}
          className="min-w-[9.5rem] justify-center"
        >
          <Plus className="w-4 h-4 shrink-0" aria-hidden />
          {t("users.add_user")}
        </AdminHeaderButton>
      )}
    </>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <AdminPageHeader title={t("users.title")} actions={headerActions} />

      <JobTitlesManagerModal open={jobTitlesOpen} onClose={() => setJobTitlesOpen(false)} />
      <AddUserModal open={addUserOpen} onClose={() => setAddUserOpen(false)} />
      <EditUserModal user={editTarget} onClose={() => setEditTarget(null)} />
      <UserRemoveModal
        user={removeTarget}
        pending={removeUser.isPending}
        onClose={() => {
          if (!removeUser.isPending) setRemoveTarget(null);
        }}
        onConfirm={(action) => {
          if (!removeTarget) return;
          removeUser.mutate({ id: removeTarget.id, action });
        }}
      />

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
              placeholder={t("users.search_placeholder")}
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

          <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2.5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--color-ink-muted)]">
                {t("stock.filter_dept_label")}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {deptFilterOptions.map((d) => {
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

            <div className="ml-auto flex flex-wrap items-center gap-x-2 gap-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--color-ink-muted)]">
                {t("stock.filter_status_label")}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {USER_STATUS_FILTERS.map((s) => {
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
                      {s === "all"
                        ? t("stock.filter_all")
                        : s === "active"
                          ? t("users.active")
                          : t("users.suspended")}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {deptMismatchForFilter.length > 0 && (
            <div className="flex flex-col gap-2 rounded-xl border border-amber-200/80 bg-amber-50/60 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-relaxed text-amber-950/90">
                {t("users.sync_dept_from_job_title_banner", {
                  count: deptMismatchForFilter.length,
                  dept: departmentLabel(deptFilter),
                })}
              </p>
              <button
                type="button"
                disabled={syncDeptFromJobTitleMut.isPending}
                onClick={() => syncDeptFromJobTitleMut.mutate()}
                className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-amber-400/80 bg-amber-100 px-3 text-xs font-semibold text-amber-950 hover:bg-amber-200/80 disabled:opacity-50"
              >
                {syncDeptFromJobTitleMut.isPending
                  ? t("common.loading")
                  : t("users.sync_dept_from_job_title_action")}
              </button>
            </div>
          )}
        </div>
      </section>

      <div className="flex min-h-[min(18rem,calc(100dvh-14rem))] flex-1 flex-col overflow-hidden rounded-xl border border-[color:var(--color-line)] bg-white">
        <div
          className={clsx(
            "hidden gap-x-3 gap-y-3 border-b border-[color:var(--color-line)] px-4 py-2 md:grid",
            USER_TABLE_GRID,
          )}
        >
          <UserSortableHeader
            label={t("users.table.name")}
            column="name"
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={onSort}
          />
          <UserSortableHeader
            label={t("users.table.role")}
            column="role"
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={onSort}
          />
          <UserSortableHeader
            label={t("users.table.department")}
            column="department"
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={onSort}
          />
          <UserSortableHeader
            label={t("users.table.status")}
            column="status"
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={onSort}
          />
          <span className="self-center text-xs font-medium text-[color:var(--color-ink-muted)]">
            {t("users.table.features")}
          </span>
          <span aria-hidden className="hidden md:block" />
          <span className="self-center text-right text-xs font-medium text-[color:var(--color-ink-muted)]">
            {t("users.table.actions")}
          </span>
        </div>

        <ul className="flex min-h-0 flex-1 flex-col divide-y divide-[color:var(--color-line)]/90 overflow-y-auto">
          {isLoading && (
            <li className="px-4 py-6 text-sm text-[color:var(--color-ink-muted)]">
              {t("common.loading")}
            </li>
          )}
          {showEmptyResults && (
            <li className="flex flex-1 flex-col items-center justify-center px-4 py-10 text-center">
              <UsersIcon
                className="mx-auto mb-3 h-14 w-14 text-[color:var(--color-ink-muted)]/35"
                strokeWidth={1.25}
                aria-hidden
              />
              <p className="text-base font-medium text-[color:var(--color-ink-soft)]">
                {deptFilterEmpty
                  ? t("users.filter_dept_empty_title", {
                      dept: departmentLabel(deptFilter),
                    })
                  : t("users.no_results")}
              </p>
              <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-[color:var(--color-ink-muted)]">
                {deptFilterEmpty
                  ? t("users.filter_dept_empty_sub")
                  : t("users.no_results_sub")}
              </p>
            </li>
          )}
          {!isLoading &&
            !showEmptyResults &&
            pageItems.map((u) => {
              const suspended = !u.active;
              const struck = suspended
                ? "line-through decoration-[color:var(--color-ink-soft)]"
                : undefined;
              return (
                <li
                  key={u.id}
                  className={clsx(suspended && "bg-[color:var(--color-paper-2)]/70")}
                >
                  <div
                    className={clsx(
                      "grid gap-x-3 gap-y-3 px-4 py-3 text-sm items-center",
                      USER_TABLE_GRID,
                      suspended && "text-[color:var(--color-ink-muted)]",
                    )}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <Avatar
                        user={u}
                        className={clsx(suspended && "opacity-50 grayscale")}
                      />
                      <span className={clsx("truncate font-medium", struck)}>
                        {u.name}
                      </span>
                    </span>
                    <span
                      className={clsx(
                        "text-[color:var(--color-ink-soft)] min-w-0 leading-snug line-clamp-2",
                        suspended && "text-[color:var(--color-ink-muted)]",
                        struck,
                      )}
                    >
                      {userPositionSubtitle(u, (k) => t(k))}
                    </span>
                    <span
                      className={clsx(
                        "text-[color:var(--color-ink-soft)]",
                        suspended && "text-[color:var(--color-ink-muted)]",
                        struck,
                      )}
                    >
                      {u.department ? departmentLabel(u.department) : "—"}
                    </span>
                    <span>
                      {suspended ? (
                        <span className="inline-flex rounded-md border border-[color:var(--color-line)] bg-[color:var(--color-paper-2)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-ink-muted)]">
                          {t("users.suspended")}
                        </span>
                      ) : (
                        <span className="inline-flex rounded-md bg-[color:var(--color-delivered-bg)] text-[color:var(--color-delivered-fg)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider">
                          {t("users.active")}
                        </span>
                      )}
                    </span>
                    <div className="min-w-0">
                      <UserFeatureAccess user={u} editable={canEditFeatures(u)} />
                    </div>
                    <span aria-hidden className="hidden md:block" />
                    <span className="flex justify-end gap-1">
                      {isSystemAdmin &&
                        u.id !== current?.id &&
                        u.role !== "admin" && (
                          <HoverTooltip label={t("users.edit_user")}>
                            <button
                              type="button"
                              onClick={() => setEditTarget(u)}
                              className="w-8 h-8 grid place-items-center rounded-md border border-[color:var(--color-line)] hover:bg-[color:var(--color-paper-2)]"
                              aria-label={t("users.edit_user")}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </HoverTooltip>
                        )}
                      {isSystemAdmin &&
                        suspended &&
                        u.id !== current?.id &&
                        u.role !== "admin" && (
                          <HoverTooltip label={t("users.restore")}>
                            <button
                              type="button"
                              onClick={() => restoreUser.mutate(u.id)}
                              disabled={restoreUser.isPending}
                              className="w-8 h-8 grid place-items-center rounded-md border border-[color:var(--color-line)] hover:bg-emerald-50 hover:border-emerald-500/40 disabled:opacity-50"
                              aria-label={t("users.restore")}
                            >
                              <RotateCcw className="w-3.5 h-3.5 text-emerald-800" />
                            </button>
                          </HoverTooltip>
                        )}
                      {isSystemAdmin &&
                        u.id !== current?.id &&
                        u.role !== "admin" && (
                          <HoverTooltip label={t("users.remove_modal.open")}>
                            <button
                              type="button"
                              onClick={() => setRemoveTarget(u)}
                              className="w-8 h-8 grid place-items-center rounded-md border border-[color:var(--color-line)] hover:bg-red-50"
                              aria-label={t("users.remove_modal.open")}
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-600/90" />
                            </button>
                          </HoverTooltip>
                        )}
                    </span>
                  </div>
                </li>
              );
            })}
        </ul>
        <ListPaginationFooter
          hidden={isLoading || showEmptyResults}
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
    </div>
  );
}
