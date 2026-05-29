import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight, FileText, Search, Share2 } from "lucide-react";
import clsx from "clsx";

import { formatReportDateShort } from "../../lib/format";
import {
  formatSavedReportMonthLabel,
  groupSavedReportsByMonth,
  processSavedReportList,
  type SavedReportMineFilter,
  type SavedReportSharedFilter,
  type SavedReportSort,
} from "../../lib/savedReportList";
import { isSavedReportSnapshotLayout, snapshotListSubtitle } from "../../lib/savedReportSnapshot";
import { useAuth } from "../../lib/auth";
import type { CustomReportRead, ReportPresetMeta } from "../../lib/types";

type Mode = "mine" | "shared";

type Props = {
  mode: Mode;
  reports: CustomReportRead[];
  presets: ReportPresetMeta[];
  emptyMessage: string;
  emptyAction?: { label: string; onClick: () => void };
  onOpen: (id: number, viewOnly: boolean) => void;
  onShare?: (id: number, title: string) => void;
};

const SORT_OPTIONS: SavedReportSort[] = ["newest", "oldest", "title", "code"];

export function SavedReportListPanel({
  mode,
  reports,
  presets,
  emptyMessage,
  emptyAction,
  onOpen,
  onShare,
}: Props) {
  const { t, i18n } = useTranslation();
  const { current } = useAuth();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SavedReportSort>("newest");
  const [mineFilter, setMineFilter] = useState<SavedReportMineFilter>("all");
  const [sharedFilter, setSharedFilter] = useState<SavedReportSharedFilter>("all");

  const filtered = useMemo(
    () =>
      processSavedReportList({
        rows: reports,
        search,
        sort,
        presets,
        translate: t,
        lang: i18n.language,
        mineFilter: mode === "mine" ? mineFilter : undefined,
        sharedFilter: mode === "shared" ? sharedFilter : undefined,
        currentUserId: mode === "shared" ? current?.id : undefined,
      }),
    [
      reports,
      search,
      sort,
      presets,
      t,
      i18n.language,
      mineFilter,
      sharedFilter,
      mode,
      current?.id,
    ],
  );

  const groups = useMemo(() => groupSavedReportsByMonth(filtered), [filtered]);

  if (reports.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-[color:var(--color-line)] bg-[color:var(--color-paper-2)]/40 px-6 py-12 text-center">
        <FileText className="mx-auto h-10 w-10 text-[color:var(--color-ink-muted)]" aria-hidden />
        <p className="mt-3 text-sm text-[color:var(--color-ink-muted)]">{emptyMessage}</p>
        {emptyAction && (
          <button
            type="button"
            onClick={emptyAction.onClick}
            className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg border border-[color:var(--color-line)] bg-white px-3 text-sm font-medium hover:bg-[color:var(--color-paper-2)]"
          >
            {emptyAction.label}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="shrink-0 space-y-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--color-ink-muted)]"
            aria-hidden
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("reports.saved_list_search_placeholder")}
            className="w-full rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-paper-2)]/30 py-2.5 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--color-ink)]/12"
          />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <div
            className="flex flex-wrap items-center gap-1.5"
            role="group"
            aria-label={t("reports.saved_list_sort_label")}
          >
            <span className="shrink-0 text-xs font-medium text-[color:var(--color-ink-muted)]">
              {t("reports.saved_list_sort_label")}
            </span>
            <div className="flex flex-wrap gap-1 rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-paper-2)]/40 p-0.5">
              {SORT_OPTIONS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSort(key)}
                  className={clsx(
                    "rounded-md px-2.5 py-1 text-xs font-medium transition whitespace-nowrap",
                    sort === key
                      ? "bg-[color:var(--color-ink)] text-white"
                      : "text-[color:var(--color-ink-soft)] hover:bg-white",
                  )}
                >
                  {t(`reports.saved_list_sort_${key}`)}
                </button>
              ))}
            </div>
          </div>
          {mode === "mine" ? (
            <div className="flex flex-wrap gap-1 rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-paper-2)]/40 p-0.5">
              {(
                [
                  ["all", "reports.saved_list_filter_all"],
                  ["shared_everyone", "reports.saved_list_filter_shared"],
                  ["private", "reports.saved_list_filter_private"],
                ] as const
              ).map(([id, labelKey]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setMineFilter(id)}
                  className={clsx(
                    "rounded-md px-2.5 py-1 text-xs font-medium transition",
                    mineFilter === id
                      ? "bg-[color:var(--color-ink)] text-white"
                      : "text-[color:var(--color-ink-soft)] hover:bg-white",
                  )}
                >
                  {t(labelKey)}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-1 rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-paper-2)]/40 p-0.5">
              {(
                [
                  ["all", "reports.saved_list_filter_all"],
                  ["by_me", "reports.saved_list_filter_by_me"],
                  ["public", "reports.saved_list_filter_public"],
                  ["direct", "reports.saved_list_filter_direct"],
                ] as const
              ).map(([id, labelKey]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSharedFilter(id)}
                  className={clsx(
                    "rounded-md px-2.5 py-1 text-xs font-medium transition",
                    sharedFilter === id
                      ? "bg-[color:var(--color-ink)] text-white"
                      : "text-[color:var(--color-ink-soft)] hover:bg-white",
                  )}
                >
                  {t(labelKey)}
                </button>
              ))}
            </div>
          )}
          <span className="text-xs text-[color:var(--color-ink-muted)] sm:ml-auto">
            {t("reports.saved_list_count", {
              shown: filtered.length,
              total: reports.length,
            })}
          </span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="flex flex-1 items-center justify-center py-12 text-sm text-[color:var(--color-ink-muted)]">
          {t("reports.saved_list_no_results")}
        </p>
      ) : (
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
          {groups.map(({ key, items }) => (
            <section key={key}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[color:var(--color-ink-muted)]">
                {formatSavedReportMonthLabel(key, i18n.language)}
              </h3>
              <ul className="grid gap-2 sm:grid-cols-2">
                {items.map((r) => {
                  const period = snapshotListSubtitle(
                    r.layout_json,
                    i18n.language,
                    presets,
                    t,
                  );
                  const isSnapshot = isSavedReportSnapshotLayout(r.layout_json);
                  const shareHint =
                    mode === "mine" && r.shared_with_all
                      ? t("reports.share_status_everyone")
                      : null;

                  if (mode === "mine") {
                    return (
                      <li key={r.id}>
                        <div className="flex w-full items-center gap-2 rounded-xl border border-[color:var(--color-line)]/80 bg-[color:var(--color-paper-2)]/30 px-3 py-2 transition hover:border-[color:var(--color-ink)]/20 hover:bg-white hover:shadow-sm">
                          <button
                            type="button"
                            onClick={() => onOpen(r.id, isSnapshot)}
                            className="flex min-w-0 flex-1 items-center gap-3 py-1 text-left"
                          >
                            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-[color:var(--color-line)] bg-white">
                              <FileText className="h-5 w-5 text-[color:var(--color-ink-muted)]" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium">{r.title}</span>
                              <span className="block text-xs text-[color:var(--color-ink-muted)]">
                                {[period, shareHint].filter(Boolean).join(" · ") ||
                                  t("reports.custom_updated", {
                                    date: formatReportDateShort(
                                      r.updated_at,
                                      i18n.language,
                                    ),
                                  })}
                              </span>
                            </span>
                            <ChevronRight className="h-4 w-4 shrink-0 text-[color:var(--color-ink-muted)]" />
                          </button>
                          {onShare && (
                            <button
                              type="button"
                              onClick={() => onShare(r.id, r.title)}
                              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[color:var(--color-line)] bg-white hover:bg-[color:var(--color-paper-2)]"
                              aria-label={t("reports.share_btn")}
                            >
                              <Share2 className="h-4 w-4 text-[color:var(--color-ink-soft)]" />
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  }

                  return (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => onOpen(r.id, true)}
                        className="flex w-full items-center gap-3 rounded-xl border-2 border-[color:var(--color-share-line)] bg-white px-4 py-3 text-left shadow-[0_4px_14px_rgb(31_29_26/0.08),0_2px_6px_rgb(72_120_168/0.1)] transition hover:border-[color:var(--color-share-line)] hover:bg-white hover:shadow-[0_8px_24px_rgb(31_29_26/0.12),0_4px_12px_rgb(72_120_168/0.16)]"
                      >
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border-2 border-[color:var(--color-share-line)]/80 bg-[color:var(--color-share-surface)] shadow-sm">
                          <FileText className="h-5 w-5 text-[color:var(--color-ink-muted)]" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{r.title}</span>
                          <span className="block text-xs text-[color:var(--color-ink-muted)]">
                            {r.owner_user_id === current?.id
                              ? r.shared_with_all
                                ? t("reports.shared_by_you_everyone")
                                : t("reports.shared_by_you_people", {
                                    count: r.individual_share_count ?? 0,
                                  })
                              : r.shared_with_all
                                ? t("reports.shared_by_everyone", {
                                    name: r.owner_name ?? "—",
                                  })
                                : t("reports.shared_by", { name: r.owner_name ?? "—" })}
                          </span>
                          {period && (
                            <span className="block text-xs text-[color:var(--color-ink-muted)]/80">
                              {period}
                            </span>
                          )}
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
