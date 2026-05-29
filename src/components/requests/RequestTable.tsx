import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Clock, ClipboardList } from "lucide-react";
import clsx from "clsx";

import { PageSizePicker } from "../ui/PageSizePicker";

import { staffDisplayName } from "../../lib/assignees";
import { Avatar } from "../ui/Avatar";
import { StatusPill } from "../ui/StatusPill";
import {
  compareDashboardActiveRequests,
  elapsedSecondsLive,
  elapsedTimeBand,
  elapsedTimeCellClass,
  formatElapsedSeconds,
  formatTimeRemainingSeconds,
  isAwaitingStaff,
  isDndDeferred,
  isDndWaiting,
  dndWaitingRowClass,
  staffCrisisRowClass,
  timeRemainingSeconds,
} from "../../lib/format";
import { RequestCardCountdown } from "./RequestCardCountdown";
import { RequestItemsChips } from "./RequestItemsChips";
import { RequestLocationDisplay } from "./RequestLocationDisplay";
import {
  CLOSING_COLLAPSE_MS,
  CLOSING_FLASH_MS,
  requestClosingRowClass,
  useClosingRequests,
} from "../../hooks/useClosingRequests";
import { useDepartments } from "../../lib/departments";
import { hotelLocationLabelMap, useHotelLocations } from "../../lib/hotelLocations";
import { useGuestRooms } from "../../lib/guestRooms";
import {
  formatScheduleClock,
  isBeforeScheduledTime,
} from "../../lib/requestSchedule";
import { requestLocationDisplay, type Room } from "../../lib/rooms";
import type { RequestRead } from "../../lib/types";

interface Props {
  rows: RequestRead[];
  showCode?: boolean;
  emptyHint?: string;
  emptySubHint?: string;
  /** While true, show placeholder rows instead of real data or empty state. */
  loading?: boolean;
  /** When false, rows are not links to the detail page (field ops). */
  linkToDetail?: boolean;
  /** Click column headers to sort asc / desc (Requests page). */
  sortable?: boolean;
  /** `elapsed` = time spent (Requests); `remaining` = countdown (Dashboard). */
  timeColumn?: "elapsed" | "remaining";
  /** Sort active rows before closing animation merge (e.g. newest first on Dashboard). */
  activeSort?: (a: RequestRead, b: RequestRead) => number;
  /** Flash + collapse when rows leave a live active list (Dashboard / My Queue). */
  animateClosing?: boolean;
  /** Keep pre-scheduled holds at the bottom until delivery time (Dashboard). */
  holdScheduledAtBottom?: boolean;
  /** Client-side pagination (Requests page). Applied after sort. */
  pagination?: RequestTablePagination;
  /** Let the table grow to fill its parent's remaining height (centers empty state). */
  fillHeight?: boolean;
}

export type RequestTableSortKey =
  | "code"
  | "room"
  | "items"
  | "department"
  | "assignee"
  | "status"
  | "time_remaining";

type SortDir = "asc" | "desc";

const DEFAULT_PAGE_SIZE_OPTIONS = [50, 100, 150, 200] as const;

export interface RequestTablePagination {
  page: number;
  pageSize: number;
  pageSizeOptions?: readonly number[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

const STATUS_SORT_ORDER = [
  "pending",
  "assigned",
  "in_progress",
  "paused",
  "dnd",
  "delivered",
  "cancelled",
] as const;

function compareRequestRows(
  a: RequestRead,
  b: RequestRead,
  key: RequestTableSortKey,
  dir: SortDir,
  lang: string,
  timeColumn: "elapsed" | "remaining",
  deptLabel: (code: string) => string,
): number {
  let cmp = 0;
  switch (key) {
    case "code":
      cmp = a.code.localeCompare(b.code, undefined, { numeric: true });
      break;
    case "room":
      cmp = a.room.localeCompare(b.room, lang, { numeric: true, sensitivity: "base" });
      break;
    case "items":
      cmp = a.items_text.localeCompare(b.items_text, lang, { sensitivity: "base" });
      break;
    case "department":
      cmp = deptLabel(a.department).localeCompare(deptLabel(b.department), lang, {
        sensitivity: "base",
      });
      break;
    case "assignee": {
      const an = a.assignee ? staffDisplayName(a.assignee.name) : "";
      const bn = b.assignee ? staffDisplayName(b.assignee.name) : "";
      if (!an && bn) cmp = 1;
      else if (an && !bn) cmp = -1;
      else cmp = an.localeCompare(bn, lang, { sensitivity: "base" });
      break;
    }
    case "status":
      cmp =
        STATUS_SORT_ORDER.indexOf(a.status) - STATUS_SORT_ORDER.indexOf(b.status);
      break;
    case "time_remaining": {
      if (timeColumn === "remaining") {
        const ar = timeRemainingSeconds(a);
        const br = timeRemainingSeconds(b);
        if (ar === null && br === null) cmp = 0;
        else if (ar === null) cmp = 1;
        else if (br === null) cmp = -1;
        else cmp = ar - br;
      } else {
        cmp = elapsedSecondsLive(a) - elapsedSecondsLive(b);
      }
      break;
    }
  }
  return dir === "asc" ? cmp : -cmp;
}

function SortableHeader({
  label,
  column,
  sortKey,
  sortDir,
  onSort,
  className,
}: {
  label: string;
  column: RequestTableSortKey;
  sortKey: RequestTableSortKey | null;
  sortDir: SortDir;
  onSort: (column: RequestTableSortKey) => void;
  className?: string;
}) {
  const { t } = useTranslation();
  const active = sortKey === column;
  const Icon = active ? (sortDir === "asc" ? ChevronUp : ChevronDown) : ChevronUp;

  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      className={clsx(
        "inline-flex min-w-0 items-center gap-0.5 rounded-md -mx-1 px-1 py-0.5",
        "justify-center text-center font-semibold uppercase tracking-wide transition-colors",
        "hover:text-[color:var(--color-ink)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-ink)]/15",
        active
          ? "text-[color:var(--color-ink)]"
          : "text-[color:var(--color-ink-muted)]",
        className,
      )}
      aria-label={
        active
          ? t(`requests.table.sort_${sortDir}`, { column: label })
          : t("requests.table.sort_by", { column: label })
      }
    >
      <span className="truncate">{label}</span>
      <Icon
        className={clsx(
          "h-3.5 w-3.5 shrink-0",
          active ? "opacity-100" : "opacity-0 group-hover/header:opacity-35",
        )}
        aria-hidden
      />
    </button>
  );
}

// Header and body share the same grid template, picked based on showCode
// so columns stay aligned in both modes.
const GRID_WITH_CODE =
  "md:grid-cols-[minmax(9.75rem,max-content)_5.5rem_minmax(0,1.25fr)_6.5rem_minmax(0,9rem)_6.5rem_5.5rem]";
const GRID_NO_CODE =
  "md:grid-cols-[5.5rem_minmax(0,1.25fr)_6.5rem_minmax(0,9rem)_6.5rem_5.5rem]";

const TABLE_CELL_CENTER =
  "flex w-full min-w-0 items-center justify-center text-center";

const TABLE_CELL_START =
  "flex w-full min-w-0 items-center justify-start text-left";

const TABLE_CELL_CODE =
  "flex w-full items-center justify-center text-center font-mono text-[13px] tabular-nums whitespace-nowrap text-[color:var(--color-ink-soft)]";

const ROW_CELL_CLASS =
  "relative z-10 grid min-h-0 gap-x-4 gap-y-1 px-4 py-1.5 text-[15px] leading-snug items-center grid-cols-2";

/** Narrow screens: row1 room·items·time; row2 dept·assignee·status (optional code prefix). */
const MOBILE_ROW_3 = "grid-cols-3";
const MOBILE_ROW2_WITH_CODE =
  "grid-cols-[minmax(4.5rem,auto)_minmax(0,1fr)_minmax(0,1fr)_auto]";
const MOBILE_GRID_ROW =
  "grid min-w-0 items-center gap-x-2 gap-y-1 text-[13px] leading-snug";

function requestTimeCell(
  r: RequestRead,
  timeColumn: "elapsed" | "remaining",
  scheduledPending: boolean,
  nowMs: number,
): { className: string; label: string; showClock: boolean } {
  const base =
    "flex items-center justify-center text-center tabular-nums font-mono text-sm leading-none whitespace-nowrap";

  if (scheduledPending && r.scheduled_at) {
    return {
      className: clsx(base, "inline-flex items-center justify-center gap-1 text-[color:var(--color-ink-muted)]"),
      label: formatScheduleClock(r.scheduled_at),
      showClock: true,
    };
  }

  if (timeColumn === "remaining") {
    const remaining = timeRemainingSeconds(r);
    return {
      className: clsx(
        base,
        remaining === null
          ? "text-[color:var(--color-ink-muted)]"
          : remaining <= 0
            ? "font-semibold text-[color:var(--color-pending-fg)]"
            : remaining <= 300
              ? "font-semibold text-[color:var(--color-stock-low-fg)]"
              : "text-[color:var(--color-ink)]",
      ),
      label: formatTimeRemainingSeconds(remaining),
      showClock: false,
    };
  }

  const elapsed = elapsedSecondsLive(r, nowMs);
  return {
    className: clsx(base, elapsedTimeCellClass(elapsedTimeBand(elapsed))),
    label: formatElapsedSeconds(elapsed),
    showClock: false,
  };
}

function TableItemsCell({ r }: { r: RequestRead }) {
  return (
    <RequestItemsChips
      items={r.items}
      text={r.items_text}
      layout="icons"
      fitIcons
      adaptive
      className="justify-start"
    />
  );
}

function MobileTableItemsCell({ r }: { r: RequestRead }) {
  return (
    <RequestItemsChips
      items={r.items}
      text={r.items_text}
      layout="icons"
      maxVisible={8}
      fitIcons={false}
      className="justify-start"
    />
  );
}

function MobileRoomCells({
  room,
  deliveryMethod,
  locationLabels,
  guestRooms,
  t,
}: {
  room: string;
  deliveryMethod?: string;
  locationLabels: Record<string, string>;
  guestRooms: Room[];
  t: TFunction;
}) {
  const loc = requestLocationDisplay(room, deliveryMethod, t, {
    labelByCode: locationLabels,
    guestRooms,
  });
  return (
    <div className="flex min-w-0 flex-col items-start justify-center gap-0.5">
      <span className="min-w-0 truncate text-[15px] font-bold tabular-nums leading-snug tracking-tight text-[color:var(--color-ink)]">
        {loc.primary}
      </span>
      {loc.stacked && loc.secondary ? (
        <span className="min-w-0 truncate text-[10px] leading-tight text-[color:var(--color-ink-muted)]">
          {loc.secondary}
        </span>
      ) : null}
    </div>
  );
}

function RequestRowContent({
  r,
  showCode,
  gridCols,
  locationLabels,
  guestRooms,
  departmentLabel,
  timeCell,
  isRush,
  awaitingStaff,
  t,
}: {
  r: RequestRead;
  showCode: boolean;
  gridCols: string;
  locationLabels: Record<string, string>;
  guestRooms: Room[];
  departmentLabel: (code: string) => string;
  timeCell: ReturnType<typeof requestTimeCell>;
  isRush: boolean;
  awaitingStaff: boolean;
  t: TFunction;
}) {
  return (
    <>
      <div className="flex flex-col gap-1.5 px-3 py-2 md:hidden">
        <div className={clsx(MOBILE_GRID_ROW, MOBILE_ROW_3)}>
          <MobileRoomCells
            room={r.room}
            deliveryMethod={r.delivery_method}
            locationLabels={locationLabels}
            guestRooms={guestRooms}
            t={t}
          />
          <div className="request-table-items-cell flex min-h-0 min-w-0 items-center justify-center overflow-visible py-0.5">
            <div className="flex min-h-0 w-full min-w-0 items-center justify-center gap-x-1.5 overflow-visible">
              {isRush ? (
                <span className="rush-badge w-fit shrink-0 text-[10px]" aria-label="Rush">
                  🚨
                </span>
              ) : null}
              <MobileTableItemsCell r={r} />
            </div>
          </div>
          <span className={clsx(timeCell.className, "justify-end text-right text-xs")}>
            {timeCell.showClock ? (
              <span className="inline-flex items-center justify-end gap-0.5">
                <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {timeCell.label}
              </span>
            ) : (
              timeCell.label
            )}
          </span>
        </div>

        <div
          className={clsx(
            MOBILE_GRID_ROW,
            showCode ? MOBILE_ROW2_WITH_CODE : MOBILE_ROW_3,
          )}
        >
          {showCode ? (
            <span className={clsx(TABLE_CELL_CODE, "justify-start text-left text-[11px]")}>
              {r.code}
            </span>
          ) : null}
          <span
            className={clsx(
              TABLE_CELL_START,
              "text-xs leading-snug text-[color:var(--color-ink-soft)]",
            )}
          >
            {departmentLabel(r.department)}
          </span>
          <span className={clsx(TABLE_CELL_CENTER, "min-w-0 justify-center gap-1.5")}>
            {r.assignee ? (
              <>
                <Avatar user={r.assignee} size="sm" className="shrink-0" />
                <span className="min-w-0 truncate text-xs text-[color:var(--color-ink-soft)]">
                  {staffDisplayName(r.assignee.name)}
                </span>
              </>
            ) : (
              <span className="text-xs text-[color:var(--color-ink-muted)]">
                {t("requests.no_assignee")}
              </span>
            )}
          </span>
          <span className={clsx(TABLE_CELL_CENTER, "justify-end")}>
            <StatusPill
              status={r.status}
              deferred={isDndDeferred(r)}
              awaitingStaff={awaitingStaff}
              className="text-xs"
            />
          </span>
        </div>
      </div>

      <div className={clsx("hidden md:grid", ROW_CELL_CLASS, gridCols)}>
        {showCode && (
          <span className={clsx(TABLE_CELL_CODE, "md:col-auto col-span-2")}>{r.code}</span>
        )}
        <span className={TABLE_CELL_CENTER}>
          <RequestLocationDisplay
            room={r.room}
            deliveryMethod={r.delivery_method}
            labelByCode={locationLabels}
            guestRooms={guestRooms}
            variant="table"
          />
        </span>
        <div className="request-table-items-cell md:col-auto col-span-2 flex min-h-0 min-w-0 w-full items-center justify-start overflow-visible py-0.5 text-left text-[color:var(--color-ink)]">
          <div className="flex min-h-0 w-full min-w-0 items-center justify-start gap-x-2 overflow-visible">
            {isRush && (
              <span className="rush-badge w-fit shrink-0" aria-label="Rush">
                🚨 RUSH
              </span>
            )}
            <TableItemsCell r={r} />
          </div>
        </div>
        <span
          className={clsx(
            TABLE_CELL_CENTER,
            "text-sm text-[color:var(--color-ink-soft)] leading-snug",
          )}
        >
          {departmentLabel(r.department)}
        </span>
        <span className={clsx(TABLE_CELL_START, "gap-2")}>
          {r.assignee ? (
            <>
              <Avatar user={r.assignee} size="sm" className="shrink-0" />
              <span className="truncate text-sm text-[color:var(--color-ink-soft)] leading-snug">
                {staffDisplayName(r.assignee.name)}
              </span>
            </>
          ) : (
            <span className="text-sm text-[color:var(--color-ink-muted)]">
              {t("requests.no_assignee")}
            </span>
          )}
        </span>
        <span className={clsx(TABLE_CELL_CENTER, "shrink-0")}>
          <StatusPill
            status={r.status}
            deferred={isDndDeferred(r)}
            awaitingStaff={awaitingStaff}
            className="text-sm"
          />
        </span>
        <span className={timeCell.className}>
          {timeCell.showClock ? (
            <>
              <Clock className="h-4 w-4 shrink-0" aria-hidden />
              {timeCell.label}
            </>
          ) : (
            timeCell.label
          )}
        </span>
      </div>
    </>
  );
}

function RequestRowSkeleton({
  gridCols,
  showCode,
}: {
  gridCols: string;
  showCode: boolean;
}) {
  return (
    <li className="border-b border-[color:var(--color-line)]/50 last:border-0 animate-pulse" aria-hidden>
      <div className="flex flex-col gap-1.5 px-3 py-2 md:hidden">
        <div className={clsx(MOBILE_GRID_ROW, MOBILE_ROW_3)}>
          <div className="h-5 min-w-0 rounded-md bg-[color:var(--color-paper-2)]" />
          <div className="mx-auto h-9 w-16 rounded-md bg-[color:var(--color-paper-2)]" />
          <div className="ml-auto h-4 w-14 shrink-0 rounded-md bg-[color:var(--color-paper-2)]" />
        </div>
        <div
          className={clsx(
            MOBILE_GRID_ROW,
            showCode ? MOBILE_ROW2_WITH_CODE : MOBILE_ROW_3,
          )}
        >
          {showCode ? (
            <div className="h-3.5 w-20 shrink-0 rounded-md bg-[color:var(--color-paper-2)]" />
          ) : null}
          <div className="h-3.5 w-16 shrink-0 rounded-md bg-[color:var(--color-paper-2)]" />
          <div className="mx-auto h-6 w-24 rounded-md bg-[color:var(--color-paper-2)]" />
          <div className="ml-auto h-5 w-16 shrink-0 rounded-full bg-[color:var(--color-paper-2)]" />
        </div>
      </div>
      <div
        className={clsx(
          "hidden gap-x-4 gap-y-1.5 px-4 py-1.5 items-center justify-items-center md:grid grid-cols-2",
          gridCols,
        )}
      >
        {showCode && (
          <div className="font-mono h-4 rounded-md bg-[color:var(--color-paper-2)] md:col-auto col-span-2 w-32 max-w-full" />
        )}
        <div className="h-4 rounded-md bg-[color:var(--color-paper-2)] w-14" />
        <div className="md:col-auto col-span-2 h-4 rounded-md bg-[color:var(--color-paper-2)] w-[85%] max-w-sm" />
        <div className="h-4 rounded-md bg-[color:var(--color-paper-2)] w-20" />
        <div className="flex items-center justify-start gap-2 min-w-0">
          <div className="w-5 h-5 rounded-full bg-[color:var(--color-paper-2)] shrink-0" />
          <div className="h-4 rounded-md bg-[color:var(--color-paper-2)] w-24" />
        </div>
        <div className="h-6 w-28 rounded-full bg-[color:var(--color-paper-2)]" />
        <div className="h-4 rounded-md bg-[color:var(--color-paper-2)] w-24" />
      </div>
    </li>
  );
}

export function RequestTable({
  rows,
  showCode = true,
  emptyHint,
  emptySubHint,
  loading,
  linkToDetail = true,
  sortable = false,
  timeColumn = "elapsed",
  activeSort,
  animateClosing = false,
  holdScheduledAtBottom = false,
  pagination,
  fillHeight = false,
}: Props) {
  const { t, i18n } = useTranslation();
  const { departmentLabel } = useDepartments();
  const { data: hotelLocations = [] } = useHotelLocations();
  const { data: guestRooms = [] } = useGuestRooms();
  const locationLabels = useMemo(
    () => hotelLocationLabelMap(hotelLocations, i18n.language),
    [hotelLocations, i18n.language],
  );
  const gridCols = showCode ? GRID_WITH_CODE : GRID_NO_CODE;

  const { displayRows: rowsWithClosing, closingOutcomes, closingPhases, closingIds } =
    useClosingRequests(rows, CLOSING_FLASH_MS, CLOSING_COLLAPSE_MS, activeSort, animateClosing);

  const [sort, setSort] = useState<{ key: RequestTableSortKey; dir: SortDir } | null>(
    null,
  );

  const onSort = (column: RequestTableSortKey) => {
    setSort((cur) => {
      if (cur?.key !== column) return { key: column, dir: "asc" };
      return { key: column, dir: cur.dir === "asc" ? "desc" : "asc" };
    });
  };

  // Re-render once per second so countdown fill + time-left stay current.
  const [tick, setTick] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (loading || rowsWithClosing.length === 0) return;
    const bump = () => {
      setNowMs(Date.now());
      setTick((n) => n + 1);
    };
    bump();
    const id = window.setInterval(bump, 1000);
    return () => window.clearInterval(id);
  }, [loading, rowsWithClosing.length]);

  const displayRows = useMemo(() => {

    if (!sortable || !sort) {
      if (!holdScheduledAtBottom) return rowsWithClosing;

      const sortableRows = rowsWithClosing.filter((r) => !closingIds.has(r.id));
      const live = sortableRows.filter((r) => !isBeforeScheduledTime(r, nowMs));
      const hold = sortableRows.filter((r) => isBeforeScheduledTime(r, nowMs));
      live.sort((a, b) => compareDashboardActiveRequests(a, b, nowMs));
      hold.sort((a, b) => compareDashboardActiveRequests(a, b, nowMs));
      const queue = [...live, ...hold];
      return rowsWithClosing.map((r) => (closingIds.has(r.id) ? r : queue.shift()!));
    }

    const sortableRows = rowsWithClosing.filter((r) => !closingIds.has(r.id));

    if (holdScheduledAtBottom) {
      const live = sortableRows.filter((r) => !isBeforeScheduledTime(r, nowMs));
      const hold = sortableRows.filter((r) => isBeforeScheduledTime(r, nowMs));
      live.sort((a, b) =>
        compareRequestRows(a, b, sort.key, sort.dir, i18n.language, timeColumn, departmentLabel),
      );
      hold.sort((a, b) => compareDashboardActiveRequests(a, b, nowMs));
      const queue = [...live, ...hold];
      return rowsWithClosing.map((r) => (closingIds.has(r.id) ? r : queue.shift()!));
    }

    sortableRows.sort((a, b) =>
      compareRequestRows(a, b, sort.key, sort.dir, i18n.language, timeColumn, departmentLabel),
    );
    const queue = [...sortableRows];
    return rowsWithClosing.map((r) => (closingIds.has(r.id) ? r : queue.shift()!));
  }, [
    rowsWithClosing,
    closingIds,
    sortable,
    sort,
    i18n.language,
    tick,
    timeColumn,
    holdScheduledAtBottom,
    departmentLabel,
    nowMs,
  ]);

  const totalRows = displayRows.length;
  const pageSizeOptions = pagination?.pageSizeOptions ?? DEFAULT_PAGE_SIZE_OPTIONS;
  const totalPages = pagination
    ? Math.max(1, Math.ceil(totalRows / pagination.pageSize))
    : 1;
  const currentPage = pagination ? Math.min(pagination.page, totalPages) : 1;
  const rangeFrom = totalRows === 0 ? 0 : (currentPage - 1) * (pagination?.pageSize ?? 0) + 1;
  const rangeTo = pagination
    ? Math.min(currentPage * pagination.pageSize, totalRows)
    : totalRows;

  const visibleRows = useMemo(() => {
    if (!pagination) return displayRows;
    const start = (currentPage - 1) * pagination.pageSize;
    return displayRows.slice(start, start + pagination.pageSize);
  }, [displayRows, pagination, currentPage]);

  const timeColumnLabel =
    timeColumn === "remaining"
      ? t("requests.table.time_remaining")
      : t("requests.table.time_spent");

  return (
    <div
      className={clsx(
        "overflow-hidden rounded-xl border border-[color:var(--color-line)] bg-white",
        fillHeight && "flex flex-1 min-h-0 flex-col",
      )}
    >
      <div
        className={clsx(
          "group/header hidden md:grid gap-x-4 gap-y-1 px-4 py-2 text-xs border-b border-[color:var(--color-line)] items-center justify-items-center text-center",
          fillHeight && "shrink-0",
          gridCols,
        )}
      >
        {showCode &&
          (sortable ? (
            <SortableHeader
              label={t("requests.table.request_no")}
              column="code"
              sortKey={sort?.key ?? null}
              sortDir={sort?.dir ?? "asc"}
              onSort={onSort}
              className="normal-case tracking-normal font-medium"
            />
          ) : (
            <span className="text-center font-semibold uppercase tracking-wide text-[color:var(--color-ink-muted)] normal-case tracking-normal font-medium">
              {t("requests.table.request_no")}
            </span>
          ))}
        {sortable ? (
          <>
            <SortableHeader
              label={t("requests.table.room")}
              column="room"
              sortKey={sort?.key ?? null}
              sortDir={sort?.dir ?? "asc"}
              onSort={onSort}
            />
            <SortableHeader
              label={t("requests.table.items")}
              column="items"
              sortKey={sort?.key ?? null}
              sortDir={sort?.dir ?? "asc"}
              onSort={onSort}
            />
            <SortableHeader
              label={t("requests.table.dept")}
              column="department"
              sortKey={sort?.key ?? null}
              sortDir={sort?.dir ?? "asc"}
              onSort={onSort}
            />
            <SortableHeader
              label={t("requests.table.assignee")}
              column="assignee"
              sortKey={sort?.key ?? null}
              sortDir={sort?.dir ?? "asc"}
              onSort={onSort}
            />
            <SortableHeader
              label={t("requests.table.status")}
              column="status"
              sortKey={sort?.key ?? null}
              sortDir={sort?.dir ?? "asc"}
              onSort={onSort}
            />
            <SortableHeader
              label={timeColumnLabel}
              column="time_remaining"
              sortKey={sort?.key ?? null}
              sortDir={sort?.dir ?? "asc"}
              onSort={onSort}
              className="normal-case tracking-normal font-medium"
            />
          </>
        ) : (
          <>
            <span className="text-center font-semibold uppercase tracking-wide text-[color:var(--color-ink-muted)]">
              {t("requests.table.room")}
            </span>
            <span className="text-center font-semibold uppercase tracking-wide text-[color:var(--color-ink-muted)]">
              {t("requests.table.items")}
            </span>
            <span className="text-center font-semibold uppercase tracking-wide text-[color:var(--color-ink-muted)]">
              {t("requests.table.dept")}
            </span>
            <span className="text-center font-semibold uppercase tracking-wide text-[color:var(--color-ink-muted)]">
              {t("requests.table.assignee")}
            </span>
            <span className="text-center font-semibold uppercase tracking-wide text-[color:var(--color-ink-muted)]">
              {t("requests.table.status")}
            </span>
            <span className="text-center font-medium normal-case tracking-normal tabular-nums text-[color:var(--color-ink-muted)]">
              {timeColumnLabel}
            </span>
          </>
        )}
      </div>

      <ul
        className={clsx(
          "divide-row divide-row-animated",
          fillHeight && "flex flex-1 min-h-0 flex-col",
        )}
        aria-busy={loading}
      >
        {loading ? (
          Array.from({ length: 5 }, (_, i) => (
            <RequestRowSkeleton
              key={`req-sk-${showCode ? "c" : "nc"}-${String(i)}`}
              gridCols={gridCols}
              showCode={showCode}
            />
          ))
        ) : displayRows.length === 0 ? (
          <li
            className={clsx(
              "px-4 text-center",
              fillHeight
                ? "flex flex-1 flex-col items-center justify-center py-10"
                : "py-14",
            )}
          >
            <ClipboardList
              className="mx-auto mb-3 h-14 w-14 text-[color:var(--color-ink-muted)]/35"
              strokeWidth={1.25}
              aria-hidden
            />
            <p className="text-base font-medium text-[color:var(--color-ink-soft)]">
              {emptyHint ?? "—"}
            </p>
            {emptySubHint ? (
              <p className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-[color:var(--color-ink-muted)]">
                {emptySubHint}
              </p>
            ) : null}
          </li>
        ) : visibleRows.map((r) => {
            const isActive = r.status !== "delivered" && r.status !== "cancelled";
            const isRush = r.priority === "rush" && isActive;
            const scheduledPending = isActive && isBeforeScheduledTime(r, nowMs);
            const timeCell = requestTimeCell(r, timeColumn, scheduledPending, nowMs);

            const dndWait = isDndWaiting(r);
            const dndDeferred = isDndDeferred(r);
            const awaitingStaff = isAwaitingStaff(r);
            const closingClass = requestClosingRowClass(
              r.id,
              closingOutcomes,
              closingPhases,
            );
            const isClosing = Boolean(closingClass);

            return (
              <li
                key={r.id}
                className={clsx(
                  "group relative",
                  awaitingStaff && !isClosing && staffCrisisRowClass,
                  isRush && !dndWait && !isClosing && !awaitingStaff && "row-rush",
                  dndDeferred && !isClosing && !awaitingStaff && dndWaitingRowClass,
                  scheduledPending && !isClosing && "opacity-60 saturate-[0.35]",
                  closingClass,
                )}
              >
                {isActive && !scheduledPending && !dndWait && !isClosing && !awaitingStaff && (
                  <RequestCardCountdown r={r} tick={tick} />
                )}
                {linkToDetail && !isClosing ? (
                  <Link
                    to={`/requests/${r.id}`}
                    className="relative z-10 block transition-colors hover:bg-[color:var(--color-paper-2)]/45"
                  >
                    <RequestRowContent
                      r={r}
                      showCode={showCode}
                      gridCols={gridCols}
                      locationLabels={locationLabels}
                      guestRooms={guestRooms}
                      departmentLabel={departmentLabel}
                      timeCell={timeCell}
                      isRush={isRush}
                      awaitingStaff={awaitingStaff}
                      t={t}
                    />
                  </Link>
                ) : (
                  <div className="relative z-10">
                    <RequestRowContent
                      r={r}
                      showCode={showCode}
                      gridCols={gridCols}
                      locationLabels={locationLabels}
                      guestRooms={guestRooms}
                      departmentLabel={departmentLabel}
                      timeCell={timeCell}
                      isRush={isRush}
                      awaitingStaff={awaitingStaff}
                      t={t}
                    />
                  </div>
                )}
              </li>
            );
          })
        }
        {fillHeight && !loading && displayRows.length > 0 && (
          <li
            aria-hidden
            className="border-t border-[color:var(--color-line)]"
          />
        )}
      </ul>

      {!loading && pagination && totalRows > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--color-line)] px-4 py-3 text-sm">
          <p className="tabular-nums text-[color:var(--color-ink-soft)]">
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
                value={pagination.pageSize}
                options={pageSizeOptions}
                onChange={pagination.onPageSizeChange}
                ariaLabel={t("products.pagination.per_page")}
                placement="up"
              />
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => pagination.onPageChange(Math.max(1, currentPage - 1))}
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
                onClick={() =>
                  pagination.onPageChange(Math.min(totalPages, currentPage + 1))
                }
                disabled={currentPage >= totalPages}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[color:var(--color-line)] bg-white hover:bg-[color:var(--color-paper-2)] disabled:opacity-40"
                aria-label={t("products.pagination.next")}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
