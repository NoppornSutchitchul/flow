import { useMemo, useCallback, useState } from "react";
import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BellRing,
  Building2,
  ClipboardList,
  DoorClosed,
  Clock,
  Pause,
  PhoneCall,
  Play,
} from "lucide-react";
import clsx from "clsx";
import type { ComponentType } from "react";

import { hotelLocationLabelMap, useHotelLocations } from "../lib/hotelLocations";
import { useGuestRooms } from "../lib/guestRooms";
import { RequestLocationDisplay } from "../components/requests/RequestLocationDisplay";
import { RequestCardCountdown } from "../components/requests/RequestCardCountdown";
import { RequestItemsChecklist } from "../components/requests/RequestItemsChecklist";
import {
  RequestItemsChips,
  normalizeRequestItems,
  useProductNameLookup,
} from "../components/requests/RequestItemsChips";
import { useRequestItemChecklist } from "../hooks/useRequestItemChecklist";
import {
  requestClosingCardClass,
  useClosingRequests,
  type ClosingOutcome,
  type ClosingPhase,
} from "../hooks/useClosingRequests";
import { StatusPill } from "../components/ui/StatusPill";
import { WorkZonePicker } from "../components/users/WorkZonePicker";
import { canAccessQueue } from "../lib/format";
import {
  ageLabel,
  dndWaitingCardClass,
  formatTimeRemainingSeconds,
  parseApiUtcMs,
  isDndPendingAutoCancel,
  isDndDeferred,
  isDndWaiting,
  sortRequestsByUrgency,
  timeOfDay,
  timeRemainingSeconds,
} from "../lib/format";
import type { Room } from "../lib/rooms";
import { requestsApi } from "../lib/api";
import { opsQueryOptions } from "../lib/queryOptions";
import { useAuth } from "../lib/auth";
import { clearRequestItemChecklist } from "../lib/requestItemChecklist";
import { opsDeptForRequestScope } from "../lib/opsDepartment";
import { requestMutationHandlersById } from "../lib/requestCache";
import { canDeliverFromDnd, canReportDndAtDoor } from "../lib/dndPolicy";
import {
  isGuestRoomRequest,
  isPublicAreaHousekeeper,
  isPublicAreaRequest,
  staffDisplayName,
  workZoneForRoomCode,
} from "../lib/assignees";
import { isBeforeScheduledTime } from "../lib/requestSchedule";
import type { DeliveryMethod, RequestRead, RequestStatus } from "../lib/types";

const DELIVERY_ICONS: Record<DeliveryMethod, ComponentType<{ className?: string }>> = {
  ring_bell: BellRing,
  leave_at_door: DoorClosed,
  front_desk: Building2,
};

const startJobBtn =
  "inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl bg-[color:var(--color-ink)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-110 active:scale-[0.98]";

const startJobBtnCompact =
  "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-[color:var(--color-ink)] px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110";

type QueueFilter = "in_progress" | "paused" | "dnd" | "completed";

function QueueStatBadges({
  filter,
  onFilter,
  inProgressCount,
  pausedCount,
  dndCount,
  completedCount,
}: {
  filter: QueueFilter | null;
  onFilter: (f: QueueFilter) => void;
  inProgressCount: number;
  pausedCount: number;
  dndCount: number;
  completedCount: number;
}) {
  const { t } = useTranslation();

  const chip = (
    key: QueueFilter,
    label: string,
    count: number,
    idleClass: string,
  ) => {
    const active = filter === key;
    return (
      <button
        type="button"
        onClick={() => onFilter(key)}
        aria-pressed={active}
        className={clsx(
          "rounded-lg border px-3 py-1.5 text-sm transition",
          active
            ? "border-[color:var(--color-ink)] bg-[color:var(--color-ink)] text-white shadow-sm"
            : idleClass,
        )}
      >
        {label} <strong className="font-semibold tabular-nums">{count}</strong>
      </button>
    );
  };

  return (
    <div
      className="flex flex-wrap items-center gap-2 text-sm shrink-0"
      role="group"
      aria-label={t("queue.filter_aria")}
    >
      {chip(
        "in_progress",
        t("queue.in_progress"),
        inProgressCount,
        "border-[color:var(--color-line)] bg-white text-[color:var(--color-ink)] hover:border-[color:var(--color-ink)]/15",
      )}
      {pausedCount > 0 &&
        chip(
          "paused",
          t("queue.paused"),
          pausedCount,
          "border-[color:var(--color-line)] bg-white text-[color:var(--color-ink)] hover:border-[color:var(--color-ink)]/15",
        )}
      {dndCount > 0 &&
        chip(
          "dnd",
          t("queue.dnd_waiting"),
          dndCount,
          "border-[color:var(--color-line)] bg-[color:var(--color-paper-2)] text-[color:var(--color-ink-muted)] hover:border-[color:var(--color-ink)]/15",
        )}
      {chip(
        "completed",
        t("queue.completed_today"),
        completedCount,
        "border-transparent bg-[color:var(--color-delivered-bg)] text-[color:var(--color-delivered-fg)] hover:opacity-90",
      )}
    </div>
  );
}

function CompletedJobCard({
  r,
  locationLabels,
  guestRooms,
}: {
  r: RequestRead;
  locationLabels: Record<string, string>;
  guestRooms: Room[];
}) {
  const { t } = useTranslation();
  const deliveredLabel = r.delivered_at ? timeOfDay(r.delivered_at) : null;
  return (
    <Card
      r={r}
      locationLabels={locationLabels}
      guestRooms={guestRooms}
      showCountdown={false}
      detailed={false}
    >
      <div className="flex w-full flex-wrap items-center justify-between gap-2">
        <StatusPill status="delivered" />
        {deliveredLabel ? (
          <span className="text-xs tabular-nums text-[color:var(--color-ink-muted)]">
            {t("queue.delivered_at", { time: deliveredLabel })}
          </span>
        ) : null}
      </div>
    </Card>
  );
}

function Card({
  r,
  children,
  locationLabels,
  guestRooms,
  showCountdown = false,
  detailed = true,
  checklist,
  closingOutcomes,
  closingPhases,
}: {
  r: RequestRead;
  children: React.ReactNode;
  locationLabels: Record<string, string>;
  guestRooms: Room[];
  showCountdown?: boolean;
  detailed?: boolean;
  checklist?: ReturnType<typeof useRequestItemChecklist>;
  closingOutcomes?: Map<number, ClosingOutcome>;
  closingPhases?: Map<number, ClosingPhase>;
}) {
  const { t } = useTranslation();
  const isActive = r.status !== "delivered" && r.status !== "cancelled";
  const closingClass = closingOutcomes
    ? requestClosingCardClass(r.id, closingOutcomes, closingPhases ?? new Map())
    : undefined;
  const isClosing = Boolean(closingClass);
  const isRush = r.priority === "rush" && isActive && !isDndWaiting(r) && !isClosing;
  const dndWait = isDndWaiting(r) && !isClosing;
  const dndDeferred = isDndDeferred(r) && !isClosing;
  const remaining = showCountdown && !dndWait && !isClosing ? timeRemainingSeconds(r) : null;
  const isOverdue = remaining !== null && remaining <= 0;
  return (
    <li
      className={clsx(
        "relative overflow-hidden rounded-xl border border-[color:var(--color-line)] bg-white",
        dndDeferred && dndWaitingCardClass,
        r.status === "paused" &&
          !dndWait &&
          !isClosing &&
          "border-l-4 border-l-[color:var(--color-paused-fg)]",
        isRush && "card-rush",
        isOverdue && "card-overdue-soft",
        closingClass,
      )}
    >
      {showCountdown && !dndWait && !isClosing && <RequestCardCountdown r={r} overduePulse />}
      <div className="relative z-10 flex flex-col gap-3 p-3">
        <div className="flex items-start gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <RequestLocationDisplay
              room={r.room}
              deliveryMethod={r.delivery_method}
              labelByCode={locationLabels}
              guestRooms={guestRooms}
              variant="badge"
              className="shrink-0"
            />
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-1.5">
                {isRush && (
                  <span className="rush-badge inline-flex" aria-label={t("queue.rush")}>
                    🚨 {t("queue.rush")}
                  </span>
                )}
              </div>
              <p className="text-sm font-semibold tabular-nums text-[color:var(--color-ink)]">
                {r.code}
              </p>
              <p
                className={clsx(
                  "text-xs tabular-nums",
                  isOverdue
                    ? "font-medium text-red-900"
                    : "text-[color:var(--color-ink-muted)]",
                )}
              >
                {timeOfDay(r.created_at)}
                {r.status === "paused" && r.pause_reason ? (
                  <>
                    {" "}
                    · <Clock className="inline w-3 h-3" /> {r.pause_reason} ·{" "}
                    {ageLabel(r.age_seconds)}
                  </>
                ) : (
                  <> · {ageLabel(r.age_seconds)}</>
                )}
                {isOverdue && remaining !== null && (
                  <>
                    {" "}
                    ·{" "}
                    <span className="font-mono overdue-timer-blink">
                      {formatTimeRemainingSeconds(remaining)}
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>
        </div>

        {detailed && checklist ? (
          <RequestItemsChecklist
            checklist={checklist}
            locked={r.status === "assigned"}
          />
        ) : detailed ? null : (
          <div className="rounded-lg -mx-0.5 px-0.5 py-0.5">
            <RequestItemsChips
              items={r.items}
              text={r.items_text}
              layout="compact"
              maxVisible={2}
            />
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[color:var(--color-line)] pt-3">
          {children}
        </div>
      </div>
    </li>
  );
}

function QueueJobCard({
  r,
  locationLabels,
  guestRooms,
  showCountdown = false,
  closingOutcomes,
  closingPhases,
  children,
}: {
  r: RequestRead;
  locationLabels: Record<string, string>;
  guestRooms: Room[];
  showCountdown?: boolean;
  closingOutcomes?: Map<number, ClosingOutcome>;
  closingPhases?: Map<number, ClosingPhase>;
  children: (ctx: { allChecked: boolean }) => React.ReactNode;
}) {
  const checklist = useRequestItemChecklist(r.id, r.items, r.items_text ?? "");
  const isClosing = closingOutcomes?.has(r.id) ?? false;
  return (
    <Card
      r={r}
      locationLabels={locationLabels}
      guestRooms={guestRooms}
      showCountdown={showCountdown}
      detailed
      checklist={checklist}
      closingOutcomes={closingOutcomes}
      closingPhases={closingPhases}
    >
      {isClosing ? null : children({ allChecked: checklist.allChecked })}
    </Card>
  );
}

function CompactQueueRow({
  r,
  locationLabels,
  guestRooms,
  closingOutcomes,
  closingPhases,
  children,
}: {
  r: RequestRead;
  locationLabels: Record<string, string>;
  guestRooms: Room[];
  closingOutcomes?: Map<number, ClosingOutcome>;
  closingPhases?: Map<number, ClosingPhase>;
  children: React.ReactNode;
}) {
  const { t, i18n } = useTranslation();
  const productLookup = useProductNameLookup();
  const rows = normalizeRequestItems(r.items, r.items_text, i18n.language, productLookup);
  const totalQty = rows.reduce((sum, row) => sum + row.qty, 0);
  const remaining = timeRemainingSeconds(r);
  const countdownLabel = formatTimeRemainingSeconds(remaining);
  const dndWait = isDndWaiting(r);
  const dndDeferred = isDndDeferred(r);
  const closingClass = closingOutcomes
    ? requestClosingCardClass(r.id, closingOutcomes, closingPhases ?? new Map())
    : undefined;

  return (
    <li
      className={clsx(
        "rounded-lg border px-3 py-2",
        closingClass,
        dndDeferred
          ? dndWaitingCardClass
          : "border-[color:var(--color-line)] bg-[color:var(--color-paper-2)]/45",
      )}
    >
      <div className="relative flex items-center gap-2.5">
        <div className="peer relative z-10 flex min-w-0 flex-1 items-center gap-2.5">
          <RequestLocationDisplay
            room={r.room}
            deliveryMethod={r.delivery_method}
            labelByCode={locationLabels}
            guestRooms={guestRooms}
            variant="badge"
            className="shrink-0 scale-90"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-mono text-[color:var(--color-ink-soft)]">
              {r.code}
            </p>
            <p className="truncate text-sm font-medium text-[color:var(--color-ink)]">
              {t("queue.items_heading", { count: rows.length, total: totalQty })}
            </p>
          </div>
          <StatusPill status={r.status} deferred={dndDeferred} />
          {!dndWait && (
            <span className="shrink-0 font-mono text-xs tabular-nums text-[color:var(--color-ink-soft)]">
              {countdownLabel}
            </span>
          )}
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-x-3 -inset-y-2 rounded-lg bg-white/70 opacity-0 transition-opacity peer-hover:opacity-100"
        />
        <div className="relative z-10 flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          {closingClass ? null : children}
        </div>
      </div>
    </li>
  );
}

function QueueLoading() {
  return (
    <div className="flex flex-col gap-4 animate-pulse" aria-busy>
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-36 rounded-lg bg-[color:var(--color-paper-2)]" />
          <div className="h-3 w-48 rounded bg-[color:var(--color-paper-2)]" />
        </div>
        <div className="h-9 w-28 rounded-lg bg-[color:var(--color-paper-2)]" />
      </div>
      <div className="h-28 rounded-xl border border-[color:var(--color-line)] bg-white" />
      <div className="h-28 rounded-xl border border-[color:var(--color-line)] bg-white" />
    </div>
  );
}

export function MyQueue() {
  const { t, i18n } = useTranslation();
  const { current, loading } = useAuth();
  const qc = useQueryClient();
  const { data: hotelLocations = [] } = useHotelLocations();
  const { data: guestRooms = [] } = useGuestRooms();
  const locationLabels = useMemo(
    () => hotelLocationLabelMap(hotelLocations, i18n.language),
    [hotelLocations, i18n.language],
  );
  const hotelCodes = useMemo(
    () => hotelLocations.map((loc) => loc.code),
    [hotelLocations],
  );

  const opsDept = opsDeptForRequestScope(current?.department ?? undefined);

  const { data: mine, isLoading: mineLoading } = useQuery({
    queryKey: ["requests", { assignee: current?.id }],
    enabled: !!current?.id,
    queryFn: () => requestsApi.list({ assignee_id: current!.id }),
    ...opsQueryOptions(),
  });

  const { data: deliveredToday = [] } = useQuery({
    queryKey: ["requests", { assignee: current?.id, scope: "delivered_today" }],
    enabled: !!current?.id,
    queryFn: () =>
      requestsApi.list({
        assignee_id: current!.id,
        scope: "delivered_today",
      }),
    ...opsQueryOptions(),
  });

  const {
    displayRows: mineRows,
    closingOutcomes,
    closingPhases,
    closingIds,
    snapshotFor,
  } = useClosingRequests(mine ?? []);

  const statusOf = useCallback(
    (r: RequestRead) =>
      closingIds.has(r.id) ? (snapshotFor(r.id)?.status ?? r.status) : r.status,
    [closingIds, snapshotFor],
  );

  const { data: deptOpen = [] } = useQuery({
    queryKey: ["requests", { dept: opsDept }],
    enabled: !!opsDept,
    queryFn: () =>
      requestsApi.list({
        department: opsDept!,
        status: "active",
      }),
    ...opsQueryOptions(),
  });

  const actorId = current?.id;
  const requestHandlers = requestMutationHandlersById(qc);

  const accept = useMutation({
    mutationFn: (id: number) => {
      if (actorId == null) throw new Error("No active user");
      return requestsApi.accept(id, actorId);
    },
    ...requestHandlers,
  });
  const start = useMutation({
    mutationFn: (id: number) => {
      if (actorId == null) throw new Error("No active user");
      return requestsApi.start(id, actorId);
    },
    ...requestHandlers,
  });
  const pause = useMutation({
    mutationFn: (id: number) => {
      if (actorId == null) throw new Error("No active user");
      return requestsApi.pause(id, actorId, "Paused");
    },
    ...requestHandlers,
  });
  const deliver = useMutation({
    mutationFn: (id: number) => {
      if (actorId == null) throw new Error("No active user");
      return requestsApi.deliver(id, actorId);
    },
    onMutate: requestHandlers.onMutate,
    onSuccess: (detail, id) => {
      clearRequestItemChecklist(id);
      requestHandlers.onSuccess(detail);
    },
  });
  const dnd = useMutation({
    mutationFn: (id: number) => {
      if (actorId == null) throw new Error("No active user");
      return requestsApi.reportDnd(id, actorId, "DND sign on door");
    },
    ...requestHandlers,
  });
  const resume = useMutation({
    mutationFn: (id: number) => {
      if (actorId == null) throw new Error("No active user");
      return requestsApi.start(id, actorId);
    },
    ...requestHandlers,
  });

  const inProgress = useMemo(
    () =>
      sortRequestsByUrgency(
        mineRows.filter((r) => {
          if (isBeforeScheduledTime(r)) return false;
          const s = statusOf(r);
          return s === "in_progress" || s === "assigned";
        }),
      ),
    [mineRows, statusOf],
  );
  const dndWaiting = useMemo(
    () =>
      sortRequestsByUrgency(
        mineRows.filter((r) => statusOf(r) === "dnd"),
      ),
    [mineRows, statusOf],
  );
  const paused = useMemo(
    () =>
      sortRequestsByUrgency(
        mineRows.filter((r) => statusOf(r) === "paused"),
      ),
    [mineRows, statusOf],
  );
  const activeWork = useMemo(
    () => sortRequestsByUrgency([...inProgress, ...paused]),
    [inProgress, paused],
  );
  const available = useMemo(
    () => {
      const pool = deptOpen.filter(
        (r) =>
          r.status === "pending" &&
          !isBeforeScheduledTime(r) &&
          r.assignee?.id !== current?.id,
      );
      if (!current || current.role !== "housekeeper") {
        return sortRequestsByUrgency(pool);
      }
      if (isPublicAreaHousekeeper(current)) {
        return sortRequestsByUrgency(
          pool.filter((r) =>
            isPublicAreaRequest(r.room, hotelCodes, guestRooms),
          ),
        );
      }
      const zone = current.work_zone?.trim();
      const scoped = pool.filter((r) => {
        if (!isGuestRoomRequest(r.room, guestRooms)) return false;
        if (!zone) return true;
        return workZoneForRoomCode(r.room, guestRooms) === zone;
      });
      return sortRequestsByUrgency(scoped);
    },
    [
      deptOpen,
      current,
      guestRooms,
      hotelCodes,
    ],
  );
  const completedTodayCount = deliveredToday.length;
  const [queueFilter, setQueueFilter] = useState<QueueFilter | null>(null);

  const deliveredSorted = useMemo(
    () =>
      [...deliveredToday].sort(
        (a, b) =>
          parseApiUtcMs(b.delivered_at ?? b.created_at) -
          parseApiUtcMs(a.delivered_at ?? a.created_at),
      ),
    [deliveredToday],
  );

  const toggleQueueFilter = useCallback((f: QueueFilter) => {
    setQueueFilter((prev) => (prev === f ? null : f));
  }, []);

  if (!loading && current && !canAccessQueue(current)) {
    return <Navigate to="/" replace />;
  }

  if (loading) {
    return <QueueLoading />;
  }

  if (mineLoading && mine === undefined) {
    return <QueueLoading />;
  }

  if (!current) {
    return (
      <p className="text-sm text-[color:var(--color-ink-muted)] text-center py-12">
        {t("common.loading")}
      </p>
    );
  }

  const renderInProgressActions = (
    r: RequestRead,
    status: RequestStatus,
    compact = false,
    canDeliver = true,
  ) => {
    const canReport = canReportDndAtDoor(current, r.assignee?.id);
    if (status === "assigned") {
      return (
        <button
          type="button"
          onClick={() => start.mutate(r.id)}
          className={compact ? startJobBtnCompact : startJobBtn}
        >
          <Play className={clsx(compact ? "h-3.5 w-3.5 fill-current" : "h-4 w-4 fill-current")} />
          {t("queue.start")}
        </button>
      );
    }
    if (status === "dnd") {
      return renderDndWaitingAction(r);
    }
    return (
      <>
        {canReport && (
          <button
            type="button"
            onClick={() => dnd.mutate(r.id)}
            className="rounded-lg border border-[color:var(--color-line)] bg-white px-3 py-1.5 text-sm hover:bg-[color:var(--color-paper-2)] inline-flex items-center gap-1"
          >
            <PhoneCall className="w-4 h-4" /> {t("queue.report_dnd")}
          </button>
        )}
        <button
          type="button"
          onClick={() => pause.mutate(r.id)}
          className="w-9 h-9 grid place-items-center rounded-lg border border-[color:var(--color-line)] bg-white hover:bg-[color:var(--color-paper-2)]"
          aria-label={t("queue.pause")}
        >
          <Pause className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => deliver.mutate(r.id)}
          disabled={!canDeliver || deliver.isPending}
          title={!canDeliver ? t("queue.checklist_deliver_locked") : undefined}
          className={clsx(
            "rounded-lg px-3 py-1.5 text-sm inline-flex items-center gap-1",
            canDeliver
              ? "bg-[color:var(--color-ink)] text-white hover:brightness-110"
              : "cursor-not-allowed bg-[color:var(--color-ink)]/35 text-white/70",
          )}
        >
          {(() => {
            const DM = DELIVERY_ICONS[r.delivery_method] ?? BellRing;
            return <DM className="w-4 h-4" />;
          })()}
          {t(`delivery.action.${r.delivery_method}`)}
        </button>
      </>
    );
  };

  const renderDndWaitingAction = (r: RequestRead) => {
    const canMeet = canDeliverFromDnd(current, r.assignee?.id);
    const remaining = formatTimeRemainingSeconds(timeRemainingSeconds(r));
    const DM = DELIVERY_ICONS[r.delivery_method] ?? BellRing;
    return (
      <>
        {isDndPendingAutoCancel(r) ? (
          <span className="max-w-[14rem] text-xs leading-snug text-[color:var(--color-ink-muted)]">
            {t("queue.dnd_pending_cancel_sub", { time: remaining })}
          </span>
        ) : (
          <span className="max-w-[14rem] text-xs leading-snug text-[color:var(--color-ink-muted)]">
            {t("queue.dnd_wait_front_sub")}
          </span>
        )}
        {canMeet && (
          <button
            type="button"
            onClick={() => deliver.mutate(r.id)}
            disabled={deliver.isPending}
            className={startJobBtnCompact}
          >
            <DM className="h-3.5 w-3.5" />
            {t("queue.dnd_guest_met")}
          </button>
        )}
      </>
    );
  };

  const renderWaitingAction = (r: RequestRead) => {
    if (
      r.status === "in_progress" ||
      r.status === "assigned" ||
      r.status === "dnd"
    ) {
      return renderInProgressActions(r, r.status, true);
    }
    if (r.status === "paused") {
      return (
        <button
          type="button"
          onClick={() => resume.mutate(r.id)}
          className="rounded-lg border border-[color:var(--color-line)] bg-white px-2.5 py-1.5 text-xs font-medium hover:bg-[color:var(--color-paper-2)]"
        >
          {t("queue.resume")}
        </button>
      );
    }
    return (
      <button
        type="button"
        onClick={() => accept.mutate(r.id)}
        className="rounded-lg border border-[color:var(--color-line)] bg-white px-2.5 py-1.5 text-xs font-medium hover:bg-[color:var(--color-paper-2)]"
      >
        {t("queue.accept")}
      </button>
    );
  };

  const queueIsEmpty =
    activeWork.length + available.length + dndWaiting.length === 0;

  const showInProgressSection =
    !queueFilter || queueFilter === "in_progress" || queueFilter === "paused";
  const showAvailableSection = !queueFilter;
  const showDndSection = !queueFilter || queueFilter === "dnd";

  const inProgressRows =
    queueFilter === "paused" ? paused : queueFilter === "in_progress" ? inProgress : activeWork;
  const inProgressHeading =
    queueFilter === "paused"
      ? t("queue.paused")
      : queueFilter === "in_progress"
        ? t("queue.in_progress")
        : t("queue.in_progress");

  const filterEmptyKey: Record<QueueFilter, string> = {
    in_progress: "queue.empty_in_progress",
    paused: "queue.empty_paused",
    dnd: "queue.empty_dnd",
    completed: "queue.empty_completed",
  };

  const filteredEmpty =
    queueFilter === "in_progress"
      ? inProgress.length === 0
      : queueFilter === "paused"
        ? paused.length === 0
        : queueFilter === "dnd"
          ? dndWaiting.length === 0
          : queueFilter === "completed"
            ? deliveredSorted.length === 0
            : false;

  return (
    <div
      className={clsx(
        "flex flex-col gap-4",
        queueIsEmpty && "min-h-0 flex-1",
      )}
    >
      {current.role === "housekeeper" && !isPublicAreaHousekeeper(current) ? (
        <WorkZonePicker user={current} layout="header">
          {({ trigger }) => (
            <header className="flex flex-col gap-3">
              <div className="relative flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                <div className="min-w-0">
                  <h1 className="text-2xl font-semibold tracking-tight">
                    {t("queue.title")}
                  </h1>
                  <p className="text-xs text-[color:var(--color-ink-soft)]">
                    {staffDisplayName(current.name)} · {t(`departments.${current.department}`)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
                  <QueueStatBadges
                    filter={queueFilter}
                    onFilter={toggleQueueFilter}
                    inProgressCount={inProgress.length}
                    pausedCount={paused.length}
                    dndCount={dndWaiting.length}
                    completedCount={completedTodayCount}
                  />
                </div>
                <div
                  className="pointer-events-none absolute inset-x-0 top-0 hidden h-full items-center justify-center lg:flex"
                  aria-hidden="false"
                >
                  <div className="pointer-events-auto">{trigger}</div>
                </div>
                <div className="basis-full flex justify-center lg:hidden">
                  {trigger}
                </div>
              </div>
            </header>
          )}
        </WorkZonePicker>
      ) : (
        <header className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                {t("queue.title")}
              </h1>
              <p className="text-xs text-[color:var(--color-ink-soft)]">
                {staffDisplayName(current.name)} · {t(`departments.${current.department}`)}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <QueueStatBadges
                filter={queueFilter}
                onFilter={toggleQueueFilter}
                inProgressCount={inProgress.length}
                pausedCount={paused.length}
                dndCount={dndWaiting.length}
                completedCount={completedTodayCount}
              />
            </div>
          </div>
        </header>
      )}

      {queueFilter && (
        <p className="text-xs text-[color:var(--color-ink-muted)]">
          {t("queue.filter_clear_hint")}
        </p>
      )}

      {queueFilter === "completed" && deliveredSorted.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-medium text-[color:var(--color-ink-soft)]">
            {t("queue.completed_today")}
          </h2>
          <ul className="queue-list-animated flex flex-col gap-3">
            {deliveredSorted.map((r) => (
              <CompletedJobCard
                key={r.id}
                r={r}
                locationLabels={locationLabels}
                guestRooms={guestRooms}
              />
            ))}
          </ul>
        </section>
      )}

      {showInProgressSection && inProgressRows.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-medium text-[color:var(--color-ink-soft)]">
            {inProgressHeading}
          </h2>
          <ul className="queue-list-animated flex flex-col gap-3">
            {inProgressRows.map((r) => (
              <QueueJobCard
                key={r.id}
                r={r}
                locationLabels={locationLabels}
                guestRooms={guestRooms}
                showCountdown={r.status !== "paused"}
                closingOutcomes={closingOutcomes}
                closingPhases={closingPhases}
              >
                {({ allChecked }) =>
                  r.status === "paused" ? (
                    <button
                      type="button"
                      onClick={() => resume.mutate(r.id)}
                      className={startJobBtn}
                    >
                      <Play className="h-4 w-4 fill-current" />
                      {t("queue.resume")}
                    </button>
                  ) : (
                    renderInProgressActions(r, r.status, false, allChecked)
                  )
                }
              </QueueJobCard>
            ))}
          </ul>
        </section>
      )}

      {showAvailableSection && available.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-medium text-[color:var(--color-ink-soft)]">
            {t("queue.available")}
          </h2>
          <ul className="queue-list-animated flex flex-col gap-3">
            {available.map((r) => (
              <QueueJobCard
                key={r.id}
                r={r}
                locationLabels={locationLabels}
                guestRooms={guestRooms}
              >
                {() => (
                  <button
                    type="button"
                    onClick={() => accept.mutate(r.id)}
                    className={startJobBtn}
                  >
                    <Play className="h-4 w-4 fill-current" />
                    {t("queue.accept")}
                  </button>
                )}
              </QueueJobCard>
            ))}
          </ul>
        </section>
      )}

      {queueFilter && filteredEmpty && (
        <section
          className="flex min-h-[min(16rem,calc(100vh-16rem))] flex-col items-center justify-center px-4 py-10 text-center"
          aria-live="polite"
        >
          <ClipboardList
            className="mx-auto mb-3 h-12 w-12 text-[color:var(--color-ink-muted)]/35"
            strokeWidth={1.25}
            aria-hidden
          />
          <p className="text-base font-medium text-[color:var(--color-ink-soft)]">
            {t(filterEmptyKey[queueFilter])}
          </p>
        </section>
      )}

      {!queueFilter && queueIsEmpty && (
        <section
          className="flex min-h-[min(20rem,calc(100vh-14rem))] flex-1 flex-col items-center justify-center px-4 py-10 text-center"
          aria-live="polite"
        >
          <ClipboardList
            className="mx-auto mb-3 h-14 w-14 text-[color:var(--color-ink-muted)]/35"
            strokeWidth={1.25}
            aria-hidden
          />
          <p className="text-base font-medium text-[color:var(--color-ink-soft)]">
            {t("queue.empty")}
          </p>
          <p className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-[color:var(--color-ink-muted)]">
            {t("queue.empty_sub")}
          </p>
          {completedTodayCount > 0 && (
            <button
              type="button"
              onClick={() => setQueueFilter("completed")}
              className="mt-4 rounded-lg bg-[color:var(--color-delivered-bg)] px-4 py-2 text-sm font-medium text-[color:var(--color-delivered-fg)] transition hover:opacity-90"
            >
              {t("queue.completed_today")} ({completedTodayCount})
            </button>
          )}
        </section>
      )}

      {showDndSection && dndWaiting.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-medium text-[color:var(--color-ink-muted)]">
            {t("queue.dnd_waiting_section")}
          </h2>
          <ul className="flex flex-col gap-1.5">
            {dndWaiting.map((r) => (
              <CompactQueueRow
                key={r.id}
                r={r}
                locationLabels={locationLabels}
                guestRooms={guestRooms}
                closingOutcomes={closingOutcomes}
                closingPhases={closingPhases}
              >
                {renderWaitingAction(r)}
              </CompactQueueRow>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
