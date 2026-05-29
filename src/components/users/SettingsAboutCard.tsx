import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Info } from "lucide-react";
import clsx from "clsx";

import { settingsApi } from "../../lib/api";
import { APP_VERSION, supportedLanguagesLabel } from "../../lib/appInfo";

function AboutRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
      <dt className="shrink-0 text-[color:var(--color-ink-muted)]">{label}</dt>
      <dd
        className={clsx(
          "min-w-0 text-right font-medium text-[color:var(--color-ink)]",
          mono && "font-mono text-xs text-[color:var(--color-ink-soft)]",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

export function SettingsAboutCard() {
  const { t } = useTranslation();
  const { data: health, isLoading: healthLoading, isError: healthError } = useQuery({
    queryKey: ["settings", "health"],
    queryFn: settingsApi.health,
    staleTime: 60_000,
    retry: 1,
  });

  const serverStatus = healthLoading
    ? t("settings.about_server_checking")
    : healthError || !health?.ok
      ? t("settings.about_server_error")
      : t("settings.about_server_ok");

  return (
    <section className="rounded-2xl border border-[color:var(--color-line)] bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[color:var(--color-paper-2)] ring-1 ring-[color:var(--color-line)]/80">
          <Info className="h-5 w-5 text-[color:var(--color-delivered-fg)]" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold tracking-tight text-[color:var(--color-ink)]">
            {t("settings.about")}
          </h2>
        </div>
      </div>
      <dl className="divide-y divide-[color:var(--color-line)]/80 text-sm">
        <AboutRow label={t("settings.about_app")} value={t("brand")} />
        <AboutRow label={t("settings.version")} value={APP_VERSION} mono />
        <AboutRow label={t("settings.about_languages")} value={supportedLanguagesLabel()} />
        <div className="flex items-center justify-between gap-4 py-2.5">
          <dt className="text-[color:var(--color-ink-muted)]">{t("settings.about_server")}</dt>
          <dd className="flex items-center justify-end gap-2 text-sm font-medium">
            <span
              className={clsx(
                "h-2 w-2 shrink-0 rounded-full",
                healthLoading && "animate-pulse bg-[color:var(--color-ink-muted)]",
                !healthLoading && !healthError && health?.ok && "bg-[color:var(--color-delivered-fg)]",
                (!healthLoading && (healthError || !health?.ok)) && "bg-[color:var(--color-pending-fg)]",
              )}
              aria-hidden
            />
            <span
              className={clsx(
                healthError || (!healthLoading && !health?.ok)
                  ? "text-[color:var(--color-pending-fg)]"
                  : "text-[color:var(--color-ink)]",
              )}
            >
              {serverStatus}
            </span>
          </dd>
        </div>
      </dl>
    </section>
  );
}
