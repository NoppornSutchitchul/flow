import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { CalendarRange, ChevronDown, ChevronUp } from "lucide-react";
import clsx from "clsx";

import { ListPaginationFooter } from "../ui/ListPaginationFooter";
import { formatReportDateShort, formatReportTimeShort } from "../../lib/format";
import {
  reportTableCell,
  sortReportTableRows,
  type ReportTableColumn,
  type ReportTableRow,
  type ReportTableSortDir,
} from "../../lib/reportTableSort";
import { PAGE_SIZE_ALL, useClientPagination } from "../../lib/useClientPagination";

export type { ReportTableColumn, ReportTableRow };
export { reportTableRow } from "../../lib/reportTableSort";

export const REPORT_TABLE_PAGE_SIZES = [10, 25, 50, 100, PAGE_SIZE_ALL] as const;

export function ReportDateTimeCell({ iso, lang }: { iso: string; lang?: string }) {
  const date = formatReportDateShort(iso, lang);
  const time = formatReportTimeShort(iso, lang);
  if (date === "—") {
    return <span className="text-[color:var(--color-ink-muted)]">—</span>;
  }
  return (
    <span className="inline-flex flex-col gap-0.5 tabular-nums leading-tight">
      <span className="text-sm text-[color:var(--color-ink)]">{date}</span>
      <span className="text-xs text-[color:var(--color-ink-muted)]">{time}</span>
    </span>
  );
}

export function ReportDocument({
  title,
  meta,
  children,
  className,
}: {
  title: string;
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <article className={clsx("report-document", className)}>
      <header className="report-document-header mb-6 border-b border-[color:var(--color-line)] pb-4">
        <h2 className="text-3xl font-semibold tracking-tight text-[color:var(--color-ink)]">
          {title}
        </h2>
        {meta ? (
          <div className="mt-2.5 flex w-full min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 text-xs leading-relaxed text-[color:var(--color-ink-muted)] [&>*]:min-w-0">
            {meta}
          </div>
        ) : null}
      </header>
      {children}
    </article>
  );
}

export function ReportSection({
  title,
  description,
  children,
  className,
  id,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={clsx("report-section scroll-mt-24", className)}>
      <div className="mb-3">
        <h3 className="text-xl font-semibold text-[color:var(--color-ink)]">{title}</h3>
        {description ? (
          <p className="mt-0.5 text-sm text-[color:var(--color-ink-muted)]">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function ReportRangeInvalidState({ message }: { message: string }) {
  return (
    <div
      className="flex min-h-[min(50vh,20rem)] flex-1 flex-col items-center justify-center px-6 py-12 text-center"
      role="alert"
    >
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-red-50 ring-1 ring-red-200/80">
        <CalendarRange className="h-7 w-7 text-red-500" aria-hidden />
      </span>
      <p className="mt-4 max-w-sm text-sm font-medium text-red-700">{message}</p>
    </div>
  );
}

export function ReportEmptyState({ message, hint }: { message: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[color:var(--color-line)] bg-[color:var(--color-paper-2)]/30 px-6 py-14 text-center">
      <span className="text-4xl" aria-hidden>
        📊
      </span>
      <p className="mt-3 text-base font-medium text-[color:var(--color-ink)]">{message}</p>
      {hint ? <p className="mt-1 text-sm text-[color:var(--color-ink-muted)]">{hint}</p> : null}
    </div>
  );
}

export function ReportLoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-6 p-2">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 rounded-xl bg-[color:var(--color-paper-2)]" />
        ))}
      </div>
      <div className="h-64 rounded-xl bg-[color:var(--color-paper-2)]" />
      <div className="h-48 rounded-xl bg-[color:var(--color-paper-2)]" />
    </div>
  );
}

export type KpiStatus = "on_track" | "warning" | "critical";

const STATUS_PILL: Record<KpiStatus, string> = {
  on_track: "bg-emerald-100 text-emerald-800",
  warning: "bg-amber-100 text-amber-900",
  critical: "bg-red-100 text-red-800",
};

export function KpiCard({
  label,
  value,
  unit,
  trend,
  target,
  status,
  statusLabel,
  variant = "default",
  onClick,
}: {
  label: string;
  value: string | number;
  unit?: string;
  trend?: {
    pct: number;
    direction: "up" | "down" | "flat";
    good?: boolean;
    label?: string;
    periodRange?: string;
  };
  target?: string;
  status?: KpiStatus;
  /** Localized pill text (e.g. เป้าหมาย / เฝ้าระวัง / วิกฤต). */
  statusLabel?: string;
  variant?: "default" | "success" | "warning" | "danger";
  onClick?: () => void;
}) {
  const variantClass = {
    default: "border-[color:var(--color-border-report)] bg-[color:var(--color-surface-elevated)]",
    success: "border-emerald-200/80 bg-emerald-50/40",
    warning: "border-amber-200/80 bg-amber-50/50",
    danger: "border-red-200/80 bg-red-50/40",
  }[variant];

  const trendGood = trend?.good ?? false;
  const trendClass =
    trend?.direction === "flat"
      ? "text-[color:var(--color-ink-muted)]"
      : trendGood
        ? "text-emerald-700"
        : "text-red-700";

  const interactive = onClick != null;

  return (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={clsx(
        "report-kpi flex h-full min-h-[8.5rem] flex-col rounded-2xl border p-4 shadow-sm",
        variantClass,
        interactive &&
          "cursor-pointer transition-shadow hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-delivered-fg)]",
      )}
    >
      <p className="text-sm text-[color:var(--color-ink-muted)]">{label}</p>
      <p
        className="mt-2 font-bold tabular-nums leading-none text-[color:var(--color-ink)]"
        style={{ fontSize: "var(--text-kpi)" }}
      >
        {value}
        {unit ? (
          <span className="ml-1 text-lg font-normal text-[color:var(--color-ink-soft)]">{unit}</span>
        ) : null}
      </p>
      {trend != null ? (
        <div className="mt-2">
          <p className={clsx("text-xs font-medium tabular-nums", trendClass)}>
            {trend.direction === "up" ? "↑" : trend.direction === "down" ? "↓" : "→"}{" "}
            {Math.abs(trend.pct).toFixed(1)}%{trend.label ? ` ${trend.label}` : ""}
          </p>
          {trend.periodRange ? (
            <p className="mt-0.5 text-[10px] leading-snug text-[color:var(--color-ink-muted)]">
              {trend.periodRange}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="mt-2 min-h-[1rem] text-xs text-transparent select-none" aria-hidden>
          —
        </p>
      )}
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-2 text-xs">
        {target ? (
          <span
            className="line-clamp-2 leading-snug text-[color:var(--color-ink-muted)]"
            title={target}
          >
            {target}
          </span>
        ) : null}
        {status && statusLabel ? (
          <span className={clsx("rounded-full px-2 py-0.5 font-medium", STATUS_PILL[status])}>
            {statusLabel}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function StatusPill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "success" | "warning" | "danger" | "neutral" | "info";
}) {
  const toneClass = {
    success: "bg-emerald-100 text-emerald-800",
    warning: "bg-amber-100 text-amber-900",
    danger:
      "bg-[color:var(--color-cancelled-bg)] text-[color:var(--color-cancelled-fg)]",
    info: "bg-blue-100 text-blue-800",
    neutral: "bg-[color:var(--color-paper-2)] text-[color:var(--color-ink-soft)]",
  }[tone];
  return (
    <span
      className={clsx(
        "inline-flex shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium",
        toneClass,
      )}
    >
      {children}
    </span>
  );
}

export function StockDeltaCell({ delta }: { delta: number }) {
  const cls =
    delta > 0
      ? "font-semibold text-emerald-700"
      : delta < 0
        ? "font-semibold text-red-700"
        : "text-[color:var(--color-ink-muted)]";
  const text = delta > 0 ? `+${delta}` : String(delta);
  return <span className={clsx("tabular-nums", cls)}>{text}</span>;
}

export function ReportBarRow({
  label,
  value,
  max,
  barClass = "bg-[color:var(--color-ink)]/75",
}: {
  label: string;
  value: number;
  max: number;
  barClass?: string;
}) {
  const pct = max > 0 ? Math.max(3, (value / max) * 100) : 0;
  return (
    <div className="grid grid-cols-[minmax(6rem,9rem)_1fr_2.5rem] items-center gap-3 text-sm">
      <span className="truncate text-[color:var(--color-ink-soft)]">{label}</span>
      <div className="h-2.5 overflow-hidden rounded-full bg-[color:var(--color-paper-2)]">
        <div
          className={clsx("h-full rounded-full transition-all", barClass)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-right font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function ReportTableSortHeader({
  label,
  active,
  dir,
  align,
  onSort,
}: {
  label: string;
  active: boolean;
  dir: ReportTableSortDir;
  align?: "left" | "right";
  onSort: () => void;
}) {
  const { t } = useTranslation();
  const Icon = active ? (dir === "asc" ? ChevronUp : ChevronDown) : ChevronUp;

  return (
    <button
      type="button"
      onClick={onSort}
      className={clsx(
        "group/header inline-flex min-w-0 max-w-full items-center gap-0.5 rounded-md -mx-1 px-1 py-0.5",
        "font-semibold uppercase tracking-wide transition-colors",
        "hover:text-[color:var(--color-ink)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-ink)]/15",
        active ? "text-[color:var(--color-ink)]" : "text-[color:var(--color-ink-muted)]",
        align === "right" ? "ml-auto justify-end" : "justify-start",
      )}
      aria-label={
        active
          ? t("reports.table.sort_dir", { column: label, dir: t(`reports.table.sort_${dir}`) })
          : t("reports.table.sort_by", { column: label })
      }
    >
      <span className="truncate">{label}</span>
      <Icon
        className={clsx(
          "h-3.5 w-3.5 shrink-0",
          active ? "opacity-100" : "opacity-0 group-hover/header:opacity-40",
        )}
        aria-hidden
      />
    </button>
  );
}

export function ReportDataTable({
  columns,
  rows,
  empty,
  paginate = false,
  initialPage = 1,
  initialSortKey = null,
  initialSortDir = "asc",
  onPageChange,
}: {
  columns: ReportTableColumn[];
  rows: ReportTableRow[];
  empty?: string;
  /** Client-side pagination for long audit / timeline tables. */
  paginate?: boolean;
  initialPage?: number;
  /** Default column sort when the table first renders. */
  initialSortKey?: string | null;
  initialSortDir?: ReportTableSortDir;
  onPageChange?: (page: number) => void;
}) {
  const { t } = useTranslation();
  const [sortKey, setSortKey] = useState<string | null>(initialSortKey);
  const [sortDir, setSortDir] = useState<ReportTableSortDir>(initialSortDir);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows;
    const col = columns.find((c) => c.key === sortKey);
    if (!col || col.sortable === false) return rows;
    return sortReportTableRows(rows, col, sortDir);
  }, [rows, columns, sortKey, sortDir]);

  const pagination = useClientPagination(
    sortedRows,
    [sortKey, sortDir, rows.length],
    paginate ? REPORT_TABLE_PAGE_SIZES[0] : 50,
    initialPage,
  );
  const formatPageSize = (size: number) =>
    size <= PAGE_SIZE_ALL ? t("products.pagination.show_all") : String(size);

  useEffect(() => {
    onPageChange?.(pagination.currentPage);
  }, [pagination.currentPage, onPageChange]);

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-[color:var(--color-line)] px-4 py-8 text-center text-sm text-[color:var(--color-ink-muted)]">
        {empty ?? "—"}
      </p>
    );
  }

  const displayRows = paginate ? pagination.pageItems : sortedRows;
  const pagedFill =
    paginate && !pagination.showAll && pagination.totalRows > 0;
  const padCount = pagedFill
    ? Math.max(0, pagination.pageSize - displayRows.length)
    : 0;
  const showFooter = paginate && pagination.totalRows > 0;

  const thClass =
    "h-10 max-h-10 px-3 py-0 align-middle text-left text-[11px] font-semibold uppercase leading-none tracking-wide whitespace-nowrap text-[color:var(--color-ink-muted)]";
  const tdClass = "px-3 py-2 align-top text-[color:var(--color-ink)]";
  const trClass =
    "border-b border-[color:var(--color-line)]/60 last:border-b-0 even:bg-[color:var(--color-paper-2)]/25";

  return (
    <div className="report-table-wrap flex flex-col overflow-hidden rounded-xl border border-[color:var(--color-line)]">
      <div className="overflow-x-auto">
        <table className="report-table w-full min-w-[32rem] text-sm">
          <thead>
            <tr className="h-10 border-b border-[color:var(--color-border-report)] bg-[color:var(--color-paper-2)]">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={clsx(thClass, c.align === "right" && "text-right")}
                  aria-sort={
                    sortKey === c.key
                      ? sortDir === "asc"
                        ? "ascending"
                        : "descending"
                      : c.sortable === false
                        ? undefined
                        : "none"
                  }
                >
                  {c.sortable === false ? (
                    c.label
                  ) : (
                    <ReportTableSortHeader
                      label={c.label}
                      active={sortKey === c.key}
                      dir={sortKey === c.key ? sortDir : "asc"}
                      align={c.align}
                      onSort={() => handleSort(c.key)}
                    />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, i) => (
              <tr key={`${pagination.currentPage}-row-${i}`} className={trClass}>
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={clsx(tdClass, c.align === "right" && "text-right tabular-nums")}
                  >
                    {reportTableCell(row, c.key)}
                  </td>
                ))}
              </tr>
            ))}
            {Array.from({ length: padCount }, (_, i) => (
              <tr
                key={`${pagination.currentPage}-pad-${i}`}
                className={trClass}
                aria-hidden
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={clsx(tdClass, c.align === "right" && "text-right")}
                  >
                    <span className="invisible select-none" aria-hidden>
                      &nbsp;
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showFooter && (
        <ListPaginationFooter
          totalRows={pagination.totalRows}
          rangeFrom={pagination.rangeFrom}
          rangeTo={pagination.rangeTo}
          pageSize={pagination.pageSize}
          onPageSizeChange={pagination.setPageSize}
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          onPageChange={pagination.setPage}
          pageSizeOptions={REPORT_TABLE_PAGE_SIZES}
          formatPageSize={formatPageSize}
          hidePageNav={pagination.showAll}
        />
      )}
    </div>
  );
}

export function InsightPanel({
  items,
  render,
}: {
  items: { level: string; code: string; value?: number }[];
  render: (code: string, value?: number) => string;
}) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-xl border border-[color:var(--color-assigned-fg)]/15 bg-[color:var(--color-assigned-bg)]/25 p-4">
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li
            key={i}
            className={clsx(
              "flex gap-2 text-sm leading-snug",
              item.level === "warning"
                ? "text-amber-900"
                : "text-[color:var(--color-ink-soft)]",
            )}
          >
            <span className="mt-0.5 shrink-0 font-bold" aria-hidden>
              {item.level === "warning" ? "!" : "i"}
            </span>
            <span>{render(item.code, item.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
