import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  BarChart3,
  ChevronLeft,
  Clock,
  LayoutDashboard,
  Users,
  Warehouse,
} from "lucide-react";
import clsx from "clsx";

import type { ReportPresetMeta } from "../../lib/types";
import { groupPresetsByCategory } from "../../lib/reportPresetCategories";
import { presetIconForSlug } from "../../lib/reportPresetIcons";

const CATEGORY_ICONS: Record<string, typeof BarChart3> = {
  executive: LayoutDashboard,
  operations: BarChart3,
  staff: Users,
  inventory: Warehouse,
  audit: Clock,
};

type Props = {
  presets: ReportPresetMeta[];
  onSelect: (slug: string) => void;
  loading?: boolean;
};

export function ReportPresetPicker({ presets, onSelect, loading = false }: Props) {
  const { t } = useTranslation();
  const grouped = useMemo(() => groupPresetsByCategory(presets), [presets]);
  const [category, setCategory] = useState<string | null>(null);

  const activeGroup = grouped.find((g) => g.category === category);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="text-sm text-[color:var(--color-ink-muted)]">{t("common.loading")}</p>
      </div>
    );
  }

  if (presets.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
        <p className="text-sm font-medium text-[color:var(--color-ink-soft)]">
          {t("reports.presets_empty")}
        </p>
      </div>
    );
  }

  if (!category || !activeGroup) {
    const renderCategoryCard = ({ category: cat, items }: (typeof grouped)[number]) => {
      const Icon = CATEGORY_ICONS[cat] ?? BarChart3;
      return (
        <button
          key={cat}
          type="button"
          onClick={() => setCategory(cat)}
          className={clsx(
            "flex min-h-[7.5rem] w-full flex-col items-start gap-2 rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-paper-2)]/30 p-4 text-left transition",
            "hover:border-[color:var(--color-ink)]/20 hover:bg-white hover:shadow-sm",
          )}
        >
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-white ring-1 ring-[color:var(--color-line)]/80">
            <Icon className="h-5 w-5 text-[color:var(--color-delivered-fg)]" aria-hidden />
          </span>
          <span className="font-semibold leading-snug text-[color:var(--color-ink)]">
            {t(`reports.category.${cat}`)}
          </span>
          <span className="text-xs text-[color:var(--color-ink-muted)]">
            {t("reports.pick_category_count", { count: items.length })}
          </span>
        </button>
      );
    };

    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-5 p-5 md:p-8">
        <p className="w-full max-w-lg text-center text-sm font-medium text-[color:var(--color-ink-soft)]">
          {t("reports.pick_category")}
        </p>
        <div className="grid w-full max-w-lg grid-cols-1 gap-3 sm:grid-cols-2">
          {grouped.map(renderCategoryCard)}
        </div>
      </div>
    );
  }

  const renderReportButton = (p: ReportPresetMeta) => {
    const Icon = presetIconForSlug(p.slug);
    return (
      <button
        type="button"
        onClick={() => onSelect(p.slug)}
        className={clsx(
          "flex min-h-[5.5rem] w-full flex-col items-center justify-center gap-2 rounded-xl border border-[color:var(--color-line)]/80 bg-[color:var(--color-paper-2)]/25 px-4 py-3 text-center text-sm font-medium leading-snug text-[color:var(--color-ink)] transition",
          "hover:border-[color:var(--color-ink)]/20 hover:bg-white hover:shadow-sm",
        )}
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white ring-1 ring-[color:var(--color-line)]/80">
          <Icon className="h-4 w-4 text-[color:var(--color-delivered-fg)]" aria-hidden />
        </span>
        <span className="font-mono text-xs font-semibold tabular-nums text-[color:var(--color-delivered-fg)]">
          {p.code}
        </span>
        <span>{t(p.title_key)}</span>
      </button>
    );
  };

  const items = activeGroup.items;
  const denseGrid = items.length >= 6;
  const gridClass = denseGrid
    ? "grid auto-rows-min grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3"
    : "grid auto-rows-min gap-2 sm:grid-cols-2";

  return (
    <div className="flex min-h-0 flex-1 flex-col p-5 md:p-8">
      <div className="flex shrink-0 flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setCategory(null)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--color-line)] bg-white px-3 py-1.5 text-xs font-medium text-[color:var(--color-ink-soft)] hover:bg-[color:var(--color-paper-2)]"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          {t("reports.change_category")}
        </button>
        <p className="text-sm font-medium text-[color:var(--color-ink-soft)]">
          {t("reports.pick_report")} · {t(`reports.category.${activeGroup.category}`)}
        </p>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div
          className={clsx(
            "m-auto flex w-full flex-col gap-2 py-4",
            denseGrid ? "max-w-5xl" : "max-w-2xl",
          )}
        >
          <ul className={gridClass}>
            {items.map((p) => (
              <li key={p.slug} className="min-h-0">
                {renderReportButton(p)}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
