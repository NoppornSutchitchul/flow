import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { useAuth } from "../../lib/auth";
import { getAuthToken } from "../../lib/api";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { current, loading } = useAuth();
  if (!getAuthToken()) {
    return <Navigate to="/login" replace />;
  }

  if (loading) {
    return (
      <div
        className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center"
        aria-busy
      >
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[color:var(--color-line)] border-t-[color:var(--color-ink-soft)]" />
        <p className="text-sm text-[color:var(--color-ink-muted)]">{t("common.loading")}</p>
      </div>
    );
  }

  if (!current) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
