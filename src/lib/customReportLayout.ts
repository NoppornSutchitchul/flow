export type CustomReportBlock =
  | { type: "preset"; slug: string }
  | { type: "heading"; text: string }
  | { type: "note"; text: string };

export interface CustomReportLayout {
  version: 1;
  period_days: number;
  blocks: CustomReportBlock[];
}

export function defaultCustomReportLayout(): CustomReportLayout {
  return {
    version: 1,
    period_days: 7,
    blocks: [{ type: "preset", slug: "operations-overview" }],
  };
}

export function parseCustomReportLayout(raw: string | null | undefined): CustomReportLayout {
  try {
    const parsed = JSON.parse(raw || "{}") as Partial<CustomReportLayout>;
    if (parsed.version !== 1 || !Array.isArray(parsed.blocks)) {
      return defaultCustomReportLayout();
    }
    const blocks = parsed.blocks.filter((b): b is CustomReportBlock => {
      if (!b || typeof b !== "object") return false;
      const t = (b as CustomReportBlock).type;
      if (t === "preset") return typeof (b as { slug?: string }).slug === "string";
      if (t === "heading" || t === "note") {
        return typeof (b as { text?: string }).text === "string";
      }
      return false;
    });
    const days =
      typeof parsed.period_days === "number" && parsed.period_days >= 1
        ? Math.min(365, Math.round(parsed.period_days))
        : 7;
    return {
      version: 1,
      period_days: days,
      blocks: blocks.length > 0 ? blocks : defaultCustomReportLayout().blocks,
    };
  } catch {
    return defaultCustomReportLayout();
  }
}

export function serializeCustomReportLayout(layout: CustomReportLayout): string {
  return JSON.stringify(layout);
}
