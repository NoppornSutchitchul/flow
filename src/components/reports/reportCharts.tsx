import clsx from "clsx";
import { Children, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { formatCount, formatPct, splitWeekRangeLabel, truncateLabel } from "../../lib/reportFormat";
import {
  CHART,
  accentShade,
  complianceBarColor,
  heatBlue,
  scatterQuadrantColor,
  slaStageColor,
} from "../../lib/reportChartTheme";

export type ChartSegment = { label: string; value: number; color: string };

export type ChartLegendItem = { label: string; color: string };

type PeriodDims = {
  barW: number;
  gap: number;
  svgWidth: number;
  padL: number;
  padR: number;
  fullWidth?: boolean;
};

/** Bar width and SVG width for period-based column charts. */
function periodChartDimensions(count: number, spread = false): PeriodDims {
  const padL = 52;
  const padR = 36;
  if (count <= 0) return { barW: 24, gap: 12, svgWidth: 200, padL, padR };

  /** ~1 month (≤8 weeks): bars spread across full card width. */
  if (spread && count <= 8) {
    const viewW = 720;
    const plotW = viewW - padL - padR;
    const slot = plotW / count;
    const barW = Math.min(72, Math.max(40, slot * 0.58));
    const gap = Math.max(12, slot - barW);
    return { barW, gap, svgWidth: viewW, padL, padR, fullWidth: true };
  }

  if (count === 1) {
    const barW = 88;
    return { barW, gap: 0, svgWidth: padL + barW + padR, padL, padR, fullWidth: spread };
  }
  if (count <= 4) {
    const barW = 56;
    const gap = 24;
    return {
      barW,
      gap,
      svgWidth: padL + count * barW + (count - 1) * gap + padR,
      padL,
      padR,
      fullWidth: spread,
    };
  }
  const gap = count > 12 ? 8 : 12;
  const barW = Math.max(22, Math.min(48, Math.floor((920 - padL - padR - (count - 1) * gap) / count)));
  return {
    barW,
    gap,
    svgWidth: padL + count * barW + (count - 1) * gap + padR,
    padL,
    padR,
  };
}

function periodChartHeight(count: number): number {
  if (count > 12) return 272;
  if (count > 6) return 248;
  return 216;
}

function periodBottomPad(count: number): number {
  if (count > 12) return 72;
  if (count > 6) return 58;
  return 40;
}

/** Minimum horizontal gap (px) between x-axis label centers in the SVG viewBox. */
const X_LABEL_MIN_GAP = 52;

/** Indices to show on the x-axis so labels do not overlap. */
function periodXLabelIndices(count: number, plotWidth: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [0];
  const maxLabels = Math.max(2, Math.floor(plotWidth / X_LABEL_MIN_GAP));
  if (count <= maxLabels) {
    return Array.from({ length: count }, (_, i) => i);
  }
  const indices: number[] = [];
  for (let k = 0; k < maxLabels; k++) {
    indices.push(Math.round((k * (count - 1)) / (maxLabels - 1)));
  }
  return [...new Set(indices)].sort((a, b) => a - b);
}

function periodShowXLabel(index: number, count: number, plotWidth = 632): boolean {
  return periodXLabelIndices(count, plotWidth).includes(index);
}

function PeriodXAxisLabel({
  cx,
  baseY,
  label,
  title,
  show,
}: {
  cx: number;
  baseY: number;
  label: string;
  title?: string;
  show: boolean;
}) {
  if (!show) {
    return (
      <text x={cx} y={baseY} className="sr-only">
        {title ?? label}
      </text>
    );
  }
  const lines = splitWeekRangeLabel(label);
  const lineH = 12;
  const startY = lines.length > 1 ? baseY - lineH : baseY;
  return (
    <text
      x={cx}
      y={startY}
      textAnchor="middle"
      className="fill-[color:var(--color-ink-soft)] text-[10px] font-medium"
    >
      {title ? <title>{title}</title> : null}
      <tspan x={cx} dy={0}>
        {lines[0]}
      </tspan>
      {lines[1] ? (
        <tspan x={cx} dy={lineH}>
          {lines[1]}
        </tspan>
      ) : null}
    </text>
  );
}

function PeriodChartFrame({
  children,
  svgWidth,
  height,
  fullWidth = false,
}: {
  children: ReactNode;
  svgWidth: number;
  height: number;
  fullWidth?: boolean;
}) {
  if (fullWidth) {
    return (
      <div className="w-full py-1">
        <svg
          width="100%"
          height={height}
          viewBox={`0 0 ${svgWidth} ${height}`}
          preserveAspectRatio="xMidYMid meet"
          className="block overflow-visible"
          role="img"
        >
          {children}
        </svg>
      </div>
    );
  }
  return (
    <div className="w-full overflow-x-auto py-1">
      <div className="mx-auto flex w-max min-w-full justify-center">
        <svg
          width={svgWidth}
          height={height}
          viewBox={`0 0 ${svgWidth} ${height}`}
          className="block overflow-visible"
          role="img"
          style={{ minWidth: "min(100%, max-content)" }}
        >
          {children}
        </svg>
      </div>
    </div>
  );
}

/** Wrapper: title, axis labels, optional legend. */
export function ChartShell({
  title,
  description,
  yLabel,
  xLabel,
  legend,
  children,
  className,
  height,
  stretch,
}: {
  title: string;
  description?: ReactNode;
  yLabel?: string;
  xLabel?: string;
  legend?: ChartLegendItem[];
  children: ReactNode;
  className?: string;
  height?: number;
  /** Match height with sibling cards in a stretched grid row. */
  stretch?: boolean;
}) {
  return (
    <div
      className={clsx(
        "report-chart-shell overflow-hidden rounded-2xl border border-[color:var(--color-border-report)] bg-[color:var(--color-surface-elevated)] p-4 shadow-sm",
        stretch && "flex h-full min-h-[22rem] flex-col",
        className,
      )}
    >
      <div className="mb-3 shrink-0">
        <h4 className="text-lg font-medium text-[color:var(--color-ink)]">{title}</h4>
        {description ? (
          <div className="mt-0.5 space-y-1 text-sm text-[color:var(--color-ink-muted)]">{description}</div>
        ) : null}
      </div>
      <div className={clsx("flex gap-3", stretch && "min-h-0 flex-1")}>
        {yLabel ? (
          <div
            className="flex shrink-0 items-center justify-center text-xs font-medium text-[color:var(--color-ink-muted)]"
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          >
            {yLabel}
          </div>
        ) : null}
        <div
          className={clsx(
            "min-w-0 flex-1 overflow-x-auto",
            stretch && "flex flex-col justify-center",
          )}
          style={{ minHeight: height ?? (stretch ? 240 : undefined) }}
        >
          {children}
        </div>
      </div>
      {xLabel ? (
        <p className="mt-2 text-center text-xs font-medium text-[color:var(--color-ink-muted)]">{xLabel}</p>
      ) : null}
      {legend && legend.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[color:var(--color-ink-soft)]">
          {legend.map((item) => (
            <li key={item.label} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: item.color }} />
              {item.label}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function ReportChartGrid({
  children,
  cols = 2,
}: {
  children: ReactNode;
  cols?: 1 | 2;
}) {
  const items = Children.toArray(children);
  return (
    <div className="grid grid-cols-12 gap-4">
      {items.map((child, i) => (
        <div key={i} className={cols === 2 ? "col-span-12 lg:col-span-6" : "col-span-12"}>
          {child}
        </div>
      ))}
    </div>
  );
}

export function ChartPrimaryRow({ children }: { children: ReactNode }) {
  return <div className="col-span-12">{children}</div>;
}

export function ChartSecondaryRow({ children }: { children: ReactNode }) {
  return <div className="col-span-12">{children}</div>;
}

/** Donut with % + count in legend. */
export function DonutChart({
  segments,
  size = 180,
  centerLabel,
  centerValue,
}: {
  segments: ChartSegment[];
  size?: number;
  centerLabel?: string;
  centerValue?: string | number;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = size * 0.36;
  const cx = size / 2;
  const cy = size / 2;
  const slices = segments.reduce<{
    angle: number;
    items: (ChartSegment & { d: string; pct: number })[];
  }>((acc, seg) => {
    const pct = seg.value / total;
    const sweep = pct * 360;
    const start = acc.angle;
    const end = start + sweep;
    acc.angle = end;
    const large = sweep > 180 ? 1 : 0;
    const x1 = cx + r * Math.cos((Math.PI * start) / 180);
    const y1 = cy + r * Math.sin((Math.PI * start) / 180);
    const x2 = cx + r * Math.cos((Math.PI * end) / 180);
    const y2 = cy + r * Math.sin((Math.PI * end) / 180);
    const d =
      pct >= 0.999
        ? `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy}`
        : `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
    acc.items.push({ ...seg, d, pct });
    return acc;
  }, { angle: -90, items: [] }).items;

  const compactLegend = segments.length <= 3;
  const stackLayout = segments.length > 3;

  return (
    <div
      className={clsx(
        "flex w-full min-w-0 gap-4",
        stackLayout
          ? "flex-col items-center"
          : compactLegend
            ? "flex-col items-center sm:flex-row sm:items-center"
            : "flex-col items-center lg:flex-row lg:items-start",
      )}
    >
      <svg width={size} height={size} className="shrink-0" role="img" aria-label="Donut chart">
        {slices.map((s) => (
          <path key={s.label} d={s.d} fill={s.color}>
            <title>{`${s.label}: ${formatCount(s.value)} (${formatPct(s.pct * 100, 1)})`}</title>
          </path>
        ))}
        <circle cx={cx} cy={cy} r={r * 0.58} fill="white" />
        {centerValue != null ? (
          <>
            <text x={cx} y={cy - 4} textAnchor="middle" className="fill-[color:var(--color-ink)] text-[18px] font-bold">
              {centerValue}
            </text>
            {centerLabel ? (
              <text x={cx} y={cy + 14} textAnchor="middle" className="fill-[color:var(--color-ink-muted)] text-[9px]">
                {truncateLabel(centerLabel, 14)}
              </text>
            ) : null}
          </>
        ) : null}
      </svg>
      <ul
        className={clsx(
          "w-full min-w-0 text-sm",
          compactLegend && !stackLayout
            ? "flex flex-wrap items-center justify-center gap-x-6 gap-y-2 sm:justify-start sm:flex-1"
            : "space-y-2",
        )}
      >
        {slices.map((s) => (
          <li
            key={s.label}
            className="flex min-w-0 items-start gap-2"
            title={`${s.label}: ${formatCount(s.value)} (${formatPct(s.pct * 100, 1)})`}
          >
            <span
              className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ background: s.color }}
            />
            <span className="min-w-0 flex-1 truncate font-medium text-[color:var(--color-ink)]">
              {s.label}
            </span>
            <span className="shrink-0 text-right text-xs tabular-nums text-[color:var(--color-ink-soft)]">
              {formatCount(s.value)}{" "}
              <span className="text-[color:var(--color-ink-muted)]">({formatPct(s.pct * 100, 1)})</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Flat split bar: green (on time) + red (breached). */
export function SlaSplitPowerBar({
  onTime,
  breached,
  centerValue,
  centerLabel,
  labels,
}: {
  onTime: number;
  breached: number;
  centerValue?: string;
  centerLabel?: string;
  labels: { onTime: string; breached: string };
}) {
  const total = onTime + breached;
  const onPct = total > 0 ? (onTime / total) * 100 : 50;
  const breachPct = total > 0 ? 100 - onPct : 50;

  return (
    <div className="flex w-full min-w-0 flex-col gap-3 py-1" role="img" aria-label="On-time vs overdue split">
      {centerValue != null ? (
        <p className="tabular-nums leading-tight text-[color:var(--color-ink)]">
          <span className="text-2xl font-bold">{centerValue}</span>
          {centerLabel ? (
            <span className="ml-2 text-sm font-normal text-[color:var(--color-ink-muted)]">
              {truncateLabel(centerLabel, 28)}
            </span>
          ) : null}
        </p>
      ) : null}
      <div
        className="flex h-2 w-full overflow-hidden rounded-full bg-slate-200"
        title={`${labels.onTime} ${formatPct(onPct, 1)} · ${labels.breached} ${formatPct(breachPct, 1)}`}
      >
        {onPct > 0 ? (
          <div
            className="h-full bg-emerald-500 transition-[width] duration-300"
            style={{ width: `${onPct}%` }}
            title={`${labels.onTime}: ${formatCount(onTime)} (${formatPct(onPct, 1)})`}
          />
        ) : null}
        {breachPct > 0 ? (
          <div
            className="h-full bg-red-500 transition-[width] duration-300"
            style={{ width: `${breachPct}%` }}
            title={`${labels.breached}: ${formatCount(breached)} (${formatPct(breachPct, 1)})`}
          />
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm text-[color:var(--color-ink-soft)]">
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-hidden />
          <span className="text-[color:var(--color-ink)]">{labels.onTime}</span>
          <span className="tabular-nums">
            {formatCount(onTime)}{" "}
            <span className="text-[color:var(--color-ink-muted)]">({formatPct(onPct, 1)})</span>
          </span>
        </span>
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" aria-hidden />
          <span className="text-[color:var(--color-ink)]">{labels.breached}</span>
          <span className="tabular-nums">
            {formatCount(breached)}{" "}
            <span className="text-[color:var(--color-ink-muted)]">({formatPct(breachPct, 1)})</span>
          </span>
        </span>
      </div>
    </div>
  );
}

/** Vertical bars with value labels on top — scales to full container width. */
export function ColumnChart({
  points,
  height = 220,
  barFill = CHART.info,
  showValueLabels = true,
  maxBars = 60,
  yMax,
  labelMax = 10,
}: {
  points: { label: string; value: number; fill?: string }[];
  height?: number;
  barFill?: string;
  showValueLabels?: boolean;
  maxBars?: number;
  yMax?: number;
  /** Max chars on x-axis; tooltip shows full label. */
  labelMax?: number;
}) {
  const slice = points.length > maxBars ? points.slice(-maxBars) : points;
  const max = yMax ?? Math.max(1, ...slice.map((p) => p.value));
  const fewBars = slice.length > 0 && slice.length <= 8;
  const chartHeight = height ?? (fewBars ? 280 : 220);
  const padL = fewBars ? 52 : 44;
  const padR = 12;
  const padB = fewBars ? 48 : 36;
  const padT = showValueLabels ? (fewBars ? 26 : 22) : 8;
  const chartH = chartHeight - padB - padT;
  const viewW = 720;
  const plotW = viewW - padL - padR;
  const slotW = slice.length > 0 ? plotW / slice.length : plotW;
  const barW = Math.max(12, Math.min(fewBars ? 56 : 40, slotW * 0.72));
  const yAxisClass = fewBars
    ? "fill-[color:var(--color-ink-muted)] text-[10px] tabular-nums"
    : "fill-[color:var(--color-ink-muted)] text-[9px]";
  const valueClass = fewBars
    ? "fill-[color:var(--color-ink)] text-[12px] font-semibold tabular-nums"
    : "fill-[color:var(--color-ink)] text-[9px] font-medium";
  const xLabelClass = fewBars
    ? "fill-[color:var(--color-ink-soft)] text-[12px] font-semibold"
    : "fill-[color:var(--color-ink-muted)] text-[9px]";

  return (
    <div className="w-full min-w-0">
      <svg
        width="100%"
        height={chartHeight}
        viewBox={`0 0 ${viewW} ${chartHeight}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        className="block max-w-none"
      >
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = padT + chartH * (1 - t);
          const v = Math.round(max * t);
          return (
            <g key={t}>
              <line x1={padL} y1={y} x2={viewW - padR} y2={y} stroke="var(--color-line)" strokeDasharray="3 3" />
              <text x={padL - 8} y={y + 4} textAnchor="end" className={yAxisClass}>
                {formatCount(v)}
              </text>
            </g>
          );
        })}
        {slice.map((p, i) => {
          const h = (p.value / max) * chartH;
          const slotX = padL + i * slotW;
          const x = slotX + (slotW - barW) / 2;
          const fill = p.fill ?? barFill;
          const labelY = chartHeight - (fewBars ? 14 : 8);
          const showX = fewBars || periodShowXLabel(i, slice.length, plotW);
          return (
            <g key={`${p.label}-${i}`}>
              <rect
                x={x}
                y={padT + chartH - h}
                width={barW}
                height={Math.max(2, h)}
                rx={fewBars ? 5 : 3}
                fill={fill}
              >
                <title>{`${p.label}: ${formatCount(p.value)}`}</title>
              </rect>
              {showValueLabels && p.value > 0 ? (
                <text
                  x={slotX + slotW / 2}
                  y={padT + chartH - h - (fewBars ? 6 : 4)}
                  textAnchor="middle"
                  className={valueClass}
                >
                  {p.value >= 1000 ? `${(p.value / 1000).toFixed(1)}k` : formatCount(p.value)}
                </text>
              ) : null}
              {showX ? (
                <text x={slotX + slotW / 2} y={labelY} textAnchor="middle" className={xLabelClass}>
                  {fewBars ? p.label : truncateLabel(p.label, labelMax)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Weekly on-time % bars with target reference line. */
export function SlaWeeklyRateChart({
  periods,
  targetPct = 95,
  height: heightProp,
}: {
  periods: { label: string; title?: string; rate: number }[];
  targetPct?: number;
  height?: number;
}) {
  if (!periods.length) return null;
  const n = periods.length;
  const height = heightProp ?? periodChartHeight(n);
  const max = 100;
  const padB = periodBottomPad(n);
  const padT = 20;
  const chartH = height - padB - padT;
  const spread = n <= 8;
  const { barW, gap, svgWidth, padL, padR, fullWidth } = periodChartDimensions(n, spread);
  const plotW = svgWidth - padL - padR;
  const slotW = n > 0 ? plotW / n : plotW;
  const targetY = padT + chartH * (1 - targetPct / max);
  const lineX2 = padL + plotW;
  const labelY = height - 10;

  return (
    <PeriodChartFrame svgWidth={svgWidth} height={height} fullWidth={fullWidth}>
      {[0, 25, 50, 75, 100].map((tick) => {
        const y = padT + chartH * (1 - tick / max);
        return (
          <g key={tick}>
            <line x1={padL} y1={y} x2={lineX2 + 8} y2={y} stroke="var(--color-line)" strokeDasharray="3 3" />
            <text x={padL - 6} y={y + 3} textAnchor="end" className="fill-[color:var(--color-ink-muted)] text-[8px]">
              {tick}%
            </text>
          </g>
        );
      })}
      <line
        x1={padL}
        y1={targetY}
        x2={lineX2}
        y2={targetY}
        stroke={CHART.warning}
        strokeWidth={1.5}
        strokeDasharray="6 4"
      />
      <text x={lineX2 + 4} y={targetY + 3} className="fill-[color:var(--color-ink-muted)] text-[8px]">
        {targetPct}%
      </text>
      {periods.map((p, i) => {
        const h = (p.rate / max) * chartH;
        const x = spread ? padL + i * slotW + (slotW - barW) / 2 : padL + i * (barW + gap);
        const cx = x + barW / 2;
        const fill = p.rate >= targetPct ? CHART.success : p.rate >= targetPct - 8 ? CHART.warning : CHART.danger;
        return (
          <g key={`${p.label}-${i}`}>
            <rect x={x} y={padT + chartH - h} width={barW} height={Math.max(2, h)} rx={4} fill={fill}>
              <title>{`${p.title ?? p.label}: ${formatPct(p.rate, 1)}`}</title>
            </rect>
            <text
              x={cx}
              y={padT + chartH - h - 5}
              textAnchor="middle"
              className="fill-[color:var(--color-ink)] text-[10px] font-semibold"
            >
              {formatPct(p.rate, 0)}
            </text>
            <PeriodXAxisLabel
              cx={cx}
              baseY={labelY}
              label={p.label}
              title={p.title}
              show={periodShowXLabel(i, n, plotW)}
            />
          </g>
        );
      })}
    </PeriodChartFrame>
  );
}

/** Stacked bars: green + red per period. */
export function StackedBarChart({
  periods,
  height: heightProp,
}: {
  periods: { label: string; title?: string; onTime: number; breached: number }[];
  height?: number;
}) {
  if (!periods.length) return null;
  const n = periods.length;
  const height = heightProp ?? periodChartHeight(n);
  const max = Math.max(1, ...periods.map((p) => p.onTime + p.breached));
  const padB = periodBottomPad(n);
  const padT = 12;
  const chartH = height - padB - padT;
  const spread = n <= 8;
  const { barW, gap, svgWidth, padL, padR, fullWidth } = periodChartDimensions(n, spread);
  const plotW = svgWidth - padL - padR;
  const slotW = n > 0 ? plotW / n : plotW;
  const labelY = height - 10;

  return (
    <PeriodChartFrame svgWidth={svgWidth} height={height} fullWidth={fullWidth}>
      {[0, 0.5, 1].map((t) => {
        const y = padT + chartH * (1 - t);
        const v = Math.round(max * t);
        return (
          <g key={t}>
            <line x1={padL} y1={y} x2={padL + plotW + 8} y2={y} stroke="var(--color-line)" strokeDasharray="3 3" />
            <text x={padL - 6} y={y + 3} textAnchor="end" className="fill-[color:var(--color-ink-muted)] text-[8px]">
              {formatCount(v)}
            </text>
          </g>
        );
      })}
      {periods.map((p, i) => {
        const total = p.onTime + p.breached;
        const x = spread ? padL + i * slotW + (slotW - barW) / 2 : padL + i * (barW + gap);
        const cx = x + barW / 2;
        let yOff = padT + chartH;
        return (
          <g key={`${p.label}-${i}`}>
            {[
              { v: p.onTime, fill: CHART.success },
              { v: p.breached, fill: CHART.danger },
            ].map((stack) => {
              const h = (stack.v / max) * chartH;
              yOff -= h;
              return (
                <rect
                  key={stack.fill}
                  x={x}
                  y={yOff}
                  width={barW}
                  height={Math.max(0, h)}
                  rx={stack.fill === CHART.danger ? 0 : 3}
                  fill={stack.fill}
                >
                  <title>{`${p.title ?? p.label} — ${formatCount(stack.v)}`}</title>
                </rect>
              );
            })}
            <PeriodXAxisLabel
              cx={cx}
              baseY={labelY}
              label={p.label}
              title={p.title}
              show={periodShowXLabel(i, n, plotW)}
            />
            <text
              x={cx}
              y={padT - 4}
              textAnchor="middle"
              className="fill-[color:var(--color-ink)] text-[10px] font-semibold"
            >
              {formatCount(total)}
            </text>
          </g>
        );
      })}
    </PeriodChartFrame>
  );
}

/** Compact weekly delivery summary when the date range spans few calendar weeks. */
export function WeeklyDeliveryOverview({
  periods,
  targetPct = 95,
  labels,
}: {
  periods: { label: string; title?: string; onTime: number; breached: number; rate: number }[];
  targetPct?: number;
  labels: {
    week: string;
    onTime: string;
    breached: string;
    rate: string;
    target: string;
    volumeChart: string;
    rateChart: string;
    belowTarget: string;
    onTarget: string;
  };
}) {
  if (!periods.length) return null;

  return (
    <div className="space-y-5">
      <div
        className={clsx(
          "grid gap-3",
          periods.length === 1 ? "grid-cols-2 sm:grid-cols-4" : "sm:grid-cols-2 lg:grid-cols-3",
        )}
      >
        {periods.map((p) => {
          const meetsTarget = p.rate >= targetPct;
          return (
            <div
              key={p.label}
              className="rounded-xl border border-[color:var(--color-border-report)] bg-gradient-to-br from-[color:var(--color-paper-2)]/80 to-white p-4 shadow-sm"
            >
              <p className="text-xs font-medium text-[color:var(--color-ink-muted)]" title={p.title ?? p.label}>
                {p.title ?? p.label}
              </p>
              <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-[color:var(--color-ink)]">
                {formatPct(p.rate, 0)}
              </p>
              <p className="mt-0.5 text-xs text-[color:var(--color-ink-muted)]">{labels.rate}</p>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-[color:var(--color-line)]/60 pt-3 text-xs">
                <span className="text-[color:var(--color-ink-soft)]">
                  <span className="font-semibold text-[color:var(--color-success)]">{formatCount(p.onTime)}</span>{" "}
                  {labels.onTime}
                </span>
                <span className="text-[color:var(--color-ink-soft)]">
                  <span className="font-semibold text-[color:var(--color-danger)]">{formatCount(p.breached)}</span>{" "}
                  {labels.breached}
                </span>
              </div>
              <p
                className={clsx(
                  "mt-2 text-[11px] font-medium",
                  meetsTarget ? "text-[color:var(--color-success)]" : "text-[color:var(--color-warning)]",
                )}
              >
                {meetsTarget
                  ? `${labels.onTarget} (${labels.target} ${targetPct}%)`
                  : `${labels.belowTarget} (${labels.target} ${targetPct}%)`}
              </p>
            </div>
          );
        })}
      </div>
      <div
        className={clsx(
          "grid gap-4",
          periods.length === 1 ? "mx-auto max-w-2xl grid-cols-1 sm:grid-cols-2" : "grid-cols-1 lg:grid-cols-2",
        )}
      >
        <div className="rounded-xl border border-[color:var(--color-border-report)] bg-[color:var(--color-surface-elevated)]/50 p-4">
          <p className="mb-1 text-sm font-medium text-[color:var(--color-ink)]">{labels.volumeChart}</p>
          <StackedBarChart periods={periods} />
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[color:var(--color-ink-soft)]">
            <li className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: CHART.success }} />
              {labels.onTime}
            </li>
            <li className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: CHART.danger }} />
              {labels.breached}
            </li>
          </ul>
        </div>
        <div className="rounded-xl border border-[color:var(--color-border-report)] bg-[color:var(--color-surface-elevated)]/50 p-4">
          <p className="mb-1 text-sm font-medium text-[color:var(--color-ink)]">{labels.rateChart}</p>
          <SlaWeeklyRateChart periods={periods.map((p) => ({ label: p.label, rate: p.rate }))} targetPct={targetPct} />
        </div>
      </div>
    </div>
  );
}

/** Line chart with visible points — scales to full card width. */
export function LineChart({
  series,
  height: heightProp,
}: {
  series: {
    label: string;
    color: string;
    points: { label: string; value: number; title?: string }[];
  }[];
  height?: number;
  yLabel?: string;
}) {
  const allVals = series.flatMap((s) => s.points.map((p) => p.value));
  if (!allVals.length) return null;

  const n = Math.max(...series.map((s) => s.points.length), 1);
  const padL = 52;
  const padR = 36;
  const padB = periodBottomPad(n);
  const padT = 20;
  const height = heightProp ?? periodChartHeight(Math.min(n, 24));
  const chartH = height - padB - padT;
  const max = Math.max(1, ...allVals);
  const svgWidth = 720;
  const plotW = svgWidth - padL - padR;
  const labelY = height - 10;

  const xAt = (index: number, count: number) =>
    padL + (index / Math.max(count - 1, 1)) * plotW;

  return (
    <PeriodChartFrame svgWidth={svgWidth} height={height} fullWidth>
      {[0, 0.25, 0.5, 0.75, 1].map((t) => {
        const y = padT + chartH * (1 - t);
        const v = Math.round(max * t);
        return (
          <g key={t}>
            <line
              x1={padL}
              y1={y}
              x2={svgWidth - padR}
              y2={y}
              stroke="var(--color-line)"
              strokeDasharray="3 3"
            />
            <text
              x={padL - 8}
              y={y + 3}
              textAnchor="end"
              className="fill-[color:var(--color-ink-muted)] text-[9px] tabular-nums"
            >
              {formatCount(v)}
            </text>
          </g>
        );
      })}
      {series.map((s) => {
        const count = s.points.length;
        const coords = s.points.map((p, i) => {
          const x = xAt(i, count);
          const y = padT + chartH - (p.value / max) * chartH;
          return { x, y, ...p };
        });
        const line = coords.map((c) => `${c.x},${c.y}`).join(" ");
        return (
          <g key={s.label}>
            <polyline
              points={line}
              fill="none"
              stroke={s.color}
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {coords.map((c) => (
              <circle key={`${s.label}-${c.label}`} cx={c.x} cy={c.y} r={3.5} fill={s.color}>
                <title>
                  {c.title ?? `${s.label} · ${c.label}: ${formatCount(c.value)}`}
                </title>
              </circle>
            ))}
          </g>
        );
      })}
      {series[0]?.points.map((p, i) => (
        <PeriodXAxisLabel
          key={`${p.label}-${i}`}
          cx={xAt(i, series[0].points.length)}
          baseY={labelY}
          label={p.label}
          title={p.title ?? p.label}
          show={periodShowXLabel(i, n, plotW)}
        />
      ))}
    </PeriodChartFrame>
  );
}

function HourHeatmapCell({
  hour,
  value,
  max,
  peakHour,
  formatCellValue,
  getCellTitle,
}: {
  hour: number;
  value: number;
  max: number;
  peakHour?: number;
  formatCellValue?: (value: number) => string;
  getCellTitle?: (hour: number, value: number) => string;
}) {
  const intensity = value / max;
  const isPeak = peakHour === hour;
  const title =
    getCellTitle?.(hour, value) ?? `${hour}:00 — ${formatCount(value)} requests`;
  const cellText =
    value > 0
      ? formatCellValue
        ? formatCellValue(value)
        : value >= 1000
          ? `${(value / 1000).toFixed(1)}k`
          : formatCount(value)
      : "";

  return (
    <div className="flex min-w-0 flex-col items-center gap-1">
      <div
        title={title}
        className={clsx(
          "flex h-11 w-full min-w-0 items-center justify-center rounded-md border px-1 text-[10px] font-semibold leading-none tabular-nums sm:h-12 sm:text-xs",
          isPeak ? "border-[color:var(--color-ink)] ring-2 ring-[color:var(--color-info)]/30" : "border-transparent",
          value > 0 ? "text-white" : "text-[color:var(--color-ink-muted)]",
        )}
        style={{ background: heatBlue(intensity) }}
      >
        {cellText}
      </div>
      <span className="text-[10px] tabular-nums text-[color:var(--color-ink-muted)]">{hour}</span>
    </div>
  );
}

export function HourHeatmap({
  counts,
  peakHour,
  xLabel,
  legendLow = "Low",
  legendHigh = "High",
  formatCellValue,
  getCellTitle,
}: {
  counts: Record<number, number>;
  peakHour?: number;
  xLabel?: string;
  legendLow?: string;
  legendHigh?: string;
  formatCellValue?: (value: number) => string;
  getCellTitle?: (hour: number, value: number) => string;
}) {
  const max = Math.max(1, ...Object.values(counts));
  const hourRows = [
    Array.from({ length: 12 }, (_, i) => i),
    Array.from({ length: 12 }, (_, i) => i + 12),
  ];

  return (
    <div className="w-full min-w-0 space-y-3">
      <div className="space-y-2">
        {hourRows.map((hours, row) => (
          <div key={row} className="grid w-full grid-cols-12 gap-1 sm:gap-1.5">
            {hours.map((h) => (
              <HourHeatmapCell
                key={h}
                hour={h}
                value={counts[h] ?? 0}
                max={max}
                peakHour={peakHour}
                formatCellValue={formatCellValue}
                getCellTitle={getCellTitle}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2 text-xs text-[color:var(--color-ink-muted)] sm:flex-row sm:items-center sm:justify-between">
        <span className="shrink-0">{xLabel ?? "Hour of day"}</span>
        <div className="flex min-w-0 items-center gap-1">
          <span className="shrink-0">{legendLow}</span>
          <div className="flex h-3 min-w-0 flex-1 max-w-24 overflow-hidden rounded-sm sm:flex-none">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="flex-1" style={{ background: heatBlue(i / 7) }} />
            ))}
          </div>
          <span className="shrink-0">{legendHigh}</span>
        </div>
      </div>
    </div>
  );
}

export function HorizontalBars({
  items,
  max,
  valueFormatter = formatCount,
  labelMax = 36,
}: {
  items: { label: string; value: number; fill?: string }[];
  max?: number;
  valueFormatter?: (n: number) => string;
  /** Max chars before ellipsis; full name stays in title/tooltip. */
  labelMax?: number;
}) {
  const peak = max ?? Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="flex w-full max-h-96 flex-col gap-3 overflow-y-auto">
      {items.map((item) => (
        <div key={item.label} className="grid grid-cols-[minmax(7rem,14rem)_1fr_3.5rem] items-center gap-3 text-sm">
          <span className="truncate text-[color:var(--color-ink-soft)]" title={item.label}>
            {truncateLabel(item.label, labelMax)}
          </span>
          <div className="h-3 overflow-hidden rounded-full bg-[color:var(--color-paper-2)]">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.max(4, (item.value / peak) * 100)}%`,
                background: item.fill ?? CHART.info,
              }}
              title={`${item.label}: ${valueFormatter(item.value)}`}
            />
          </div>
          <span className="min-w-[3rem] text-right tabular-nums font-semibold">{valueFormatter(item.value)}</span>
        </div>
      ))}
    </div>
  );
}

/** Request lifecycle funnel — event counts per stage (not minutes). */
export function ActivityCountFunnel({
  stages,
}: {
  stages: { label: string; value: number; fill?: string }[];
}) {
  const max = Math.max(1, ...stages.map((s) => s.value));
  return (
    <ul className="flex w-full min-w-0 flex-col gap-3">
      {stages.map((s) => {
        const fill = s.fill ?? CHART.accent;
        return (
          <li key={s.label} className="min-w-0">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-[color:var(--color-border-report)] bg-[color:var(--color-paper-2)]/50 px-4 py-2.5">
              <span className="min-w-0 text-sm font-medium text-[color:var(--color-ink)]">{s.label}</span>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-[color:var(--color-ink)]">
                {formatCount(s.value)}
              </span>
            </div>
            <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-white ring-1 ring-[color:var(--color-line)]/60">
              <div
                className="h-full rounded-full"
                style={{ width: `${(s.value / max) * 100}%`, background: fill }}
                title={`${s.label}: ${formatCount(s.value)}`}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export type StageDurationStats = { p50: number; p90: number; p95: number };

/** Stage duration rows — equal card height, bar length shows relative minutes. */
export function FunnelChart({
  stages,
  slaMinutes = 15,
}: {
  stages: { label: string; value: number; stats: StageDurationStats }[];
  slaMinutes?: number;
}) {
  const { t } = useTranslation();
  const minUnit = t("reports.min");
  const max = Math.max(1, ...stages.map((s) => s.value));

  const statLine = (key: "stage_stat_p50" | "stage_stat_p90" | "stage_stat_p95", n: number) =>
    t(`reports.brs.${key}`, { n, unit: minUnit });

  return (
    <ul className="grid w-full min-w-0 gap-3 sm:grid-cols-2">
      {stages.map((s, i) => {
        const fill = slaStageColor(s.value, slaMinutes * (i === stages.length - 1 ? 1 : 0.35 + i * 0.15));
        return (
          <li key={s.label} className="min-w-0">
            <div className="flex h-full min-h-[9.25rem] flex-col rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-paper-2)]/40 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <span className="min-w-0 flex-1 text-sm font-medium leading-snug text-[color:var(--color-ink)]">
                  {s.label}
                </span>
                <div className="shrink-0 text-right">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-[color:var(--color-ink-muted)]">
                    {t("reports.brs.stage_avg_label")}
                  </p>
                  <p className="text-sm font-semibold tabular-nums text-[color:var(--color-ink)]">
                    {s.value.toFixed(1)} {minUnit}
                  </p>
                </div>
              </div>
              <ul className="mt-2.5 min-h-[3.6rem] flex-1 space-y-1.5 text-[11px] leading-snug text-[color:var(--color-ink-muted)]">
                <li className="flex gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[color:var(--color-ink-muted)]/70" aria-hidden />
                  <span>{statLine("stage_stat_p50", s.stats.p50)}</span>
                </li>
                <li className="flex gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[color:var(--color-ink-muted)]/70" aria-hidden />
                  <span>{statLine("stage_stat_p90", s.stats.p90)}</span>
                </li>
                <li className="flex gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[color:var(--color-ink-muted)]/70" aria-hidden />
                  <span>{statLine("stage_stat_p95", s.stats.p95)}</span>
                </li>
              </ul>
              <div className="mt-auto pt-2.5">
                <div className="h-2.5 overflow-hidden rounded-full bg-white ring-1 ring-[color:var(--color-line)]/60">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(s.value / max) * 100}%`, background: fill }}
                    title={`${s.label}: ${s.value.toFixed(1)} ${minUnit}`}
                  />
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Staff scatter: all points, quadrant colors, outlier labels. */
export function StaffScatterChart({
  points,
  xLabel,
  yLabel,
}: {
  points: { label: string; x: number; y: number }[];
  xLabel: string;
  yLabel: string;
}) {
  if (points.length < 3) {
    return (
      <p className="py-8 text-center text-sm text-[color:var(--color-ink-muted)]">
        Not enough staff data for scatter chart.
      </p>
    );
  }

  const w = 480;
  const h = 280;
  const padL = 48;
  const padR = 16;
  const padT = 16;
  const padB = 40;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const xMin = Math.min(...xs) * 0.9;
  const xMax = Math.max(...xs) * 1.1;
  const yMin = Math.max(0, Math.min(...ys) - 5);
  const yMax = Math.min(100, Math.max(...ys) + 5);
  const xMed = xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;
  const yMed = ys.slice().sort((a, b) => a - b)[Math.floor(ys.length / 2)] ?? 0;

  const scaleX = (v: number) => padL + ((v - xMin) / (xMax - xMin || 1)) * (w - padL - padR);
  const scaleY = (v: number) => h - padB - ((v - yMin) / (yMax - yMin || 1)) * (h - padB - padT);

  const byY = [...points].sort((a, b) => b.y - a.y);
  const labelSet = new Set([
    ...byY.slice(0, 3).map((p) => p.label),
    ...byY.slice(-3).map((p) => p.label),
  ]);

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} className="max-w-full" role="img">
      <rect x={scaleX(xMed)} y={padT} width={1} height={h - padB - padT} fill="var(--color-line)" strokeDasharray="4 4" />
      <rect x={padL} y={scaleY(yMed)} width={w - padL - padR} height={1} fill="var(--color-line)" strokeDasharray="4 4" />
      <line x1={padL} y1={h - padB} x2={w - padR} y2={h - padB} stroke="var(--color-line)" />
      <line x1={padL} y1={padT} x2={padL} y2={h - padB} stroke="var(--color-line)" />
      {points.map((p) => {
        const cx = scaleX(p.x);
        const cy = scaleY(p.y);
        const fill = scatterQuadrantColor(p.x, p.y, xMed, yMed);
        return (
          <g key={p.label}>
            <circle cx={cx} cy={cy} r={6} fill={fill} opacity={0.9}>
              <title>{`${p.label}\n${xLabel}: ${p.x.toFixed(1)} min\n${yLabel}: ${formatPct(p.y, 1)}`}</title>
            </circle>
            {labelSet.has(p.label) ? (
              <text x={cx} y={cy - 10} textAnchor="middle" className="fill-[color:var(--color-ink)] text-[8px] font-medium">
                {truncateLabel(p.label, 12)}
              </text>
            ) : null}
          </g>
        );
      })}
      <text x={w / 2} y={h - 6} textAnchor="middle" className="fill-[color:var(--color-ink-muted)] text-[10px] font-medium">
        {xLabel}
      </text>
      <text
        x={14}
        y={h / 2}
        textAnchor="middle"
        transform={`rotate(-90 14 ${h / 2})`}
        className="fill-[color:var(--color-ink-muted)] text-[10px] font-medium"
      >
        {yLabel}
      </text>
    </svg>
  );
}

export function CompareBars({
  items,
  currentLabel = "Current",
  previousLabel = "Previous",
}: {
  items: { label: string; current: number; previous: number; unit?: string }[];
  currentLabel?: string;
  previousLabel?: string;
}) {
  const barWidth = (value: number, rowMax: number) => {
    if (value <= 0) return "0%";
    const pct = (value / rowMax) * 100;
    return `${Math.max(pct < 100 ? 4 : 100, pct)}%`;
  };

  return (
    <div className="space-y-4">
      {items.map((item) => {
        const rowMax = Math.max(1, item.current, item.previous);
        return (
          <div key={item.label}>
            <p className="mb-1.5 text-sm font-medium text-[color:var(--color-ink)]">{item.label}</p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs">
                <span className="w-20 shrink-0 text-[color:var(--color-ink-muted)]">{currentLabel}</span>
                <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[color:var(--color-paper-2)]">
                  <div
                    className="h-full rounded-full"
                    style={{ width: barWidth(item.current, rowMax), background: CHART.accent }}
                  />
                </div>
                <span className="w-24 shrink-0 text-right tabular-nums font-medium">
                  {item.current}
                  {item.unit ?? ""}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="w-20 shrink-0 text-[color:var(--color-ink-muted)]">{previousLabel}</span>
                <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[color:var(--color-paper-2)]">
                  <div
                    className="h-full rounded-full opacity-70"
                    style={{ width: barWidth(item.previous, rowMax), background: CHART.gray }}
                  />
                </div>
                <span className="w-24 shrink-0 text-right tabular-nums text-[color:var(--color-ink-muted)]">
                  {item.previous}
                  {item.unit ?? ""}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function UrgencyBar({ days, maxDays = 30 }: { days: number; maxDays?: number }) {
  const pct = Math.min(100, (days / maxDays) * 100);
  const fill =
    days < 7 ? CHART.danger : days < 14 ? CHART.warning : CHART.success;
  return (
    <div className="h-2 w-full min-w-[4rem] overflow-hidden rounded-full bg-[color:var(--color-paper-2)]">
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: fill }} title={`${days.toFixed(1)} days left`} />
    </div>
  );
}

/** Workload bars with team mean and deviation coloring. */
export function WorkloadDeviationBars({
  items,
  mean,
  valueFormatter = formatCount,
}: {
  items: { label: string; value: number }[];
  mean: number;
  valueFormatter?: (n: number) => string;
}) {
  const peak = Math.max(1, ...items.map((i) => i.value), mean);
  return (
    <div className="relative flex max-h-96 flex-col gap-3 overflow-y-auto">
      {items.map((item) => {
        const ratio = item.value / mean;
        const fill =
          ratio >= 1.25 ? CHART.danger : ratio >= 1.1 ? CHART.warning : ratio <= 0.85 ? CHART.info : CHART.success;
        return (
          <div key={item.label} className="grid grid-cols-[minmax(6rem,9rem)_1fr_auto] items-center gap-2 text-sm">
            <span className="truncate text-[color:var(--color-ink-soft)]" title={item.label}>
              {truncateLabel(item.label, 20)}
            </span>
            <div className="relative h-3 overflow-hidden rounded-full bg-[color:var(--color-paper-2)]">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.max(4, (item.value / peak) * 100)}%`, background: fill }}
                title={`${item.label}: ${valueFormatter(item.value)}`}
              />
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-[color:var(--color-ink)]/40"
                style={{ left: `${Math.min(98, (mean / peak) * 100)}%` }}
                title={`Mean: ${valueFormatter(mean)}`}
              />
            </div>
            <span className="min-w-[3rem] text-right tabular-nums font-semibold">{valueFormatter(item.value)}</span>
          </div>
        );
      })}
      <p className="text-xs text-[color:var(--color-ink-muted)]">
        | = {valueFormatter(Math.round(mean))} ({formatPct((mean / peak) * 100, 0)} scale)
      </p>
    </div>
  );
}

export function chartColor(i: number): string {
  return accentShade(i);
}

export { complianceBarColor };
