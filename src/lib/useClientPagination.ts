import { useEffect, useMemo, useState } from "react";

export const DEFAULT_PAGE_SIZE_OPTIONS = [50, 100, 150, 200] as const;
export type PageSize = (typeof DEFAULT_PAGE_SIZE_OPTIONS)[number];

/** `0` = show all rows on one page (no slicing). */
export const PAGE_SIZE_ALL = 0;

export function effectivePageSize(pageSize: number, totalRows: number): number {
  if (pageSize <= PAGE_SIZE_ALL) return Math.max(1, totalRows);
  return pageSize;
}

export function useClientPagination<T>(
  items: readonly T[],
  resetDeps: readonly unknown[] = [],
  initialPageSize: number = 50,
  initialPage: number = 1,
) {
  const [page, setPage] = useState(Math.max(1, initialPage));
  const [pageSize, setPageSize] = useState(initialPageSize);

  useEffect(() => {
    setPage(Math.max(1, initialPage));
  }, [initialPage]);

  const totalRows = items.length;
  const sliceSize = effectivePageSize(pageSize, totalRows);
  const totalPages = Math.max(1, Math.ceil(totalRows / sliceSize));
  const currentPage = Math.min(page, totalPages);
  const showAll = pageSize <= PAGE_SIZE_ALL;

  useEffect(() => {
    setPage(1);
  }, [pageSize, ...resetDeps]);

  useEffect(() => {
    if (page !== currentPage) setPage(currentPage);
  }, [page, currentPage]);

  const pageItems = useMemo(() => {
    const start = (currentPage - 1) * sliceSize;
    return items.slice(start, start + sliceSize);
  }, [items, currentPage, sliceSize]);

  const rangeFrom = totalRows === 0 ? 0 : (currentPage - 1) * sliceSize + 1;
  const rangeTo = Math.min(currentPage * sliceSize, totalRows);

  return {
    page,
    setPage,
    pageSize,
    setPageSize,
    currentPage,
    totalPages,
    totalRows,
    rangeFrom,
    rangeTo,
    pageItems,
    showAll,
  };
}
