import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Lock, MousePointerClick, User as UserIcon, X } from "lucide-react";
import clsx from "clsx";

import { FlowLogo } from "../components/layout/FlowLogo";
import { LanguageMenu } from "../components/ui/LanguageMenu";
import { loginErrorMessage } from "../lib/authErrors";
import { getAuthToken } from "../lib/api";
import { useAuth } from "../lib/auth";
import { homePathForUser } from "../lib/format";
import type { User } from "../lib/types";

const fieldClass =
  "h-11 w-full rounded-xl border border-[color:var(--color-line)] bg-white pl-10 pr-3 text-sm shadow-sm transition focus:border-[color:var(--color-ink)]/25 focus:outline-none focus:ring-2 focus:ring-[color:var(--color-ink)]/10";

type DemoAccount = {
  departmentKey: "executive_management" | "front_office" | "bell_boy" | "housekeeping" | "maintenance";
  displayName: string;
  jobTitle: string;
  username: string;
  password: string;
};

function buildDemoAccounts(): DemoAccount[] {
  const baseRows: Array<{
    displayName: string;
    departmentKey: DemoAccount["departmentKey"];
    jobTitle: string;
  }> = [
    { displayName: "Admin User", departmentKey: "executive_management", jobTitle: "System Administrator" },
    { displayName: "Prasert M.", departmentKey: "executive_management", jobTitle: "General Manager" },
    { displayName: "Walai R.", departmentKey: "executive_management", jobTitle: "Room Division Manager" },
    { displayName: "Narong F.", departmentKey: "front_office", jobTitle: "Front Office Manager" },
    { displayName: "Orasa P.", departmentKey: "front_office", jobTitle: "Assistant Front Office Manager" },
    { displayName: "Nicha T.", departmentKey: "front_office", jobTitle: "Guest Service Agent" },
    { displayName: "Chaiwat L.", departmentKey: "front_office", jobTitle: "Guest Service Agent" },
    { displayName: "Supaporn D.", departmentKey: "front_office", jobTitle: "Guest Relation Manager" },
    { displayName: "Nop K.", departmentKey: "front_office", jobTitle: "Night Guest Service Agent" },
    { displayName: "Thida H.", departmentKey: "housekeeping", jobTitle: "Housekeeping Manager" },
    { displayName: "Anong K.", departmentKey: "housekeeping", jobTitle: "Housekeeping Supervisor" },
    { displayName: "Benchamat S.", departmentKey: "housekeeping", jobTitle: "Assistant Housekeeping Manager" },
    { displayName: "Malee S.", departmentKey: "housekeeping", jobTitle: "Housekeeper" },
    { displayName: "Niran K.", departmentKey: "housekeeping", jobTitle: "Housekeeper" },
    { displayName: "Somsak P.", departmentKey: "maintenance", jobTitle: "Technician" },
    { displayName: "Anan W.", departmentKey: "maintenance", jobTitle: "Technician" },
    { displayName: "Somkid R.", departmentKey: "bell_boy", jobTitle: "Bell Boy" },
    { displayName: "Pichai T.", departmentKey: "bell_boy", jobTitle: "Bell Boy" },
    { displayName: "Arun M.", departmentKey: "bell_boy", jobTitle: "Bell Boy" },
  ];
  const hkFirstNames = [
    "Wipa", "Suda", "Jintana", "Kamon", "Pensri", "Rattana", "Sirilak", "Narisa", "Daranee", "Nuchanart",
    "Kanyarat", "Pawinee", "Sasithorn", "Anchalee", "Siriporn", "Yupin", "Naree", "Busaba", "Pimdao", "Ladda",
  ];
  const hkJobTitles = ["Housekeeper", "Room Boy", "Public Area Housekeeper"];
  let n = 0;
  for (let tower = 1; tower <= 2; tower += 1) {
    for (let floor = 1; floor <= 9; floor += 1) {
      for (let slot = 0; slot < 2; slot += 1) {
        const first = hkFirstNames[n % hkFirstNames.length];
        const lastInitial = String.fromCharCode(65 + (n % 26));
        baseRows.push({
          displayName: `${first} ${lastInitial}.`,
          departmentKey: "housekeeping",
          jobTitle: hkJobTitles[n % hkJobTitles.length],
        });
        n += 1;
      }
    }
  }

  const usernameCounter = new Map<string, number>();
  const toBaseUsername = (displayName: string): string => {
    const parts = displayName.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "";
    const first = parts[0];
    const last = parts[parts.length - 1]?.replace(/\./g, "");
    const hasInitial = last && last.length === 1 && /[a-z]/i.test(last);
    return hasInitial ? `${first}${last}` : first;
  };

  return baseRows.map((row) => {
    const base = toBaseUsername(row.displayName);
    const used = usernameCounter.get(base) ?? 0;
    usernameCounter.set(base, used + 1);
    const username = used === 0 ? base : `${base} (${used + 1})`;
    return {
      ...row,
      username,
      password: "1234",
    };
  });
}

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { login, current, loading, clearAuthError } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showDepartmentAccounts, setShowDepartmentAccounts] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const demoAccounts = buildDemoAccounts();
  const groupedDemoAccounts = [
    "executive_management",
    "front_office",
    "bell_boy",
    "housekeeping",
    "maintenance",
  ].map((departmentKey) => {
    const departmentUsers = demoAccounts.filter((user) => user.departmentKey === departmentKey);
    if (departmentKey !== "housekeeping" && departmentKey !== "front_office") {
      return {
        departmentKey: departmentKey as DemoAccount["departmentKey"],
        users: departmentUsers,
      };
    }

    // Keep only one account per position to avoid overly long department lists.
    const seenJobTitles = new Set<string>();
    const reducedUsers = departmentUsers.filter((user) => {
      if (seenJobTitles.has(user.jobTitle)) return false;
      seenJobTitles.add(user.jobTitle);
      return true;
    });
    return {
      departmentKey: departmentKey as DemoAccount["departmentKey"],
      users: reducedUsers,
    };
  });

  useEffect(() => {
    clearAuthError();
  }, [clearAuthError]);

  if (getAuthToken() && !loading && current) {
    return <Navigate to={homePathForUser(current)} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const u = username.trim();
    if (!u || !password) {
      setError(t("auth.login_error_required"));
      return;
    }
    setPending(true);
    try {
      await login(u, password);
      const user = qc.getQueryData<User>(["auth", "me"]);
      navigate(user ? homePathForUser(user) : "/", { replace: true });
    } catch (err) {
      setError(loginErrorMessage(err, t));
    } finally {
      setPending(false);
    }
  };

  const handleSelectDemoAccount = async(account: DemoAccount) => {
    setError(null);
    setPending(true);
    setShowDepartmentAccounts(false);
    try {
      await login(account.username, account.password);
      const user = qc.getQueryData<User>(["auth", "me"]);
      navigate(user ? homePathForUser(user) : "/", {replace : true});
    } catch (err) {
      setError(loginErrorMessage(err, t))
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="relative flex min-h-[100dvh] flex-col bg-[color:var(--color-paper)]">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(126,185,147,0.22),transparent_55%),radial-gradient(ellipse_50%_40%_at_100%_100%,rgba(75,87,107,0.08),transparent)]"
        aria-hidden
      />

      <header className="relative z-20 flex items-center justify-between px-4 py-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <FlowLogo className="h-9 w-9" />
          <span className="text-lg font-semibold tracking-tight">{t("brand")}</span>
        </div>
        <div className="w-[148px] sm:w-[160px]">
          <LanguageMenu variant="compact" />
        </div>
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 pb-10">
        <div className="w-full max-w-[22rem]">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-[color:var(--color-ink)]">
              {t("auth.login_page_title")}
            </h1>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowDepartmentAccounts((v) => !v)}
              className="absolute left-1/2 top-full z-30 mt-2 hidden -translate-x-1/2 rounded-xl border border-[color:var(--color-line)] bg-white px-3 py-2 text-xs font-semibold tracking-wide text-[color:var(--color-ink-soft)] shadow-sm transition hover:bg-[color:var(--color-paper-2)] lg:inline-flex"
              aria-expanded={showDepartmentAccounts}
              aria-controls="department-demo-accounts-modal"
            >
              {showDepartmentAccounts
                ? t("auth.hide_department_accounts")
                : t("auth.show_department_accounts")}
            </button>

            <div className="rounded-2xl border border-[color:var(--color-line)] bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.06)] sm:p-6">
              <form onSubmit={handleSubmit}>
                <div className="space-y-4">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold text-[color:var(--color-ink-soft)]">
                      {t("auth.login_username")}
                    </span>
                    <span className="relative block">
                      <UserIcon
                        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--color-ink-muted)]"
                        aria-hidden
                      />
                      <input
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        autoComplete="username"
                        className={fieldClass}
                        placeholder={t("auth.login_username_ph")}
                      />
                    </span>
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold text-[color:var(--color-ink-soft)]">
                      {t("auth.login_password")}
                    </span>
                    <span className="relative block">
                      <Lock
                        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--color-ink-muted)]"
                        aria-hidden
                      />
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="current-password"
                        className={clsx(fieldClass, "pr-10")}
                        placeholder="••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-[color:var(--color-ink-muted)] hover:bg-[color:var(--color-paper-2)]"
                        aria-label={
                          showPassword ? t("auth.hide_password") : t("auth.show_password")
                        }
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </span>
                  </label>
                </div>

                {error ? (
                  <p role="alert" className="mt-3 text-sm text-red-600">
                    {error}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={pending}
                  className="mt-5 flex h-11 w-full items-center justify-center rounded-xl bg-[color:var(--color-ink)] text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
                >
                  {pending ? t("common.loading") : t("auth.login_submit")}
                </button>
              </form>

              <button
                type="button"
                onClick={() => setShowDepartmentAccounts((v) => !v)}
                className="mt-4 inline-flex rounded-lg border border-[color:var(--color-line)] px-3 py-2 text-xs font-semibold text-[color:var(--color-ink-soft)] transition hover:bg-[color:var(--color-paper-2)] lg:hidden"
                aria-expanded={showDepartmentAccounts}
                aria-controls="department-demo-accounts-modal"
              >
                {showDepartmentAccounts
                  ? t("auth.hide_department_accounts")
                  : t("auth.show_department_accounts")}
              </button>

              <div className="mt-5 space-y-2 border-t border-[color:var(--color-line)]/80 pt-4 text-center text-xs leading-relaxed text-[color:var(--color-ink-muted)] whitespace-pre-line">
                <p>{t("auth.login_demo_credentials")}</p>
                <p>{t("auth.login_demo_accounts_path")}</p>
              </div>
            </div>
          </div>
        </div>
      </main>
      <div
        id="department-demo-accounts-modal"
        className={clsx(
          "fixed inset-0 z-40 flex items-center justify-center bg-black/30 px-4 transition-opacity duration-200",
          showDepartmentAccounts ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={() => setShowDepartmentAccounts(false)}
        aria-hidden={!showDepartmentAccounts}
      >
        <div
          className={clsx(
            "w-full max-w-xl rounded-2xl border border-[color:var(--color-line)] bg-white p-5 shadow-[0_14px_38px_rgba(0,0,0,0.2)] transition-all duration-200 sm:p-6",
            showDepartmentAccounts ? "scale-100 translate-y-0" : "scale-95 translate-y-3",
          )}
          role="dialog"
          aria-modal="true"
          aria-label={t("auth.department_accounts_title")}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-[color:var(--color-ink)]">
                {t("auth.department_accounts_title")}
              </h2>
              <p className="mt-1 text-xs text-[color:var(--color-ink-muted)]">
                {t("auth.department_accounts_hint")}
              </p>
            </div>
            <button
              type="button"
              className="grid h-8 w-8 place-items-center rounded-lg text-[color:var(--color-ink-muted)] transition hover:bg-[color:var(--color-paper-2)]"
              onClick={() => setShowDepartmentAccounts(false)}
              aria-label={t("common.close")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 max-h-[60dvh] space-y-4 overflow-y-auto pr-1">
            {groupedDemoAccounts.map((group) => (
              <section key={group.departmentKey} className="rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-paper)] p-3">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[color:var(--color-ink-soft)]">
                  {t(`departments.${group.departmentKey}`)}
                </h3>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {group.users.map((user) => (
                    <button
                      key={`${user.departmentKey}-${user.username}-${user.jobTitle}`}
                      type="button"
                      disabled={pending}
                      onClick={() => void handleSelectDemoAccount(user)}
                      className="group w-full cursor-pointer rounded-md border border-[color:var(--color-line)] bg-white p-2 text-left shadow-sm ring-1 ring-transparent transition hover:-translate-y-0.5 hover:border-[color:var(--color-ink)]/25 hover:shadow-md hover:ring-[color:var(--color-ink)]/15 active:translate-y-0 active:shadow-sm"
                    >
                      <p className="flex items-center justify-between gap-2 text-xs text-[color:var(--color-ink)]">
                        <span>
                          {t("auth.login_username")}: <span className="font-semibold">{user.username}</span>
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[color:var(--color-ink-soft)] opacity-70 transition group-hover:opacity-100">
                          <MousePointerClick className="h-3.5 w-3.5" />
                          <span>{t("auth.click_to_use_account")}</span>
                        </span>
                      </p>
                      <p className="text-xs text-[color:var(--color-ink)]">
                        {t("auth.login_password")}: <span className="font-semibold">{user.password}</span>
                      </p>
                      <p className="text-xs text-[color:var(--color-ink)]">
                        {t("auth.account_position")}: <span className="font-semibold">{user.jobTitle}</span>
                      </p>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
