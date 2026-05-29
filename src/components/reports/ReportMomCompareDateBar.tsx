import { useTranslation } from "react-i18next";

import type { ReportFiltersState } from "../../lib/reportPresetFilters";
import { ReportDateRangeFields } from "./ReportDateRangeFields";

type Props = {
  filters: ReportFiltersState;
  onChange: (next: ReportFiltersState) => void;
};

type PeriodKeys = {
  from: "dateFrom" | "compareDateFrom";
  to: "dateTo" | "compareDateTo";
};

function PeriodRow({
  periodLabel,
  keys,
  filters,
  onPatch,
}: {
  periodLabel: string;
  keys: PeriodKeys;
  filters: ReportFiltersState;
  onPatch: (partial: Partial<ReportFiltersState>) => void;
}) {
  return (
    <div className="grid grid-cols-1 items-center gap-x-4 gap-y-2 sm:grid-cols-[5.25rem_minmax(0,1fr)]">
      <span className="text-xs font-semibold text-[color:var(--color-ink)] sm:text-right">
        {periodLabel}
      </span>
      <ReportDateRangeFields
        className="min-w-0 w-full justify-start sm:justify-center"
        fieldClassName="min-w-0"
        dateFrom={filters[keys.from]}
        dateTo={filters[keys.to]}
        onDateFromChange={(v) => onPatch({ [keys.from]: v })}
        onDateToChange={(v) => onPatch({ [keys.to]: v })}
      />
    </div>
  );
}

export function ReportMomCompareDateBar({ filters, onChange }: Props) {
  const { t } = useTranslation();

  const patch = (partial: Partial<ReportFiltersState>) =>
    onChange({ ...filters, ...partial });

  return (
    <div className="rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-paper-2)]/60 px-3 py-3 sm:px-4 sm:py-3.5">
      <div className="flex flex-col gap-3">
        <PeriodRow
          periodLabel={t("reports.mom_period_a")}
          keys={{ from: "dateFrom", to: "dateTo" }}
          filters={filters}
          onPatch={patch}
        />
        <div
          className="flex items-center gap-3 text-[10px] font-medium uppercase tracking-wide text-[color:var(--color-ink-muted)]"
          aria-hidden
        >
          <span className="h-px flex-1 bg-[color:var(--color-line)]" />
          <span>{t("reports.mom_vs")}</span>
          <span className="h-px flex-1 bg-[color:var(--color-line)]" />
        </div>
        <PeriodRow
          periodLabel={t("reports.mom_period_b")}
          keys={{ from: "compareDateFrom", to: "compareDateTo" }}
          filters={filters}
          onPatch={patch}
        />
      </div>
    </div>
  );
}
