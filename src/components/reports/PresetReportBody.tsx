import { useTranslation } from "react-i18next";
import clsx from "clsx";

import { useReportDisplayFormatters } from "../../hooks/useReportDisplayFormatters";
import { BrsReportsBody } from "./BrsReportsBody";
import { isBrsReportSlug } from "../../lib/brsReportSlugs";
import { ExecutiveDashboard } from "./ExecutiveDashboard";
import { ReportDataTable, ReportDateTimeCell } from "./reportUi";
import { ProductItemIcon } from "../../lib/productIcons";
import { relativeFromNow } from "../../lib/format";
import { useDepartments } from "../../lib/departments";
import type { ExecutiveDashboardData } from "../../lib/reportTypes";
import type { ReportSummary, StockAdjustmentRead } from "../../lib/types";

function Bar({
  label,
  value,
  max,
  color,
  sku,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  sku?: string;
}) {
  const pct = max > 0 ? Math.max(4, (value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="flex min-w-0 w-40 items-center gap-2 text-[color:var(--color-ink-soft)]">
        {sku !== undefined ? (
          <ProductItemIcon sku={sku} name={label} size="xs" />
        ) : null}
        <span className="truncate">{label}</span>
      </span>
      <div className="h-3 flex-1 overflow-hidden rounded-full bg-[color:var(--color-paper-2)]">
        <div className={clsx("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-10 text-right font-medium tabular-nums">{value}</span>
    </div>
  );
}

function StockRow({
  row,
  productLabel,
}: {
  row: StockAdjustmentRead;
  productLabel: string;
}) {
  const { t } = useTranslation();
  const deltaLabel = row.delta > 0 ? `+${row.delta}` : String(row.delta);
  return (
    <tr className="border-b border-[color:var(--color-line)] last:border-0">
      <td className="py-2 pr-2">
        <span className="inline-flex items-center gap-2">
          <ProductItemIcon sku={row.product_sku} name={productLabel} size="xs" />
          {productLabel}
        </span>
      </td>
      <td
        className={clsx(
          "py-2 pr-2 text-right font-semibold tabular-nums",
          row.delta < 0 ? "text-red-700" : "text-emerald-700",
        )}
      >
        {deltaLabel}
      </td>
      <td className="py-2 pr-2 text-[color:var(--color-ink-soft)]">
        {t(`reports.stock_reason.${row.reason}`, row.reason)}
      </td>
      <td className="py-2 text-right text-xs text-[color:var(--color-ink-muted)] whitespace-nowrap">
        {[row.actor_label, relativeFromNow(row.created_at)].filter(Boolean).join(" · ")}
      </td>
    </tr>
  );
}

type Props = {
  slug: string;
  data: Record<string, unknown>;
};

export function PresetReportBody({ slug, data }: Props) {
  const { t, i18n } = useTranslation();
  const { departmentLabel } = useDepartments(true);
  const { displayProductName, translateEventTitle } = useReportDisplayFormatters();
  if (isBrsReportSlug(slug)) {
    return <BrsReportsBody slug={slug} data={data} />;
  }

  if (slug === "executive-dashboard") {
    return <ExecutiveDashboard data={data as unknown as ExecutiveDashboardData} />;
  }

  if (slug === "operations-overview") {
    const d = data as unknown as ReportSummary & { period_days?: number };
    const deptMax = Math.max(1, ...Object.values(d.requests_by_dept ?? {}));
    const statusMax = Math.max(1, ...Object.values(d.requests_by_status ?? {}));
    const itemMax = Math.max(1, ...(d.top_items ?? []).map((i) => i.qty));
    const dailyMax = Math.max(1, ...(d.daily_volume ?? []).map((x) => x.count));
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-[color:var(--color-line)] bg-white p-4">
            <p className="text-xs text-[color:var(--color-ink-soft)]">{t("reports.avg_delivery")}</p>
            <p className="text-2xl font-semibold tabular-nums">
              {d.avg_delivery_minutes} <span className="text-base">{t("reports.min")}</span>
            </p>
          </div>
          <div className="rounded-xl border border-[color:var(--color-line)] bg-white p-4">
            <p className="text-xs text-[color:var(--color-ink-soft)]">{t("reports.delivered_today")}</p>
            <p className="text-2xl font-semibold tabular-nums">{d.delivered_today}</p>
          </div>
          <div className="rounded-xl border border-[color:var(--color-row-breach)]/60 bg-[color:var(--color-row-breach)]/40 p-4">
            <p className="text-xs text-[color:var(--color-ink-soft)]">{t("reports.overdue_today")}</p>
            <p className="text-2xl font-semibold tabular-nums">{d.overdue_today}</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-[color:var(--color-line)] bg-white p-4">
            <h3 className="mb-3 font-semibold">{t("reports.by_dept")}</h3>
            <div className="flex flex-col gap-2">
              {Object.entries(d.requests_by_dept ?? {}).map(([k, v]) => (
                <Bar
                  key={k}
                  label={departmentLabel(k)}
                  value={v}
                  max={deptMax}
                  color="bg-[color:var(--color-assigned-bg)]"
                />
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-[color:var(--color-line)] bg-white p-4">
            <h3 className="mb-3 font-semibold">{t("reports.by_status")}</h3>
            <div className="flex flex-col gap-2">
              {Object.entries(d.requests_by_status ?? {}).map(([k, v]) => (
                <Bar
                  key={k}
                  label={t(`status.${k}`, k)}
                  value={v}
                  max={statusMax}
                  color="bg-[color:var(--color-delivered-bg)]"
                />
              ))}
            </div>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-[color:var(--color-line)] bg-white p-4">
            <h3 className="mb-3 font-semibold">{t("reports.top_items")}</h3>
            <div className="flex flex-col gap-2">
              {(d.top_items ?? []).map((it) => {
                const row = it as { name: string; qty: number; sku?: string };
                return (
                <Bar
                  key={row.name}
                  label={displayProductName(row.name, row.sku)}
                  value={row.qty}
                  max={itemMax}
                  color="bg-[color:var(--color-stock-low-bg)]"
                  sku={row.sku}
                />
              );
              })}
            </div>
          </div>
          <div className="rounded-xl border border-[color:var(--color-line)] bg-white p-4">
            <h3 className="mb-3 font-semibold">{t("reports.daily_volume")}</h3>
            <div className="flex h-32 items-end gap-2">
              {(d.daily_volume ?? []).map((day) => {
                const h = (day.count / dailyMax) * 100;
                return (
                  <div key={day.date} className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className="w-full rounded-md bg-[color:var(--color-assigned-bg)]"
                      style={{ height: `${Math.max(4, h)}%` }}
                    />
                    <span className="text-[10px] text-[color:var(--color-ink-muted)]">{day.date}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (slug === "top-items") {
    const items = (data.items as { name: string; sku?: string; qty: number }[]) ?? [];
    const max = Math.max(1, ...items.map((i) => i.qty));
    return (
      <div className="rounded-xl border border-[color:var(--color-line)] bg-white p-4">
        <div className="flex flex-col gap-2">
          {items.map((it) => (
            <Bar
              key={it.name}
              label={displayProductName(it.name, it.sku)}
              sku={it.sku}
              value={it.qty}
              max={max}
              color="bg-[color:var(--color-stock-low-bg)]"
            />
          ))}
          {items.length === 0 && (
            <p className="text-sm text-[color:var(--color-ink-muted)]">—</p>
          )}
        </div>
      </div>
    );
  }

  if (slug === "busy-periods") {
    const byHour = (data.by_hour as { hour: number; count: number }[]) ?? [];
    const byWeekday = (data.by_weekday as { weekday: string; count: number }[]) ?? [];
    const hourMax = Math.max(1, ...byHour.map((h) => h.count));
    const wdMax = Math.max(1, ...byWeekday.map((w) => w.count));
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-[color:var(--color-line)] bg-white p-4">
          <h3 className="mb-3 font-semibold">{t("reports.busy_by_hour")}</h3>
          <div className="flex h-36 items-end gap-0.5">
            {byHour.map((h) => (
              <div key={h.hour} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-sm bg-[color:var(--color-assigned-bg)]"
                  style={{ height: `${Math.max(4, (h.count / hourMax) * 100)}%` }}
                  title={`${h.hour}:00 — ${h.count}`}
                />
                <span className="text-[9px] text-[color:var(--color-ink-muted)]">
                  {h.hour % 3 === 0 ? h.hour : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-[color:var(--color-line)] bg-white p-4">
          <h3 className="mb-3 font-semibold">{t("reports.busy_by_weekday")}</h3>
          <div className="flex flex-col gap-2">
            {byWeekday.map((w) => (
              <Bar
                key={w.weekday}
                label={w.weekday}
                value={w.count}
                max={wdMax}
                color="bg-[color:var(--color-delivered-bg)]"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (slug === "staff-workload") {
    const staff =
      (data.staff as {
        name: string;
        department?: string;
        delivered: number;
        open: number;
        avg_delivery_minutes: number;
      }[]) ?? [];
    return (
      <div className="overflow-x-auto rounded-xl border border-[color:var(--color-line)] bg-white">
        <table className="w-full min-w-[28rem] text-sm">
          <thead>
            <tr className="border-b border-[color:var(--color-line)] bg-[color:var(--color-paper-2)]/50 text-left text-xs text-[color:var(--color-ink-soft)]">
              <th className="px-3 py-2">{t("users.table.name")}</th>
              <th className="px-3 py-2">{t("users.table.department")}</th>
              <th className="px-3 py-2 text-right">{t("reports.staff_delivered")}</th>
              <th className="px-3 py-2 text-right">{t("reports.staff_open")}</th>
              <th className="px-3 py-2 text-right">{t("reports.avg_delivery")}</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((row) => (
              <tr key={row.name} className="border-b border-[color:var(--color-line)]/80">
                <td className="px-3 py-2 font-medium">{row.name}</td>
                <td className="px-3 py-2 text-[color:var(--color-ink-soft)]">
                  {departmentLabel(row.department)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{row.delivered}</td>
                <td className="px-3 py-2 text-right tabular-nums">{row.open}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {row.avg_delivery_minutes} {t("reports.min")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {staff.length === 0 && (
          <p className="p-4 text-sm text-[color:var(--color-ink-muted)]">—</p>
        )}
      </div>
    );
  }

  if (slug === "activity-log") {
    const entries =
      (data.entries as {
        created_at: string;
        actor_label: string;
        action: string;
        summary: string;
      }[]) ?? [];
    return (
      <ReportDataTable
        columns={[
          { key: "time", label: t("reports.log_time") },
          { key: "who", label: t("reports.log_who") },
          { key: "action", label: t("reports.log_action") },
        ]}
        rows={entries.map((e) => ({
          time: <ReportDateTimeCell iso={e.created_at} lang={i18n.language} />,
          who: e.actor_label,
          action:
            e.action === "auth.login"
              ? t("reports.activity_login")
              : e.action === "auth.logout"
                ? t("reports.activity_logout")
                : e.action,
        }))}
        empty={t("reports.activity_empty")}
        paginate
      />
    );
  }

  if (slug === "request-timeline") {
    const events =
      (data.events as {
        created_at: string;
        request_code: string;
        kind: string;
        title: string;
        actor_label: string;
      }[]) ?? [];
    return (
      <ReportDataTable
        columns={[
          { key: "time", label: t("reports.log_time") },
          { key: "code", label: t("reports.request_code") },
          { key: "what", label: t("reports.log_what") },
          { key: "who", label: t("reports.log_who") },
        ]}
        rows={events.map((e) => ({
          time: <ReportDateTimeCell iso={e.created_at} lang={i18n.language} />,
          code: <span className="font-mono text-xs">{e.request_code}</span>,
          what: translateEventTitle(e.title),
          who:
            e.actor_label === "System"
              ? t("requests.timeline_events.actor_system")
              : e.actor_label,
        }))}
        empty="—"
        paginate
      />
    );
  }

  if (slug === "sla-performance") {
    const d = data as {
      total?: number;
      delivered?: number;
      on_time_count?: number;
      on_time_rate?: number;
      avg_delivery_minutes?: number;
      overdue_open?: number;
      by_department?: Record<string, { total: number; delivered: number; on_time_rate: number }>;
    };
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-[color:var(--color-line)] bg-white p-4">
            <p className="text-xs text-[color:var(--color-ink-soft)]">{t("reports.sla_on_time_rate")}</p>
            <p className="text-2xl font-semibold tabular-nums">{d.on_time_rate ?? 0}%</p>
          </div>
          <div className="rounded-xl border border-[color:var(--color-line)] bg-white p-4">
            <p className="text-xs text-[color:var(--color-ink-soft)]">{t("reports.sla_on_time")}</p>
            <p className="text-2xl font-semibold tabular-nums">{d.on_time_count ?? 0}</p>
          </div>
          <div className="rounded-xl border border-[color:var(--color-line)] bg-white p-4">
            <p className="text-xs text-[color:var(--color-ink-soft)]">{t("reports.avg_delivery")}</p>
            <p className="text-2xl font-semibold tabular-nums">
              {d.avg_delivery_minutes ?? 0} {t("reports.min")}
            </p>
          </div>
          <div className="rounded-xl border border-[color:var(--color-row-breach)]/60 bg-[color:var(--color-row-breach)]/40 p-4">
            <p className="text-xs text-[color:var(--color-ink-soft)]">{t("reports.sla_overdue_open")}</p>
            <p className="text-2xl font-semibold tabular-nums">{d.overdue_open ?? 0}</p>
          </div>
        </div>
        <div className="rounded-xl border border-[color:var(--color-line)] bg-white p-4">
          <h3 className="mb-3 font-semibold">{t("reports.by_dept")}</h3>
          <div className="flex flex-col gap-2">
            {Object.entries(d.by_department ?? {}).map(([k, v]) => (
              <Bar
                key={k}
                label={`${departmentLabel(k)} · ${v.on_time_rate}%`}
                value={v.delivered}
                max={Math.max(1, ...Object.values(d.by_department ?? {}).map((x) => x.delivered))}
                color="bg-[color:var(--color-delivered-bg)]"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (slug === "status-breakdown" || slug === "delivery-methods") {
    const key = slug === "status-breakdown" ? "by_status" : "by_method";
    const extra =
      slug === "status-breakdown"
        ? [
            ["by_priority", t("reports.by_priority", "Priority")],
            ["by_delivery_method", t("reports.by_delivery_method")],
          ]
        : [];
    const entries = Object.entries(
      (data[key] as Record<string, number>) ?? {},
    );
    const max = Math.max(1, ...entries.map(([, v]) => v));
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-[color:var(--color-line)] bg-white p-4">
          <h3 className="mb-3 font-semibold">
            {slug === "status-breakdown" ? t("reports.by_status") : t("reports.by_delivery_method")}
          </h3>
          <div className="flex flex-col gap-2">
            {entries.map(([k, v]) => (
              <Bar
                key={k}
                label={
                  slug === "status-breakdown"
                    ? t(`status.${k}`, k)
                    : t(`delivery.${k}`, k)
                }
                value={v}
                max={max}
                color="bg-[color:var(--color-assigned-bg)]"
              />
            ))}
          </div>
        </div>
        {extra.map(([field, title]) => {
          const rows = Object.entries((data[field] as Record<string, number>) ?? {});
          const m = Math.max(1, ...rows.map(([, v]) => v));
          return (
            <div
              key={field}
              className="rounded-xl border border-[color:var(--color-line)] bg-white p-4"
            >
              <h3 className="mb-3 font-semibold">{title}</h3>
              <div className="flex flex-col gap-2">
                {rows.map(([k, v]) => (
                  <Bar
                    key={k}
                    label={field.includes("priority") ? t(`priority.${k}`, k) : k}
                    value={v}
                    max={m}
                    color="bg-[color:var(--color-delivered-bg)]"
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (slug === "priority-analysis") {
    const d = data as {
      rush_count?: number;
      normal_count?: number;
      rush_pct?: number;
      rush_avg_minutes?: number;
      normal_avg_minutes?: number;
    };
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-[color:var(--color-line)] bg-white p-4">
            <p className="text-xs text-[color:var(--color-ink-soft)]">{t("reports.rush_share")}</p>
            <p className="text-2xl font-semibold tabular-nums">{d.rush_pct ?? 0}%</p>
          </div>
          <div className="rounded-xl border border-[color:var(--color-line)] bg-white p-4">
            <p className="text-xs text-[color:var(--color-ink-soft)]">{t("reports.rush_avg")}</p>
            <p className="text-2xl font-semibold tabular-nums">
              {d.rush_avg_minutes ?? 0} {t("reports.min")}
            </p>
          </div>
          <div className="rounded-xl border border-[color:var(--color-line)] bg-white p-4">
            <p className="text-xs text-[color:var(--color-ink-soft)]">{t("reports.normal_avg")}</p>
            <p className="text-2xl font-semibold tabular-nums">
              {d.normal_avg_minutes ?? 0} {t("reports.min")}
            </p>
          </div>
        </div>
        <p className="text-sm text-[color:var(--color-ink-soft)]">
          {t("priority.rush")}: {d.rush_count ?? 0} · {t("priority.normal")}: {d.normal_count ?? 0}
        </p>
      </div>
    );
  }

  if (slug === "department-comparison") {
    const rows =
      (data.departments as {
        department: string;
        total: number;
        delivered: number;
        open: number;
        cancelled: number;
        rush: number;
      }[]) ?? [];
    return (
      <div className="overflow-x-auto rounded-xl border border-[color:var(--color-line)] bg-white">
        <table className="w-full min-w-[36rem] text-sm">
          <thead>
            <tr className="border-b border-[color:var(--color-line)] bg-[color:var(--color-paper-2)]/50 text-left text-xs text-[color:var(--color-ink-soft)]">
              <th className="px-3 py-2">{t("users.table.department")}</th>
              <th className="px-3 py-2 text-right">{t("reports.kpi.total_requests")}</th>
              <th className="px-3 py-2 text-right">{t("reports.staff_delivered")}</th>
              <th className="px-3 py-2 text-right">{t("reports.staff_open")}</th>
              <th className="px-3 py-2 text-right">{t("status.cancelled")}</th>
              <th className="px-3 py-2 text-right">{t("priority.rush")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.department} className="border-b border-[color:var(--color-line)]/80">
                <td className="px-3 py-2 font-medium">{departmentLabel(row.department)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{row.total}</td>
                <td className="px-3 py-2 text-right tabular-nums">{row.delivered}</td>
                <td className="px-3 py-2 text-right tabular-nums">{row.open}</td>
                <td className="px-3 py-2 text-right tabular-nums">{row.cancelled}</td>
                <td className="px-3 py-2 text-right tabular-nums">{row.rush}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (slug === "room-demand") {
    const rooms = (data.rooms as { room: string; count: number }[]) ?? [];
    const max = Math.max(1, ...rooms.map((r) => r.count));
    return (
      <div className="rounded-xl border border-[color:var(--color-line)] bg-white p-4">
        <div className="flex flex-col gap-2">
          {rooms.map((r) => (
            <Bar
              key={r.room}
              label={r.room}
              value={r.count}
              max={max}
              color="bg-[color:var(--color-assigned-bg)]"
            />
          ))}
          {rooms.length === 0 && (
            <p className="text-sm text-[color:var(--color-ink-muted)]">—</p>
          )}
        </div>
      </div>
    );
  }

  if (slug === "cancellation-summary") {
    const d = data as {
      cancelled?: number;
      dnd?: number;
      cancel_rate?: number;
      dnd_rate?: number;
      delivered?: number;
      total?: number;
    };
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-[color:var(--color-line)] bg-white p-4">
            <p className="text-xs text-[color:var(--color-ink-soft)]">{t("reports.cancel_rate")}</p>
            <p className="text-2xl font-semibold tabular-nums">{d.cancel_rate ?? 0}%</p>
          </div>
          <div className="rounded-xl border border-[color:var(--color-line)] bg-white p-4">
            <p className="text-xs text-[color:var(--color-ink-soft)]">{t("reports.dnd_rate")}</p>
            <p className="text-2xl font-semibold tabular-nums">{d.dnd_rate ?? 0}%</p>
          </div>
          <div className="rounded-xl border border-[color:var(--color-line)] bg-white p-4">
            <p className="text-xs text-[color:var(--color-ink-soft)]">{t("status.cancelled")}</p>
            <p className="text-2xl font-semibold tabular-nums">{d.cancelled ?? 0}</p>
          </div>
          <div className="rounded-xl border border-[color:var(--color-line)] bg-white p-4">
            <p className="text-xs text-[color:var(--color-ink-soft)]">{t("status.dnd")}</p>
            <p className="text-2xl font-semibold tabular-nums">{d.dnd ?? 0}</p>
          </div>
        </div>
      </div>
    );
  }

  if (slug === "volume-trend") {
    const daily = (data.daily_volume as { date: string; count: number }[]) ?? [];
    const max = Math.max(1, ...daily.map((x) => x.count));
    const d = data as { avg_daily?: number; peak_daily?: number };
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-[color:var(--color-line)] bg-white p-4">
            <p className="text-xs text-[color:var(--color-ink-soft)]">{t("reports.avg_daily")}</p>
            <p className="text-2xl font-semibold tabular-nums">{d.avg_daily ?? 0}</p>
          </div>
          <div className="rounded-xl border border-[color:var(--color-line)] bg-white p-4">
            <p className="text-xs text-[color:var(--color-ink-soft)]">{t("reports.peak_daily")}</p>
            <p className="text-2xl font-semibold tabular-nums">{d.peak_daily ?? 0}</p>
          </div>
        </div>
        <div className="rounded-xl border border-[color:var(--color-line)] bg-white p-4">
          <h3 className="mb-3 font-semibold">{t("reports.daily_volume")}</h3>
          <div className="flex h-36 items-end gap-1">
            {daily.map((day) => (
              <div key={day.date} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-sm bg-[color:var(--color-assigned-bg)]"
                  style={{ height: `${Math.max(4, (day.count / max) * 100)}%` }}
                />
                <span className="text-[9px] text-[color:var(--color-ink-muted)]">{day.date}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (slug === "inventory-health") {
    const low =
      (data.low_stock as {
        sku: string;
        name: string;
        on_hand: number;
        reorder_at: number | null;
      }[]) ?? [];
    const out =
      (data.out_of_stock as { sku: string; name: string; department: string }[]) ?? [];
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-[color:var(--color-line)] bg-white p-4">
            <p className="text-xs text-[color:var(--color-ink-soft)]">{t("reports.net_stock_delta")}</p>
            <p className="text-2xl font-semibold tabular-nums">{data.net_stock_delta as number}</p>
          </div>
          <div className="rounded-xl border border-[color:var(--color-line)] bg-white p-4">
            <p className="text-xs text-[color:var(--color-ink-soft)]">{t("reports.movement_count")}</p>
            <p className="text-2xl font-semibold tabular-nums">{data.movement_count as number}</p>
          </div>
        </div>
        <div className="rounded-xl border border-[color:var(--color-line)] bg-white p-4">
          <h3 className="mb-2 font-semibold">{t("reports.low_stock_title")}</h3>
          {low.length === 0 ? (
            <p className="text-sm text-[color:var(--color-ink-muted)]">—</p>
          ) : (
            <ul className="text-sm space-y-1">
              {low.map((p) => (
                <li key={p.sku}>
                  {p.name} — {p.on_hand} / {p.reorder_at ?? "—"}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-xl border border-[color:var(--color-line)] bg-white p-4">
          <h3 className="mb-2 font-semibold">{t("reports.out_of_stock_title")}</h3>
          {out.length === 0 ? (
            <p className="text-sm text-[color:var(--color-ink-muted)]">—</p>
          ) : (
            <ul className="text-sm space-y-1">
              {out.map((p) => (
                <li key={p.sku}>{p.name}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }

  if (slug === "stock-movements") {
    const rows = (data.adjustments as StockAdjustmentRead[]) ?? [];
    return (
      <div className="overflow-x-auto rounded-xl border border-[color:var(--color-line)] bg-white">
        <table className="w-full min-w-[32rem] text-sm">
          <thead>
            <tr className="border-b border-[color:var(--color-line)] bg-[color:var(--color-paper-2)]/50 text-left text-xs text-[color:var(--color-ink-soft)]">
              <th className="px-3 py-2">{t("reports.stock_product")}</th>
              <th className="px-3 py-2 text-right">{t("reports.stock_delta")}</th>
              <th className="px-3 py-2">{t("reports.stock_reason_col")}</th>
              <th className="px-3 py-2 text-right">{t("reports.log_who")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <StockRow
                key={row.id}
                row={row}
                productLabel={displayProductName(row.product_name, row.product_sku)}
              />
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="p-4 text-sm text-[color:var(--color-ink-muted)]">
            {t("reports.stock_adjustments_empty")}
          </p>
        )}
      </div>
    );
  }

  return <p className="text-sm text-[color:var(--color-ink-muted)]">—</p>;
}
