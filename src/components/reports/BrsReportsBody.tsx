import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { useReportDisplayFormatters } from "../../hooks/useReportDisplayFormatters";

import { useReportsHubContext } from "../../lib/ReportsHubContext";
import { useDepartments } from "../../lib/departments";
import { CHART, seriesLineColor, timelineKindColor } from "../../lib/reportChartTheme";
import {
  formatPeriodRangeShort,
  periodDaysInclusive,
  truncateLabel,
  weekPeriodLabels,
} from "../../lib/reportFormat";
import { requestStatusReportTone } from "../../lib/format";
import { pauseReasonLabel } from "../../lib/pauseReason";
import { heatmapLegendLabels } from "../../lib/reportChartsI18n";
import { BrsReportLayout } from "./brsLayout";
import {
  BrsKpiRow,
  hasPriorPeriodData,
  type MetricDelta,
  slaStatus,
  useBrsFormatters,
} from "./brsKpi";
import {
  ActivityCountFunnel,
  ChartPrimaryRow,
  ChartSecondaryRow,
  ChartShell,
  ColumnChart,
  CompareBars,
  DonutChart,
  FunnelChart,
  HourHeatmap,
  HorizontalBars,
  LineChart,
  ReportChartGrid,
  SlaSplitPowerBar,
  SlaWeeklyRateChart,
  StaffScatterChart,
  StackedBarChart,
  UrgencyBar,
  WeeklyDeliveryOverview,
  WorkloadDeviationBars,
} from "./reportCharts";
import { ProductItemIcon } from "../../lib/productIcons";
import type { StockAdjustmentRead } from "../../lib/types";
import {
  ReportDataTable,
  ReportDateTimeCell,
  ReportEmptyState,
  ReportSection,
  StatusPill,
  StockDeltaCell,
  reportTableRow,
  type KpiStatus,
} from "./reportUi";

export { isBrsReportSlug } from "../../lib/brsReportSlugs";

type Props = { slug: string; data: Record<string, unknown> };

function num(v: unknown, fallback = 0): number {
  return typeof v === "number" ? v : fallback;
}

function kpi(data: Record<string, unknown>, key: string): MetricDelta | undefined {
  const block = data.kpi_compare as Record<string, MetricDelta> | undefined;
  return block?.[key];
}

const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

function hourCounts(rec: Record<string, number>): Record<number, number> {
  const out: Record<number, number> = {};
  for (let h = 0; h < 24; h += 1) out[h] = Number(rec[String(h)] ?? 0);
  return out;
}

function hasRows(rows: unknown[]): boolean {
  return rows.length > 0;
}

function requestNameCell(name: string, code?: string) {
  const title = code && code !== name ? `${name} (${code})` : name;
  return (
    <span className="block min-w-0 max-w-md text-sm leading-snug text-[color:var(--color-ink)] line-clamp-2" title={title}>
      {name}
    </span>
  );
}

const CANCEL_STAGE_ORDER = ["pending", "assigned", "in_progress"] as const;

/** Per-week KPI cards only for very short ranges; charts cap bars for readability. */
const WEEKLY_KPI_CARD_MAX = 3;
const WEEKLY_CHART_BAR_MAX = 20;

const TIMELINE_KIND_ORDER = [
  "created",
  "auto_assigned",
  "reassigned",
  "accepted",
  "started",
  "paused",
  "resumed",
  "rushed",
  "unrushed",
  "delivered",
  "dnd_reported",
  "dnd_cleared",
  "dnd_defer",
  "cancelled",
  "note",
] as const;

const TIMELINE_CATEGORY_ORDER = ["intake", "assignment", "execution", "completion", "dnd", "closure"] as const;

function timelineKindTone(kind: string): "success" | "warning" | "danger" | "info" | "neutral" {
  if (kind === "delivered") return "success";
  if (kind === "cancelled") return "danger";
  if (kind.startsWith("dnd") || kind === "paused") return "warning";
  if (kind === "created" || kind === "auto_assigned" || kind === "accepted" || kind === "started") return "info";
  return "neutral";
}

function brsStatusLabel(t: TFunction, status: KpiStatus): string {
  const key =
    status === "on_track" ? "status_on_track" : status === "warning" ? "status_watch" : "status_critical";
  return t(`reports.brs.${key}`);
}

function dndActionTone(action: string): "success" | "warning" | "danger" | "info" | "neutral" {
  if (action === "proceed") return "success";
  if (action === "cancelled") return "danger";
  if (action === "unresolved") return "danger";
  return "warning";
}

type TimelineRecentEvent = {
  created_at: string;
  request_code: string;
  request_name?: string;
  kind: string;
  title: string;
  actor_label: string;
};

export function BrsReportsBody({ slug, data }: Props) {
  const { t, i18n } = useTranslation();
  const { returnTo, reportPage, setReportPage } = useReportsHubContext();
  const { departmentLabel } = useDepartments(true);
  const priorCompareRange =
    slug === "sla-compliance" || slug === "month-over-month-comparison"
      ? (data.previous_period as { from?: string; to?: string } | undefined)
      : undefined;
  const f = useBrsFormatters(priorCompareRange);
  const {
    displayRoom,
    displayRequestName,
    displayProductName,
    translateEventTitle,
    translateDetail,
  } = useReportDisplayFormatters();
  const heatLegend = heatmapLegendLabels(t);

  const reqCodeCell = (r: { id?: number; code: string }) =>
    r.id != null ? (
      <Link
        to={`/requests/${r.id}`}
        state={{ returnTo }}
        className="font-mono text-xs whitespace-nowrap text-[color:var(--color-ink)] hover:text-[color:var(--color-delivered-fg)] hover:underline"
      >
        {r.code}
      </Link>
    ) : (
      <span className="font-mono text-xs whitespace-nowrap text-[color:var(--color-ink)]">{r.code}</span>
    );

  const requestNameLink = (r: { id?: number; code: string; name?: string }) =>
    r.id != null ? (
      <Link
        to={`/requests/${r.id}`}
        state={{ returnTo }}
        className="block min-w-0 text-[color:var(--color-ink)] hover:text-[color:var(--color-delivered-fg)] hover:underline"
      >
        {requestNameCell(displayRequestName(r.name?.trim() || r.code))}
      </Link>
    ) : (
      requestNameCell(displayRequestName(r.name?.trim() || r.code))
    );

  if (slug === "sla-compliance") {
    const weekly = (data.weekly_trend ?? []) as {
      period?: string;
      week_start?: string;
      week_end?: string;
      label?: string;
      on_time: number;
      breached: number;
      rate: number;
    }[];
    const weekLabel = (w: (typeof weekly)[number]) => weekPeriodLabels(w, i18n.language);
    const deptTable = (data.dept_table ?? []) as {
      department: string;
      compliance_rate: number;
      breached: number;
      delivered: number;
      breach_rate: number;
    }[];
    const rate = num(data.compliance_rate);
    const target = num(data.target_compliance_rate, 95);
    const st = slaStatus(rate, target);
    const split = data.status_split as { on_time?: number; breached?: number } | undefined;
    const curPeriod = data.current_period as { from?: string; to?: string } | undefined;
    const prevPeriod = data.previous_period as { from?: string; to?: string } | undefined;
    const curFrom = curPeriod?.from?.slice(0, 10) ?? String(data.range_from ?? "").slice(0, 10);
    const curTo = curPeriod?.to?.slice(0, 10) ?? String(data.range_to ?? "").slice(0, 10);
    const prevFrom = prevPeriod?.from?.slice(0, 10);
    const prevTo = prevPeriod?.to?.slice(0, 10);
    const compareNote =
      curFrom && curTo && prevFrom && prevTo
        ? t("reports.brs.sla_compare_periods_note", {
            current: formatPeriodRangeShort(curFrom, curTo, i18n.language),
            previous: formatPeriodRangeShort(prevFrom, prevTo, i18n.language),
            days: periodDaysInclusive(prevFrom, prevTo),
          })
        : undefined;

    const SLA_BREACH_TABLE_ID = "sla-breach-requests";
    const SLA_DELIVERED_TABLE_ID = "sla-delivered-requests";
    const breachedRows = (data.breached_requests ?? []) as {
      id?: number;
      code: string;
      name?: string;
      department: string;
      delivered_at: string;
      breach_minutes: number;
      total_minutes: number;
      sla_minutes: number;
    }[];
    const deliveredRows = (data.delivered_requests ?? []) as {
      id?: number;
      code: string;
      name?: string;
      department: string;
      delivered_at: string;
      breach_minutes: number;
      on_time: boolean;
    }[];
    const breachedTotal = num(data.breached_requests_total ?? data.breach_count);
    const deliveredTotal = num(data.delivered_requests_total ?? data.total_delivered);
    const rowCapped = data.row_limit_capped === true;

    return (
      <BrsReportLayout>
        <BrsKpiRow
          items={[
            {
              label: t("reports.brs.sla_compliance_rate"),
              value: f.pct(rate),
              trend: f.trend(kpi(data, "compliance_rate"), true),
              target: `${t("reports.brs.target")}: ${f.pct(target)}`,
              status: st,
              statusLabel: brsStatusLabel(t, st),
              variant: rate >= target ? "success" : rate >= target - 8 ? "warning" : "danger",
            },
            {
              label: t("reports.brs.sla_breaches"),
              value: f.count(num(data.breach_count)),
              trend: f.trend(kpi(data, "breach_count"), false),
              variant: "danger",
              scrollToId: SLA_BREACH_TABLE_ID,
            },
            {
              label: t("reports.brs.avg_breach_minutes"),
              value: f.min(num(data.avg_breach_minutes)),
              trend: f.trend(kpi(data, "avg_breach_minutes"), false),
            },
            {
              label: t("reports.brs.total_delivered"),
              value: f.count(num(data.total_delivered)),
              scrollToId: SLA_DELIVERED_TABLE_ID,
            },
          ]}
        />
        {compareNote ? (
          <p className="text-xs leading-relaxed text-[color:var(--color-ink-muted)]">{compareNote}</p>
        ) : null}
        {weekly.length > 0 && weekly.length <= WEEKLY_KPI_CARD_MAX ? (
          <ChartShell
            title={t("reports.brs.weekly_delivery_overview")}
            description={t("reports.brs.weekly_delivery_overview_desc")}
          >
            <WeeklyDeliveryOverview
              periods={weekly.map((w) => {
                const { label, title } = weekLabel(w);
                return {
                  label,
                  title,
                  onTime: w.on_time,
                  breached: w.breached,
                  rate: w.rate,
                };
              })}
              targetPct={target}
              labels={{
                week: t("reports.brs.week_label"),
                onTime: t("reports.brs.on_time"),
                breached: t("reports.brs.breached"),
                rate: t("reports.brs.sla_compliance_rate"),
                target: t("reports.brs.target"),
                volumeChart: t("reports.brs.weekly_sla_stacked"),
                rateChart: t("reports.brs.weekly_rate_chart"),
                belowTarget: t("reports.brs.below_target"),
                onTarget: t("reports.brs.on_target"),
              }}
            />
          </ChartShell>
        ) : null}
        {weekly.length > WEEKLY_KPI_CARD_MAX ? (
          <>
            {weekly.length > WEEKLY_CHART_BAR_MAX ? (
              <p className="text-sm text-[color:var(--color-ink-muted)]">
                {t("reports.brs.weekly_chart_trimmed", {
                  shown: WEEKLY_CHART_BAR_MAX,
                  total: weekly.length,
                })}
              </p>
            ) : null}
            {(() => {
              const chartWeeks =
                weekly.length > WEEKLY_CHART_BAR_MAX
                  ? weekly.slice(-WEEKLY_CHART_BAR_MAX)
                  : weekly;
              const monthView = chartWeeks.length <= 6;
              const periodRows = chartWeeks.map((w) => {
                const { label, title } = weekLabel(w);
                return {
                  label,
                  title,
                  onTime: w.on_time,
                  breached: w.breached,
                  rate: w.rate,
                };
              });
              return (
                <div
                  className={
                    monthView
                      ? "flex flex-col gap-4"
                      : chartWeeks.length <= 8
                        ? "grid grid-cols-1 gap-4 xl:grid-cols-2"
                        : "flex flex-col gap-4"
                  }
                >
                  <div className="min-w-0 w-full">
                    <ChartShell
                      title={t("reports.brs.weekly_sla_stacked")}
                      yLabel={monthView ? undefined : t("reports.brs.request_count")}
                      xLabel={t("reports.brs.period")}
                      legend={[
                        { label: t("reports.brs.on_time"), color: CHART.success },
                        { label: t("reports.brs.breached"), color: CHART.danger },
                      ]}
                    >
                      <StackedBarChart
                        periods={periodRows.map((r) => ({
                          label: r.label,
                          title: r.title,
                          onTime: r.onTime,
                          breached: r.breached,
                        }))}
                      />
                    </ChartShell>
                  </div>
                  <div className="min-w-0 w-full">
                    <ChartShell
                      title={t("reports.brs.weekly_rate_chart")}
                      description={t("reports.brs.weekly_rate_desc")}
                      xLabel={t("reports.brs.period")}
                    >
                      <SlaWeeklyRateChart
                        periods={periodRows.map((r) => ({
                          label: r.label,
                          title: r.title,
                          rate: r.rate,
                        }))}
                        targetPct={target}
                      />
                    </ChartShell>
                  </div>
                </div>
              );
            })()}
            <ReportSection
              title={t("reports.brs.weekly_detail_table")}
              description={t("reports.brs.weekly_detail_table_desc")}
            >
              <ReportDataTable
                columns={[
                  { key: "period", label: t("reports.brs.week_period") },
                  { key: "rate", label: t("reports.brs.sla_compliance_rate"), align: "right" },
                  { key: "on_time", label: t("reports.brs.on_time"), align: "right" },
                  { key: "breached", label: t("reports.brs.breached"), align: "right" },
                  { key: "total", label: t("reports.brs.week_total"), align: "right" },
                  { key: "status", label: t("reports.filter_status") },
                ]}
                rows={[...weekly].reverse().map((w) => {
                  const { title } = weekLabel(w);
                  const total = w.on_time + w.breached;
                  const meets = w.rate >= target;
                  return {
                    period: title,
                    rate: f.pct(w.rate),
                    on_time: f.count(w.on_time),
                    breached: f.count(w.breached),
                    total: f.count(total),
                    status: (
                      <StatusPill tone={meets ? "success" : "warning"}>
                        {meets ? t("reports.brs.on_target") : t("reports.brs.below_target")}
                      </StatusPill>
                    ),
                  };
                })}
                empty={t("reports.no_data")}
                paginate
              />
            </ReportSection>
          </>
        ) : null}
        <div className="grid grid-cols-12 items-start gap-4">
          <div className="col-span-12 xl:col-span-5">
            <ChartShell title={t("reports.brs.sla_split")} description={t("reports.brs.sla_split_desc")}>
              <SlaSplitPowerBar
                onTime={num(split?.on_time)}
                breached={num(split?.breached)}
                centerValue={f.pct(rate)}
                centerLabel={t("reports.brs.sla_compliance_rate")}
                labels={{
                  onTime: t("reports.brs.on_time"),
                  breached: t("reports.brs.breached"),
                }}
              />
            </ChartShell>
          </div>
          <div className="col-span-12 xl:col-span-7">
            <ReportSection
              title={t("reports.brs.dept_summary_table")}
              description={t("reports.brs.dept_summary_table_desc")}
            >
              <ReportDataTable
                columns={[
                  { key: "department", label: t("reports.filter_department") },
                  { key: "delivered", label: t("reports.brs.completed"), align: "right" },
                  { key: "compliance_rate", label: t("reports.sla_on_time_rate"), align: "right" },
                  { key: "breached", label: t("reports.brs.breached"), align: "right" },
                  { key: "breach_rate", label: t("reports.brs.breach_rate"), align: "right" },
                ]}
                rows={deptTable.map((r) => ({
                  department: departmentLabel(r.department),
                  delivered: f.count(r.delivered),
                  compliance_rate: f.pct(r.compliance_rate),
                  breached: f.count(r.breached),
                  breach_rate: f.pct(r.breach_rate),
                }))}
                empty={t("reports.no_data")}
              />
            </ReportSection>
          </div>
        </div>
        <ChartPrimaryRow>
          <ReportSection
            id={SLA_BREACH_TABLE_ID}
            title={t("reports.brs.sla_breach_list_title")}
            description={t("reports.brs.sla_breach_list_desc")}
          >
            <ReportDataTable
              columns={[
                { key: "delivered_at", label: t("reports.brs.when") },
                { key: "code", label: t("reports.brs.req_number") },
                { key: "name", label: t("reports.brs.request_name") },
                { key: "department", label: t("reports.filter_department") },
                { key: "breach_minutes", label: t("reports.brs.breach_over_minutes"), align: "right" },
                { key: "total_minutes", label: t("reports.brs.total_delivery_minutes"), align: "right" },
              ]}
              rows={breachedRows.map((r) => ({
                delivered_at: r.delivered_at ? (
                  <ReportDateTimeCell iso={r.delivered_at} lang={i18n.language} />
                ) : (
                  "—"
                ),
                code: reqCodeCell(r),
                name: requestNameLink(r),
                department: departmentLabel(r.department),
                breach_minutes: (
                  <span className="font-medium text-red-700 tabular-nums">{f.min(r.breach_minutes)}</span>
                ),
                total_minutes: f.min(r.total_minutes),
              }))}
              empty={t("reports.no_data")}
              paginate
            />
            {rowCapped && breachedTotal > breachedRows.length ? (
              <p className="mt-2 text-xs text-[color:var(--color-ink-muted)]">
                {t("reports.filter_rows", { count: num(data.breach_row_limit) })}
              </p>
            ) : null}
          </ReportSection>
        </ChartPrimaryRow>
        <ChartPrimaryRow>
          <ReportSection
            id={SLA_DELIVERED_TABLE_ID}
            title={t("reports.brs.sla_delivered_list_title")}
            description={t("reports.brs.sla_delivered_list_desc")}
          >
            <ReportDataTable
              columns={[
                { key: "delivered_at", label: t("reports.brs.when") },
                { key: "code", label: t("reports.brs.req_number") },
                { key: "name", label: t("reports.brs.request_name") },
                { key: "department", label: t("reports.filter_department") },
                { key: "status", label: t("reports.filter_status") },
                { key: "breach_minutes", label: t("reports.brs.breach_over_minutes"), align: "right" },
              ]}
              rows={deliveredRows.map((r) => ({
                delivered_at: r.delivered_at ? (
                  <ReportDateTimeCell iso={r.delivered_at} lang={i18n.language} />
                ) : (
                  "—"
                ),
                code: reqCodeCell(r),
                name: requestNameLink(r),
                department: departmentLabel(r.department),
                status: (
                  <StatusPill tone={r.on_time ? "success" : "danger"}>
                    {r.on_time ? t("reports.brs.on_time") : t("reports.brs.breached")}
                  </StatusPill>
                ),
                breach_minutes: r.on_time ? "—" : f.min(r.breach_minutes),
              }))}
              empty={t("reports.no_data")}
              paginate
            />
            {rowCapped && deliveredTotal > deliveredRows.length ? (
              <p className="mt-2 text-xs text-[color:var(--color-ink-muted)]">
                {t("reports.filter_rows", { count: num(data.delivered_row_limit) })}
              </p>
            ) : null}
          </ReportSection>
        </ChartPrimaryRow>
      </BrsReportLayout>
    );
  }

  if (slug === "response-time-analysis") {
    const stages = (data.stage_stats ?? {}) as Record<string, { avg: number; p50: number; p90: number; p95: number }>;
    const byHourAvg = hourCounts((data.by_hour_avg_total ?? {}) as Record<string, number>);
    const byHourN = hourCounts((data.by_hour_delivered_count ?? {}) as Record<string, number>);
    const peakHourAvg = data.peak_hour_avg as number | null | undefined;
    const outliers = (data.outliers ?? []) as {
      id?: number;
      code: string;
      name?: string;
      total_minutes: number;
      department: string;
    }[];
    const outliersTotal = num(data.outliers_total, outliers.length);
    const funnelStages = Object.entries(stages).map(([k, v]) => ({
      label: t(`reports.brs.stage_timing.${k}`, k),
      value: v.avg,
      stats: { p50: v.p50, p90: v.p90, p95: v.p95 },
    }));

    const RESPONSE_TIME_OUTLIERS_TABLE_ID = "response-time-outliers-table";

    const outlierRows = outliers.map((r) => ({
      code:
        r.id != null ? (
          <Link
            to={`/requests/${r.id}`}
            state={{ returnTo }}
            className="font-mono text-xs font-medium text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-delivered-fg)] hover:underline"
          >
            {r.code}
          </Link>
        ) : (
          <span className="font-mono text-xs text-[color:var(--color-ink-soft)]">{r.code}</span>
        ),
      name:
        r.id != null ? (
          <Link
            to={`/requests/${r.id}`}
            state={{ returnTo }}
            className="block min-w-0 text-[color:var(--color-ink)] hover:text-[color:var(--color-delivered-fg)] hover:underline"
          >
            {requestNameCell(displayRequestName(r.name?.trim() || r.code))}
          </Link>
        ) : (
          requestNameCell(displayRequestName(r.name?.trim() || r.code))
        ),
      department: departmentLabel(r.department),
      total_minutes: f.min(r.total_minutes),
    }));

    return (
      <BrsReportLayout>
        <BrsKpiRow
          items={[
            { label: t("reports.brs.end_to_end_avg"), value: f.min(num(data.sla_end_to_end_avg)) },
            {
              label: t("reports.brs.outliers"),
              value: f.count(outliersTotal),
              target: outliersTotal > 0 ? t("reports.brs.outliers_kpi_hint") : undefined,
              variant: outliersTotal > 0 ? "warning" : "default",
              scrollToId: RESPONSE_TIME_OUTLIERS_TABLE_ID,
            },
          ]}
        />
        <ChartPrimaryRow>
          <ChartShell
            title={t("reports.brs.stage_times")}
            description={t("reports.brs.funnel_desc")}
          >
            <FunnelChart stages={funnelStages} slaMinutes={15} />
          </ChartShell>
        </ChartPrimaryRow>
        <ChartSecondaryRow>
          <ChartShell
            title={t("reports.brs.by_hour_avg")}
            description={t("reports.brs.by_hour_avg_desc")}
            xLabel={t("reports.brs.hour_created")}
          >
            <HourHeatmap
              counts={byHourAvg}
              peakHour={peakHourAvg != null ? Number(peakHourAvg) : undefined}
              xLabel={t("reports.brs.hour_created")}
              legendLow={heatLegend.low}
              legendHigh={heatLegend.high}
              formatCellValue={(v) => (v >= 10 ? v.toFixed(0) : v.toFixed(1))}
              getCellTitle={(h, v) =>
                byHourN[h] > 0
                  ? `${h}:00 — ${v.toFixed(1)} ${t("reports.min")} (${t("reports.brs.delivered_n", { count: byHourN[h] })})`
                  : `${h}:00 — ${t("reports.no_data")}`
              }
            />
          </ChartShell>
        </ChartSecondaryRow>
        <ChartPrimaryRow>
          <ReportSection
            id={RESPONSE_TIME_OUTLIERS_TABLE_ID}
            title={t("reports.brs.outliers_list_title")}
            description={
              outliersTotal > 0
                ? [
                    t("reports.brs.outliers_list_desc", { count: outliersTotal }),
                    t("reports.brs.outliers_rule"),
                    outliersTotal > outliers.length
                      ? t("reports.brs.outliers_list_trimmed", {
                          shown: outliers.length,
                          total: outliersTotal,
                        })
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")
                : t("reports.brs.outliers_none")
            }
          >
            <ReportDataTable
              columns={[
                { key: "code", label: t("reports.brs.request_req_no") },
                { key: "name", label: t("reports.brs.request_name") },
                { key: "department", label: t("reports.filter_department") },
                { key: "total_minutes", label: t("reports.brs.total_minutes"), align: "right" },
              ]}
              rows={outlierRows}
              empty={t("reports.brs.outliers_none")}
              paginate
              initialPage={reportPage}
              onPageChange={setReportPage}
            />
          </ReportSection>
        </ChartPrimaryRow>
      </BrsReportLayout>
    );
  }

  if (slug === "request-volume-forecast") {
    const byHour = hourCounts((data.by_hour ?? {}) as Record<string, number>);
    const byWeekday = (data.by_weekday ?? {}) as Record<string, number>;
    const daily = (data.daily_volume ?? []) as { date: string; count: number }[];
    const peakHour = data.peak_hour_local ?? data.peak_hour;

    return (
      <BrsReportLayout>
        <BrsKpiRow
          items={[
            { label: t("reports.brs.total_requests"), value: f.count(num(data.total)) },
            { label: t("reports.avg_daily"), value: f.count(num(data.avg_daily)) },
            { label: t("reports.brs.peak_hour"), value: peakHour != null ? `${peakHour}:00` : "—" },
          ]}
        />
        <ChartPrimaryRow>
          <ChartShell
            title={t("reports.brs.hour_heatmap")}
            description={t("reports.brs.hour_heatmap")}
            yLabel={t("reports.brs.request_count")}
            xLabel={t("reports.brs.hour_local")}
          >
            <HourHeatmap
              counts={byHour}
              peakHour={peakHour != null ? Number(peakHour) : undefined}
              xLabel={t("reports.brs.hour_local")}
              legendLow={heatLegend.low}
              legendHigh={heatLegend.high}
            />
          </ChartShell>
        </ChartPrimaryRow>
        <ChartSecondaryRow>
          <ChartShell
            title={t("reports.daily_volume")}
            description={t("reports.daily_volume")}
            yLabel={t("reports.brs.request_count")}
            xLabel={t("reports.brs.date")}
          >
            <LineChart
              series={[
                {
                  label: t("reports.brs.total_requests"),
                  color: CHART.accent,
                  points: daily.map((d) => ({ label: d.date.slice(5), value: d.count })),
                },
              ]}
            />
          </ChartShell>
        </ChartSecondaryRow>
        <ChartShell
          title={t("reports.brs.by_weekday")}
          yLabel={t("reports.brs.request_count")}
          xLabel={t("reports.brs.day")}
        >
          <ColumnChart
            points={WEEKDAYS.map((d) => ({
              label: t(`reports.brs.weekday.${d}`, d),
              value: byWeekday[d] ?? 0,
              fill: CHART.accent,
            }))}
            barFill={CHART.accent}
          />
        </ChartShell>
      </BrsReportLayout>
    );
  }

  if (slug === "staff-performance-scorecard") {
    const staff = (data.staff ?? []) as {
      name: string;
      department: string;
      delivered: number;
      avg_minutes: number;
      on_time_rate: number;
      score: number;
    }[];
    const top10 = [...staff].sort((a, b) => b.delivered - a.delivered).slice(0, 10);
    const STAFF_SCORECARD_TABLE_ID = "staff-performance-table";

    return (
      <BrsReportLayout>
        <BrsKpiRow
          items={[
            {
              label: t("reports.brs.staff_count"),
              value: f.count(staff.length),
              scrollToId: STAFF_SCORECARD_TABLE_ID,
            },
            {
              label: t("reports.sla_on_time_rate"),
              value: staff.length
                ? f.pct(staff.reduce((s, x) => s + x.on_time_rate, 0) / staff.length)
                : "—",
            },
          ]}
        />
        <ChartPrimaryRow>
          <ChartShell
            title={t("reports.brs.scatter_performance")}
            description={t("reports.brs.scatter_desc")}
            yLabel={t("reports.sla_on_time_rate")}
            xLabel={t("reports.avg_delivery")}
            legend={[
              { label: t("reports.brs.quadrant_best"), color: CHART.success },
              { label: t("reports.brs.quadrant_risk"), color: CHART.danger },
            ]}
          >
            <StaffScatterChart
              points={staff.map((s) => ({ label: s.name, x: s.avg_minutes, y: s.on_time_rate }))}
              xLabel={t("reports.avg_delivery")}
              yLabel={t("reports.sla_on_time_rate")}
            />
          </ChartShell>
        </ChartPrimaryRow>
        <ChartSecondaryRow>
          <ChartShell
            title={t("reports.brs.top_completed")}
            description={t("reports.brs.top_completed")}
            yLabel={t("reports.brs.completed")}
            xLabel={t("reports.brs.staff")}
          >
            <ColumnChart
              points={top10.map((s) => ({
                label: truncateLabel(s.name, 12),
                value: s.delivered,
                fill: CHART.accent,
              }))}
              maxBars={10}
            />
          </ChartShell>
        </ChartSecondaryRow>
        <ChartSecondaryRow>
          <ReportSection
            id={STAFF_SCORECARD_TABLE_ID}
            title={t("reports.brs.staff_performance_table_title")}
            description={t("reports.brs.staff_performance_table_desc")}
          >
            <ReportDataTable
              columns={[
                { key: "name", label: t("reports.brs.staff") },
                { key: "department", label: t("reports.filter_department") },
                { key: "delivered", label: t("reports.brs.completed"), align: "right" },
                { key: "avg_minutes", label: t("reports.avg_delivery"), align: "right" },
                { key: "on_time_rate", label: t("reports.sla_on_time_rate"), align: "right" },
                { key: "score", label: t("reports.brs.score"), align: "right" },
              ]}
              rows={staff.map((r) => ({
                name: <span title={r.name}>{truncateLabel(r.name, 20)}</span>,
                department: departmentLabel(r.department),
                delivered: f.count(r.delivered),
                avg_minutes: f.min(r.avg_minutes),
                on_time_rate: f.pct(r.on_time_rate),
                score: r.score.toFixed(1),
              }))}
              empty={t("reports.no_data")}
              paginate
            />
          </ReportSection>
        </ChartSecondaryRow>
      </BrsReportLayout>
    );
  }

  if (slug === "workload-distribution") {
    const historical = (data.historical_staff ?? data.current_staff ?? []) as {
      name: string;
      completed_period: number;
      avg_completed_per_day: number;
    }[];
    const barItems = historical.slice(0, 25).map((r) => ({
      label: r.name,
      value: r.completed_period,
    }));
    const mean =
      barItems.length > 0 ? barItems.reduce((s, x) => s + x.value, 0) / barItems.length : 0;

    return (
      <BrsReportLayout>
        <BrsKpiRow
          items={[
            {
              label: t("reports.brs.period_total"),
              value: f.count(num(data.total_completed_period)),
              unit: t("reports.brs.unit_jobs"),
            },
            {
              label: t("reports.brs.per_day"),
              value: historical.length
                ? f.count(
                    Math.round(
                      historical.reduce((s, x) => s + x.avg_completed_per_day, 0) / historical.length,
                    ),
                  )
                : "—",
              unit: t("reports.brs.unit_jobs_per_day"),
            },
          ]}
        />
        <ChartPrimaryRow>
          <ChartShell
            title={t("reports.brs.historical_completed")}
            description={t("reports.brs.workload_mean_desc")}
            yLabel={t("reports.brs.completed")}
            xLabel={t("reports.brs.staff")}
          >
            {barItems.length ? (
              <WorkloadDeviationBars items={barItems} mean={mean} valueFormatter={f.count} />
            ) : (
              <ReportEmptyState message={t("reports.no_data")} hint={t("reports.brs.adjust_dates")} />
            )}
          </ChartShell>
        </ChartPrimaryRow>
        <ChartSecondaryRow>
          <ReportDataTable
            columns={[
              { key: "name", label: t("reports.brs.staff") },
              {
                key: "completed_period",
                label: `${t("reports.brs.period_total")} (${t("reports.brs.unit_jobs")})`,
                align: "right",
              },
              {
                key: "avg_completed_per_day",
                label: `${t("reports.brs.per_day")} (${t("reports.brs.unit_jobs_per_day")})`,
                align: "right",
              },
            ]}
            rows={historical.map((r) => ({
              name: <span title={r.name}>{truncateLabel(r.name, 20)}</span>,
              completed_period: f.count(r.completed_period),
              avg_completed_per_day: r.avg_completed_per_day.toFixed(1),
            }))}
            empty={t("reports.no_data")}
            paginate
          />
        </ChartSecondaryRow>
      </BrsReportLayout>
    );
  }

  if (slug === "auto-assignment-effectiveness") {
    const reasons = (data.reassign_reasons ?? {}) as Record<string, number>;
    const split = (data.assignment_split ?? {}) as { auto?: number; manual?: number; reassigned?: number };

    return (
      <BrsReportLayout>
        <BrsKpiRow
          items={[
            { label: t("reports.brs.auto_rate"), value: f.pct(num(data.auto_rate)), variant: "success" },
            { label: t("reports.brs.success_rate"), value: f.pct(num(data.success_rate)), variant: "success" },
            { label: t("reports.brs.avg_assign_min"), value: f.min(num(data.avg_assign_minutes)) },
            {
              label: t("reports.brs.reassigned_count"),
              value: f.count(num(split.reassigned)),
            },
            {
              label: t("reports.brs.manual_assignments"),
              value: f.count(num(split.manual)),
            },
          ]}
        />
        <ChartPrimaryRow>
          <ChartShell
            title={t("reports.brs.assignment_split")}
            description={t("reports.brs.assignment_split")}
            legend={[
              { label: t("reports.brs.auto"), color: CHART.auto },
              { label: t("reports.brs.manual"), color: CHART.manual },
              { label: t("reports.brs.reassigned"), color: CHART.reassigned },
            ]}
          >
            <DonutChart
              segments={[
                { label: t("reports.brs.auto"), value: num(split.auto), color: CHART.auto },
                { label: t("reports.brs.manual"), value: num(split.manual), color: CHART.manual },
                { label: t("reports.brs.reassigned"), value: num(split.reassigned), color: CHART.reassigned },
              ]}
              centerValue={f.pct(num(data.auto_rate))}
              centerLabel={t("reports.brs.auto_rate")}
            />
          </ChartShell>
        </ChartPrimaryRow>
        <ChartSecondaryRow>
          <ChartShell
            title={t("reports.brs.reassign_reasons")}
            description={
              Object.keys(reasons).length
                ? t("reports.brs.reassign_reasons")
                : t("reports.brs.reassign_empty_desc")
            }
            yLabel={t("reports.brs.count")}
            xLabel={t("reports.brs.reason")}
          >
            {Object.keys(reasons).length ? (
              <ColumnChart
                points={Object.entries(reasons).map(([k, v]) => ({
                  label: truncateLabel(k, 20),
                  value: v,
                  fill: CHART.reassigned,
                }))}
                maxBars={8}
              />
            ) : (
              <ReportEmptyState message={t("reports.brs.no_reassign")} hint={t("reports.brs.reassign_empty_desc")} />
            )}
          </ChartShell>
        </ChartSecondaryRow>
      </BrsReportLayout>
    );
  }

  if (slug === "stock-consumption-analysis") {
    const products = (data.products ?? []) as {
      sku: string;
      name: string;
      consumed: number;
      daily_avg: number;
      on_hand: number;
      days_remaining: number;
      status: string;
    }[];
    const trends = (data.product_trends ?? []) as {
      name: string;
      points: {
        label: string;
        count: number;
        week_start?: string;
        week_end?: string;
      }[];
    }[];

    const statusIcon = (st: string) => {
      if (st === "critical" || st === "out") return "🔴";
      if (st === "low") return "🟡";
      return "🟢";
    };

    const productsTotal = num(data.products_total, products.length);
    const top10 = products.slice(0, 10);
    const leastUsed =
      products.length > 0
        ? products.reduce((min, p) => (p.consumed < min.consumed ? p : min), products[0])
        : null;

    return (
      <BrsReportLayout>
        <BrsKpiRow
          items={[
            {
              label: t("reports.brs.products_tracked"),
              value: f.count(productsTotal),
              unit: t("reports.brs.unit_items"),
            },
            {
              label: t("reports.brs.top_consumed"),
              value: products[0] ? f.count(products[0].consumed) : "—",
              unit: t("reports.brs.unit_quantity"),
              target: products[0] ? displayProductName(products[0].name, products[0].sku) : undefined,
            },
            {
              label: t("reports.brs.least_consumed"),
              value: leastUsed ? f.count(leastUsed.consumed) : "—",
              unit: t("reports.brs.unit_quantity"),
              target: leastUsed ? displayProductName(leastUsed.name, leastUsed.sku) : undefined,
            },
          ]}
        />
        <ChartPrimaryRow>
          <ChartShell
            title={t("reports.brs.top_consumed_bars")}
            description={t("reports.brs.top_consumed_desc")}
            yLabel={t("reports.brs.units_used")}
            xLabel={t("reports.brs.product")}
          >
            <HorizontalBars
              items={top10.map((p) => ({
                label: displayProductName(p.name, p.sku),
                value: p.consumed,
                fill: CHART.accent,
              }))}
            />
          </ChartShell>
        </ChartPrimaryRow>
        {hasRows(trends) ? (
          <ChartShell
            title={t("reports.brs.consumption_trends")}
            description={
              <>
                <p>{t("reports.brs.consumption_trends_desc")}</p>
                <p>{t("reports.brs.consumption_trends_hint")}</p>
              </>
            }
            yLabel={t("reports.brs.units_used")}
            xLabel={t("reports.brs.week_period")}
            legend={trends.map((tr, i) => ({
              label: truncateLabel(displayProductName(tr.name), 28),
              color: seriesLineColor(i),
            }))}
          >
            <LineChart
              series={trends.map((tr, i) => {
                const seriesName = displayProductName(tr.name);
                return {
                label: seriesName,
                color: seriesLineColor(i),
                points: tr.points.map((p) => {
                  const { label, title } = weekPeriodLabels(p, i18n.language);
                  return {
                    label,
                    value: p.count,
                    title: `${seriesName} · ${title}: ${f.count(p.count)} ${t("reports.brs.unit_quantity")}`,
                  };
                }),
              };
              })}
            />
          </ChartShell>
        ) : null}
        <ChartSecondaryRow>
          <ReportDataTable
            columns={[
              { key: "name", label: t("reports.brs.product") },
              { key: "consumed", label: t("reports.brs.consumed"), align: "right" },
              { key: "daily_avg", label: t("reports.brs.daily_avg"), align: "right" },
              { key: "on_hand", label: t("reports.brs.on_hand"), align: "right" },
              { key: "days_remaining", label: t("reports.brs.days_left"), align: "right" },
              { key: "status", label: t("reports.filter_status") },
            ]}
            rows={products.map((r) =>
              reportTableRow(
                {
                  name: (
                    <span
                      className="inline-flex items-center gap-2"
                      title={displayProductName(r.name, r.sku)}
                    >
                      <ProductItemIcon
                        sku={r.sku}
                        name={displayProductName(r.name, r.sku)}
                        size="xs"
                      />
                      {truncateLabel(displayProductName(r.name, r.sku), 30)}
                    </span>
                  ),
                  consumed: f.count(r.consumed),
                  daily_avg: r.daily_avg.toFixed(1),
                  on_hand: f.count(r.on_hand),
                  days_remaining:
                    r.days_remaining >= 999 ? (
                      "—"
                    ) : (
                      <span className="inline-flex min-w-[6rem] flex-col gap-1">
                        <span className="tabular-nums">{f.days(r.days_remaining)}</span>
                        <UrgencyBar days={r.days_remaining} />
                      </span>
                    ),
                  status: `${statusIcon(r.status)} ${t(`reports.brs.stock_status.${r.status}`, r.status)}`,
                },
                {
                  name: displayProductName(r.name, r.sku),
                  consumed: r.consumed,
                  daily_avg: r.daily_avg,
                  on_hand: r.on_hand,
                  days_remaining: r.days_remaining >= 999 ? 999_999 : r.days_remaining,
                  status: r.status,
                },
              ),
            )}
            empty={t("reports.no_data")}
            paginate
          />
        </ChartSecondaryRow>
      </BrsReportLayout>
    );
  }

  if (slug === "low-stock-stockout") {
    const alerts = (data.alerts ?? []) as {
      sku?: string;
      name: string;
      on_hand: number;
      reorder_at: number;
      status: string;
      days_remaining: number;
    }[];
    const bad = alerts.filter((a) => a.status !== "ok");
    const stockStatusOrder: Record<string, number> = { out: 0, critical: 1, low: 2, ok: 3 };

    return (
      <BrsReportLayout>
        <BrsKpiRow
          items={[
            { label: t("reports.brs.low_count"), value: f.count(num(data.low_count)), variant: "warning" },
            { label: t("reports.brs.critical_count"), value: f.count(num(data.critical_count)), variant: "danger" },
            { label: t("reports.brs.out_count"), value: f.count(num(data.out_count)), variant: "danger" },
          ]}
        />
        <ChartSecondaryRow>
          <ReportSection title={t("reports.brs.low_stock_table_title")} description={t("reports.brs.low_stock_table_desc")}>
          <ReportDataTable
            columns={[
              { key: "name", label: t("reports.brs.product") },
              { key: "on_hand", label: t("reports.brs.on_hand"), align: "right" },
              { key: "days_remaining", label: t("reports.brs.days_left"), align: "right" },
              { key: "urgency", label: t("reports.brs.urgency"), sortable: false },
              { key: "status", label: t("reports.filter_status") },
            ]}
            rows={bad.map((r) =>
              reportTableRow(
                {
                  name: (
                    <span
                      className="inline-flex items-center gap-2"
                      title={displayProductName(r.name, r.sku)}
                    >
                      <ProductItemIcon
                        sku={r.sku ?? ""}
                        name={displayProductName(r.name, r.sku)}
                        size="xs"
                      />
                      {truncateLabel(displayProductName(r.name, r.sku), 30)}
                    </span>
                  ),
                  on_hand: f.count(r.on_hand),
                  days_remaining: (
                    <span className="inline-flex min-w-[4rem] flex-col gap-1 tabular-nums">
                      {f.days(r.days_remaining)}
                    </span>
                  ),
                  urgency: <UrgencyBar days={r.days_remaining} />,
                  status: t(`reports.brs.stock_status.${r.status}`, r.status),
                },
                {
                  name: displayProductName(r.name, r.sku),
                  on_hand: r.on_hand,
                  days_remaining: r.days_remaining,
                  status: stockStatusOrder[r.status] ?? 9,
                },
              ),
            )}
            empty={t("reports.brs.all_stock_ok")}
            paginate
            initialSortKey="days_remaining"
            initialSortDir="asc"
          />
          </ReportSection>
        </ChartSecondaryRow>
      </BrsReportLayout>
    );
  }

  if (slug === "stock-movement-audit") {
    const adjustments = (data.adjustments ?? []) as StockAdjustmentRead[];
    const byUser = (data.by_user ?? {}) as Record<string, number>;
    const byType = (data.by_type ?? {}) as Record<string, number>;
    const topUsers = Object.entries(byUser).sort((a, b) => b[1] - a[1]).slice(0, 12);
    const totalMovements = num(data.total_adjustments);
    const adjustmentsTotal = num(data.adjustments_total, adjustments.length);
    const rowCapped = data.row_limit_capped === true;
    const movementTypes = ["addition", "deduction", "adjustment"] as const;
    const STOCK_MOVEMENT_TABLE_ID = "stock-movement-audit-table";

    return (
      <BrsReportLayout>
        <BrsKpiRow
          items={[
            {
              label: t("reports.brs.movement_count"),
              value: f.count(totalMovements),
              scrollToId: STOCK_MOVEMENT_TABLE_ID,
            },
            { label: t("reports.brs.staff_involved"), value: f.count(Object.keys(byUser).length) },
            {
              label: t("reports.brs.movement_type.addition"),
              value: f.count(byType.addition ?? 0),
              variant: "success",
            },
            {
              label: t("reports.brs.movement_type.deduction"),
              value: f.count(byType.deduction ?? 0),
              variant: "danger",
            },
            {
              label: t("reports.brs.timeline_log_shown"),
              value: f.count(adjustments.length),
              hide: !rowCapped && adjustments.length === adjustmentsTotal,
              unit:
                rowCapped && adjustmentsTotal > adjustments.length
                  ? t("reports.filter_rows", { count: num(data.row_limit) })
                  : undefined,
            },
          ]}
        />
        <div className="grid grid-cols-12 gap-4">
          <ChartShell
            className="col-span-12 lg:col-span-7"
            title={t("reports.brs.movements_by_user")}
            description={t("reports.brs.movements_by_user_desc")}
          >
            <HorizontalBars
              items={topUsers.map(([name, count]) => ({
                label: name,
                value: count,
                fill: CHART.accent,
              }))}
            />
          </ChartShell>
          <ChartShell
            className="col-span-12 lg:col-span-5"
            title={t("reports.brs.movements_by_type")}
            description={t("reports.brs.movements_by_type_desc")}
          >
            <HorizontalBars
              items={movementTypes.map((kind) => ({
                label: t(`reports.brs.movement_type.${kind}`, kind),
                value: byType[kind] ?? 0,
                fill: kind === "addition" ? CHART.success : kind === "deduction" ? CHART.danger : CHART.gray,
              }))}
            />
          </ChartShell>
        </div>
        <ChartSecondaryRow>
          <ReportSection
            id={STOCK_MOVEMENT_TABLE_ID}
            title={t("reports.brs.stock_movement_table_title")}
            description={t("reports.brs.stock_movement_table_desc")}
          >
            {rowCapped ? (
              <p className="mb-3 text-xs text-[color:var(--color-ink-muted)]">
                {t("reports.brs.timeline_log_limit_note")}
              </p>
            ) : null}
            <ReportDataTable
              columns={[
                { key: "product_name", label: t("reports.brs.product") },
                { key: "delta", label: t("reports.brs.qty"), align: "right" },
                { key: "reason", label: t("reports.brs.reason") },
                { key: "actor_label", label: t("reports.brs.user") },
                { key: "created_at", label: t("reports.brs.when") },
              ]}
              rows={adjustments.map((r) =>
                reportTableRow(
                  {
                    product_name: (
                      <span title={displayProductName(r.product_name, r.product_sku)}>
                        {truncateLabel(
                          displayProductName(r.product_name, r.product_sku),
                          30,
                        )}
                      </span>
                    ),
                    delta: <StockDeltaCell delta={r.delta} />,
                    reason: t(`reports.stock_reason.${r.reason}`, r.reason),
                    actor_label: r.actor_label ?? "—",
                    created_at: <ReportDateTimeCell iso={r.created_at} lang={i18n.language} />,
                  },
                  {
                    product_name: displayProductName(r.product_name, r.product_sku),
                    delta: r.delta,
                    reason: r.reason,
                    actor_label: r.actor_label ?? "",
                    created_at: r.created_at,
                  },
                ),
              )}
              empty={t("reports.no_data")}
              paginate
              initialSortKey="created_at"
              initialSortDir="desc"
            />
          </ReportSection>
        </ChartSecondaryRow>
      </BrsReportLayout>
    );
  }

  if (slug === "request-lifecycle-activity") {
    const byKind = (data.by_kind ?? {}) as Record<string, number>;
    const byCategory = (data.by_category ?? {}) as Record<string, number>;
    const byActor = (data.by_actor ?? {}) as Record<string, number>;
    const lifecycle = (data.lifecycle ?? {}) as Record<string, number>;
    const dailyTrend = (data.daily_trend ?? []) as { label: string; count: number }[];
    const peakHour = data.peak_hour as number | null | undefined;
    const kindItems = TIMELINE_KIND_ORDER.filter((k) => (byKind[k] ?? 0) > 0).map((k) => ({
      label: t(`reports.brs.timeline_kind.${k}`, k),
      value: byKind[k] ?? 0,
      fill: timelineKindColor(k),
    }));
    const categoryColors: Record<string, string> = {
      intake: CHART.accent,
      assignment: CHART.auto,
      execution: CHART.info,
      completion: CHART.success,
      dnd: CHART.warning,
      closure: CHART.danger,
    };
    const funnelStages = [
      { key: "created", fill: CHART.accent },
      { key: "assigned", fill: CHART.auto },
      { key: "started", fill: CHART.info },
      { key: "delivered", fill: CHART.success },
      { key: "cancelled", fill: CHART.danger },
    ] as const;

    return (
      <BrsReportLayout>
        <BrsKpiRow
          items={[
            { label: t("reports.brs.lifecycle_total_events"), value: f.count(num(data.total_events)) },
            {
              label: t("reports.brs.lifecycle_requests"),
              value: f.count(num(data.requests_in_period)),
            },
            {
              label: t("reports.brs.lifecycle_avg_events"),
              value: num(data.avg_events_per_request).toFixed(1),
              unit: t("reports.brs.per_request"),
            },
            {
              label: t("reports.brs.lifecycle_peak_hour"),
              value: peakHour != null ? `${String(peakHour).padStart(2, "0")}:00` : "—",
            },
          ]}
        />
        <div className="grid grid-cols-12 gap-4">
          <ChartShell
            className="col-span-12"
            title={t("reports.brs.lifecycle_daily_trend")}
            description={t("reports.brs.lifecycle_daily_trend_desc")}
            yLabel={t("reports.brs.count")}
            xLabel={t("reports.brs.date")}
          >
            {hasRows(dailyTrend) ? (
              <LineChart
                series={[
                  {
                    label: t("reports.brs.lifecycle_daily_trend"),
                    color: CHART.accent,
                    points: dailyTrend.map((d) => ({
                      label: d.label.slice(5),
                      value: d.count,
                    })),
                  },
                ]}
              />
            ) : (
              <ReportEmptyState message={t("reports.no_data")} />
            )}
          </ChartShell>
        </div>
        <ReportChartGrid cols={2}>
          <ChartShell
            title={t("reports.brs.lifecycle_by_category")}
            description={t("reports.brs.lifecycle_by_category_desc")}
          >
            <DonutChart
              segments={TIMELINE_CATEGORY_ORDER.filter((c) => (byCategory[c] ?? 0) > 0).map((c) => ({
                label: t(`reports.brs.timeline_category.${c}`, c),
                value: byCategory[c] ?? 0,
                color: categoryColors[c],
              }))}
            />
          </ChartShell>
          <ChartShell
            title={t("reports.brs.lifecycle_funnel")}
            description={t("reports.brs.lifecycle_funnel_desc")}
          >
            <ActivityCountFunnel
              stages={funnelStages.map((s) => ({
                label: t(`reports.brs.lifecycle_stage.${s.key}`, s.key),
                value: lifecycle[s.key] ?? 0,
                fill: s.fill,
              }))}
            />
          </ChartShell>
        </ReportChartGrid>
        <div className="grid grid-cols-12 gap-4">
          <ChartShell
            className="col-span-12"
            title={t("reports.brs.lifecycle_by_hour")}
            description={t("reports.brs.lifecycle_by_hour_desc")}
          >
            <HourHeatmap
              counts={hourCounts((data.by_hour ?? {}) as Record<string, number>)}
              peakHour={peakHour ?? undefined}
              xLabel={t("reports.brs.hour_of_day")}
              legendLow={heatLegend.low}
              legendHigh={heatLegend.high}
            />
          </ChartShell>
        </div>
        <div className="grid grid-cols-12 gap-4">
          <ChartShell
            className="col-span-12 lg:col-span-7"
            title={t("reports.brs.lifecycle_by_kind")}
            description={t("reports.brs.lifecycle_by_kind_desc")}
          >
            {kindItems.length > 0 ? (
              <HorizontalBars items={kindItems} />
            ) : (
              <ReportEmptyState message={t("reports.no_data")} />
            )}
          </ChartShell>
          <ChartShell
            className="col-span-12 lg:col-span-5"
            title={t("reports.brs.lifecycle_top_actors")}
            description={t("reports.brs.lifecycle_top_actors_desc")}
          >
            <HorizontalBars
              items={Object.entries(byActor).map(([name, count]) => ({
                label: name === "System" ? t("requests.timeline_events.actor_system") : name,
                value: count,
                fill: name === "System" ? CHART.gray : CHART.info,
              }))}
            />
          </ChartShell>
        </div>
      </BrsReportLayout>
    );
  }

  if (slug === "timeline-activity-log") {
    const recent = (data.recent_events ?? []) as TimelineRecentEvent[];
    const totalEvents = num(data.total_events);
    const rowCapped = data.row_limit_capped === true;

    return (
      <BrsReportLayout>
        <BrsKpiRow
          items={[
            { label: t("reports.brs.lifecycle_total_events"), value: f.count(totalEvents) },
            {
              label: t("reports.brs.timeline_log_shown"),
              value: f.count(recent.length),
              unit:
                rowCapped && totalEvents > recent.length
                  ? t("reports.filter_rows", { count: num(data.row_limit) })
                  : undefined,
            },
            {
              label: t("reports.brs.lifecycle_requests"),
              value: f.count(num(data.requests_in_period)),
            },
          ]}
        />
        <ChartPrimaryRow>
          <ReportSection
            title={t("reports.brs.lifecycle_recent")}
            description={t("reports.brs.lifecycle_recent_desc")}
          >
            {rowCapped ? (
              <p className="mb-3 text-xs text-[color:var(--color-ink-muted)]">
                {t("reports.brs.timeline_log_limit_note")}
              </p>
            ) : null}
            <ReportDataTable
              columns={[
                { key: "time", label: t("reports.brs.when") },
                { key: "code", label: t("reports.brs.req_number") },
                { key: "name", label: t("reports.brs.request_name") },
                { key: "event", label: t("reports.brs.event") },
                { key: "who", label: t("reports.brs.user") },
              ]}
              rows={recent.map((e) => ({
                time: <ReportDateTimeCell iso={e.created_at} lang={i18n.language} />,
                code: (
                  <span className="font-mono text-xs whitespace-nowrap text-[color:var(--color-ink)]">
                    {e.request_code}
                  </span>
                ),
                name: requestNameCell(displayRequestName(e.request_name?.trim() || e.request_code)),
                event: (
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <StatusPill tone={timelineKindTone(e.kind)}>
                      {t(`reports.brs.timeline_kind.${e.kind}`, e.kind)}
                    </StatusPill>
                    <span
                      className="truncate text-xs text-[color:var(--color-ink-muted)]"
                      title={translateEventTitle(e.title)}
                    >
                      {truncateLabel(translateEventTitle(e.title), 48)}
                    </span>
                  </div>
                ),
                who:
                  e.actor_label === "System"
                    ? t("requests.timeline_events.actor_system")
                    : e.actor_label,
              }))}
              empty={t("reports.no_data")}
              paginate
            />
          </ReportSection>
        </ChartPrimaryRow>
      </BrsReportLayout>
    );
  }

  if (slug === "service-only-room-requests") {
    const services = (data.services ?? []) as {
      sku: string;
      name: string;
      department: string;
      count: number;
    }[];
    const lines = (data.lines ?? []) as {
      id?: number;
      code: string;
      room: string;
      service_name: string;
      service_sku: string;
      department: string;
      qty: number;
      status: string;
      created_at: string;
    }[];
    const serviceLineCount = num(data.service_line_count);
    const linesTotal = num(data.lines_total, lines.length);
    const rowCapped = data.row_limit_capped === true;
    const SERVICE_DETAIL_TABLE_ID = "service-only-room-requests-table";

    return (
      <BrsReportLayout>
        <BrsKpiRow
          items={[
            {
              label: t("reports.brs.service_only_count"),
              value: f.count(serviceLineCount),
              scrollToId: SERVICE_DETAIL_TABLE_ID,
            },
            { label: t("reports.brs.service_types"), value: f.count(num(data.service_types)) },
            { label: t("reports.brs.unique_rooms"), value: f.count(num(data.unique_rooms)) },
            {
              label: t("reports.brs.timeline_log_shown"),
              value: f.count(lines.length),
              hide: !rowCapped && lines.length === linesTotal,
              unit:
                rowCapped && linesTotal > lines.length
                  ? t("reports.filter_rows", { count: num(data.row_limit) })
                  : undefined,
            },
          ]}
        />
        <p className="text-xs text-[color:var(--color-ink-muted)]">
          {t("reports.brs.service_only_rule_note")}
        </p>
        <ChartPrimaryRow>
          <ChartShell
            title={t("reports.brs.service_only_room_chart")}
            description={t("reports.brs.service_only_room_chart_desc")}
            yLabel={t("reports.brs.service_qty_total")}
            xLabel={t("reports.brs.service_name_col")}
          >
            {services.length > 0 ? (
              <HorizontalBars
                items={services.slice(0, 24).map((s) => ({
                  label: displayProductName(s.name, s.sku),
                  value: s.count,
                  fill: CHART.accent,
                }))}
              />
            ) : (
              <ReportEmptyState message={t("reports.no_data")} />
            )}
          </ChartShell>
        </ChartPrimaryRow>
        <ChartPrimaryRow>
          <ReportSection
            title={t("reports.brs.service_only_summary_table")}
            description={t("reports.brs.service_only_summary_desc")}
          >
            <ReportDataTable
              columns={[
                { key: "name", label: t("reports.brs.service_name_col") },
                { key: "department", label: t("reports.filter_department") },
                {
                  key: "count",
                  label: t("reports.brs.service_qty_total"),
                  align: "right",
                },
              ]}
              rows={services.map((s) =>
                reportTableRow(
                  {
                    name: (
                      <span className="font-medium">{displayProductName(s.name, s.sku)}</span>
                    ),
                    department: departmentLabel(s.department),
                    count: <span className="tabular-nums">{f.count(s.count)}</span>,
                  },
                  { count: s.count },
                ),
              )}
              empty={t("reports.no_data")}
              paginate
              initialSortKey="count"
              initialSortDir="desc"
            />
          </ReportSection>
        </ChartPrimaryRow>
        <ChartPrimaryRow>
          <ReportSection
            id={SERVICE_DETAIL_TABLE_ID}
            title={t("reports.brs.service_only_requests_list")}
            description={t("reports.brs.service_only_requests_list_desc")}
          >
            {rowCapped ? (
              <p className="mb-3 text-xs text-[color:var(--color-ink-muted)]">
                {t("reports.brs.timeline_log_limit_note")}
              </p>
            ) : null}
            <ReportDataTable
              columns={[
                { key: "created_at", label: t("reports.brs.when") },
                { key: "room", label: t("reports.brs.room") },
                { key: "code", label: t("reports.brs.req_number") },
                { key: "service_name", label: t("reports.brs.service_name_col") },
                { key: "qty", label: t("reports.brs.qty"), align: "right" },
                { key: "department", label: t("reports.filter_department") },
                { key: "status", label: t("reports.filter_status") },
              ]}
              rows={lines.map((r) =>
                reportTableRow({
                  created_at: <ReportDateTimeCell iso={r.created_at} lang={i18n.language} />,
                  room: <span className="font-medium tabular-nums">{displayRoom(r.room)}</span>,
                  code: reqCodeCell(r),
                  service_name: (
                    <span className="font-medium">
                      {displayProductName(r.service_name, r.service_sku)}
                    </span>
                  ),
                  qty: <span className="tabular-nums">{r.qty}</span>,
                  department: departmentLabel(r.department),
                  status: (
                    <StatusPill tone={requestStatusReportTone(r.status)}>
                      {t(`status.${r.status}`, r.status)}
                    </StatusPill>
                  ),
                }),
              )}
              empty={t("reports.no_data")}
              paginate
            />
          </ReportSection>
        </ChartPrimaryRow>
      </BrsReportLayout>
    );
  }

  if (slug === "stock-only-room-requests") {
    const products = (data.products ?? []) as {
      sku: string;
      name: string;
      department: string;
      count: number;
    }[];
    const lines = (data.lines ?? []) as {
      id?: number;
      code: string;
      room: string;
      product_name: string;
      product_sku: string;
      department: string;
      qty: number;
      status: string;
      created_at: string;
    }[];
    const productLineCount = num(data.product_line_count);
    const linesTotal = num(data.lines_total, lines.length);
    const rowCapped = data.row_limit_capped === true;
    const STOCK_DETAIL_TABLE_ID = "stock-only-room-requests-table";

    return (
      <BrsReportLayout>
        <BrsKpiRow
          items={[
            {
              label: t("reports.brs.stock_only_count"),
              value: f.count(productLineCount),
              scrollToId: STOCK_DETAIL_TABLE_ID,
            },
            { label: t("reports.brs.product_types"), value: f.count(num(data.product_types)) },
            {
              label: t("reports.brs.unique_rooms_stock"),
              value: f.count(num(data.unique_rooms)),
            },
            {
              label: t("reports.brs.timeline_log_shown"),
              value: f.count(lines.length),
              hide: !rowCapped && lines.length === linesTotal,
              unit:
                rowCapped && linesTotal > lines.length
                  ? t("reports.filter_rows", { count: num(data.row_limit) })
                  : undefined,
            },
          ]}
        />
        <p className="text-xs text-[color:var(--color-ink-muted)]">
          {t("reports.brs.stock_only_rule_note")}
        </p>
        <ChartPrimaryRow>
          <ChartShell
            title={t("reports.brs.stock_only_room_chart")}
            description={t("reports.brs.stock_only_room_chart_desc")}
            yLabel={t("reports.brs.product_qty_total")}
            xLabel={t("reports.brs.product_name_col")}
          >
            {products.length > 0 ? (
              <HorizontalBars
                items={products.slice(0, 24).map((p) => ({
                  label: displayProductName(p.name, p.sku),
                  value: p.count,
                  fill: CHART.accent,
                }))}
              />
            ) : (
              <ReportEmptyState message={t("reports.no_data")} />
            )}
          </ChartShell>
        </ChartPrimaryRow>
        <ChartPrimaryRow>
          <ReportSection
            title={t("reports.brs.stock_only_summary_table")}
            description={t("reports.brs.stock_only_summary_desc")}
          >
            <ReportDataTable
              columns={[
                { key: "name", label: t("reports.brs.product_name_col") },
                { key: "department", label: t("reports.filter_department") },
                {
                  key: "count",
                  label: t("reports.brs.product_qty_total"),
                  align: "right",
                },
              ]}
              rows={products.map((p) =>
                reportTableRow(
                  {
                    name: (
                      <span className="font-medium">{displayProductName(p.name, p.sku)}</span>
                    ),
                    department: departmentLabel(p.department),
                    count: <span className="tabular-nums">{f.count(p.count)}</span>,
                  },
                  { count: p.count },
                ),
              )}
              empty={t("reports.no_data")}
              paginate
              initialSortKey="count"
              initialSortDir="desc"
            />
          </ReportSection>
        </ChartPrimaryRow>
        <ChartPrimaryRow>
          <ReportSection
            id={STOCK_DETAIL_TABLE_ID}
            title={t("reports.brs.stock_only_requests_list")}
            description={t("reports.brs.stock_only_requests_list_desc")}
          >
            {rowCapped ? (
              <p className="mb-3 text-xs text-[color:var(--color-ink-muted)]">
                {t("reports.brs.timeline_log_limit_note")}
              </p>
            ) : null}
            <ReportDataTable
              columns={[
                { key: "created_at", label: t("reports.brs.when") },
                { key: "room", label: t("reports.brs.room") },
                { key: "code", label: t("reports.brs.req_number") },
                { key: "product_name", label: t("reports.brs.product_name_col") },
                { key: "qty", label: t("reports.brs.qty"), align: "right" },
                { key: "department", label: t("reports.filter_department") },
                { key: "status", label: t("reports.filter_status") },
              ]}
              rows={lines.map((r) =>
                reportTableRow({
                  created_at: <ReportDateTimeCell iso={r.created_at} lang={i18n.language} />,
                  room: <span className="font-medium tabular-nums">{displayRoom(r.room)}</span>,
                  code: reqCodeCell(r),
                  product_name: (
                    <span className="font-medium">
                      {displayProductName(r.product_name, r.product_sku)}
                    </span>
                  ),
                  qty: <span className="tabular-nums">{r.qty}</span>,
                  department: departmentLabel(r.department),
                  status: (
                    <StatusPill tone={requestStatusReportTone(r.status)}>
                      {t(`status.${r.status}`, r.status)}
                    </StatusPill>
                  ),
                }),
              )}
              empty={t("reports.no_data")}
              paginate
            />
          </ReportSection>
        </ChartPrimaryRow>
      </BrsReportLayout>
    );
  }

  if (slug === "cancellation-analysis") {
    const byReason = (data.by_reason ?? {}) as Record<string, number>;
    const byStage = (data.by_stage ?? {}) as Record<string, number>;
    const wastedH = num(data.wasted_hours);
    const cancelledRows = (data.cancelled_requests ?? []) as {
      id?: number;
      code: string;
      name?: string;
      department: string;
      stage: string;
      reason: string;
      cancelled_at: string;
      detail?: string;
    }[];
    const cancelledTotal = num(data.cancelled_count);
    const rowCapped = data.row_limit_capped === true;
    const stagePoints = CANCEL_STAGE_ORDER.map((k) => ({
      label: t(`reports.brs.cancel_stage.${k}`, k),
      value: byStage[k] ?? 0,
      fill: CHART.danger,
    }));
    const CANCELLATION_TABLE_ID = "cancellation-requests-table";

    return (
      <BrsReportLayout>
        <BrsKpiRow
          items={[
            { label: t("reports.cancel_rate"), value: f.pct(num(data.cancellation_rate)), variant: "warning" },
            {
              label: t("reports.brs.wasted_hours"),
              value: `${wastedH.toFixed(1)} h`,
              hide: wastedH <= 0,
            },
            {
              label: t("reports.brs.cancelled_count"),
              value: f.count(cancelledTotal),
              variant: cancelledTotal > 0 ? "warning" : "default",
              scrollToId: CANCELLATION_TABLE_ID,
            },
            {
              label: t("reports.brs.timeline_log_shown"),
              value: f.count(cancelledRows.length),
              hide: !rowCapped && cancelledRows.length === cancelledTotal,
              unit:
                rowCapped && cancelledTotal > cancelledRows.length
                  ? t("reports.filter_rows", { count: num(data.row_limit) })
                  : undefined,
            },
          ]}
        />
        <div className="grid grid-cols-12 items-stretch gap-4">
          <div className="col-span-12 flex lg:col-span-6">
            <ChartShell
              stretch
              className="w-full"
              title={t("reports.brs.by_reason")}
              description={t("reports.brs.by_reason")}
            >
              <DonutChart
                segments={Object.entries(byReason).map(([k, v], i) => ({
                  label: t(`reports.brs.cancel_reason.${k}`, k),
                  value: v,
                  color: i === 0 ? CHART.warning : i === 1 ? CHART.danger : CHART.gray,
                }))}
              />
            </ChartShell>
          </div>
          <div className="col-span-12 flex lg:col-span-6">
            <ChartShell
              stretch
              className="w-full"
              title={t("reports.brs.by_stage")}
              description={t("reports.brs.by_stage")}
              yLabel={t("reports.brs.count")}
              xLabel={t("reports.brs.stage")}
            >
              <ColumnChart points={stagePoints} />
            </ChartShell>
          </div>
        </div>
        <ChartPrimaryRow>
          <ReportSection
            id={CANCELLATION_TABLE_ID}
            title={t("reports.brs.cancelled_list_title")}
            description={t("reports.brs.cancelled_list_desc")}
          >
            <ReportDataTable
              columns={[
                { key: "cancelled_at", label: t("reports.brs.when") },
                { key: "name", label: t("reports.brs.request_name") },
                { key: "reason", label: t("reports.brs.reason") },
                { key: "stage", label: t("reports.brs.stage") },
                { key: "detail", label: t("reports.brs.cancel_detail") },
              ]}
              rows={cancelledRows.map((r) => ({
                cancelled_at: r.cancelled_at ? (
                  <ReportDateTimeCell iso={r.cancelled_at} lang={i18n.language} />
                ) : (
                  "—"
                ),
                name:
                  r.id != null ? (
                    <Link
                      to={`/requests/${r.id}`}
                      state={{ returnTo }}
                      className="block min-w-0 text-[color:var(--color-ink)] hover:text-[color:var(--color-delivered-fg)] hover:underline"
                    >
                      {requestNameCell(displayRequestName(r.name?.trim() || r.code), r.code)}
                    </Link>
                  ) : (
                    requestNameCell(displayRequestName(r.name?.trim() || r.code), r.code)
                  ),
                reason: (
                  <StatusPill tone={r.reason === "stockout" ? "danger" : r.reason === "other" ? "neutral" : "warning"}>
                    {t(`reports.brs.cancel_reason.${r.reason}`, r.reason)}
                  </StatusPill>
                ),
                stage: t(`reports.brs.cancel_stage.${r.stage}`, r.stage),
                detail: (
                  <span
                    className="block min-w-0 max-w-md truncate text-sm text-[color:var(--color-ink-soft)]"
                    title={r.detail || undefined}
                  >
                    {r.detail?.trim() ? truncateLabel(translateDetail(r.detail), 56) : "—"}
                  </span>
                ),
              }))}
              empty={t("reports.no_data")}
              paginate
            />
          </ReportSection>
        </ChartPrimaryRow>
      </BrsReportLayout>
    );
  }

  if (slug === "pause-delay-analysis") {
    const reasonStats = (data.reason_stats ?? []) as { reason: string; count: number; avg_minutes: number }[];
    const items =
      reasonStats.length > 0
        ? reasonStats
        : Object.entries((data.by_reason ?? {}) as Record<string, number>).map(([reason, count]) => ({
            reason,
            count,
            avg_minutes: 0,
          }));

    const slaPauseBreach = num(data.sla_breach_with_pause);
    const pausedRows = (data.paused_requests ?? []) as {
      id?: number;
      code: string;
      name?: string;
      department: string;
      paused_at: string;
      reason: string;
      duration_minutes: number | null;
      outcome: string;
    }[];
    const pauseEventsTotal = num(data.pause_events_total ?? data.pause_count);
    const pausedRequestsCount = num(data.paused_requests_count);
    const rowCapped = data.row_limit_capped === true;
    const PAUSE_DELAY_TABLE_ID = "pause-delay-requests-table";

    return (
      <BrsReportLayout>
        <BrsKpiRow
          items={[
            {
              label: t("reports.brs.paused_requests_count"),
              value: f.count(pausedRequestsCount),
              variant: pausedRequestsCount > 0 ? "warning" : "default",
              scrollToId: PAUSE_DELAY_TABLE_ID,
            },
            { label: t("reports.brs.pause_events_count"), value: f.count(pauseEventsTotal) },
            { label: t("reports.brs.pause_rate"), value: f.pct(num(data.pause_rate)) },
            { label: t("reports.brs.avg_pause_min"), value: f.min(num(data.avg_pause_minutes)) },
            {
              label: t("reports.brs.timeline_log_shown"),
              value: f.count(pausedRows.length),
              hide: !rowCapped && pausedRows.length === pauseEventsTotal,
              unit:
                rowCapped && pauseEventsTotal > pausedRows.length
                  ? t("reports.filter_rows", { count: num(data.row_limit) })
                  : undefined,
            },
            {
              label: t("reports.brs.sla_pause_breach"),
              value: f.count(slaPauseBreach),
              variant: "danger",
              hide: slaPauseBreach <= 0,
            },
          ]}
        />
        <ChartPrimaryRow>
          <ChartShell
            title={t("reports.brs.pause_reasons")}
            description={t("reports.brs.pause_reasons")}
            yLabel={t("reports.brs.count")}
            xLabel={t("reports.brs.reason")}
          >
            <HorizontalBars
              items={items.map((r) => ({
                label: pauseReasonLabel(t, r.reason),
                value: r.count,
                fill: r.avg_minutes >= 12 ? CHART.danger : r.avg_minutes >= 8 ? CHART.warning : CHART.gray,
              }))}
            />
          </ChartShell>
        </ChartPrimaryRow>
        {items.some((r) => r.avg_minutes > 0) ? (
          <p className="text-sm text-[color:var(--color-ink-muted)]">
            {t("reports.brs.pause_avg_hint")}:{" "}
            {items
              .filter((r) => r.avg_minutes > 0)
              .map((r) => `${truncateLabel(pauseReasonLabel(t, r.reason), 20)} ${f.min(r.avg_minutes)}`)
              .join(" · ")}
          </p>
        ) : null}
        <ChartPrimaryRow>
          <ReportSection
            id={PAUSE_DELAY_TABLE_ID}
            title={t("reports.brs.paused_list_title")}
            description={t("reports.brs.paused_list_desc")}
          >
            <ReportDataTable
              columns={[
                { key: "paused_at", label: t("reports.brs.when") },
                { key: "name", label: t("reports.brs.request_name") },
                { key: "reason", label: t("reports.brs.reason") },
                { key: "duration_minutes", label: t("reports.brs.pause_duration"), align: "right" },
                { key: "outcome", label: t("reports.brs.pause_status") },
              ]}
              rows={pausedRows.map((r) => ({
                paused_at: r.paused_at ? (
                  <ReportDateTimeCell iso={r.paused_at} lang={i18n.language} />
                ) : (
                  "—"
                ),
                name:
                  r.id != null ? (
                    <Link
                      to={`/requests/${r.id}`}
                      state={{ returnTo }}
                      className="block min-w-0 text-[color:var(--color-ink)] hover:text-[color:var(--color-delivered-fg)] hover:underline"
                    >
                      {requestNameCell(displayRequestName(r.name?.trim() || r.code), r.code)}
                    </Link>
                  ) : (
                    requestNameCell(displayRequestName(r.name?.trim() || r.code), r.code)
                  ),
                reason: (
                  <span
                    className="block min-w-0 max-w-xs truncate text-sm"
                    title={pauseReasonLabel(t, r.reason)}
                  >
                    {truncateLabel(pauseReasonLabel(t, r.reason), 40)}
                  </span>
                ),
                duration_minutes:
                  r.duration_minutes != null ? f.min(r.duration_minutes) : "—",
                outcome: (
                  <StatusPill
                    tone={
                      r.outcome === "paused"
                        ? "warning"
                        : r.outcome === "resumed"
                          ? "success"
                          : "neutral"
                    }
                  >
                    {t(`reports.brs.pause_outcome.${r.outcome}`, r.outcome)}
                  </StatusPill>
                ),
              }))}
              empty={t("reports.no_data")}
              paginate
            />
          </ReportSection>
        </ChartPrimaryRow>
      </BrsReportLayout>
    );
  }

  if (slug === "dnd-incident-report") {
    const DND_INCIDENTS_TABLE_ID = "dnd-incidents-table";
    const incidents = (data.incidents ?? []) as {
      id?: number;
      code: string;
      name?: string;
      room: string;
      reported_at: string;
      resolution_minutes: number | null;
      action: string;
    }[];
    const incidentsTotal = num(data.incidents_total ?? data.total_incidents ?? incidents.length);
    const rowCapped = data.row_limit_capped === true;
    const actions = (data.resolution_actions ?? {}) as Record<string, number>;

    return (
      <BrsReportLayout>
        <BrsKpiRow
          items={[
            {
              label: t("reports.brs.dnd_total"),
              value: f.count(incidentsTotal),
              scrollToId: DND_INCIDENTS_TABLE_ID,
            },
            { label: t("reports.brs.avg_resolution"), value: f.min(num(data.avg_resolution_minutes)) },
            { label: t("reports.brs.unresolved"), value: f.count(num(data.unresolved)), variant: "warning" },
          ]}
        />
        <div className="grid grid-cols-12 items-stretch gap-4">
          <div className="col-span-12 flex lg:col-span-5">
            <ChartShell
              stretch
              className="w-full"
              title={t("reports.brs.resolution_actions")}
              description={t("reports.brs.resolution_actions")}
            >
              <DonutChart
                segments={Object.entries(actions).map(([k, v]) => ({
                  label: t(`reports.brs.dnd_action.${k}`, k),
                  value: v,
                  color:
                    k === "proceed"
                      ? CHART.success
                      : k === "cancelled" || k === "unresolved"
                        ? CHART.danger
                        : k === "defer"
                          ? CHART.warning
                          : CHART.accent,
                }))}
              />
            </ChartShell>
          </div>
          <div className="col-span-12 flex lg:col-span-7">
            <ChartShell
              stretch
              className="w-full"
              title={t("reports.brs.resolution_histogram")}
              description={t("reports.brs.resolution_histogram")}
              yLabel={t("reports.brs.incidents")}
              xLabel={t("reports.min")}
            >
              <ColumnChart
                points={[
                  { label: "<30", value: incidents.filter((i) => (i.resolution_minutes ?? 0) < 30).length, fill: CHART.success },
                  {
                    label: "30–60",
                    value: incidents.filter((i) => (i.resolution_minutes ?? 0) >= 30 && (i.resolution_minutes ?? 0) < 60).length,
                    fill: CHART.warning,
                  },
                  {
                    label: "60+",
                    value: incidents.filter((i) => (i.resolution_minutes ?? 0) >= 60).length,
                    fill: CHART.danger,
                  },
                ]}
              />
            </ChartShell>
          </div>
        </div>
        <ChartPrimaryRow>
          <ReportSection
            id={DND_INCIDENTS_TABLE_ID}
            title={t("reports.brs.dnd_list_title")}
            description={t("reports.brs.dnd_list_desc", { count: incidentsTotal })}
          >
            {rowCapped && incidentsTotal > incidents.length ? (
              <p className="mb-3 text-xs text-[color:var(--color-ink-muted)]">
                {t("reports.filter_rows", { count: num(data.row_limit) })}
              </p>
            ) : null}
            <ReportDataTable
              columns={[
                { key: "reported_at", label: t("reports.brs.when") },
                { key: "code", label: t("reports.brs.req_number") },
                { key: "name", label: t("reports.brs.request_name") },
                { key: "room", label: t("reports.brs.room") },
                { key: "resolution_minutes", label: t("reports.brs.resolution_min"), align: "right" },
                { key: "action", label: t("reports.brs.action") },
              ]}
              rows={incidents.map((r) => ({
                reported_at: r.reported_at ? (
                  <ReportDateTimeCell iso={r.reported_at} lang={i18n.language} />
                ) : (
                  "—"
                ),
                code:
                  r.id != null ? (
                    <Link
                      to={`/requests/${r.id}`}
                      state={{ returnTo }}
                      className="font-mono text-xs whitespace-nowrap text-[color:var(--color-ink)] hover:text-[color:var(--color-delivered-fg)] hover:underline"
                    >
                      {r.code}
                    </Link>
                  ) : (
                    <span className="font-mono text-xs text-[color:var(--color-ink)]">{r.code}</span>
                  ),
                name:
                  r.id != null ? (
                    <Link
                      to={`/requests/${r.id}`}
                      state={{ returnTo }}
                      className="block min-w-0 text-[color:var(--color-ink)] hover:text-[color:var(--color-delivered-fg)] hover:underline"
                    >
                      {requestNameCell(displayRequestName(r.name?.trim() || r.code), r.code)}
                    </Link>
                  ) : (
                    requestNameCell(displayRequestName(r.name?.trim() || r.code), r.code)
                  ),
                room: (
                  <span title={displayRoom(r.room)}>{truncateLabel(displayRoom(r.room), 20)}</span>
                ),
                resolution_minutes:
                  r.resolution_minutes != null ? f.min(r.resolution_minutes) : "—",
                action: (
                  <StatusPill tone={dndActionTone(r.action)}>
                    {t(`reports.brs.dnd_action.${r.action}`, r.action)}
                  </StatusPill>
                ),
              }))}
              empty={t("reports.no_data")}
              paginate
            />
          </ReportSection>
        </ChartPrimaryRow>
      </BrsReportLayout>
    );
  }

  if (slug === "month-over-month-comparison") {
    const metrics = (data.metrics ?? {}) as Record<string, MetricDelta>;
    const curPeriod = data.current_period as { from?: string; to?: string } | undefined;
    const prevPeriod = data.previous_period as { from?: string; to?: string } | undefined;
    const labels: Record<string, string> = {
      volume: t("reports.brs.metric_volume"),
      sla_rate: t("reports.sla_on_time_rate"),
      avg_response: t("reports.avg_delivery"),
      cancel_rate: t("reports.cancel_rate"),
      productivity: t("reports.brs.metric_productivity"),
    };
    const units: Record<string, string> = {
      volume: "",
      sla_rate: "%",
      avg_response: ` ${t("reports.min")}`,
      cancel_rate: "%",
      productivity: "",
    };

    const hasPrior = hasPriorPeriodData(metrics);
    const curFrom = curPeriod?.from?.slice(0, 10) ?? String(data.range_from ?? "").slice(0, 10);
    const curTo = curPeriod?.to?.slice(0, 10) ?? String(data.range_to ?? "").slice(0, 10);
    const prevFrom = prevPeriod?.from?.slice(0, 10);
    const prevTo = prevPeriod?.to?.slice(0, 10);
    const periodNote =
      curFrom && curTo && prevFrom && prevTo
        ? t("reports.brs.mom_compare_periods_note", {
            periodA: formatPeriodRangeShort(curFrom, curTo, i18n.language),
            periodB: formatPeriodRangeShort(prevFrom, prevTo, i18n.language),
          })
        : undefined;

    if (!hasPrior) {
      return (
        <BrsReportLayout>
          <ReportEmptyState message={t("reports.brs.no_prior_period")} hint={t("reports.brs.adjust_dates")} />
        </BrsReportLayout>
      );
    }

    const higherBetter = (key: string) => key !== "cancel_rate" && key !== "avg_response";

    const metricOrder = ["volume", "sla_rate", "avg_response", "cancel_rate", "productivity"] as const;

    return (
      <BrsReportLayout>
        <BrsKpiRow
          className="md:grid-cols-3 xl:grid-cols-5"
          items={metricOrder
            .filter((key) => metrics[key])
            .map((key) => {
              const m = metrics[key];
              const value =
                key === "sla_rate" || key === "cancel_rate"
                  ? f.pct(m.current)
                  : key === "avg_response"
                    ? f.min(m.current)
                    : key === "productivity"
                      ? m.current.toFixed(1)
                      : f.count(m.current);
              return {
                label: labels[key] ?? key,
                value,
                trend: m.previous > 0 ? f.trend(m, higherBetter(key)) : undefined,
              };
            })}
        />
        <ChartPrimaryRow>
          <ChartShell
            title={t("reports.brs.period_compare")}
            description={periodNote ?? t("reports.brs.period_compare_desc")}
          >
            <CompareBars
              currentLabel={t("reports.mom_period_a")}
              previousLabel={t("reports.mom_period_b")}
              items={metricOrder
                .filter((key) => metrics[key])
                .map((key) => ({
                  label: labels[key] ?? key,
                  current: metrics[key].current,
                  previous: metrics[key].previous,
                  unit: units[key],
                }))}
            />
          </ChartShell>
        </ChartPrimaryRow>
      </BrsReportLayout>
    );
  }

  return (
    <BrsReportLayout>
      <ReportEmptyState message={t("reports.no_data")} hint={t("reports.brs.adjust_dates")} />
    </BrsReportLayout>
  );
}
