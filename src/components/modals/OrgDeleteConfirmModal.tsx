import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, X } from "lucide-react";
import clsx from "clsx";

import { GroupedChoicePicker } from "../ui/GroupedChoicePicker";
import { departmentsApi, jobTitlesApi, usersApi } from "../../lib/api";
import { departmentEnglishName, useDepartments } from "../../lib/departments";
import { jobTitleDisplayLabel } from "../../lib/jobTitleDisplay";
import type { OrgDeleteCheck } from "../../lib/types";

export type OrgDeleteTarget =
  | { kind: "department"; id: number; code: string; name: string }
  | { kind: "job_title"; id: number; label: string; name: string };

interface Props {
  open: boolean;
  target: OrgDeleteTarget | null;
  pending?: boolean;
  onClose: () => void;
  onDeleted: () => void;
}

function BlockerList({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-amber-200/80 bg-amber-50/50 px-3 py-2.5">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-amber-900/80">
        {title}
      </p>
      <ul className="space-y-1.5 text-sm text-[color:var(--color-ink)]">{children}</ul>
    </div>
  );
}

function deptPickerGroups(
  options: { value: string; label: string }[],
  sectionTitle: string,
) {
  if (!options.length) return [];
  return [
    {
      title: sectionTitle,
      sectionDotClass: "bg-amber-500",
      items: options,
    },
  ];
}

export function OrgDeleteConfirmModal({
  open,
  target,
  pending,
  onClose,
  onDeleted,
}: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { departments } = useDepartments(open);
  const [reassignTarget, setReassignTarget] = useState<string>("");
  const [jtMoveTarget, setJtMoveTarget] = useState<Record<number, string>>({});
  const [movingJtId, setMovingJtId] = useState<number | null>(null);

  const checkQuery = useQuery({
    queryKey: [
      "org-delete-check",
      target?.kind,
      target?.kind === "department" ? target.id : target?.kind === "job_title" ? target.id : null,
    ],
    queryFn: () => {
      if (!target) throw new Error("no target");
      return target.kind === "department"
        ? departmentsApi.deleteCheck(target.id)
        : jobTitlesApi.deleteCheck(target.id);
    },
    enabled: open && target != null,
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ["users", "admin"],
    queryFn: () => usersApi.list({ includeInactive: true }),
    enabled: open && target?.kind === "department",
  });

  const { data: jobTitles = [] } = useQuery({
    queryKey: ["job-titles"],
    queryFn: () => jobTitlesApi.list(),
    enabled: open && target?.kind === "department",
  });

  const check: OrgDeleteCheck | undefined = checkQuery.data;
  const blocked = check != null && !check.can_delete;
  const loadingCheck = checkQuery.isLoading && open && target != null;

  const reassignOptions = useMemo(() => {
    if (target?.kind !== "department") return [];
    const code = target.code;
    return departments
      .filter((d) => d.code !== code)
      .map((d) => ({
        value: d.code,
        label: departmentEnglishName(d),
      }));
  }, [target, departments]);

  const reassignPickerGroups = useMemo(
    () => deptPickerGroups(reassignOptions, t("users.confirm_delete_reassign_target")),
    [reassignOptions, t],
  );

  const jobTitleDeptByLabel = useMemo(() => {
    const m = new Map<string, string>();
    for (const jt of jobTitles) {
      if (jt.department) m.set(jt.label, jt.department);
    }
    return m;
  }, [jobTitles]);

  const deptStaff = useMemo(() => {
    if (target?.kind !== "department") return [];
    return allUsers.filter((u) => u.department === target.code);
  }, [allUsers, target]);

  const staffDeptMismatch = useMemo(() => {
    return deptStaff.filter((u) => {
      const jtDept = u.job_title ? jobTitleDeptByLabel.get(u.job_title) : undefined;
      return jtDept && jtDept !== u.department;
    });
  }, [deptStaff, jobTitleDeptByLabel]);

  const defaultMoveDept = reassignOptions[0]?.value ?? "";

  useEffect(() => {
    if (!open) {
      setReassignTarget("");
      setJtMoveTarget({});
    }
  }, [open, target?.kind, target?.kind === "department" ? target.id : null]);

  useEffect(() => {
    if (reassignOptions.length > 0 && !reassignTarget) {
      setReassignTarget(reassignOptions[0].value);
    }
  }, [reassignOptions, reassignTarget]);

  useEffect(() => {
    if (!defaultMoveDept) return;
    const blockers = check?.job_titles ?? [];
    setJtMoveTarget((prev) => {
      const next = { ...prev };
      for (const jt of blockers) {
        if (!next[jt.id]) next[jt.id] = defaultMoveDept;
      }
      return next;
    });
  }, [check?.job_titles, defaultMoveDept]);

  const moveJobTitlesMut = useMutation({
    mutationFn: () => {
      if (target?.kind !== "department") throw new Error("invalid");
      if (!reassignTarget) throw new Error("no target department");
      return departmentsApi.moveJobTitles(target.id, reassignTarget);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["job-titles"] });
      void qc.invalidateQueries({ queryKey: ["org-delete-check"] });
      void qc.invalidateQueries({ queryKey: ["users", "admin"] });
      void qc.invalidateQueries({ queryKey: ["users"] });
    },
  });

  const moveOneJobTitleMut = useMutation({
    mutationFn: ({ id, department }: { id: number; department: string }) =>
      jobTitlesApi.update(id, { department }),
    onMutate: ({ id }) => setMovingJtId(id),
    onSettled: () => setMovingJtId(null),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["job-titles"] });
      void qc.invalidateQueries({ queryKey: ["org-delete-check"] });
      void qc.invalidateQueries({ queryKey: ["users", "admin"] });
      void qc.invalidateQueries({ queryKey: ["users"] });
    },
  });

  const syncStaffFromJobTitlesMut = useMutation({
    mutationFn: () => {
      if (target?.kind !== "department") throw new Error("invalid");
      return departmentsApi.syncUsersFromJobTitles(target.id);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["users", "admin"] });
      void qc.invalidateQueries({ queryKey: ["users"] });
      void qc.invalidateQueries({ queryKey: ["org-delete-check"] });
    },
  });

  const removeMut = useMutation({
    mutationFn: () => {
      if (!target) throw new Error("no target");
      return target.kind === "department"
        ? departmentsApi.remove(target.id)
        : jobTitlesApi.remove(target.id);
    },
    onSuccess: () => {
      if (target?.kind === "department") {
        void qc.invalidateQueries({ queryKey: ["departments"] });
      } else {
        void qc.invalidateQueries({ queryKey: ["job-titles"] });
      }
      onDeleted();
    },
  });

  const busy =
    pending ||
    removeMut.isPending ||
    moveJobTitlesMut.isPending ||
    moveOneJobTitleMut.isPending ||
    syncStaffFromJobTitlesMut.isPending;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onClose();
    }
    if (open) document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open, onClose, busy]);

  if (!open || !target) return null;

  const title =
    target.kind === "department"
      ? blocked
        ? t("users.confirm_delete_blocked_title_dept")
        : t("users.confirm_delete_department_title")
      : blocked
        ? t("users.confirm_delete_blocked_title_job_title")
        : t("users.confirm_delete_job_title_title");

  const jobTitleBlockers = check?.job_titles ?? [];
  const userBlockers = check?.users ?? [];
  const hasJobTitleBlockers = jobTitleBlockers.length > 0;
  const hasUserBlockers = userBlockers.length > 0;

  return (
    <div
      className="fixed inset-0 z-[120] grid place-items-center bg-black/50 px-4 py-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        role="alertdialog"
        aria-modal
        aria-labelledby="org-delete-title"
        className="flex w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-[color:var(--color-line)] bg-white shadow-xl sm:max-w-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          className={clsx(
            "flex items-start gap-3 border-b border-[color:var(--color-line)] px-4 py-3.5",
            blocked ? "bg-amber-50/80" : "bg-red-50/40",
          )}
        >
          <AlertTriangle
            className={clsx(
              "mt-0.5 h-5 w-5 shrink-0",
              blocked ? "text-amber-600" : "text-red-600/90",
            )}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <h2 id="org-delete-title" className="text-base font-semibold leading-snug">
              {title}
            </h2>
            <p className="mt-1 truncate text-sm text-[color:var(--color-ink-soft)]">
              {target.name}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg hover:bg-white/80 disabled:opacity-50"
            aria-label={t("common.close")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[min(70vh,32rem)] overflow-y-auto px-4 py-4 sm:px-5">
          {loadingCheck ? (
            <p className="text-center text-sm text-[color:var(--color-ink-muted)]">
              {t("common.loading")}
            </p>
          ) : blocked ? (
            <div className="space-y-3">
              <p className="text-sm leading-relaxed text-[color:var(--color-ink-soft)]">
                {target.kind === "department"
                  ? t("users.confirm_delete_blocked_intro_dept", { name: target.name })
                  : t("users.confirm_delete_blocked_intro_job_title", {
                      name: target.name,
                    })}
              </p>

              {target.kind === "department" && (
                <p className="text-xs leading-relaxed text-[color:var(--color-ink-muted)]">
                  {t("users.confirm_delete_dept_independent_hint")}
                </p>
              )}

              {hasJobTitleBlockers && target.kind === "department" && (
                <BlockerList title={t("users.confirm_delete_blocked_job_titles_section")}>
                  {jobTitleBlockers.map((jt) => {
                    const dest = jtMoveTarget[jt.id] ?? defaultMoveDept;
                    return (
                      <li
                        key={jt.id}
                        className="flex flex-col gap-2 rounded-lg bg-white/80 p-2.5 sm:flex-row sm:items-center"
                      >
                        <span className="min-w-0 flex-1 truncate font-medium sm:max-w-[40%]">
                          {jobTitleDisplayLabel(jt.label)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <GroupedChoicePicker
                            ariaLabel={t("users.confirm_delete_reassign_target")}
                            value={dest}
                            onChange={(code) =>
                              setJtMoveTarget((prev) => ({ ...prev, [jt.id]: code }))
                            }
                            groups={reassignPickerGroups}
                            showGroupHeaders={false}
                            menuMinWidth={220}
                            className="h-9 text-xs"
                          />
                        </div>
                        <button
                          type="button"
                          disabled={busy || !dest || movingJtId === jt.id}
                          onClick={() => moveOneJobTitleMut.mutate({ id: jt.id, department: dest })}
                          className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-amber-300/80 bg-amber-100/80 px-3 text-xs font-medium text-amber-950 hover:bg-amber-100 disabled:opacity-50"
                        >
                          {movingJtId === jt.id
                            ? t("common.loading")
                            : t("users.confirm_delete_move_one")}
                        </button>
                      </li>
                    );
                  })}
                </BlockerList>
              )}

              {hasJobTitleBlockers && target.kind === "department" && (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <label className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="text-[11px] font-medium text-[color:var(--color-ink-muted)]">
                      {t("users.confirm_delete_reassign_job_titles_bulk")}
                    </span>
                    <div
                      className={clsx(
                        busy || reassignOptions.length === 0
                          ? "pointer-events-none opacity-50"
                          : undefined,
                      )}
                    >
                      <GroupedChoicePicker
                        ariaLabel={t("users.confirm_delete_reassign_target")}
                        value={reassignTarget}
                        onChange={setReassignTarget}
                        groups={reassignPickerGroups}
                        showGroupHeaders={false}
                        menuMinWidth={280}
                      />
                    </div>
                  </label>
                  <button
                    type="button"
                    disabled={busy || !reassignTarget}
                    onClick={() => moveJobTitlesMut.mutate()}
                    className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg border border-amber-300/80 bg-amber-100/80 px-4 text-sm font-medium text-amber-950 hover:bg-amber-100 disabled:opacity-50"
                  >
                    {moveJobTitlesMut.isPending
                      ? t("common.loading")
                      : t("users.confirm_delete_reassign_all")}
                  </button>
                </div>
              )}

              {hasJobTitleBlockers && target.kind === "department" && (
                <p className="text-xs leading-relaxed text-[color:var(--color-ink-muted)]">
                  {t("users.confirm_delete_staff_follows_job_title")}
                </p>
              )}

              {staffDeptMismatch.length > 0 && target.kind === "department" && (
                <div className="flex flex-col gap-2 rounded-xl border border-sky-200/80 bg-sky-50/40 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs leading-relaxed text-sky-950/90">
                    {t("users.confirm_delete_staff_mismatch_hint", {
                      count: staffDeptMismatch.length,
                    })}
                  </p>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => syncStaffFromJobTitlesMut.mutate()}
                    className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-sky-300/80 bg-white px-3 text-xs font-medium text-sky-950 hover:bg-sky-50 disabled:opacity-50"
                  >
                    {syncStaffFromJobTitlesMut.isPending
                      ? t("common.loading")
                      : t("users.confirm_delete_sync_staff_from_job_title")}
                  </button>
                </div>
              )}

              {hasJobTitleBlockers && target.kind === "job_title" && (
                <BlockerList title={t("users.confirm_delete_blocked_job_titles_section")}>
                  {jobTitleBlockers.map((jt) => (
                    <li
                      key={jt.id}
                      className="flex items-center gap-2 rounded-lg bg-white/80 px-2.5 py-1.5"
                    >
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {jobTitleDisplayLabel(jt.label)}
                      </span>
                    </li>
                  ))}
                </BlockerList>
              )}

              {hasUserBlockers && target.kind === "job_title" && (
                <>
                  <BlockerList title={t("users.confirm_delete_blocked_users_jt_section")}>
                    {userBlockers.map((u) => (
                      <li
                        key={u.id}
                        className="flex items-baseline gap-2 rounded-lg bg-white/80 px-2.5 py-1.5 tabular-nums"
                      >
                        <span className="shrink-0 text-[11px] font-semibold text-[color:var(--color-ink-muted)]">
                          #{u.id}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-medium">{u.name}</span>
                      </li>
                    ))}
                  </BlockerList>
                  <p className="text-xs leading-relaxed text-[color:var(--color-ink-muted)]">
                    {t("users.confirm_delete_blocked_hint_move_user_jt")}
                  </p>
                </>
              )}

              {check?.blocked_by_requests && (
                <p className="text-xs text-amber-900/90">{t("users.confirm_delete_other_requests")}</p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-center">
                <div className="mx-auto max-w-full rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-paper-2)]/50 px-4 py-3">
                  <p className="truncate text-base font-semibold text-[color:var(--color-ink)]">
                    {target.name}
                  </p>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-[color:var(--color-ink-soft)]">
                  {t("users.confirm_delete_message", { name: target.name })}
                </p>
              </div>

              {staffDeptMismatch.length > 0 && target.kind === "department" && (
                <div className="flex flex-col gap-2 rounded-xl border border-sky-200/80 bg-sky-50/40 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs leading-relaxed text-sky-950/90">
                    {t("users.confirm_delete_staff_mismatch_hint", {
                      count: staffDeptMismatch.length,
                    })}
                  </p>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => syncStaffFromJobTitlesMut.mutate()}
                    className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-sky-300/80 bg-white px-3 text-xs font-medium text-sky-950 hover:bg-sky-50 disabled:opacity-50"
                  >
                    {syncStaffFromJobTitlesMut.isPending
                      ? t("common.loading")
                      : t("users.confirm_delete_sync_staff_from_job_title")}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-[color:var(--color-line)] px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-[color:var(--color-line)] bg-white px-4 text-sm font-medium hover:bg-[color:var(--color-paper-2)] disabled:opacity-50"
          >
            {blocked ? t("users.confirm_delete_ok_understand") : t("common.cancel")}
          </button>
          {!blocked && !loadingCheck && (
            <button
              type="button"
              onClick={() => removeMut.mutate()}
              disabled={busy}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-red-600 px-4 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {removeMut.isPending ? t("common.loading") : t("users.confirm_delete_action")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
