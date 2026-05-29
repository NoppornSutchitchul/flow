import { useMemo, useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  BellRing,
  Building2,
  Check,
  Clock,
  DoorClosed,
  Pause,
  PhoneCall,
  PhoneOff,
  Play,
  Truck,
  X,
} from "lucide-react";
import clsx from "clsx";
import type { ComponentType } from "react";

import { BackNavButton } from "../components/layout/BackNavButton";
import { CancelRequestModal } from "../components/modals/CancelRequestModal";
import { Avatar } from "../components/ui/Avatar";
import { ScheduledHoldEditor } from "../components/requests/ScheduledHoldEditor";
import { StaffAssigneePicker } from "../components/users/StaffAssigneePicker";
import { StatusPill } from "../components/ui/StatusPill";
import { requestsApi, usersApi, productsApi } from "../lib/api";
import {
  assignableUsers,
  assignableUsersForRoom,
  canEditScheduledHoldRequest,
  canReassignRequest,
  sortedZoneGroups,
  staffDisplayName,
  withAssigneeInPool,
} from "../lib/assignees";
import { canDeliverFromDnd, canReportDndAtDoor, canResolveDnd } from "../lib/dndPolicy";
import { opsQueryOptions } from "../lib/queryOptions";
import { hotelLocationLabelMap, useHotelLocations } from "../lib/hotelLocations";
import { useGuestRooms } from "../lib/guestRooms";
import { RequestLocationDisplay } from "../components/requests/RequestLocationDisplay";
import { RequestItemsChips } from "../components/requests/RequestItemsChips";
import { ProductItemIcon } from "../lib/productIcons";
import { productDisplayName } from "../lib/productDisplayName";
import { scheduleSummaryLabel, isBeforeScheduledTime } from "../lib/requestSchedule";
import {
  formatTimeRemainingSeconds,
  isDndPendingAutoCancel,
  isAwaitingStaff,
  relativeFromNow,
  requestTimeBand,
  timeOfDay,
  timeRemainingSeconds,
  canViewRequestDetail,
} from "../lib/format";
import { formatTimelineEvent } from "../lib/timeline";
import { useAuth } from "../lib/auth";
import { requestMutationHandlers } from "../lib/requestCache";
import type { DeliveryMethod, TimelineEvent } from "../lib/types";

// Icon used to represent each delivery method everywhere it shows up.
const DELIVERY_ICONS: Record<DeliveryMethod, ComponentType<{ className?: string }>> = {
  ring_bell: BellRing,
  leave_at_door: DoorClosed,
  front_desk: Building2,
};

const primaryActionBtn =
  "inline-flex items-center gap-1.5 rounded-lg bg-[color:var(--color-ink)] text-white px-4 py-2 text-sm font-semibold shadow-sm hover:brightness-110 active:scale-[0.98]";

const rushIcon = (
  <span
    className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-[0.875rem] leading-none"
    aria-hidden
  >
    🚨
  </span>
);

/** Emoji badges for timeline event kinds (Request detail). */
const TIMELINE_KIND: Record<string, { emoji: string; bg: string }> = {
  created: { emoji: "📝", bg: "bg-[color:var(--color-assigned-bg)]" },
  auto_assigned: { emoji: "🤖", bg: "bg-[color:var(--color-paused-bg)]" },
  reassigned: { emoji: "🔁", bg: "bg-[color:var(--color-paused-bg)]" },
  accepted: { emoji: "✅", bg: "bg-[color:var(--color-delivered-bg)]" },
  started: { emoji: "▶️", bg: "bg-[color:var(--color-delivered-bg)]" },
  resumed: { emoji: "▶️", bg: "bg-[color:var(--color-delivered-bg)]" },
  paused: { emoji: "⏸️", bg: "bg-[color:var(--color-paused-bg)]" },
  delivered: { emoji: "🚚", bg: "bg-[color:var(--color-delivered-bg)]" },
  dnd_reported: { emoji: "🚪", bg: "bg-[color:var(--color-dnd-bg)]" },
  dnd_cleared: { emoji: "📞", bg: "bg-[color:var(--color-delivered-bg)]" },
  dnd_defer: { emoji: "📵", bg: "bg-[color:var(--color-paused-bg)]" },
  rushed: { emoji: "🚨", bg: "bg-orange-200" },
  unrushed: { emoji: "🔽", bg: "bg-[color:var(--color-paper-2)]" },
  cancelled: { emoji: "❌", bg: "bg-[color:var(--color-cancelled-bg)]" },
  note: { emoji: "💬", bg: "bg-[color:var(--color-paused-bg)]" },
};

function TimelineRow({ ev }: { ev: TimelineEvent }) {
  const { t, i18n } = useTranslation();
  const info = TIMELINE_KIND[ev.kind] ?? TIMELINE_KIND.note;
  const formatted = formatTimelineEvent(ev, t, i18n.language);
  return (
    <li className="flex items-start gap-3">
      <span
        className={clsx(
          "grid h-8 w-8 shrink-0 place-items-center rounded-full text-[1.05rem] leading-none",
          info.bg,
        )}
        aria-hidden
      >
        {info.emoji}
      </span>
      <div className="flex-1 min-w-0 pt-1">
        <p className="text-sm font-medium">
          {formatted.title}
          {formatted.actorLabel && (
            <span className="font-normal text-[color:var(--color-ink-soft)]">
              {" · "}
              {formatted.actorLabel}
            </span>
          )}
        </p>
        <p className="text-xs text-[color:var(--color-ink-muted)]">
          {[
            formatted.detail,
            ev.kind === "created"
              ? t("requests.timeline_events.created_at", {
                  time: timeOfDay(ev.created_at, i18n.language),
                })
              : t("requests.timeline_events.at_time", {
                  time: timeOfDay(ev.created_at, i18n.language),
                }),
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
    </li>
  );
}

type RequestNavState = { returnTo?: string };

export function RequestDetailPage() {
  const { id } = useParams();
  const reqId = Number(id);
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = (location.state as RequestNavState | null)?.returnTo;
  const { current } = useAuth();
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const blocked = current != null && !canViewRequestDetail(current);

  useEffect(() => {
    if (blocked) navigate("/queue", { replace: true });
  }, [blocked, navigate]);

  const { data, isLoading } = useQuery({
    queryKey: ["request", reqId],
    queryFn: () => requestsApi.get(reqId),
    ...opsQueryOptions(),
    enabled: !blocked && Number.isFinite(reqId),
  });

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

  const scheduledHold = data ? isBeforeScheduledTime(data) : false;
  const canEditHold =
    canEditScheduledHoldRequest(current?.role) &&
    scheduledHold &&
    !!data &&
    data.status !== "delivered" &&
    data.status !== "cancelled";
  const canReassign =
    canReassignRequest(current?.role) &&
    data?.status !== "delivered" &&
    data?.status !== "cancelled" &&
    !scheduledHold;

  const { data: userList = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => usersApi.list(),
    enabled: canReassign,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => productsApi.list(),
    enabled: canEditHold,
  });

  const assigneeGroups = useMemo(() => {
    if (!data) return [];
    const dept = data.department as
      | "housekeeping"
      | "maintenance"
      | "front_office"
      | "bell_boy";
    const pool = withAssigneeInPool(
      dept === "housekeeping"
        ? assignableUsersForRoom(
            dept,
            userList,
            data.room,
            guestRooms,
            hotelCodes,
          )
        : assignableUsers(dept, userList),
      data.assignee,
    );
    return sortedZoneGroups(pool, t("quick.zone_no"), {
      room: data.room,
      guestRooms,
    });
  }, [data, userList, guestRooms, hotelCodes, t]);

  const reqHandlers = requestMutationHandlers(qc, reqId);

  const refreshRequestDetail = () => {
    void qc.invalidateQueries({
      queryKey: ["request", reqId],
      refetchType: "active",
    });
  };

  const reassign = useMutation({
    mutationFn: (assigneeId: number) =>
      requestsApi.reassign(reqId, assigneeId, current?.id),
    ...reqHandlers,
  });

  const rush = useMutation({
    mutationFn: () => requestsApi.rush(reqId, current?.id),
    ...reqHandlers,
  });
  const unrush = useMutation({
    mutationFn: () => requestsApi.unrush(reqId, current?.id),
    ...reqHandlers,
  });
  const cancel = useMutation({
    mutationFn: (reason: string) => requestsApi.cancel(reqId, current?.id, reason),
    onMutate: reqHandlers.onMutate,
    onSuccess: (detail) => {
      setCancelOpen(false);
      reqHandlers.onSuccess(detail);
    },
  });
  const clearDnd = useMutation({
    mutationFn: () => requestsApi.clearDnd(reqId, current?.id),
    ...reqHandlers,
  });
  const deferDnd = useMutation({
    mutationFn: () => requestsApi.deferDnd(reqId, current?.id),
    ...reqHandlers,
  });
  const accept = useMutation({
    mutationFn: () => requestsApi.accept(reqId, current?.id),
    ...reqHandlers,
  });
  const start = useMutation({
    mutationFn: () => requestsApi.start(reqId, current?.id),
    ...reqHandlers,
  });
  const deliver = useMutation({
    mutationFn: () => requestsApi.deliver(reqId, current?.id),
    ...reqHandlers,
  });
  const addNote = useMutation({
    mutationFn: () => requestsApi.addNote(reqId, note.trim(), current?.id),
    onMutate: reqHandlers.onMutate,
    onSuccess: () => {
      setNote("");
      refreshRequestDetail();
    },
  });

  if (blocked) return null;

  if (!Number.isFinite(reqId)) {
    return (
      <p className="text-sm text-[color:var(--color-ink-muted)]" role="alert">
        {t("requests.not_found", { defaultValue: "Request not found." })}
      </p>
    );
  }

  if (isLoading && !data) {
    return (
      <p className="text-sm text-[color:var(--color-ink-muted)]">
        {t("common.loading")}
      </p>
    );
  }

  if (!data) {
    return (
      <p className="text-sm text-[color:var(--color-ink-muted)]" role="alert">
        {t("requests.not_found", { defaultValue: "Request not found." })}
      </p>
    );
  }

  const band = requestTimeBand(data);
  const closed = data.status === "delivered" || data.status === "cancelled";
  const canReportField = canReportDndAtDoor(current, data.assignee?.id);
  const canDeliverDnd = canDeliverFromDnd(current, data.assignee?.id);
  const canResolve = canResolveDnd(current);
  const showReportDndBtn =
    canReportField && (data.status === "in_progress" || data.status === "paused");

  return (
    <div className="flex flex-col gap-4">
      <BackNavButton
        onClick={() => {
          if (returnTo) navigate(returnTo);
          else navigate(-1);
        }}
      >
        {t("requests.back")}
      </BackNavButton>

      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold font-mono tracking-tight">
          {data.code}
        </h1>
        <StatusPill
          status={data.status}
          deferred={isDndPendingAutoCancel(data)}
          awaitingStaff={isAwaitingStaff(data)}
        />
        {data.priority === "rush" && data.status !== "delivered" && data.status !== "cancelled" && (
          <span className="rush-badge" aria-label="Rush">
            🚨 RUSH
          </span>
        )}
        <div className="request-detail-actions ml-auto flex items-center gap-2">
          {data.status === "dnd" && canResolve ? (
            <>
              <button
                type="button"
                onClick={() => clearDnd.mutate()}
                disabled={clearDnd.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--color-line)] bg-white px-3 py-1.5 text-sm hover:bg-[color:var(--color-paper-2)]"
              >
                <Check className="w-4 h-4" />
                {t("requests.dnd_clear")}
              </button>
              {!isDndPendingAutoCancel(data) && (
                <button
                  type="button"
                  onClick={() => deferDnd.mutate()}
                  disabled={deferDnd.isPending}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--color-line)] bg-white px-3 py-1.5 text-sm hover:bg-[color:var(--color-paper-2)]"
                >
                  <PhoneOff className="w-4 h-4" />
                  {t("requests.dnd_defer")}
                </button>
              )}
            </>
          ) : data.status === "dnd" ? null : !closed ? (
            <>
              {data.priority === "rush" ? (
                <button
                  type="button"
                  onClick={() => unrush.mutate()}
                  disabled={unrush.isPending}
                  className="rush-btn"
                >
                  {rushIcon}
                  {t("requests.unrush")}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => rush.mutate()}
                  disabled={rush.isPending}
                  className="rush-btn"
                >
                  {rushIcon}
                  {t("requests.rush")}
                </button>
              )}
              <button
                type="button"
                onClick={() => setCancelOpen(true)}
                disabled={cancel.isPending}
                className="cancel-btn"
              >
                <X className="h-4 w-4 shrink-0" strokeWidth={2.25} />
                {t("requests.cancel")}
              </button>
            </>
          ) : null}
        </div>
      </header>

      {isAwaitingStaff(data) && (
        <div
          className="staff-crisis-banner rounded-xl border-2 border-red-600 bg-red-600 px-4 py-3 text-sm font-semibold text-white"
          role="alert"
        >
          {t("quick.no_staff_available")}
        </div>
      )}

      {data.status === "dnd" && (
        <section
          className={clsx(
            "rounded-xl border p-4",
            isDndPendingAutoCancel(data)
              ? "border-[color:var(--color-line)] bg-[color:var(--color-paper-2)]"
              : "border-[color:var(--color-line)] bg-[color:var(--color-row-dnd)]/80",
          )}
        >
          <h2
            className={clsx(
              "font-semibold flex items-center gap-2",
              isDndPendingAutoCancel(data)
                ? "text-[color:var(--color-ink-soft)]"
                : "text-[color:var(--color-dnd-fg)]",
            )}
          >
            <PhoneCall className="w-4 h-4" />
            {isDndPendingAutoCancel(data)
              ? t("requests.dnd_unreachable_title")
              : t("requests.dnd_help")}
          </h2>
          <p className="text-sm mt-1 text-[color:var(--color-ink-soft)]">
            {isDndPendingAutoCancel(data)
              ? t("requests.dnd_pending_cancel_note", {
                  time: formatTimeRemainingSeconds(timeRemainingSeconds(data)),
                })
              : data.dnd_reason}
          </p>
          {!isDndPendingAutoCancel(data) && (
            <p className="text-xs mt-0.5 text-[color:var(--color-ink-muted)]">
              {t("dashboard.reported_by")} {data.assignee?.name ?? "—"} ·{" "}
              {timeOfDay(data.updated_at)}
            </p>
          )}
          {canResolve ? (
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => clearDnd.mutate()}
                disabled={clearDnd.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--color-line)] bg-white px-3 py-1.5 text-sm hover:bg-[color:var(--color-paper-2)]"
              >
                <Check className="w-4 h-4" />
                {t("requests.dnd_clear")}
              </button>
              {!isDndPendingAutoCancel(data) && (
                <button
                  type="button"
                  onClick={() => deferDnd.mutate()}
                  disabled={deferDnd.isPending}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--color-line)] bg-white px-3 py-1.5 text-sm hover:bg-[color:var(--color-paper-2)]"
                >
                  <PhoneOff className="w-4 h-4" />
                  {t("requests.dnd_defer")}
                </button>
              )}
            </div>
          ) : canDeliverDnd ? (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => deliver.mutate()}
                disabled={deliver.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[color:var(--color-ink)] px-3 py-1.5 text-sm font-medium text-white hover:brightness-110"
              >
                <Check className="w-4 h-4" />
                {t("queue.dnd_guest_met")}
              </button>
            </div>
          ) : (
            <p className="text-sm mt-3 text-[color:var(--color-ink-muted)] leading-relaxed">
              {isDndPendingAutoCancel(data)
                ? t("requests.dnd_field_pending_cancel")
                : t("requests.dnd_field_note")}
            </p>
          )}
        </section>
      )}

      <div className="grid md:grid-cols-[2fr_1fr] gap-4">
        <section className="rounded-xl border border-[color:var(--color-line)] bg-white px-5 py-4 sm:py-5">
          <h2 className="font-semibold mb-4">{t("requests.details")}</h2>
          {canEditHold ? (
            <>
              <ScheduledHoldEditor
                data={data}
                reqId={reqId}
                actorId={current?.id}
                hotelCodes={hotelCodes}
                locationLabels={locationLabels}
                guestRooms={guestRooms}
                products={products}
                onSaved={refreshRequestDetail}
              />
              <div className="mt-4 grid grid-cols-[6.75rem_minmax(0,1fr)] sm:grid-cols-[7.25rem_minmax(0,1fr)] gap-x-5 items-center border-t border-[color:var(--color-line)] pt-3.5">
                <dt className="text-sm text-[color:var(--color-ink-muted)]">
                  {t("requests.table.assignee")}
                </dt>
                <dd className="min-w-0">
                  <span className="text-sm text-[color:var(--color-ink-muted)]">
                    {t("schedule.assignee_pending")}
                  </span>
                </dd>
              </div>
            </>
          ) : (
          <dl className="divide-y divide-[color:var(--color-line)]">
            <div className="grid grid-cols-[6.75rem_minmax(0,1fr)] sm:grid-cols-[7.25rem_minmax(0,1fr)] gap-x-5 items-center pb-3.5">
              <dt className="text-sm text-[color:var(--color-ink-muted)]">
                {t("requests.table.room")}
              </dt>
              <dd className="min-w-0">
                <RequestLocationDisplay
                  room={data.room}
                  deliveryMethod={data.delivery_method}
                  labelByCode={locationLabels}
                  guestRooms={guestRooms}
                  variant="inline"
                />
              </dd>
            </div>
            <div className="grid grid-cols-[6.75rem_minmax(0,1fr)] sm:grid-cols-[7.25rem_minmax(0,1fr)] gap-x-5 items-start py-3.5">
              <dt className="pt-2 text-sm text-[color:var(--color-ink-muted)]">
                {t("requests.table.items")}
              </dt>
              <dd className="min-w-0">
                {data.items.length > 0 ? (
                  <ul className="m-0 flex list-none flex-col gap-2 p-0">
                    {data.items.map((it) => (
                      <li key={it.product_id} className="flex flex-col gap-1">
                        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
                          <ProductItemIcon sku={it.sku} name={it.name} iconEmoji={it.icon_emoji} size="sm" />
                          <span className="font-medium leading-snug text-[color:var(--color-ink)]">
                            {productDisplayName(it, i18n.language)}
                          </span>
                          <span className="flex h-8 min-w-[2rem] shrink-0 items-center justify-center rounded-lg bg-[color:var(--color-ink)] px-2 text-sm font-bold tabular-nums leading-none text-white">
                            ×{it.qty}
                          </span>
                        </div>
                        {it.note?.trim() ? (
                          <p className="pl-11 text-xs leading-snug text-[color:var(--color-ink-soft)]">
                            {t("requests.item_note_prefix")} {it.note}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <RequestItemsChips text={data.items_text} layout="compact" maxVisible={8} />
                )}
              </dd>
            </div>
            <div className="grid grid-cols-[6.75rem_minmax(0,1fr)] sm:grid-cols-[7.25rem_minmax(0,1fr)] gap-x-5 items-center py-3.5">
              <dt className="text-sm text-[color:var(--color-ink-muted)]">
                {t("schedule.detail_row")}
              </dt>
              <dd className="min-w-0 text-sm text-[color:var(--color-ink)]">
                {scheduleSummaryLabel(data, { t, locale: i18n.language }) ??
                  t("schedule.immediate")}
              </dd>
            </div>
            <div className="grid grid-cols-[6.75rem_minmax(0,1fr)] sm:grid-cols-[7.25rem_minmax(0,1fr)] gap-x-5 items-center py-3.5">
              <dt className="text-sm text-[color:var(--color-ink-muted)]">
                {t("requests.delivery_method")}
              </dt>
              <dd className="min-w-0">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-[color:var(--color-paper-2)] px-2.5 py-1.5 text-sm">
                  {(() => {
                    const DM = DELIVERY_ICONS[data.delivery_method] ?? BellRing;
                    return <DM className="h-4 w-4 shrink-0" />;
                  })()}
                  {t(`delivery.${data.delivery_method}`)}
                </span>
              </dd>
            </div>
            <div className="grid grid-cols-[6.75rem_minmax(0,1fr)] sm:grid-cols-[7.25rem_minmax(0,1fr)] gap-x-5 items-center gap-y-2 pt-3.5">
              <dt className="text-sm text-[color:var(--color-ink-muted)]">
                {t("requests.table.assignee")}
              </dt>
              <dd className="min-w-0">
                {scheduledHold ? (
                  <span className="text-sm text-[color:var(--color-ink-muted)]">
                    {t("schedule.assignee_pending")}
                  </span>
                ) : canReassign ? (
                  <StaffAssigneePicker
                    value={data.assignee?.id ?? ""}
                    onChange={(id) => {
                      if (id !== "" && id !== data.assignee?.id) {
                        reassign.mutate(id);
                      }
                    }}
                    groups={assigneeGroups}
                    autoLabel={t("requests.select_assignee")}
                    ariaLabel={
                      data.department === "maintenance"
                        ? t("quick.assign_mt_aria")
                        : data.department === "front_office"
                          ? t("quick.assign_fo_aria")
                          : data.department === "bell_boy"
                            ? t("quick.assign_bb_aria")
                            : t("quick.assign_hk_aria")
                    }
                    variant={
                      data.department === "maintenance"
                        ? "maintenance"
                        : data.department === "front_office"
                          ? "front_office"
                          : data.department === "bell_boy"
                            ? "bell_boy"
                            : "housekeeping"
                    }
                    showAutoOption={false}
                    density="compact"
                  />
                ) : data.assignee ? (
                  <span className="inline-flex items-center gap-2 py-1">
                    <Avatar user={data.assignee} size="xs" />
                    {staffDisplayName(data.assignee.name)}
                  </span>
                ) : (
                  <span className="text-[color:var(--color-ink-muted)]">
                    {t("requests.no_assignee")}
                  </span>
                )}
              </dd>
            </div>
          </dl>
          )}
        </section>

        <aside className="flex flex-col gap-3">
          {band === "breach" && !closed && (
            <div className="rounded-xl bg-[color:var(--color-row-breach)] px-4 py-3 text-sm font-medium">
              <Clock className="w-4 h-4 inline mr-1" />
              {t("requests.overdue_by_minutes", {
                minutes: Math.floor(data.age_seconds / 60),
              })}
            </div>
          )}

          <section className="rounded-xl border border-[color:var(--color-line)] bg-white p-4">
            <h2 className="font-semibold mb-2">{t("requests.internal_notes")}</h2>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("requests.add_note")}
              rows={3}
              className="w-full rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-paper)]/40 p-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[color:var(--color-ink)]/10"
            />
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                disabled={!note.trim() || addNote.isPending}
                onClick={() => addNote.mutate()}
                className={clsx(
                  "px-3 py-1.5 rounded-lg border border-[color:var(--color-line)] bg-white text-xs font-medium",
                  (!note.trim() || addNote.isPending) && "opacity-50 cursor-not-allowed",
                )}
              >
                {t("requests.post_note")}
              </button>
            </div>
            <ul className="mt-2 divide-row">
              {data.notes.map((n) => (
                <li key={n.id} className="py-2 text-sm">
                  <p>{n.body}</p>
                  <p className="text-xs text-[color:var(--color-ink-muted)]">
                    {n.author_label ?? "—"} · {relativeFromNow(n.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          {!closed && data.status !== "dnd" && !scheduledHold && (
            <section className="rounded-xl border border-[color:var(--color-line)] bg-white p-3 flex flex-col gap-2">
              {data.status === "pending" && (
                <button
                  type="button"
                  onClick={() => accept.mutate()}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-[color:var(--color-line)] bg-white px-3 py-2 text-sm font-medium hover:bg-[color:var(--color-paper-2)]"
                >
                  <Check className="w-4 h-4" /> {t("queue.accept")}
                </button>
              )}
              {data.status === "assigned" && (
                <button
                  type="button"
                  onClick={() => start.mutate()}
                  disabled={start.isPending}
                  className={clsx(primaryActionBtn, "w-full justify-center py-2.5")}
                >
                  <Play className="w-4 h-4 fill-current" />
                  {t("queue.start")}
                </button>
              )}
              {data.status === "paused" && (
                <button
                  type="button"
                  onClick={() => start.mutate()}
                  disabled={start.isPending}
                  className={clsx(primaryActionBtn, "w-full justify-center py-2.5")}
                >
                  <Play className="w-4 h-4 fill-current" />
                  {t("queue.resume")}
                </button>
              )}
              {data.status === "in_progress" && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      reqHandlers.onMutate();
                      void requestsApi
                        .pause(reqId, current?.id, "Paused")
                        .then(reqHandlers.onSuccess);
                    }}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[color:var(--color-line)] bg-white px-3 py-2 text-sm font-medium hover:bg-[color:var(--color-paper-2)]"
                  >
                    <Pause className="w-4 h-4" /> {t("queue.pause")}
                  </button>
                  <button
                    type="button"
                    onClick={() => deliver.mutate()}
                    disabled={deliver.isPending}
                    className="inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[color:var(--color-ink)] px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
                  >
                    {(() => {
                      const DM = DELIVERY_ICONS[data.delivery_method] ?? Truck;
                      return <DM className="w-4 h-4 shrink-0" />;
                    })()}
                    <span className="truncate">{t(`delivery.action.${data.delivery_method}`)}</span>
                  </button>
                </div>
              )}
              {showReportDndBtn && (
                <button
                  type="button"
                  onClick={() => {
                    reqHandlers.onMutate();
                    void requestsApi
                      .reportDnd(reqId, current?.id, "DND sign on door")
                      .then(reqHandlers.onSuccess);
                  }}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-[color:var(--color-line)] bg-white px-3 py-2 text-sm font-medium hover:bg-[color:var(--color-paper-2)]"
                >
                  <PhoneCall className="w-4 h-4" /> {t("queue.report_dnd")}
                </button>
              )}
            </section>
          )}
        </aside>
      </div>

      <section className="rounded-xl border border-[color:var(--color-line)] bg-white p-4">
        <h2 className="font-semibold mb-3">{t("requests.timeline")}</h2>
        <ul className="flex flex-col gap-4">
          {data.timeline.map((ev) => (
            <TimelineRow key={ev.id} ev={ev} />
          ))}
        </ul>
      </section>

      <CancelRequestModal
        open={cancelOpen}
        pending={cancel.isPending}
        onClose={() => setCancelOpen(false)}
        onConfirm={(reason) => cancel.mutate(reason)}
      />
    </div>
  );
}
