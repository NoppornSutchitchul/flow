import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import clsx from "clsx";

import { Avatar } from "../ui/Avatar";
import { GroupedChoicePicker } from "../ui/GroupedChoicePicker";
import { HoverTooltip } from "../ui/HoverTooltip";
import { PasswordSetupGuidance } from "../users/PasswordSetupGuidance";
import { UserEnglishNameFields } from "../users/UserEnglishNameFields";
import { jobTitlesApi, usersApi } from "../../lib/api";
import { USER_MANAGED_APP_FEATURES, emptyPermissions } from "../../lib/appFeatures";
import { jobTitleDisplayLabel } from "../../lib/jobTitleDisplay";
import { jobTitleDepartment } from "../../lib/jobTitles";
import { useDepartmentPickerGroups } from "../../lib/departments";
import { userEnglishNamesValid } from "../../lib/langInput";
import { validateNewPassword } from "../../lib/passwordRules";
import { createUserErrorMessage, passwordValidationMessage, usernameValidationMessage } from "../../lib/userCreateErrors";
import { filterUsernameInput, validateUsername } from "../../lib/usernameRules";
import { defaultRoleForDepartment } from "../../lib/userProfileForm";
import type { AppFeatureKey, Department, UserPermissions } from "../../lib/types";

const AVATAR_COLORS_BY_DEPT: Record<string, readonly string[]> = {
  executive_management: ["#d9b69a", "#b8a8d6", "#ce93d8", "#9575cd"],
  front_office: ["#4b576b", "#627d98", "#546e7a", "#78909c"],
  housekeeping: ["#7eb993", "#9bc2a0", "#8d6e63", "#a1887f"],
  maintenance: ["#607d8b", "#546e7a", "#78909c", "#90a4ae"],
};
const DEFAULT_AVATAR_COLORS = ["#7eb993", "#9bc2a0", "#8d6e63", "#a1887f"] as const;

const sectionClass =
  "rounded-2xl border border-[color:var(--color-line)]/80 bg-[color:var(--color-paper)]/30 p-4 sm:p-5";

const sectionTitleClass =
  "text-[11px] font-semibold uppercase tracking-wide text-[color:var(--color-ink-muted)]";

function initialsFromDisplayName(raw: string): string {
  const parts = raw.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((p) => (p[0] ?? "").toUpperCase())
    .join("");
}

function FeaturePermissionPicker({
  value,
  onChange,
}: {
  value: UserPermissions;
  onChange: (next: UserPermissions) => void;
}) {
  const { t } = useTranslation();

  const toggle = (key: AppFeatureKey) => {
    onChange({ ...value, [key]: !value[key] });
  };

  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5">
      {USER_MANAGED_APP_FEATURES.map(({ key, icon: Icon, labelKey }) => {
        const on = value[key];
        const label = t(labelKey);
        return (
          <HoverTooltip key={key} label={label}>
            <button
              type="button"
              aria-label={label}
              aria-pressed={on}
              onClick={() => toggle(key)}
              className={clsx(
                "grid h-10 w-10 shrink-0 place-items-center rounded-xl border transition-colors",
                on
                  ? "border-emerald-500/40 bg-emerald-50 text-emerald-800 hover:bg-emerald-100/80"
                  : "border-red-300/60 bg-red-50 text-red-600 hover:bg-red-100/80",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
            </button>
          </HoverTooltip>
        );
      })}
    </div>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function AddUserModal({ open, onClose }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [department, setDepartment] = useState<Department>("housekeeping");
  const [permissions, setPermissions] = useState<UserPermissions>(emptyPermissions);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const color = (AVATAR_COLORS_BY_DEPT[department] ?? DEFAULT_AVATAR_COLORS)[0];

  const { groups: deptPickerGroups, departmentLabel } = useDepartmentPickerGroups(open);

  const { data: jobTitleRows = [] } = useQuery({
    queryKey: ["job-titles", department],
    queryFn: () => jobTitlesApi.list(department),
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    setFirstName("");
    setLastName("");
    setJobTitle("");
    setDepartment("housekeeping");
    setPermissions(emptyPermissions());
    setUsername("");
    setPassword("");
    setConfirmPassword("");
    setCreateError(null);
    setShowErrors(false);
  }, [open]);

  const jobTitlesForDept = jobTitleRows;

  useEffect(() => {
    if (jobTitlesForDept.length === 0) {
      setJobTitle("");
      return;
    }
    setJobTitle((j) =>
      j && jobTitlesForDept.some((r) => r.label === j) ? j : jobTitlesForDept[0].label,
    );
  }, [department, jobTitlesForDept]);

  const roleForDept = defaultRoleForDepartment(department);

  const fullDisplayName = useMemo(
    () => [firstName.trim(), lastName.trim()].filter(Boolean).join(" "),
    [firstName, lastName],
  );

  const jobTitlePickerGroups = useMemo(() => {
    const items = jobTitlesForDept.map((r) => ({
      value: r.label,
      label: jobTitleDisplayLabel(r.label),
      accentBarClass: "bg-transparent",
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

  const create = useMutation({
    mutationFn: () =>
      usersApi.create({
        name: fullDisplayName,
        username: username.trim(),
        password: password.trim(),
        role: roleForDept,
        department,
        color,
        permissions,
        ...(jobTitle.trim() ? { job_title: jobTitle.trim() } : {}),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["users", "admin"] });
      onClose();
    },
    onError: (err) => setCreateError(createUserErrorMessage(err, t)),
  });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !create.isPending) onClose();
    }
    if (open) document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open, onClose, create.isPending]);

  if (!open) return null;

  const previewInitials = initialsFromDisplayName(fullDisplayName);
  const previewSubtitle = jobTitle.trim()
    ? `${jobTitleDisplayLabel(jobTitle)} · ${departmentLabel(department)}`
    : departmentLabel(department);
  const usernameCheck = validateUsername(username);
  const passwordCheck = validateNewPassword(password);
  const passwordOk = passwordCheck === "ok";
  const confirmOk =
    password.length > 0 && password.trim() === confirmPassword.trim();
  const canSave =
    userEnglishNamesValid(firstName, lastName) &&
    usernameCheck === "ok" &&
    passwordOk &&
    confirmOk;

  const handleSave = () => {
    setShowErrors(true);
    setCreateError(null);
    if (!canSave) return;
    create.mutate();
  };

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-black/45 px-4 py-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !create.isPending) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal
        aria-labelledby="add-user-modal-title"
        className="flex max-h-[min(90dvh,52rem)] w-[min(100%,32rem)] flex-col rounded-2xl border border-[color:var(--color-line)] bg-white shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-[color:var(--color-line)] px-4 py-3 sm:px-5">
          <Plus className="h-5 w-5 shrink-0 text-[color:var(--color-ink-soft)]" aria-hidden />
          <h2 id="add-user-modal-title" className="text-base font-semibold sm:text-lg">
            {t("users.add_user")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={create.isPending}
            className="ml-auto grid h-9 w-9 place-items-center rounded-lg hover:bg-[color:var(--color-paper-2)] disabled:opacity-50"
            aria-label={t("common.close")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5">
          <div className="flex flex-col items-center gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[color:var(--color-ink-muted)]">
              {t("users.form_preview_title")}
            </p>
            <div className="inline-flex max-w-full items-center gap-2.5 rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-paper-2)]/40 px-4 py-2.5">
              <Avatar
                user={{
                  name: fullDisplayName || t("users.form_preview_pending_name"),
                  initials: previewInitials,
                  color,
                }}
                size="md"
              />
              <div className="min-w-0 text-left">
                <p
                  className={clsx(
                    "text-sm font-semibold whitespace-nowrap",
                    canSave
                      ? "text-[color:var(--color-ink)]"
                      : "text-[color:var(--color-ink-muted)]",
                  )}
                >
                  {canSave ? fullDisplayName : t("users.form_preview_pending_name")}
                </p>
                <p className="text-[11px] text-[color:var(--color-ink-muted)] whitespace-nowrap">
                  {previewSubtitle}
                </p>
              </div>
            </div>
          </div>

          <section className={clsx(sectionClass, "my-6 space-y-6")}>
            <div className="space-y-4">
              <p className={sectionTitleClass}>{t("users.form_section_identity")}</p>
              <UserEnglishNameFields
                firstName={firstName}
                lastName={lastName}
                showErrors={showErrors}
                onFirstNameChange={setFirstName}
                onLastNameChange={setLastName}
              />
            </div>

            <div className="space-y-4">
              <p className={sectionTitleClass}>{t("users.form_section_account")}</p>
              <label className="flex min-w-0 flex-col gap-2">
                <span className="text-xs font-semibold text-[color:var(--color-ink-soft)]">
                  {t("users.form_username")}
                </span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(filterUsernameInput(e.target.value));
                    setCreateError(null);
                  }}
                  autoComplete="username"
                  spellCheck={false}
                  className="rounded-xl border border-[color:var(--color-line)] bg-white px-3 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--color-ink)]/15"
                  aria-invalid={showErrors && usernameCheck !== "ok"}
                />
                <span className="text-[11px] leading-snug text-[color:var(--color-ink-muted)]">
                  {t("users.form_username_hint")}
                </span>
                {showErrors && usernameCheck !== "ok" ? (
                  <span className="text-xs text-red-600" role="alert">
                    {usernameValidationMessage(usernameCheck, t)}
                  </span>
                ) : null}
              </label>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="flex min-w-0 flex-col gap-2">
                  <span className="text-xs font-semibold text-[color:var(--color-ink-soft)]">
                    {t("auth.new_user_password")}
                  </span>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setCreateError(null);
                    }}
                    autoComplete="new-password"
                    className="rounded-xl border border-[color:var(--color-line)] bg-white px-3 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--color-ink)]/15"
                    aria-invalid={showErrors && !passwordOk}
                  />
                  {showErrors && !passwordOk ? (
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
                      setCreateError(null);
                    }}
                    autoComplete="new-password"
                    className="rounded-xl border border-[color:var(--color-line)] bg-white px-3 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--color-ink)]/15"
                    aria-invalid={showErrors && !confirmOk}
                  />
                  {showErrors && !confirmOk ? (
                    <span className="text-xs text-red-600" role="alert">
                      {t("auth.password_mismatch")}
                    </span>
                  ) : null}
                </label>
              </div>
              <PasswordSetupGuidance password={password} confirmPassword={confirmPassword} />
            </div>

            <div className="space-y-4">
              <p className={sectionTitleClass}>{t("users.form_section_role")}</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="flex min-w-0 flex-col gap-2">
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
                <label className="flex min-w-0 flex-col gap-2">
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
            </div>

            <div className="space-y-3">
              <p className={sectionTitleClass}>{t("users.form_features")}</p>
              <FeaturePermissionPicker value={permissions} onChange={setPermissions} />
            </div>
          </section>
        </div>

        <div className="flex w-full shrink-0 flex-col gap-2 border-t border-[color:var(--color-line)] px-4 py-3 sm:px-5">
          {createError ? (
            <p className="text-center text-sm text-red-600" role="alert">
              {createError}
            </p>
          ) : null}
          <div className="flex w-full gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={create.isPending}
            className="flex h-10 w-1/4 shrink-0 items-center justify-center rounded-xl border border-[color:var(--color-line)] bg-white text-sm font-medium shadow-sm hover:bg-[color:var(--color-paper-2)] disabled:opacity-50"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            disabled={create.isPending}
            onClick={handleSave}
            className="flex h-10 w-3/4 min-w-0 flex-[3] items-center justify-center rounded-xl bg-[color:var(--color-ink)] text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
          >
            {create.isPending ? t("common.loading") : t("common.save")}
          </button>
          </div>
        </div>
      </div>
    </div>
  );
}
