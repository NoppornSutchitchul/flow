import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Briefcase, Building2, Pencil, Plus, Trash2, X } from "lucide-react";
import { OrgDeleteConfirmModal, type OrgDeleteTarget } from "./OrgDeleteConfirmModal";
import {
  DepartmentFormModal,
  type DepartmentDraft,
} from "./DepartmentFormModal";
import {
  JobTitleFormModal,
  type JobTitleDraft,
} from "./JobTitleFormModal";
import { jobTitlesApi } from "../../lib/api";
import {
  departmentCodeFallbackLabel,
  departmentEnglishName,
  useDepartments,
} from "../../lib/departments";
import { jobTitleDisplayLabel } from "../../lib/jobTitleDisplay";
import type { JobTitle, OrgDepartment } from "../../lib/types";

const emptyDeptDraft = (): DepartmentDraft => ({ name: "" });

const emptyJobTitleDraft = (department = ""): JobTitleDraft => ({
  label: "",
  department,
});

function draftFromDept(row: OrgDepartment): DepartmentDraft {
  return { name: row.name };
}

function draftFromJobTitle(row: JobTitle): JobTitleDraft {
  return { label: row.label, department: row.department ?? "" };
}

function jobTitleDeptLabel(
  departments: OrgDepartment[],
  code: string | null | undefined,
): string {
  if (!code) return "";
  const row = departments.find((d) => d.code === code);
  return row ? departmentEnglishName(row) : departmentCodeFallbackLabel(code);
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function JobTitlesManagerModal({ open, onClose }: Props) {
  const { t } = useTranslation();
  const { departments } = useDepartments(open);

  const [deptModalOpen, setDeptModalOpen] = useState(false);
  const [deptModalEditId, setDeptModalEditId] = useState<number | null>(null);
  const [deptDraft, setDeptDraft] = useState<DepartmentDraft>(emptyDeptDraft);
  const [deptShowErrors, setDeptShowErrors] = useState(false);

  const [jtModalOpen, setJtModalOpen] = useState(false);
  const [jtModalEditId, setJtModalEditId] = useState<number | null>(null);
  const [jtDraft, setJtDraft] = useState<JobTitleDraft>(emptyJobTitleDraft);
  const [jtShowErrors, setJtShowErrors] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<OrgDeleteTarget | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["job-titles"],
    queryFn: () => jobTitlesApi.list(),
    enabled: open,
  });

  const childModalOpen = deptModalOpen || jtModalOpen || deleteConfirm !== null;

  useEffect(() => {
    if (!open) {
      setDeptModalOpen(false);
      setDeptModalEditId(null);
      setDeptDraft(emptyDeptDraft());
      setDeptShowErrors(false);
      setJtModalOpen(false);
      setJtModalEditId(null);
      setJtDraft(emptyJobTitleDraft());
      setJtShowErrors(false);
      setDeleteConfirm(null);
    }
  }, [open]);

  const openDeptAdd = () => {
    setDeptDraft(emptyDeptDraft());
    setDeptShowErrors(false);
    setDeptModalEditId(null);
    setDeptModalOpen(true);
    setJtModalOpen(false);
  };

  const openDeptEdit = (row: OrgDepartment) => {
    setDeptDraft(draftFromDept(row));
    setDeptShowErrors(false);
    setDeptModalEditId(row.id);
    setDeptModalOpen(true);
    setJtModalOpen(false);
  };

  const closeDeptModal = () => {
    setDeptModalOpen(false);
    setDeptModalEditId(null);
    setDeptShowErrors(false);
  };

  const openJtAdd = () => {
    const defaultDept = departments[0]?.code ?? "";
    setJtDraft(emptyJobTitleDraft(defaultDept));
    setJtShowErrors(false);
    setJtModalEditId(null);
    setJtModalOpen(true);
    setDeptModalOpen(false);
  };

  const openJtEdit = (row: JobTitle) => {
    setJtDraft(draftFromJobTitle(row));
    setJtShowErrors(false);
    setJtModalEditId(row.id);
    setJtModalOpen(true);
    setDeptModalOpen(false);
  };

  const closeJtModal = () => {
    setJtModalOpen(false);
    setJtModalEditId(null);
    setJtShowErrors(false);
  };

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (deleteConfirm) {
        setDeleteConfirm(null);
        return;
      }
      if (deptModalOpen) {
        closeDeptModal();
        return;
      }
      if (jtModalOpen) {
        closeJtModal();
        return;
      }
      onClose();
    }
    if (open) document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open, onClose, deleteConfirm, deptModalOpen, jtModalOpen]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[100] grid place-items-center bg-black/45 px-4">
        <div
          role="dialog"
          aria-modal
          className="flex h-[min(44rem,92dvh)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[color:var(--color-line)] bg-white shadow-xl"
        >
          <div className="flex min-h-[3.25rem] items-center gap-2 border-b border-[color:var(--color-line)] px-4 py-4">
            <Briefcase className="h-5 w-5 shrink-0 text-[color:var(--color-ink-soft)]" aria-hidden />
            <h2 className="min-w-0 flex-1 text-base font-semibold leading-none">
              {t("users.job_titles_modal_title")}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="ml-auto grid h-8 w-8 place-items-center rounded-lg hover:bg-[color:var(--color-paper-2)]"
              aria-label={t("common.close")}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-1 divide-y divide-[color:var(--color-line)] sm:grid-cols-2 sm:divide-x sm:divide-y-0">
            <section className="flex min-h-0 min-h-[14rem] flex-col bg-[color:var(--color-paper-2)]/25 px-4 py-3 sm:min-h-0">
              <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <Building2
                    className="h-4 w-4 shrink-0 text-[color:var(--color-ink-soft)]"
                    aria-hidden
                  />
                  <h3 className="text-sm font-semibold">{t("users.departments_section_title")}</h3>
                </div>
                <button
                  type="button"
                  onClick={openDeptAdd}
                  disabled={childModalOpen}
                  className="inline-flex h-9 shrink-0 items-center justify-center gap-1 rounded-lg border border-[color:var(--color-line)] bg-white px-2.5 text-xs font-medium shadow-sm hover:bg-[color:var(--color-paper-2)] disabled:opacity-50 sm:px-3 sm:text-sm"
                >
                  <Plus className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="truncate">{t("users.departments_show_add")}</span>
                </button>
              </div>

              <ul className="min-h-0 flex-1 divide-y divide-[color:var(--color-line)]/60 overflow-y-auto overscroll-contain rounded-xl border border-[color:var(--color-line)]/80 bg-white text-sm [-webkit-overflow-scrolling:touch]">
                {departments.length === 0 && (
                  <li className="px-3 py-4 text-center text-[color:var(--color-ink-muted)]">
                    {t("users.departments_empty")}
                  </li>
                )}
                {departments.map((d) => (
                  <li key={d.id} className="px-3 py-2.5">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {departmentEnglishName(d)}
                      </span>
                      <button
                        type="button"
                        onClick={() => openDeptEdit(d)}
                        disabled={childModalOpen}
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-[color:var(--color-line)] hover:bg-[color:var(--color-paper-2)] disabled:opacity-40"
                        aria-label={t("users.departments_edit")}
                      >
                        <Pencil className="w-3.5 h-3.5 text-[color:var(--color-ink-muted)]" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setDeleteConfirm({
                            kind: "department",
                            id: d.id,
                            code: d.code,
                            name: departmentEnglishName(d),
                          })
                        }
                        disabled={childModalOpen}
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-[color:var(--color-line)] hover:bg-red-50 disabled:opacity-40"
                        aria-label={t("users.departments_delete")}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-600/90" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section className="flex min-h-0 min-h-[14rem] flex-col px-4 py-3 sm:min-h-0">
              <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <Briefcase
                    className="h-4 w-4 shrink-0 text-[color:var(--color-ink-soft)]"
                    aria-hidden
                  />
                  <h3 className="text-sm font-semibold">{t("users.job_titles_section_title")}</h3>
                </div>
                <button
                  type="button"
                  onClick={openJtAdd}
                  disabled={childModalOpen}
                  className="inline-flex h-9 shrink-0 items-center justify-center gap-1 rounded-lg border border-[color:var(--color-line)] bg-white px-2.5 text-xs font-medium shadow-sm hover:bg-[color:var(--color-paper-2)] disabled:opacity-50 sm:px-3 sm:text-sm"
                >
                  <Plus className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="truncate">{t("users.job_titles_show_add")}</span>
                </button>
              </div>

              <ul className="min-h-0 flex-1 divide-y divide-[color:var(--color-line)]/60 overflow-y-auto overscroll-contain rounded-xl border border-[color:var(--color-line)]/80 bg-white text-sm [-webkit-overflow-scrolling:touch]">
                {isLoading && (
                  <li className="px-3 py-4 text-center text-[color:var(--color-ink-muted)]">
                    {t("common.loading")}
                  </li>
                )}
                {!isLoading && rows.length === 0 && (
                  <li className="px-3 py-4 text-center text-[color:var(--color-ink-muted)]">
                    {t("users.job_titles_empty")}
                  </li>
                )}
                {!isLoading &&
                  rows.map((r) => (
                    <li key={r.id} className="px-3 py-2.5">
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{jobTitleDisplayLabel(r.label)}</p>
                          {r.department ? (
                            <p className="truncate text-[11px] text-[color:var(--color-ink-muted)]">
                              {jobTitleDeptLabel(departments, r.department)}
                            </p>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => openJtEdit(r)}
                          disabled={childModalOpen}
                          className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-[color:var(--color-line)] hover:bg-[color:var(--color-paper-2)] disabled:opacity-40"
                          aria-label={t("users.job_titles_edit")}
                        >
                          <Pencil className="w-3.5 h-3.5 text-[color:var(--color-ink-muted)]" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setDeleteConfirm({
                              kind: "job_title",
                              id: r.id,
                              label: r.label,
                              name: jobTitleDisplayLabel(r.label),
                            })
                          }
                          disabled={childModalOpen}
                          className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-[color:var(--color-line)] hover:bg-red-50 disabled:opacity-40"
                          aria-label={t("users.job_titles_delete")}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-600/90" />
                        </button>
                      </div>
                    </li>
                  ))}
              </ul>
            </section>
          </div>
        </div>
      </div>

      <DepartmentFormModal
        open={deptModalOpen}
        editId={deptModalEditId}
        draft={deptDraft}
        showErrors={deptShowErrors}
        sortOrder={departments.length}
        onDraftChange={setDeptDraft}
        onShowErrorsChange={setDeptShowErrors}
        onClose={closeDeptModal}
      />

      <JobTitleFormModal
        open={jtModalOpen}
        editId={jtModalEditId}
        draft={jtDraft}
        showErrors={jtShowErrors}
        onDraftChange={setJtDraft}
        onShowErrorsChange={setJtShowErrors}
        onClose={closeJtModal}
      />

      <OrgDeleteConfirmModal
        open={deleteConfirm !== null}
        target={deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onDeleted={() => setDeleteConfirm(null)}
      />
    </>
  );
}
