import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, X } from "lucide-react";
import clsx from "clsx";

import { departmentsApi } from "../../lib/api";
import {
  jobTitleLabelAlertMessage,
  jobTitleLabelFieldInvalid,
  jobTitleLabelOk,
} from "../../lib/langInput";

const fieldLabel = "text-[11px] font-medium text-[color:var(--color-ink-muted)]";
const formControlClass =
  "h-10 rounded-lg border border-[color:var(--color-line)] bg-white px-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--color-ink)]/15";

export type DepartmentDraft = {
  name: string;
};

interface Props {
  open: boolean;
  editId: number | null;
  draft: DepartmentDraft;
  showErrors: boolean;
  sortOrder: number;
  onDraftChange: (next: DepartmentDraft) => void;
  onShowErrorsChange: (v: boolean) => void;
  onClose: () => void;
}

export function DepartmentFormModal({
  open,
  editId,
  draft,
  showErrors,
  sortOrder,
  onDraftChange,
  onShowErrorsChange,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const isEdit = editId !== null;
  const valid = jobTitleLabelOk(draft.name);
  const nameInvalid = jobTitleLabelFieldInvalid(draft.name, showErrors);
  const nameAlert = jobTitleLabelAlertMessage(t, draft.name, showErrors, "department");

  const saveMut = useMutation({
    mutationFn: async () => {
      const name = draft.name.trim();
      if (isEdit) {
        return departmentsApi.update(editId!, { name });
      }
      return departmentsApi.create({ name, sort_order: sortOrder });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["departments"] });
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
        aria-labelledby="department-form-title"
        className="flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-[color:var(--color-line)] bg-white shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-[color:var(--color-line)] px-4 py-3">
          <Building2 className="h-5 w-5 shrink-0 text-[color:var(--color-ink-soft)]" aria-hidden />
          <h2 id="department-form-title" className="min-w-0 flex-1 text-base font-semibold">
            {isEdit
              ? t("users.departments_form_edit_title")
              : t("users.departments_form_add_title")}
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

        <div className="px-4 py-4">
          <label className="flex flex-col gap-1">
            <span className={fieldLabel}>{t("users.departments_name_label")}</span>
            <input
              lang="en"
              value={draft.name}
              onChange={(e) => onDraftChange({ name: e.target.value })}
              className={clsx(
                formControlClass,
                nameInvalid && "border-red-400 focus:ring-red-200/70",
              )}
              placeholder={t("users.departments_name_ph")}
              autoFocus
              spellCheck
              autoComplete="off"
              aria-invalid={nameInvalid}
            />
            {nameAlert && <span className="text-xs text-red-600">{nameAlert}</span>}
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
