import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  ChevronRight,
  PhoneCall,
} from "lucide-react";
import clsx from "clsx";

import { Avatar } from "../components/ui/Avatar";
import { RequestItemsChips } from "../components/requests/RequestItemsChips";
import { RequestTable } from "../components/requests/RequestTable";
import { ProductItemIcon } from "../lib/productIcons";
import { productDisplayName } from "../lib/productDisplayName";
import { staffDisplayName } from "../lib/assignees";
import { useAuth } from "../lib/auth";
import { hasAppFeature } from "../lib/appFeatures";
import { dashboardApi, productsApi, requestsApi } from "../lib/api";
import { opsQueryOptions } from "../lib/queryOptions";
import { activeRequestAlerts, compareDashboardActiveRequests, isDndPendingAutoCancel, formatTimeRemainingSeconds, timeRemainingSeconds } from "../lib/format";
import { formatScheduleClock } from "../lib/requestSchedule";
import { dashboardDeptScope } from "../lib/opsDepartment";
import { hotelLocationLabelMap, useHotelLocations } from "../lib/hotelLocations";
import { useGuestRooms } from "../lib/guestRooms";
import { requestLocationHeadline } from "../lib/rooms";

type Tone = "warn" | "bad" | "neutral";

function KpiCard({
  title,
  value,
  tone = "neutral",
  to,
}: {
  title: string;
  value: number | string;
  tone?: Tone;
  to?: string;
}) {
  const className = clsx(
    "min-w-0 rounded-xl border px-2.5 py-2.5 transition-colors block w-full text-left sm:px-4 sm:py-3",
    tone === "warn" &&
      "bg-[color:var(--color-row-warning)] border-[color:var(--color-stock-low-bg)]",
    tone === "bad" &&
      "bg-[color:var(--color-row-breach)] border-[color:var(--color-pending-bg)]",
    tone === "neutral" && "bg-white border-[color:var(--color-line)]",
    to &&
      "cursor-pointer hover:brightness-[0.98] hover:border-[color:var(--color-ink)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-ink)]/15",
  );
  const body = (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-[11px] leading-snug text-[color:var(--color-ink-soft)] sm:text-xs">
        {title}
      </span>
      <span className="text-xl font-semibold tabular-nums tracking-tight text-[color:var(--color-ink)] sm:text-2xl">
        {value}
      </span>
    </div>
  );
  if (to) {
    return (
      <Link to={to} className={className}>
        {body}
      </Link>
    );
  }
  return <div className={className}>{body}</div>;
}

function toneForBreach(n: number): Tone {
  if (n === 0) return "neutral";
  if (n <= 2) return "warn";
  return "bad";
}

function toneForLowStock(n: number): Tone {
  if (n === 0) return "neutral";
  if (n <= 2) return "warn";
  return "bad";
}

function toneForInProgress(n: number): Tone {
  if (n > 10) return "warn";
  return "neutral";
}

function KpiCardSkeleton() {
  return (
    <div className="min-w-0 animate-pulse rounded-xl border border-[color:var(--color-line)] bg-white px-2.5 py-2.5 sm:px-4 sm:py-3">
      <div className="flex flex-col gap-2">
        <div className="h-3 w-[60%] max-w-[7rem] rounded bg-[color:var(--color-paper-2)]" />
        <div className="h-8 w-[2.5rem] rounded-md bg-[color:var(--color-paper-2)]" />
      </div>
    </div>
  );
}

function toneForCancelled(n: number): Tone {
  // small numbers happen; lots of cancellations is a red flag
  if (n === 0) return "neutral";
  if (n <= 2) return "warn";
  return "bad";
}

export function Dashboard() {
  const { t, i18n } = useTranslation();
  const { current } = useAuth();
  /** HK / maintenance floor staff see a department slice; FO & leadership see hotel-wide. */
  const deptScope = dashboardDeptScope(current?.department ?? undefined);
  const { data: hotelLocations = [] } = useHotelLocations();
  const { data: guestRooms = [] } = useGuestRooms();
  const locationLabels = useMemo(
    () => hotelLocationLabelMap(hotelLocations, i18n.language),
    [hotelLocations, i18n.language],
  );

  const statsQuery = useQuery({
    queryKey: ["dashboard", "stats", deptScope ?? "all"],
    queryFn: () => dashboardApi.stats(deptScope),
    ...opsQueryOptions(),
  });
  const { data: stats, isLoading: statsLoading } = statsQuery;
  const showStatsSkeleton = statsLoading && stats == null;

  const activeQuery = useQuery({
    queryKey: ["requests", { status: "active", department: deptScope }],
    queryFn: () =>
      requestsApi.list({
        status: "active",
        ...(deptScope ? { department: deptScope } : {}),
      }),
    ...opsQueryOptions(),
    placeholderData: keepPreviousData,
  });
  const { data: active, isLoading: activeLoading } = activeQuery;
  const showActiveSkeleton = activeLoading && active == null;

  const [activeTick, setActiveTick] = useState(0);
  useEffect(() => {
    if (!active?.length) return;
    const id = window.setInterval(() => setActiveTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [active?.length]);

  const activeAlerts = useMemo(() => {
    void activeTick;
    return activeRequestAlerts(active ?? []);
  }, [active, activeTick]);

  const { data: stockAlerts = [], isPending: stockAlertsPending } = useQuery({
    queryKey: ["products", "stock-alerts", deptScope ?? "all"],
    queryFn: () => productsApi.stockAlerts(deptScope),
    ...opsQueryOptions(),
  });

  const dndRequests = useMemo(() => {
    const all = (active ?? []).filter((r) => r.status === "dnd");
    return [...all].sort((a, b) => {
      const aPending = isDndPendingAutoCancel(a) ? 1 : 0;
      const bPending = isDndPendingAutoCancel(b) ? 1 : 0;
      if (aPending !== bPending) return aPending - bPending;
      return b.id - a.id;
    });
  }, [active]);
  // Sort: out-of-stock first, then low. Inside each group keep server order.
  const sortedStock = [...stockAlerts].sort((a, b) => {
    if (a.status === b.status) return 0;
    return a.status === "out" ? -1 : 1;
  });

  /** Same gate as Products page — avoids "click then redirect home". */
  const canOpenCatalog = Boolean(current && hasAppFeature(current, "stock"));

  const StockAlert =
    !stockAlertsPending &&
    sortedStock.length > 0 && (
    <section className="stock-alert-glow rounded-xl border border-[color:var(--color-line)] bg-white p-3">
      <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        <AlertTriangle className="h-4 w-4 shrink-0 text-[color:var(--color-stock-out-bg)]" />
        <h2 className="shrink-0 text-sm font-semibold">{t("dashboard.stock_alert")}</h2>
        <span className="min-w-0 text-xs text-[color:var(--color-ink-muted)]">
          {t("dashboard.stock_alert_sub", {
            count: sortedStock.length,
            defaultValue:
              sortedStock.length === 1
                ? "{{count}} item needs attention"
                : "{{count}} items need attention",
          })}
        </span>
        {canOpenCatalog ? (
          <Link
            to="/products"
            className="ml-auto inline-flex items-center gap-1 text-xs rounded-md border border-[color:var(--color-line)] px-2 py-0.5 hover:bg-[color:var(--color-paper-2)]"
          >
            {t("dashboard.see_all")}
            <ArrowRight className="w-3 h-3" />
          </Link>
        ) : (
          <span
            className="ml-auto inline-flex items-center gap-1 text-xs rounded-md border border-[color:var(--color-line)]/60 px-2 py-0.5 text-[color:var(--color-ink-muted)] opacity-70 cursor-not-allowed select-none"
            aria-disabled="true"
          >
            {t("dashboard.see_all")}
            <ArrowRight className="w-3 h-3 opacity-60" />
          </span>
        )}
      </div>
      <ul className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:pl-0.5">
        {sortedStock.map((p) => {
          const label = productDisplayName(p, i18n.language);
          const out = p.status === "out";
          const pillClass = clsx(
            "inline-flex w-full min-w-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm min-h-[2.25rem] transition-colors duration-200 ease-out sm:w-auto sm:rounded-full sm:py-1.5",
            out
              ? "bg-[color:var(--color-row-breach)] border-[color:var(--color-stock-out-bg)]/30"
              : "bg-[color:var(--color-row-warning)] border-[color:var(--color-stock-low-bg)]/40",
            canOpenCatalog &&
              (out
                ? "hover:bg-[color:var(--color-stock-out-bg)]/20"
                : "hover:bg-[color:var(--color-stock-low-bg)]/30"),
            !canOpenCatalog &&
              "opacity-85 cursor-not-allowed saturate-90",
          );
          const pillBody = (
            <>
              <span
                className={clsx(
                  "rounded-md px-1.5 py-0.5 text-[11px] sm:text-xs font-bold uppercase tracking-wide",
                  out
                    ? "bg-[color:var(--color-stock-out-bg)] text-[color:var(--color-stock-out-fg)]"
                    : "bg-[color:var(--color-stock-low-bg)] text-[color:var(--color-stock-low-fg)]",
                )}
              >
                {t(`products.status.${p.status}`)}
              </span>
              <ProductItemIcon sku={p.sku} name={p.name} iconEmoji={p.icon_emoji} size="xs" />
              <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
              <span
                className={clsx(
                  "font-semibold tabular-nums text-base",
                  out
                    ? "text-[color:var(--color-stock-out-bg)]"
                    : "text-[color:var(--color-stock-low-fg)]",
                )}
              >
                {p.on_hand ?? 0}
              </span>
            </>
          );
          return (
            <li key={p.id}>
              {canOpenCatalog ? (
                <Link to={`/products?focus=${p.id}`} className={pillClass}>
                  {pillBody}
                </Link>
              ) : (
                <span className={pillClass} aria-disabled="true">
                  {pillBody}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );

  return (
    <div className="flex flex-1 flex-col gap-4 min-h-0">
      <header>
        <h1 className="min-w-0 text-2xl font-semibold tracking-tight">
          {t("dashboard.title")}
        </h1>
      </header>


      <section className="grid grid-cols-3 gap-2 sm:gap-3 lg:grid-cols-6">
        {showStatsSkeleton ? (
          Array.from({ length: 6 }, (_, i) => (
            <KpiCardSkeleton key={`kpi-skeleton-${i}`} />
          ))
        ) : statsQuery.isError ? (
          <p
            className="col-span-full text-sm text-red-600 px-1 py-2"
            role="alert"
          >
            {t("dashboard.stats_error")}
          </p>
        ) : stats ? (
          <>
            <KpiCard
              title={t("dashboard.today")}
              value={stats.today_count}
              to="/requests?filter=today"
            />
            <KpiCard
              title={t("dashboard.in_progress")}
              value={stats.in_progress}
              tone={toneForInProgress(stats.in_progress)}
              to="/requests?filter=active"
            />
            <KpiCard
              title={t("dashboard.delivered_today")}
              value={stats.delivered_today}
              to="/requests?filter=delivered_today"
            />
            <KpiCard
              title={t("dashboard.cancelled_today")}
              value={stats.cancelled_today}
              tone={toneForCancelled(stats.cancelled_today)}
              to="/requests?filter=cancelled_today"
            />
            <KpiCard
              title={t("dashboard.overdue")}
              value={stats.open_overdue}
              tone={toneForBreach(stats.open_overdue)}
              to="/requests?filter=overdue"
            />
            <KpiCard
              title={t("dashboard.low_stock")}
              value={stats.low_stock}
              tone={toneForLowStock(stats.low_stock)}
              to={canOpenCatalog ? "/products" : undefined}
            />
          </>
        ) : (
          Array.from({ length: 6 }, (_, i) => (
            <KpiCardSkeleton key={`kpi-skeleton-fallback-${i}`} />
          ))
        )}
      </section>

      {!activeLoading && dndRequests.length > 0 && (
        <section className="dnd-banner-urgent overflow-hidden rounded-xl border border-[color:var(--color-dnd-bg)] bg-white shadow-sm">
          <div className="flex items-center gap-2.5 border-b border-[color:var(--color-line)]/80 bg-[color:var(--color-row-dnd)]/70 px-3 py-2">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[color:var(--color-dnd-bg)]/20 text-[color:var(--color-dnd-fg)]">
              <PhoneCall className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-tight text-[color:var(--color-dnd-fg)]">
                {t("dashboard.front_desk_action")}
                <span className="ml-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-[color:var(--color-dnd-bg)] px-1.5 text-[11px] font-bold tabular-nums text-white">
                  {dndRequests.length}
                </span>
              </p>
              <p className="truncate text-[11px] leading-snug text-[color:var(--color-ink-soft)]">
                {t("dashboard.dnd_message")}
              </p>
            </div>
          </div>
          <ul className="divide-y divide-[color:var(--color-line)]/60">
            {dndRequests.map((r) => {
              const location = requestLocationHeadline(
                r.room,
                t,
                locationLabels,
                guestRooms,
                r.delivery_method,
              );
              const pendingCancel = isDndPendingAutoCancel(r);
              return (
                <li key={r.id}>
                  <Link
                    to={`/requests/${r.id}`}
                    className={clsx(
                      "group flex items-center gap-2.5 px-3 py-2.5 text-left no-underline outline-none transition-colors",
                      pendingCancel
                        ? "bg-[color:var(--color-paper-2)]/60 opacity-75 saturate-[0.45] hover:bg-[color:var(--color-paper-2)]"
                        : "hover:bg-[color:var(--color-row-dnd)]/25 focus-visible:bg-[color:var(--color-row-dnd)]/25",
                      "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--color-dnd-fg)]/20",
                    )}
                  >
                    <span
                      className={clsx(
                        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5",
                        "text-[10px] font-bold uppercase tracking-wide leading-none",
                        pendingCancel
                          ? "bg-[color:var(--color-paused-bg)] text-[color:var(--color-paused-fg)]"
                          : "bg-[color:var(--color-dnd-bg)] text-[color:var(--color-dnd-fg)] status-pill-dnd-blink",
                      )}
                    >
                      {pendingCancel ? t("requests.dnd_defer") : "DND"}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-[color:var(--color-ink)]">
                        {location}
                      </span>
                      <RequestItemsChips
                        items={r.items}
                        text={r.items_text}
                        layout="compact"
                        maxVisible={2}
                        className="min-w-0 text-xs"
                      />
                    </div>
                    <div className="hidden min-w-0 shrink-0 items-center gap-1.5 text-[11px] text-[color:var(--color-ink-muted)] sm:flex">
                      {r.assignee ? (
                        <span className="inline-flex max-w-[6rem] items-center gap-1 truncate">
                          <Avatar user={r.assignee} size="xs" className="shrink-0" />
                          <span className="truncate">{staffDisplayName(r.assignee.name)}</span>
                        </span>
                      ) : null}
                      <span className="shrink-0 tabular-nums whitespace-nowrap">
                        {pendingCancel
                          ? formatTimeRemainingSeconds(timeRemainingSeconds(r))
                          : formatScheduleClock(r.updated_at, i18n.language)}
                      </span>
                    </div>
                    <ChevronRight
                      className="h-4 w-4 shrink-0 text-[color:var(--color-ink-muted)] opacity-35 transition-opacity group-hover:opacity-80"
                      aria-hidden
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {StockAlert}

      <section className="flex flex-1 min-h-[18rem] flex-col rounded-xl border border-[color:var(--color-line)] bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="font-semibold">{t("dashboard.active_requests")}</h2>
          {(activeAlerts.rush ||
            activeAlerts.warning ||
            activeAlerts.overdue ||
            activeAlerts.staffCrisis) && (
            <div
              className="flex flex-wrap items-center justify-end gap-1.5"
              role="status"
              aria-live="polite"
            >
              {activeAlerts.staffCrisis && (
                <span className="dashboard-staff-crisis-badge text-[11px]">
                  🚨 {t("dashboard.active_alert_staff_crisis")}
                </span>
              )}
              {activeAlerts.rush && (
                <span className="rush-badge text-[11px]">
                  🚨 {t("dashboard.active_alert_rush")}
                </span>
              )}
              {activeAlerts.warning && (
                <span className="inline-flex items-center rounded-md bg-[color:var(--color-stock-low-bg)] px-2 py-0.5 text-[11px] font-semibold text-[color:var(--color-stock-low-fg)]">
                  {t("dashboard.active_alert_warning")}
                </span>
              )}
              {activeAlerts.overdue && (
                <span className="inline-flex items-center rounded-md bg-[color:var(--color-row-breach)] px-2 py-0.5 text-[11px] font-semibold text-[color:var(--color-pending-fg)]">
                  {t("dashboard.active_alert_overdue")}
                </span>
              )}
            </div>
          )}
        </div>
        {activeQuery.isError ? (
          <p className="text-sm text-red-600 px-4 py-8 text-center" role="alert">
            {t("dashboard.active_list_error")}
          </p>
        ) : (
          <RequestTable
            rows={active ?? []}
            showCode={false}
            loading={showActiveSkeleton}
            timeColumn="remaining"
            sortable
            animateClosing
            holdScheduledAtBottom
            activeSort={compareDashboardActiveRequests}
            emptyHint={t("dashboard.no_active_requests")}
            emptySubHint={t("dashboard.no_active_requests_sub")}
            fillHeight
          />
        )}
      </section>
    </div>
  );
}
