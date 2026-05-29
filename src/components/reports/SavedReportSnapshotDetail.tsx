import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronLeft, Share2, Trash2 } from "lucide-react";
import { ReportShareDialog } from "./ReportShareDialog";

import { PresetReportBody } from "./PresetReportBody";
import { ReportDocument } from "./reportUi";
import { reportsApi } from "../../lib/api";
import { useDepartments } from "../../lib/departments";
import { formatReportDateTime } from "../../lib/format";
import { reportPresetDisplayLabel } from "../../lib/reportPresetLabel";
import {
  formatIsoDateForSnapshotTitle,
  parseSavedReportSnapshotLayout,
} from "../../lib/savedReportSnapshot";
import { ReportsHubProvider } from "../../lib/ReportsHubContext";
import type { ReportPresetMeta } from "../../lib/types";

type Props = {
  reportId: number;
  presets: ReportPresetMeta[];
  canManage: boolean;
  onBack: () => void;
  onDeleted?: () => void;
};

export function SavedReportSnapshotDetail({
  reportId,
  presets,
  canManage,
  onBack,
  onDeleted,
}: Props) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [shareOpen, setShareOpen] = useState(false);
  const { departmentLabel } = useDepartments(true);

  const { data: report, isLoading } = useQuery({
    queryKey: ["reports", "custom", reportId],
    queryFn: () => reportsApi.customGet(reportId),
  });

  const deleteMut = useMutation({
    mutationFn: () => reportsApi.customDelete(reportId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["reports", "custom"] });
      onDeleted?.();
      onBack();
    },
  });

  if (isLoading || !report) {
    return (
      <p className="text-sm text-[color:var(--color-ink-muted)]">{t("common.loading")}</p>
    );
  }

  const layout = parseSavedReportSnapshotLayout(report.layout_json);
  if (!layout) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-900">
        <p>{t("reports.snapshot_invalid")}</p>
        <button
          type="button"
          onClick={onBack}
          className="mt-3 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium"
        >
          {t("common.back")}
        </button>
      </div>
    );
  }

  const meta = presets.find((p) => p.slug === layout.preset_slug);
  const reportTitle =
    report.title ||
    (meta ? reportPresetDisplayLabel(meta, t) : layout.preset_slug);
  const f = layout.filters;
  const lang = i18n.language;
  const dateFromLabel = formatIsoDateForSnapshotTitle(f.dateFrom, lang);
  const dateToLabel = formatIsoDateForSnapshotTitle(f.dateTo, lang);
  const generatedAt =
    typeof layout.snapshot.data.generated_at === "string"
      ? layout.snapshot.data.generated_at
      : layout.snapshot_at;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="no-print flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-9 items-center gap-1 rounded-lg border border-[color:var(--color-line)] bg-white px-3 text-sm font-medium hover:bg-[color:var(--color-paper-2)]"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          {t("common.back")}
        </button>
        {canManage && (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[color:var(--color-line)] bg-white px-3 text-sm font-medium hover:bg-[color:var(--color-paper-2)]"
            >
              <Share2 className="h-3.5 w-3.5" aria-hidden />
              {t("reports.share_btn")}
            </button>
            <button
              type="button"
              onClick={() => {
                if (!window.confirm(t("reports.snapshot_delete_confirm"))) return;
                deleteMut.mutate();
              }}
              disabled={deleteMut.isPending}
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              {t("common.delete")}
            </button>
          </div>
        )}
      </div>

      <ReportShareDialog
        reportId={reportId}
        reportTitle={reportTitle}
        open={shareOpen}
        onClose={() => setShareOpen(false)}
      />

      <div className="report-print-target min-h-0 flex-1 overflow-y-auto rounded-xl border border-[color:var(--color-line)] bg-white p-4 shadow-sm md:p-8">
        <ReportDocument
          title={reportTitle}
          meta={
            <>
              <span className="rounded-full border border-[color:var(--color-line)] bg-[color:var(--color-paper-2)]/50 px-2.5 py-0.5">
                {dateFromLabel} – {dateToLabel}
              </span>
              <span className="rounded-full border border-amber-200/80 bg-amber-50/80 px-2.5 py-0.5 text-amber-900">
                {t("reports.snapshot_frozen_badge")}
              </span>
              {f.department !== "all" && (
                <span className="rounded-full border border-[color:var(--color-line)] px-2.5 py-0.5">
                  {departmentLabel(f.department)}
                </span>
              )}
              {f.status !== "all" && (
                <span className="rounded-full border border-[color:var(--color-line)] px-2.5 py-0.5">
                  {t(`status.${f.status}`, f.status)}
                </span>
              )}
              {f.priority !== "all" && (
                <span className="rounded-full border border-[color:var(--color-line)] px-2.5 py-0.5">
                  {t(`priority.${f.priority}`, f.priority)}
                </span>
              )}
              <span>
                {t("reports.snapshot_saved_at", {
                  date: formatReportDateTime(layout.snapshot_at, i18n.language),
                })}
              </span>
              <span>
                {t("reports.generated_at", {
                  date: formatReportDateTime(generatedAt, i18n.language),
                })}
              </span>
            </>
          }
        >
          <ReportsHubProvider value={{ returnTo: "/reports", reportPage: 1, setReportPage: () => {} }}>
            <PresetReportBody slug={layout.preset_slug} data={layout.snapshot.data} />
          </ReportsHubProvider>
        </ReportDocument>
      </div>
    </div>
  );
}
