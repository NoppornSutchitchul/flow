import type { ReportFiltersState } from "../../lib/reportPresetFilters";
import { ReportDateRangeFields } from "./ReportDateRangeFields";

type Props = {
  filters: ReportFiltersState;
  onChange: (next: ReportFiltersState) => void;
};

export function ReportDateRangeBar({ filters, onChange }: Props) {
  const patch = (partial: Partial<ReportFiltersState>) =>
    onChange({ ...filters, ...partial });

  return (
    <ReportDateRangeFields
      className="w-full min-w-0 max-w-full"
      dateFrom={filters.dateFrom}
      dateTo={filters.dateTo}
      onDateFromChange={(dateFrom) => patch({ dateFrom })}
      onDateToChange={(dateTo) => patch({ dateTo })}
    />
  );
}
