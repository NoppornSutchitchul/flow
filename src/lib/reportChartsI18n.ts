import type { TFunction } from "i18next";

export function heatmapLegendLabels(t: TFunction): { low: string; high: string } {
  return {
    low: t("reports.charts.legend_low"),
    high: t("reports.charts.legend_high"),
  };
}
