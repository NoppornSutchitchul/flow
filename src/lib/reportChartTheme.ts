/** Semantic chart colors — consistent across all BRS reports. */

export const CHART = {
  success: "var(--color-success, #10b981)",
  warning: "var(--color-warning, #f59e0b)",
  danger: "var(--color-danger, #ef4444)",
  info: "#3b82f6",
  accent: "var(--color-accent, #6366f1)",
  gray: "#94a3b8",
  manual: "#3b82f6",
  auto: "var(--color-success, #10b981)",
  reassigned: "var(--color-warning, #f59e0b)",
} as const;

/** Indigo shades for multi-series bars (same hue family). */
const ACCENT_SHADES = ["#4f46e5", "#6366f1", "#818cf8", "#a5b4fc", "#c7d2fe"] as const;

export function accentShade(i: number): string {
  return ACCENT_SHADES[i % ACCENT_SHADES.length];
}

/** Distinct hues for multi-series line charts (lines are easy to tell apart). */
const SERIES_LINE_COLORS = [
  "#2563eb",
  "#059669",
  "#d97706",
  "#dc2626",
  "#7c3aed",
  "#0891b2",
  "#ea580c",
  "#db2777",
] as const;

export function seriesLineColor(i: number): string {
  return SERIES_LINE_COLORS[i % SERIES_LINE_COLORS.length];
}

export function complianceBarColor(complianceRate: number, breachRate: number): string {
  if (breachRate >= 20) return CHART.danger;
  if (complianceRate >= 90) return CHART.success;
  if (complianceRate >= 80) return CHART.warning;
  return CHART.danger;
}

/** @deprecated Use CHART.accent + accentShade */
export function seriesColor(i: number): string {
  return accentShade(i);
}

/** Heatmap blue gradient: light (low) → dark (high). */
export function heatBlue(intensity: number): string {
  const t = Math.min(1, Math.max(0, intensity));
  const r = Math.round(239 - t * 187);
  const g = Math.round(246 - t * 118);
  const b = Math.round(255 - t * 12);
  return `rgb(${r},${g},${b})`;
}

export function slaStageColor(minutes: number, slaBudget: number): string {
  if (minutes <= slaBudget * 0.85) return CHART.success;
  if (minutes <= slaBudget) return CHART.warning;
  return CHART.danger;
}

export function scatterQuadrantColor(x: number, y: number, xMed: number, yMed: number): string {
  const fast = x <= xMed;
  const quality = y >= yMed;
  if (fast && quality) return CHART.success;
  if (fast && !quality) return CHART.warning;
  if (!fast && quality) return CHART.warning;
  return CHART.danger;
}

export function daysLeftBarColor(days: number): string {
  if (days < 7) return CHART.danger;
  if (days < 14) return CHART.warning;
  return CHART.success;
}

/** Timeline event kind → semantic bar/pill color. */
export function timelineKindColor(kind: string): string {
  switch (kind) {
    case "created":
      return CHART.accent;
    case "auto_assigned":
      return CHART.auto;
    case "reassigned":
      return CHART.reassigned;
    case "accepted":
    case "started":
    case "resumed":
      return CHART.info;
    case "paused":
    case "dnd_reported":
    case "dnd_cleared":
    case "dnd_defer":
      return CHART.warning;
    case "delivered":
      return CHART.success;
    case "cancelled":
      return CHART.danger;
    default:
      return CHART.gray;
  }
}
