import clsx from "clsx";
import { useTranslation } from "react-i18next";

import { AnimateExpand } from "../ui/AnimateExpand";
import type { ReportPresetMeta } from "../../lib/types";
import {
  reportFiltersDateRangeInvalid,
  type ReportFiltersState,
} from "../../lib/reportPresetFilters";
import { ReportDateRangeBar } from "./ReportDateRangeBar";
import { ReportMomCompareDateBar } from "./ReportMomCompareDateBar";
import { ReportPresetCombobox } from "./ReportPresetCombobox";

type Props = {
  presets: ReportPresetMeta[];
  selectedSlug: string | null;
  onSelectReport: (slug: string) => void;
  presetsLoading?: boolean;
  filters: ReportFiltersState;
  onChangeFilters: (next: ReportFiltersState) => void;
};

export function ReportCustomizeIsland({
  presets,
  selectedSlug,
  onSelectReport,
  presetsLoading = false,
  filters,
  onChangeFilters,
}: Props) {
  const { t } = useTranslation();
  const isMom = selectedSlug === "month-over-month-comparison";
  const rangeTooLong = reportFiltersDateRangeInvalid(filters, selectedSlug);

  return (
    <section
      className="no-print shrink-0 rounded-xl border border-[color:var(--color-line)] bg-white p-4 shadow-sm md:p-5"
      aria-label={t("reports.customize_title")}
    >
      <div
        className={clsx(
          "grid gap-5",
          isMom
            ? "md:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] md:items-start md:gap-6 xl:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] xl:gap-8"
            : "md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:items-end md:gap-6 lg:gap-8",
        )}
      >
        <div className="relative z-10 flex min-w-0 flex-col gap-1.5">
          <p className="text-xs font-medium text-[color:var(--color-ink-soft)]">
            {t("reports.customize_report")}
          </p>
          <ReportPresetCombobox
            presets={presets}
            selectedSlug={selectedSlug}
            onSelect={onSelectReport}
            loading={presetsLoading}
          />
        </div>
        <AnimateExpand
          deps={[selectedSlug]}
          similarThreshold={8}
          clipWhileAnimating
          className={clsx(
            "flex min-w-0 flex-col",
            isMom
              ? "md:min-w-0 md:justify-self-stretch"
              : "w-full justify-self-center md:max-w-none md:justify-self-stretch",
          )}
        >
          <div
            className={clsx(
              "flex min-w-0 w-full flex-col items-stretch gap-1.5 text-center",
              isMom ? "md:items-stretch md:text-left" : "md:items-end md:text-right",
            )}
          >
            <p className="flex flex-wrap items-baseline justify-center gap-x-1.5 text-xs font-medium text-[color:var(--color-ink-soft)]">
              <span>{isMom ? t("reports.mom_compare_ranges") : t("reports.customize_period")}</span>
              {rangeTooLong ? (
                <span className="font-normal text-red-600" role="alert">
                  {t("reports.range_max_one_year")}
                </span>
              ) : null}
            </p>
            {isMom ? (
              <ReportMomCompareDateBar filters={filters} onChange={onChangeFilters} />
            ) : (
              <ReportDateRangeBar filters={filters} onChange={onChangeFilters} />
            )}
          </div>
        </AnimateExpand>
      </div>
    </section>
  );
}
