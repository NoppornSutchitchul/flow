import { useTranslation } from "react-i18next";
import clsx from "clsx";

import { DatePickerField } from "../ui/DatePickerField";

type Props = {
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  className?: string;
  fieldClassName?: string;
};

export function ReportDateRangeFields({
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  className,
  fieldClassName,
}: Props) {
  const { t } = useTranslation();

  return (
    <div
      className={clsx(
        "flex min-w-0 flex-nowrap items-center gap-1.5 sm:gap-2",
        className,
      )}
    >
      <DatePickerField
        compact
        size="sm"
        className={clsx("min-w-0 flex-1 basis-0", fieldClassName)}
        value={dateFrom}
        max={dateTo}
        onChange={onDateFromChange}
        aria-label={t("reports.filter_date_from")}
      />
      <span
        className="shrink-0 px-0.5 text-xs font-medium text-[color:var(--color-ink-muted)]"
        aria-hidden
      >
        -
      </span>
      <DatePickerField
        compact
        size="sm"
        className={clsx("min-w-0 flex-1 basis-0", fieldClassName)}
        value={dateTo}
        min={dateFrom}
        onChange={onDateToChange}
        aria-label={t("reports.filter_date_to")}
      />
    </div>
  );
}
