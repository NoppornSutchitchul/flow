import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Search, X } from "lucide-react";
import clsx from "clsx";

import { DatePickerField } from "../components/ui/DatePickerField";
import { RequestTable } from "../components/requests/RequestTable";
import { requestsApi } from "../lib/api";
import { useAuth } from "../lib/auth";
import { canViewRequestDetail, requestsListScopeForUser } from "../lib/format";
import { opsQueryOptions } from "../lib/queryOptions";
import {
  REQUEST_FILTERS,
  type RequestFilter,
  filtersToParam,
  isMultiFilter,
  parseFiltersParam,
  parseViewDateParam,
  requestMatchesAnyFilter,
  singleFilterApiParams,
} from "../lib/requestFilters";
import { isoDateLocal } from "../lib/reportPresetFilters";

const FILTER_CHIPS: RequestFilter[] = [
  "active",
  "pending",
  "in_progress",
  "paused",
  "dnd",
  "delivered",
  "cancelled",
  "overdue",
];

const PAGE_SIZE_OPTIONS = [50, 100, 150, 200] as const;
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

function filtersFromSet(set: Set<RequestFilter>): RequestFilter[] {
  return [...set].filter((f) => f !== "all");
}

function setFromFilters(filters: RequestFilter[]): Set<RequestFilter> {
  return new Set(filters.filter((f) => f !== "all"));
}

function toggleFilterSet(
  prev: Set<RequestFilter>,
  value: RequestFilter,
): Set<RequestFilter> {
  const next = new Set(prev);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

export function RequestsPage() {
  const { t } = useTranslation();
  const { current } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [draftQ, setDraftQ] = useState(() => searchParams.get("q") ?? "");
  const [appliedQ, setAppliedQ] = useState(() => searchParams.get("q") ?? "");
  const [viewDate, setViewDate] = useState(() =>
    parseViewDateParam(searchParams.get("date")),
  );
  const [filters, setFilters] = useState<Set<RequestFilter>>(() =>
    setFromFilters(parseFiltersParam(searchParams.get("filter"))),
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(50);
  const tableRef = useRef<HTMLDivElement>(null);
  const paginationScrollReadyRef = useRef(false);

  useEffect(() => {
    setDraftQ(searchParams.get("q") ?? "");
    setAppliedQ(searchParams.get("q") ?? "");
    setViewDate(parseViewDateParam(searchParams.get("date"), isoDateLocal()));
    setFilters(setFromFilters(parseFiltersParam(searchParams.get("filter"))));
  }, [searchParams]);

  const filterList = useMemo(() => filtersFromSet(filters), [filters]);

  const todayIso = isoDateLocal();
  const listScope = useMemo(() => requestsListScopeForUser(current), [current]);
  const effectiveViewDate = listScope.todayOnly ? todayIso : viewDate;

  useEffect(() => {
    setPage(1);
  }, [pageSize, appliedQ, filterList, effectiveViewDate]);

  useEffect(() => {
    if (!listScope.todayOnly) return;
    const today = isoDateLocal();
    if (viewDate !== today) setViewDate(today);
    if (!searchParams.get("date")) return;
    const next = new URLSearchParams(searchParams);
    next.delete("date");
    setSearchParams(next, { replace: true });
  }, [listScope.todayOnly, viewDate, searchParams, setSearchParams]);

  const apiParams = useMemo(() => {
    const q = appliedQ.trim() || undefined;
    const base = {
      on_date: effectiveViewDate,
      q,
      ...(listScope.department ? { department: listScope.department } : {}),
    };
    if (isMultiFilter(filterList)) return base;
    const single = singleFilterApiParams(filterList);
    return { ...single, ...base };
  }, [filterList, appliedQ, effectiveViewDate, listScope.department]);

  const { data, isLoading } = useQuery({
    queryKey: ["requests", apiParams],
    queryFn: () => requestsApi.list(apiParams),
    ...opsQueryOptions(),
    placeholderData: keepPreviousData,
  });

  const rows = useMemo(() => {
    const list = data ?? [];
    if (!isMultiFilter(filterList)) return list;
    return list.filter((r) => requestMatchesAnyFilter(r, filterList));
  }, [filterList, data]);

  const showListSkeleton = isLoading && data == null;
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const showEmptyList = !showListSkeleton && rows.length === 0;

  useEffect(() => {
    if (page !== currentPage) setPage(currentPage);
  }, [page, currentPage]);

  useEffect(() => {
    if (!paginationScrollReadyRef.current) {
      paginationScrollReadyRef.current = true;
      return () => {
        paginationScrollReadyRef.current = false;
      };
    }
    requestAnimationFrame(() => {
      tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [page, pageSize]);

  const searchDirty = draftQ !== appliedQ;

  const syncUrl = useCallback(
    (q: string, nextFilters: Set<RequestFilter>, dateIso: string) => {
      const next = new URLSearchParams();
      const f = filtersToParam(nextFilters);
      if (f) next.set("filter", f);
      const trimmed = q.trim();
      if (trimmed) next.set("q", trimmed);
      const today = isoDateLocal();
      if (!listScope.todayOnly && dateIso !== today) next.set("date", dateIso);
      setSearchParams(next, { replace: true });
    },
    [setSearchParams, listScope.todayOnly],
  );

  const runSearch = () => {
    setAppliedQ(draftQ);
    syncUrl(draftQ, filters, viewDate);
  };

  const resetSearch = () => {
    const today = isoDateLocal();
    setDraftQ("");
    setAppliedQ("");
    setFilters(new Set());
    if (listScope.todayOnly) {
      setViewDate(today);
      syncUrl("", new Set(), today);
      return;
    }
    setViewDate(today);
    setSearchParams({}, { replace: true });
  };

  const setViewDateAndSync = (iso: string) => {
    if (listScope.todayOnly) return;
    const next = parseViewDateParam(iso, isoDateLocal());
    setViewDate(next);
    syncUrl(appliedQ, filters, next);
  };

  const toggleFilter = (value: RequestFilter) => {
    setFilters((prev) => {
      const next = toggleFilterSet(prev, value);
      syncUrl(appliedQ, next, viewDate);
      return next;
    });
  };

  return (
    <div className="flex flex-1 flex-col gap-3 min-h-0">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("requests.title")}
        </h1>
      </header>

      <section className="min-w-0 overflow-hidden rounded-xl border border-[color:var(--color-line)] bg-white shadow-sm">
        <div className="flex flex-col gap-3 p-3 sm:p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-2">
            <div className="flex min-w-0 items-stretch gap-2 sm:min-w-0 sm:flex-1">
              <div className="relative min-w-0 flex-1">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--color-ink-muted)]"
                  aria-hidden
                />
                <input
                  value={draftQ}
                  onChange={(e) => setDraftQ(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      runSearch();
                    }
                  }}
                  placeholder={t("requests.search_placeholder")}
                  className="h-full w-full min-h-9 rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-paper)]/40 py-2.5 pl-9 pr-9 text-sm transition focus:border-[color:var(--color-ink)]/20 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[color:var(--color-ink)]/10"
                />
                {draftQ && (
                  <button
                    type="button"
                    onClick={resetSearch}
                    aria-label={t("requests.search_clear")}
                    className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-[color:var(--color-ink-muted)] transition hover:bg-[color:var(--color-paper-2)] hover:text-[color:var(--color-ink)]"
                  >
                    <X className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={runSearch}
                className={clsx(
                  "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-semibold transition sm:min-w-[5.5rem]",
                  searchDirty
                    ? "bg-[color:var(--color-ink)] text-white shadow-sm hover:opacity-90"
                    : "border border-[color:var(--color-line)] bg-white text-[color:var(--color-ink)] hover:bg-[color:var(--color-paper-2)]",
                )}
              >
                <Search className="h-4 w-4 shrink-0" aria-hidden />
                <span className="hidden sm:inline">{t("requests.search_submit")}</span>
              </button>
            </div>
            {!listScope.todayOnly ? (
              <DatePickerField
                value={viewDate}
                max={todayIso}
                onChange={setViewDateAndSync}
                size="sm"
                compact
                className="w-full shrink-0 sm:w-[11.25rem]"
                aria-label={t("requests.view_date_aria")}
              />
            ) : null}
          </div>

          <div className="flex min-w-0 flex-col gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--color-ink-muted)]">
              {t("requests.filter_bar_label")}
            </p>
            <div
              className="min-w-0 rounded-xl border border-[color:var(--color-line)]/70 bg-[color:var(--color-paper)]/30 p-2 sm:p-2.5"
              role="group"
              aria-label={t("requests.filter_aria")}
            >
              <div className="flex gap-1.5 overflow-x-auto overscroll-x-contain pb-0.5 [-webkit-overflow-scrolling:touch] sm:flex-wrap sm:overflow-visible sm:pb-0">
                {FILTER_CHIPS.map((f) => {
                  const active = filters.has(f);
                  return (
                    <button
                      key={f}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleFilter(f)}
                      className={clsx(
                        "shrink-0 snap-start whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium transition sm:px-3 sm:py-1.5",
                        active
                          ? "border-[color:var(--color-ink)] bg-[color:var(--color-ink)] text-white shadow-sm"
                          : "border-[color:var(--color-line)] bg-white text-[color:var(--color-ink-soft)] hover:border-[color:var(--color-ink)]/15",
                      )}
                    >
                      {t(`requests.filter_${f}`)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div
        ref={tableRef}
        className={clsx(
          "flex min-h-[18rem] flex-col",
          showEmptyList && "flex-1",
        )}
      >
        <RequestTable
          rows={rows}
          loading={showListSkeleton}
          sortable
          emptyHint={t("requests.empty_list")}
          emptySubHint={t("requests.empty_list_sub")}
          fillHeight={showEmptyList}
          linkToDetail={canViewRequestDetail(current ?? undefined)}
          pagination={{
            page: currentPage,
            pageSize,
            pageSizeOptions: PAGE_SIZE_OPTIONS,
            onPageChange: setPage,
            onPageSizeChange: (n) => setPageSize(n as PageSize),
          }}
        />
      </div>
    </div>
  );
}

export { REQUEST_FILTERS };
