import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Briefcase, X } from "lucide-react";
import clsx from "clsx";

import { GroupedChoicePicker } from "../ui/GroupedChoicePicker";
import { jobTitlesApi } from "../../lib/api";
import { departmentEnglishName, useDepartments } from "../../lib/departments";
import {
  jobTitleLabelAlertMessage,
  jobTitleLabelFieldInvalid,
  jobTitleLabelOk,
} from "../../lib/langInput";
import type { Department } from "../../lib/types";

const fieldLabel = "text-[11px] font-medium text-[color:var(--color-ink-muted)]";
const formControlClass =
  "h-10 rounded-lg border border-[color:var(--color-line)] bg-white px-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--color-ink)]/15";

export type JobTitleDraft = {
  label: string;
  department: Department | "";
};

interface Props {
  open: boolean;
  editId: number | null;
  draft: JobTitleDraft;
  showErrors: boolean;
  onDraftChange: (next: JobTitleDraft) => void;
  onShowErrorsChange: (v: boolean) => void;
  onClose: () => void;
}

export function JobTitleFormModal({
  open,
  editId,
  draft,
  showErrors,
  onDraftChange,
  onShowErrorsChange,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { departments } = useDepartments(open);
  const isEdit = editId !== null;
  const deptOk = draft.department.trim().length > 0;
  const valid = jobTitleLabelOk(draft.label) && deptOk;
  const labelInvalid = jobTitleLabelFieldInvalid(draft.label, showErrors);
  const labelAlert = jobTitleLabelAlertMessage(t, draft.label, showErrors);
  const deptInvalid = showErrors && !deptOk;

  const deptPickerGroups = useMemo(() => {
    const items = [...departments]
      .sort(
        (a, b) =>
          a.sort_order - b.sort_order ||
          a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      )
      .map((d) => ({
        value: d.code,
        label: departmentEnglishName(d),
      }));
    if (!items.length) return [];
    return [
      {
        title: t("users.job_title_scope"),
        sectionDotClass: "bg-sky-500",
        items,
      },
    ];
  }, [departments, t]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const label = draft.label.trim();
      const department = draft.department.trim();
      if (isEdit) {
        return jobTitlesApi.update(editId!, { label, department });
      }
      return jobTitlesApi.create({ label, department });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["job-titles"] });
      void qc.invalidateQueries({ queryKey: ["users"] });
      void qc.invalidateQueries({ queryKey: ["users", "admin"] });
      onShowErrorsChange(false);
      onClose();
    },
  });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !saveMut.isPending) onClose();
    }
    if (open) document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open, onClose, saveMut.isPending]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[110] grid place-items-center bg-black/50 px-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saveMut.isPending) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal
        aria-labelledby="job-title-form-title"
        className="flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-[color:var(--color-line)] bg-white shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-[color:var(--color-line)] px-4 py-3">
          <Briefcase className="h-5 w-5 shrink-0 text-[color:var(--color-ink-soft)]" aria-hidden />
          <h2 id="job-title-form-title" className="min-w-0 flex-1 text-base font-semibold">
            {isEdit
              ? t("users.job_titles_form_edit_title")
              : t("users.job_titles_form_add_title")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saveMut.isPending}
            className="grid h-8 w-8 place-items-center rounded-lg hover:bg-[color:var(--color-paper-2)] disabled:opacity-50"
            aria-label={t("common.close")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-4 py-4">
          <label className="flex flex-col gap-1">
            <span className={fieldLabel}>{t("users.job_titles_new_label")}</span>
            <input
              lang="en"
              value={draft.label}
              onChange={(e) => onDraftChange({ ...draft, label: e.target.value })}
              className={clsx(
                formControlClass,
                labelInvalid && "border-red-400 focus:ring-red-200/70",
              )}
              placeholder={t("users.job_titles_new_label_ph")}
              autoFocus
              spellCheck
              autoComplete="off"
              aria-invalid={labelInvalid}
            />
            {labelAlert && <span className="text-xs text-red-600">{labelAlert}</span>}
          </label>

          <label className="flex flex-col gap-1">
            <span className={fieldLabel}>{t("users.job_title_scope")}</span>
            <GroupedChoicePicker
              ariaLabel={t("users.job_title_scope_aria")}
              value={draft.department}
              onChange={(department) => onDraftChange({ ...draft, department: department as Department })}
              groups={deptPickerGroups}
              showGroupHeaders={false}
              className={clsx(
                formControlClass,
                "w-full justify-between",
                deptInvalid && "border-red-400",
              )}
            />
            {deptInvalid ? (
              <span className="text-xs text-red-600">{t("users.job_titles_error_department_required")}</span>
            ) : (
              <span className="text-[11px] text-[color:var(--color-ink-muted)]">
                {t("users.job_titles_department_hint")}
              </span>
            )}
          </label>
        </div>

        <div className="grid w-full shrink-0 grid-cols-4 gap-2 border-t border-[color:var(--color-line)] px-4 py-3">
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
            disabled={saveMut.isPending || !valid}
            onClick={() => {
              if (!valid) {
                onShowErrorsChange(true);
                return;
              }
              saveMut.mutate();
            }}
            className="col-span-3 flex h-10 w-full items-center justify-center rounded-xl bg-[color:var(--color-ink)] text-sm font-semibold text-white shadow-sm disabled:opacity-50 hover:opacity-90"
          >
            {saveMut.isPending ? t("common.loading") : t("common.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
