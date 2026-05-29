import clsx from "clsx";
import { useTranslation } from "react-i18next";

import {
  formatCount,
  formatDays,
  formatMinutesUnit,
  formatPeriodRangeShort,
  formatPct,
  periodDaysInclusive,
  trendFromDelta,
} from "../../lib/reportFormat";
import { KpiCard, type KpiStatus } from "./reportUi";

export type MetricDelta = {
  current: number;
  previous: number;
  delta: number;
  delta_pct: number;
};

export type KpiTrend = {
  pct: number;
  direction: "up" | "down" | "flat";
  good?: boolean;
  label?: string;
  periodRange?: string;
};

export function buildTrend(
  m: MetricDelta | undefined,
  higherIsBetter: boolean,
  vsLabel: string,
  periodRange?: string,
): KpiTrend | undefined {
  if (!m || m.previous === 0) return undefined;
  const t = trendFromDelta(m.delta, higherIsBetter);
  return {
    pct: Math.abs(m.delta_pct),
    direction: t.direction,
    good: t.good,
    label: vsLabel,
    periodRange,
  };
}

export function hasPriorPeriodData(metrics: Record<string, MetricDelta>): boolean {
  return Object.values(metrics).some((m) => m.previous > 0);
}

export function slaStatus(rate: number, target: number): KpiStatus {
  if (rate >= target) return "on_track";
  if (rate >= target - 8) return "warning";
  return "critical";
}

export function BrsKpiRow({
  items,
  className,
}: {
  items: {
    label: string;
    value: string | number;
    unit?: string;
    trend?: KpiTrend;
    target?: string;
    status?: KpiStatus;
    statusLabel?: string;
    variant?: "default" | "success" | "warning" | "danger";
    hide?: boolean;
    scrollToId?: string;
  }[];
  className?: string;
}) {
  const visible = items.filter((k) => !k.hide);
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return (
    <div className={clsx("grid grid-cols-2 gap-3 lg:grid-cols-4", className)}>
      {visible.map((k) => (
        <KpiCard
          key={k.label}
          label={k.label}
          value={k.value}
          unit={k.unit}
          trend={k.trend}
          target={k.target}
          status={k.status}
          statusLabel={k.statusLabel}
          variant={k.variant}
          onClick={k.scrollToId ? () => scrollTo(k.scrollToId!) : undefined}
        />
      ))}
    </div>
  );
}

export function useBrsFormatters(comparePeriod?: { from?: string; to?: string }) {
  const { t, i18n } = useTranslation();
  const fallbackVs = t("reports.brs.vs_last_period");
  const minUnit = t("reports.min");
  const dayUnit = t("reports.brs.day_unit");

  const vsLabelAndRange = (): { label: string; periodRange?: string } => {
    const from = comparePeriod?.from?.slice(0, 10);
    const to = comparePeriod?.to?.slice(0, 10);
    if (!from || !to) return { label: fallbackVs };
    const days = periodDaysInclusive(from, to);
    return {
      label: t("reports.brs.vs_prior_period_days", { days }),
      periodRange: formatPeriodRangeShort(from, to, i18n.language),
    };
  };

  return {
    vs: fallbackVs,
    count: formatCount,
    pct: (n: number) => formatPct(n, 1),
    min: (n: number) => formatMinutesUnit(n, minUnit, 1),
    days: (n: number) => `${formatDays(n, 1)} ${dayUnit}`,
    trend: (m: MetricDelta | undefined, higherIsBetter: boolean) => {
      const { label, periodRange } = vsLabelAndRange();
      return buildTrend(m, higherIsBetter, label, periodRange);
    },
  };
}
