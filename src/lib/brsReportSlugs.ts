/** Standard BRS analytics report slugs (17). */
export const BRS_REPORT_SLUGS = [
  "sla-compliance",
  "response-time-analysis",
  "request-volume-forecast",
  "staff-performance-scorecard",
  "workload-distribution",
  "auto-assignment-effectiveness",
  "stock-consumption-analysis",
  "low-stock-stockout",
  "stock-movement-audit",
  "request-lifecycle-activity",
  "timeline-activity-log",
  "cancellation-analysis",
  "pause-delay-analysis",
  "dnd-incident-report",
  "month-over-month-comparison",
  "service-only-room-requests",
  "stock-only-room-requests",
] as const;

export type BrsReportSlug = (typeof BRS_REPORT_SLUGS)[number];

export function isBrsReportSlug(slug: string): slug is BrsReportSlug {
  return (BRS_REPORT_SLUGS as readonly string[]).includes(slug);
}
