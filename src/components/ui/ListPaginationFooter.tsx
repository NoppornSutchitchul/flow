import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { PageSizePicker } from "./PageSizePicker";
import { DEFAULT_PAGE_SIZE_OPTIONS } from "../../lib/useClientPagination";

interface Props {
  totalRows: number;
  rangeFrom: number;
  rangeTo: number;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  hidden?: boolean;
  pageSizeOptions?: readonly number[];
  formatPageSize?: (size: number) => string;
  /** Hide prev/next when all rows are on one page. */
  hidePageNav?: boolean;
}

export function ListPaginationFooter({
  totalRows,
  rangeFrom,
  rangeTo,
  pageSize,
  onPageSizeChange,
  currentPage,
  totalPages,
  onPageChange,
  hidden = false,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  formatPageSize,
  hidePageNav = false,
}: Props) {
  const { t } = useTranslation();

  if (hidden || totalRows === 0) return null;

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[color:var(--color-line)] px-4 py-3 text-sm">
      <p className="text-[color:var(--color-ink-soft)] tabular-nums">
        {t("products.pagination.showing", {
          from: rangeFrom,
          to: rangeTo,
          total: totalRows,
        })}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center gap-2 text-[color:var(--color-ink-soft)]">
          <span className="text-xs">{t("products.pagination.per_page")}</span>
          <PageSizePicker
            value={pageSize}
            options={pageSizeOptions}
            onChange={onPageSizeChange}
            ariaLabel={t("products.pagination.per_page")}
            placement="up"
            formatOption={formatPageSize}
          />
        </div>
        {!hidePageNav && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[color:var(--color-line)] bg-white hover:bg-[color:var(--color-paper-2)] disabled:opacity-40"
            aria-label={t("products.pagination.prev")}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[5.5rem] text-center text-xs font-medium tabular-nums text-[color:var(--color-ink-soft)]">
            {t("products.pagination.page", {
              current: currentPage,
              total: totalPages,
            })}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage >= totalPages}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[color:var(--color-line)] bg-white hover:bg-[color:var(--color-paper-2)] disabled:opacity-40"
            aria-label={t("products.pagination.next")}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        )}
      </div>
    </div>
  );
}
