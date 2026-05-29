import { useTranslation } from "react-i18next";

import { useReportDisplayFormatters } from "../../hooks/useReportDisplayFormatters";
import { ProductItemIcon } from "../../lib/productIcons";
import { ReportDateTimeCell } from "./reportUi";
import { useDepartments } from "../../lib/departments";
import type { ExecutiveDashboardData } from "../../lib/reportTypes";
import {
  KpiCard,
  ReportBarRow,
  ReportDataTable,
  ReportSection,
} from "./reportUi";

type Props = { data: ExecutiveDashboardData };

export function ExecutiveDashboard({ data }: Props) {
  const { t, i18n } = useTranslation();
  const { departmentLabel } = useDepartments(true);
  const { displayProductName, translateEventTitle } = useReportDisplayFormatters();
  const { kpis, trends, forecast, dimensions } = data;

  const deptMax = Math.max(1, ...Object.values(dimensions.by_department));
  const statusMax = Math.max(1, ...Object.values(dimensions.by_status));
  const hourMax = Math.max(1, ...dimensions.by_hour.map((h) => h.count));
  const wdMax = Math.max(1, ...dimensions.by_weekday.map((w) => w.count));
  const dailyMax = Math.max(1, ...data.daily_volume.map((d) => d.count));

  return (
    <div className="space-y-8">
      <ReportSection title={t("reports.section.kpis")}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label={t("reports.kpi.total_requests")}
            value={kpis.total_requests}
            trend={{
              pct: Math.abs(trends.total_requests_pct),
              direction:
                trends.total_requests_pct > 0
                  ? "up"
                  : trends.total_requests_pct < 0
                    ? "down"
                    : "flat",
              good: trends.total_requests_pct >= 0,
              label: t("reports.vs_prev_period"),
            }}
          />
          <KpiCard
            label={t("reports.kpi.completion_rate")}
            value={`${kpis.completion_rate}`}
            unit="%"
            variant={kpis.completion_rate < 70 ? "warning" : "success"}
          />
          <KpiCard
            label={t("reports.avg_delivery")}
            value={kpis.avg_delivery_minutes}
            unit={t("reports.min")}
          />
          <KpiCard
            label={t("reports.overdue_today")}
            value={kpis.overdue}
            variant={kpis.overdue > 0 ? "danger" : "default"}
          />
          <KpiCard label={t("reports.kpi.open")} value={kpis.open} />
          <KpiCard label={t("reports.kpi.rush")} value={kpis.rush} variant="warning" />
          <KpiCard
            label={t("reports.delivered_today")}
            value={kpis.delivered_today}
            variant="success"
          />
          <KpiCard
            label={t("reports.kpi.stock_net")}
            value={kpis.net_stock_delta > 0 ? `+${kpis.net_stock_delta}` : kpis.net_stock_delta}
          />
        </div>
      </ReportSection>

      <ReportSection
        title={t("reports.section.forecast")}
        description={t("reports.section.forecast_desc")}
      >
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-[color:var(--color-line)] bg-gradient-to-br from-white to-[color:var(--color-paper-2)]/60 p-4">
            <p className="text-xs text-[color:var(--color-ink-muted)]">
              {t("reports.forecast.daily")}
            </p>
            <p className="mt-1 font-serif text-3xl font-semibold tabular-nums">
              ~{forecast.daily_requests}
            </p>
            <p className="mt-1 text-[11px] text-[color:var(--color-ink-soft)]">
              {t("reports.forecast.daily_hint")}
            </p>
          </div>
          <div className="rounded-xl border border-[color:var(--color-line)] bg-gradient-to-br from-white to-[color:var(--color-paper-2)]/60 p-4">
            <p className="text-xs text-[color:var(--color-ink-muted)]">
              {t("reports.forecast.weekly")}
            </p>
            <p className="mt-1 font-serif text-3xl font-semibold tabular-nums">
              ~{forecast.weekly_requests}
            </p>
            <p className="mt-1 text-[11px] text-[color:var(--color-ink-soft)]">
              {t("reports.forecast.weekly_hint")}
            </p>
          </div>
          <div className="rounded-xl border border-[color:var(--color-line)] bg-white p-4">
            <p className="mb-2 text-xs font-medium text-[color:var(--color-ink-muted)]">
              {t("reports.daily_volume")}
            </p>
            <div className="flex h-24 items-end gap-1">
              {data.daily_volume.map((day) => {
                const h = (day.count / dailyMax) * 100;
                return (
                  <div key={day.date} className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className="w-full rounded-t bg-[color:var(--color-ink)]/70"
                      style={{ height: `${Math.max(6, h)}%` }}
                      title={`${day.date}: ${day.count}`}
                    />
                    <span className="text-[8px] text-[color:var(--color-ink-muted)]">
                      {day.date.slice(-5)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </ReportSection>

      <div className="grid gap-6 lg:grid-cols-2">
        <ReportSection title={t("reports.by_dept")}>
          <div className="space-y-2 rounded-xl border border-[color:var(--color-line)] bg-white p-4">
            {Object.entries(dimensions.by_department).map(([k, v]) => (
              <ReportBarRow
                key={k}
                label={departmentLabel(k)}
                value={v}
                max={deptMax}
                barClass="bg-[color:var(--color-assigned-bg)]"
              />
            ))}
          </div>
        </ReportSection>
        <ReportSection title={t("reports.by_status")}>
          <div className="space-y-2 rounded-xl border border-[color:var(--color-line)] bg-white p-4">
            {Object.entries(dimensions.by_status).map(([k, v]) => (
              <ReportBarRow
                key={k}
                label={t(`status.${k}`, k)}
                value={v}
                max={statusMax}
                barClass="bg-[color:var(--color-delivered-bg)]"
              />
            ))}
          </div>
        </ReportSection>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ReportSection title={t("reports.busy_by_hour")}>
          <div className="rounded-xl border border-[color:var(--color-line)] bg-white p-4">
            <div className="flex h-32 items-end gap-0.5">
              {dimensions.by_hour.map((h) => (
                <div key={h.hour} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full rounded-sm bg-[color:var(--color-ink)]/60"
                    style={{
                      height: `${Math.max(4, (h.count / hourMax) * 100)}%`,
                    }}
                    title={`${h.hour}:00 — ${h.count}`}
                  />
                  <span className="text-[8px] text-[color:var(--color-ink-muted)]">
                    {h.hour % 4 === 0 ? h.hour : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </ReportSection>
        <ReportSection title={t("reports.busy_by_weekday")}>
          <div className="space-y-2 rounded-xl border border-[color:var(--color-line)] bg-white p-4">
            {dimensions.by_weekday.map((w) => (
              <ReportBarRow key={w.weekday} label={w.weekday} value={w.count} max={wdMax} />
            ))}
          </div>
        </ReportSection>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ReportSection title={t("reports.top_items")}>
          <div className="space-y-2 rounded-xl border border-[color:var(--color-line)] bg-white p-4">
            {data.top_items.map((it) => {
              const label = displayProductName(it.name, it.sku);
              return (
              <div key={it.name} className="flex items-center gap-2">
                {it.sku ? (
                  <ProductItemIcon sku={it.sku} name={label} size="xs" />
                ) : (
                  <span className="w-5" />
                )}
                <div className="min-w-0 flex-1">
                  <ReportBarRow
                    label={label}
                    value={it.qty}
                    max={Math.max(1, ...data.top_items.map((x) => x.qty))}
                    barClass="bg-[color:var(--color-stock-low-bg)]"
                  />
                </div>
              </div>
            );
            })}
          </div>
        </ReportSection>
        <ReportSection title={t("reports.presets.staff_workload")}>
          <ReportDataTable
            columns={[
              { key: "name", label: t("users.table.name") },
              { key: "delivered", label: t("reports.staff_delivered"), align: "right" },
              { key: "open", label: t("reports.staff_open"), align: "right" },
              { key: "avg", label: t("reports.avg_delivery"), align: "right" },
            ]}
            rows={data.staff_top.map((s) => ({
              name: s.name,
              delivered: s.delivered,
              open: s.open,
              avg: `${s.avg_delivery_minutes} ${t("reports.min")}`,
            }))}
            empty={t("reports.activity_empty")}
          />
        </ReportSection>
      </div>

      <ReportSection
        title={t("reports.section.recent_activity")}
        description={t("reports.section.recent_activity_desc")}
      >
        <ReportDataTable
          columns={[
            { key: "time", label: t("reports.log_time") },
            { key: "code", label: t("reports.request_code") },
            { key: "what", label: t("reports.log_what") },
            { key: "who", label: t("reports.log_who") },
          ]}
          rows={data.recent_timeline.map((e) => ({
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
      </ReportSection>
    </div>
  );
}
