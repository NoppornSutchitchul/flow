import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Pencil, X } from "lucide-react";
import clsx from "clsx";

import { Avatar } from "../ui/Avatar";
import { GroupedChoicePicker } from "../ui/GroupedChoicePicker";
import { PasswordSetupGuidance } from "../users/PasswordSetupGuidance";
import { UserEnglishNameFields } from "../users/UserEnglishNameFields";
import { jobTitlesApi, usersApi } from "../../lib/api";
import { jobTitleDisplayLabel } from "../../lib/jobTitleDisplay";
import { jobTitleDepartment } from "../../lib/jobTitles";
import { useDepartmentPickerGroups } from "../../lib/departments";
import { userEnglishNamesValid } from "../../lib/langInput";
import { validateNewPassword } from "../../lib/passwordRules";
import {
  passwordValidationMessage,
  resetPasswordErrorMessage,
} from "../../lib/userCreateErrors";
import {
  defaultRoleForDepartment,
  joinDisplayName,
  splitDisplayName,
} from "../../lib/userProfileForm";
import type { Department, User } from "../../lib/types";

type Props = {
  user: User | null;
  onClose: () => void;
};

export function EditUserModal({ user, onClose }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [department, setDepartment] = useState<Department>("housekeeping");
  const [showErrors, setShowErrors] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswordErrors, setShowPasswordErrors] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);
  const [passwordErr, setPasswordErr] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const { first, last } = splitDisplayName(user.name);
    setFirstName(first);
    setLastName(last);
    setJobTitle(user.job_title?.trim() ?? "");
    setDepartment((user.department as Department) ?? "housekeeping");
    setNewPassword("");
    setConfirmPassword("");
    setShowPasswordErrors(false);
    setPasswordMsg(null);
    setPasswordErr(null);
  }, [user]);

  const { data: jobTitleRows = [] } = useQuery({
    queryKey: ["job-titles", department],
    queryFn: () => jobTitlesApi.list(department),
    enabled: Boolean(user),
  });

  const jobTitlesForDept = jobTitleRows;

  useEffect(() => {
    if (!user || jobTitleRows.length === 0) return;
    if (jobTitlesForDept.length === 0) {
      setJobTitle("");
      return;
    }
    setJobTitle((j) =>
      j && jobTitlesForDept.some((r) => r.label === j) ? j : jobTitlesForDept[0].label,
    );
  }, [department, jobTitleRows, jobTitlesForDept, user]);

  const fullDisplayName = useMemo(
    () => joinDisplayName(firstName, lastName),
    [firstName, lastName],
  );

  const { groups: deptPickerGroups, departmentLabel } = useDepartmentPickerGroups(
    Boolean(user),
  );

  const jobTitlePickerGroups = useMemo(() => {
    const items = jobTitlesForDept.map((r) => ({
      value: r.label,
      label: jobTitleDisplayLabel(r.label),
    }));
    return [
      {
        title: t("users.form_job_title_list"),
        sectionDotClass: "bg-violet-500",
        items,
      },
    ];
  }, [t, jobTitlesForDept]);

  const onJobTitleChange = (label: string) => {
    setJobTitle(label);
    const dept = jobTitleDepartment(jobTitleRows, label);
    if (dept) setDepartment(dept);
  };

  const passwordCheck = validateNewPassword(newPassword);
  const passwordOk = passwordCheck === "ok";
  const confirmOk =
    newPassword.length > 0 && newPassword.trim() === confirmPassword.trim();
  const canResetPassword = passwordOk && confirmOk;

  const resetPassword = useMutation({
    mutationFn: () => {
      if (!user) throw new Error("no user");
      return usersApi.resetPassword(user.id, newPassword.trim());
    },
    onSuccess: () => {
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordErrors(false);
      setPasswordErr(null);
      setPasswordMsg(t("users.reset_password_success"));
    },
    onError: (err) => {
      setPasswordMsg(null);
      setPasswordErr(resetPasswordErrorMessage(err, t));
    },
  });

  const save = useMutation({
    mutationFn: () => {
      if (!user) throw new Error("no user");
      const payload: Parameters<typeof usersApi.update>[1] = {
        name: fullDisplayName,
        department,
        job_title: jobTitle.trim() || undefined,
      };
      if (user.role !== "admin") {
        payload.role = defaultRoleForDepartment(department);
      }
      return usersApi.update(user.id, payload);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["users", "admin"] });
      void qc.invalidateQueries({ queryKey: ["users"] });
      onClose();
    },
  });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !save.isPending && !resetPassword.isPending) onClose();
    }
    if (user) document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [user, onClose, save.isPending, resetPassword.isPending]);

  if (!user) return null;

  const canSave = userEnglishNamesValid(firstName, lastName);
  const previewSubtitle = jobTitle.trim()
    ? `${jobTitleDisplayLabel(jobTitle)} · ${departmentLabel(department)}`
    : departmentLabel(department);

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-black/45 px-4 py-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !save.isPending && !resetPassword.isPending) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal
        aria-labelledby="edit-user-modal-title"
        className="flex max-h-[min(92vh,48rem)] w-max max-w-[min(100%,32rem)] flex-col overflow-hidden rounded-2xl border border-[color:var(--color-line)] bg-white shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-[color:var(--color-line)] px-4 py-3 sm:px-5">
          <Pencil className="h-5 w-5 shrink-0 text-[color:var(--color-ink-soft)]" aria-hidden />
          <h2 id="edit-user-modal-title" className="text-base font-semibold sm:text-lg">
            {t("users.edit_user")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={save.isPending || resetPassword.isPending}
            className="ml-auto grid h-9 w-9 place-items-center rounded-lg hover:bg-[color:var(--color-paper-2)] disabled:opacity-50"
            aria-label={t("common.close")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="w-full min-w-[17.5rem] space-y-4 overflow-y-auto p-4 sm:p-5 sm:min-w-[28rem]">
          <div className="flex justify-center">
            <div className="inline-flex max-w-full items-center gap-2.5 rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-paper-2)]/40 px-4 py-2.5">
              <Avatar user={user} size="md" />
              <div className="min-w-0">
                <p className="text-sm font-semibold whitespace-nowrap">
                  {canSave ? fullDisplayName : user.name}
                </p>
                <p className="text-[11px] text-[color:var(--color-ink-muted)] whitespace-nowrap">
                  {previewSubtitle}
                </p>
              </div>
            </div>
          </div>

          <UserEnglishNameFields
            firstName={firstName}
            lastName={lastName}
            showErrors={showErrors}
            onFirstNameChange={setFirstName}
            onLastNameChange={setLastName}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2 min-w-0">
              <span className="text-xs font-semibold text-[color:var(--color-ink-soft)]">
                {t("users.form_department")}
              </span>
              <GroupedChoicePicker
                ariaLabel={t("users.form_department_aria")}
                value={department}
                onChange={setDepartment}
                groups={deptPickerGroups}
                showGroupHeaders={false}
              />
            </label>
            <label className="flex flex-col gap-2 min-w-0">
              <span className="text-xs font-semibold text-[color:var(--color-ink-soft)]">
                {t("users.form_job_title")}
              </span>
              <GroupedChoicePicker
                ariaLabel={t("users.form_job_title_aria")}
                value={jobTitle}
                onChange={onJobTitleChange}
                groups={jobTitlePickerGroups}
                menuMinWidth={300}
                showGroupHeaders={false}
              />
              {jobTitlesForDept.length === 0 ? (
                <span className="text-[11px] text-[color:var(--color-ink-muted)]">
                  {t("users.form_job_title_empty_for_dept")}
                </span>
              ) : null}
            </label>
          </div>

          <section className="space-y-3 rounded-xl border border-[color:var(--color-line)]/80 bg-[color:var(--color-paper-2)]/30 p-4">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 shrink-0 text-[color:var(--color-ink-soft)]" aria-hidden />
              <div>
                <p className="text-xs font-semibold text-[color:var(--color-ink)]">
                  {t("users.reset_password_title")}
                </p>
                <p className="mt-0.5 text-[11px] leading-snug text-[color:var(--color-ink-muted)]">
                  {t("users.reset_password_intro")}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="flex min-w-0 flex-col gap-2">
                <span className="text-xs font-semibold text-[color:var(--color-ink-soft)]">
                  {t("auth.new_password")}
                </span>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    setPasswordMsg(null);
                    setPasswordErr(null);
                  }}
                  autoComplete="new-password"
                  className="rounded-xl border border-[color:var(--color-line)] bg-white px-3 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--color-ink)]/15"
                  aria-invalid={showPasswordErrors && !passwordOk}
                />
                {showPasswordErrors && !passwordOk ? (
                  <span className="text-xs text-red-600" role="alert">
                    {passwordValidationMessage(passwordCheck, t)}
                  </span>
                ) : null}
              </label>
              <label className="flex min-w-0 flex-col gap-2">
                <span className="text-xs font-semibold text-[color:var(--color-ink-soft)]">
                  {t("auth.confirm_password")}
                </span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setPasswordMsg(null);
                    setPasswordErr(null);
                  }}
                  autoComplete="new-password"
                  className="rounded-xl border border-[color:var(--color-line)] bg-white px-3 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--color-ink)]/15"
                  aria-invalid={showPasswordErrors && !confirmOk}
                />
                {showPasswordErrors && !confirmOk ? (
                  <span className="text-xs text-red-600" role="alert">
                    {t("auth.password_mismatch")}
                  </span>
                ) : null}
              </label>
            </div>
            <PasswordSetupGuidance password={newPassword} confirmPassword={confirmPassword} />
            {passwordErr ? (
              <p className="text-xs text-red-600" role="alert">
                {passwordErr}
              </p>
            ) : null}
            {passwordMsg ? (
              <p className="text-xs font-medium text-emerald-700" role="status">
                {passwordMsg}
              </p>
            ) : null}
            <button
              type="button"
              disabled={!canResetPassword || resetPassword.isPending || save.isPending}
              onClick={() => {
                setShowPasswordErrors(true);
                if (!canResetPassword) return;
                resetPassword.mutate();
              }}
              className="flex h-10 w-full items-center justify-center rounded-xl border border-[color:var(--color-ink)]/20 bg-white text-sm font-semibold text-[color:var(--color-ink)] shadow-sm hover:bg-[color:var(--color-paper-2)] disabled:opacity-50"
            >
              {resetPassword.isPending
                ? t("common.loading")
                : t("users.reset_password_submit")}
            </button>
          </section>
        </div>

        <div className="flex w-full shrink-0 gap-2 border-t border-[color:var(--color-line)] px-4 py-3 sm:px-5">
          <button
            type="button"
            onClick={onClose}
            disabled={save.isPending || resetPassword.isPending}
            className="flex h-10 w-1/4 shrink-0 items-center justify-center rounded-xl border border-[color:var(--color-line)] bg-white text-sm font-medium shadow-sm hover:bg-[color:var(--color-paper-2)] disabled:opacity-50"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            disabled={!canSave || save.isPending || resetPassword.isPending}
            onClick={() => {
              if (!canSave) {
                setShowErrors(true);
                return;
              }
              save.mutate();
            }}
            className={clsx(
              "flex h-10 w-3/4 min-w-0 flex-[3] items-center justify-center rounded-xl bg-[color:var(--color-ink)] text-sm font-semibold text-white shadow-sm",
              "disabled:opacity-50 hover:opacity-90",
            )}
          >
            {save.isPending ? t("common.loading") : t("common.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
