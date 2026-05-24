import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Lock, User as UserIcon } from "lucide-react";
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

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { login, current, loading, clearAuthError } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

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

          <div className="mt-5 space-y-2 border-t border-[color:var(--color-line)]/80 pt-4 text-center text-xs leading-relaxed text-[color:var(--color-ink-muted)] whitespace-pre-line">
            <p>{t("auth.login_demo_credentials")}</p>
            <p>{t("auth.login_demo_accounts_path")}</p>
          </div>
          </div>
        </div>
      </main>
    </div>
  );
}
