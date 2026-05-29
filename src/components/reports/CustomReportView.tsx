import { useTranslation } from "react-i18next";
import { useQueries } from "@tanstack/react-query";

import { PresetReportBody } from "./PresetReportBody";
import { reportsApi } from "../../lib/api";
import { parseCustomReportLayout } from "../../lib/customReportLayout";

type Props = {
  layoutJson: string;
  className?: string;
};

export function CustomReportView({ layoutJson, className }: Props) {
  const { t } = useTranslation();
  const layout = parseCustomReportLayout(layoutJson);
  const presetSlugs = layout.blocks
    .filter((b): b is { type: "preset"; slug: string } => b.type === "preset")
    .map((b) => b.slug);

  const presetQueries = useQueries({
    queries: presetSlugs.map((slug) => ({
      queryKey: ["reports", "preset", slug, layout.period_days],
      queryFn: () => reportsApi.presetData(slug, layout.period_days),
    })),
  });

  const presetDataBySlug = new Map(
    presetSlugs.map((slug, i) => [slug, presetQueries[i]?.data?.data]),
  );

  if (layout.blocks.length === 0) {
    return (
      <p className="text-sm text-[color:var(--color-ink-muted)]">
        {t("reports.custom_no_blocks")}
      </p>
    );
  }

  return (
    <div className={className ?? "space-y-6"}>
      {layout.blocks.map((block, index) => {
        if (block.type === "heading") {
          return (
            <h3
              key={`h-${index}`}
              className="text-base font-semibold text-[color:var(--color-ink)]"
            >
              {block.text || "—"}
            </h3>
          );
        }
        if (block.type === "note") {
          return (
            <p
              key={`n-${index}`}
              className="rounded-lg border border-[color:var(--color-line)]/80 bg-[color:var(--color-paper-2)]/50 px-3 py-2 text-sm text-[color:var(--color-ink-soft)]"
            >
              {block.text || "—"}
            </p>
          );
        }
        const data = presetDataBySlug.get(block.slug);
        const metaSlug = block.slug;
        const loading = presetQueries[presetSlugs.indexOf(block.slug)]?.isLoading;
        return (
          <section
            key={`p-${index}-${block.slug}`}
            className="rounded-xl border border-[color:var(--color-line)] bg-white p-4 shadow-sm"
          >
            <h3 className="mb-3 text-sm font-semibold text-[color:var(--color-ink-soft)]">
              {t(`reports.presets.${metaSlug.replace(/-/g, "_")}`, {
                defaultValue: metaSlug,
              })}
            </h3>
            {loading && (
              <p className="text-sm text-[color:var(--color-ink-muted)]">
                {t("common.loading")}
              </p>
            )}
            {data && <PresetReportBody slug={block.slug} data={data} />}
            {!loading && !data && (
              <p className="text-sm text-[color:var(--color-ink-muted)]">—</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
