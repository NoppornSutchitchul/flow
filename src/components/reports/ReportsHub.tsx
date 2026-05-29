import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, Bookmark, FileText, Share2 } from "lucide-react";
import clsx from "clsx";

import { CustomReportEditor } from "./CustomReportEditor";
import { PresetReportBody } from "./PresetReportBody";
import { ReportCustomizeIsland } from "./ReportCustomizeIsland";
import { ReportPresetPicker } from "./ReportPresetPicker";
import { ReportShareDialog } from "./ReportShareDialog";
import { SaveReportSnapshotDialog } from "./SaveReportSnapshotDialog";
import { SavedReportListPanel } from "./SavedReportListPanel";
import { SavedReportSnapshotDetail } from "./SavedReportSnapshotDetail";
import { ReportDocument, ReportLoadingSkeleton, ReportRangeInvalidState } from "./reportUi";
import { reportsApi } from "../../lib/api";
import {
  DEFAULT_REPORT_FILTERS,
  defaultFiltersForPreset,
  reportFiltersDateRangeInvalid,
  type ReportFiltersState,
} from "../../lib/reportPresetFilters";
import { isSavedReportSnapshotLayout } from "../../lib/savedReportSnapshot";
import { buildSharedTabReports } from "../../lib/savedReportList";
import {
  buildSnapshotLayout,
  defaultSnapshotReportTitle,
  serializeSavedReportSnapshotLayout,
} from "../../lib/savedReportSnapshot";
import { useAuth } from "../../lib/auth";
import { useDepartments } from "../../lib/departments";
import { formatReportDateTime } from "../../lib/format";
import { formatPeriodRangeShort } from "../../lib/reportFormat";
import { reportPresetDisplayLabel } from "../../lib/reportPresetLabel";
import { ReportsHubProvider } from "../../lib/ReportsHubContext";
import {
  readReportsHubSnapshot,
  writeReportsHubSearchParams,
  type ReportsHubTab,
} from "../../lib/reportsHubPersistence";
type HubTab = ReportsHubTab;

function daysBetween(from: string, to: string): number {
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  const diff = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  return Math.min(365, Math.max(1, diff));
}

export function ReportsHub() {
  const { current } = useAuth();
  const qc = useQueryClient();
  const printRef = useRef<HTMLDivElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const boot = readReportsHubSnapshot(searchParams);

  const { t, i18n } = useTranslation();
  const [tab, setTab] = useState<HubTab>(boot?.tab ?? "presets");
  const [selectedSlug, setSelectedSlug] = useState<string | null>(boot?.preset ?? null);
  const [draftFilters, setDraftFilters] = useState<ReportFiltersState>(
    boot?.filters ?? DEFAULT_REPORT_FILTERS,
  );
  const [appliedFilters, setAppliedFilters] = useState<ReportFiltersState | null>(
    boot?.preset ? boot.filters : null,
  );
  const [reportPage, setReportPage] = useState(boot?.page ?? 1);
  const [fetchNonce, setFetchNonce] = useState(0);
  const prevSlugRef = useRef<string | null>(selectedSlug);

  const triggerFetch = useCallback((filters: ReportFiltersState) => {
    setAppliedFilters({ ...filters });
    setFetchNonce((n) => n + 1);
  }, []);

  const reportDays = useMemo(
    () =>
      appliedFilters
        ? daysBetween(appliedFilters.dateFrom, appliedFilters.dateTo)
        : daysBetween(draftFilters.dateFrom, draftFilters.dateTo),
    [appliedFilters, draftFilters.dateFrom, draftFilters.dateTo],
  );
  const { departmentLabel } = useDepartments(true);
  const [activeCustomId, setActiveCustomId] = useState<number | null>(null);
  const [customViewOnly, setCustomViewOnly] = useState(false);
  const [saveSnapshotOpen, setSaveSnapshotOpen] = useState(false);
  const [saveSnapshotError, setSaveSnapshotError] = useState<string | null>(null);
  const [shareReportId, setShareReportId] = useState<number | null>(null);
  const [shareReportTitle, setShareReportTitle] = useState("");

  const { data: presets = [], isLoading: presetsLoading } = useQuery({
    queryKey: ["reports", "presets"],
    queryFn: () => reportsApi.presets(),
  });

  const {
    data: presetData,
    isLoading: dataLoading,
    isError: dataError,
    error: dataErr,
    refetch: refetchPreset,
  } = useQuery({
    queryKey: ["reports", "preset", selectedSlug, fetchNonce, reportDays, appliedFilters],
    queryFn: () => {
      const f = appliedFilters!;
      return reportsApi.presetData(selectedSlug!, reportDays, {
        department: f.department,
        status: f.status,
        priority: f.priority,
        assigneeId: f.assigneeId,
        action: f.action,
        dateFrom: f.dateFrom,
        dateTo: f.dateTo,
        compareDateFrom: f.compareDateFrom,
        compareDateTo: f.compareDateTo,
        limit: f.limit,
        shift: f.shift,
        stockStatus: f.stockStatus,
      });
    },
    enabled:
      tab === "presets" &&
      Boolean(selectedSlug) &&
      appliedFilters !== null &&
      !reportFiltersDateRangeInvalid(appliedFilters, selectedSlug),
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  useEffect(() => {
    if (!presets.length) setSelectedSlug(null);
  }, [presets]);

  const handleSelectReport = (slug: string) => {
    setSelectedSlug(slug);
    setDraftFilters(defaultFiltersForPreset(slug));
    setAppliedFilters(null);
    setReportPage(1);
  };

  const rangeInvalid = useMemo(
    () => reportFiltersDateRangeInvalid(draftFilters, selectedSlug),
    [draftFilters, selectedSlug],
  );

  useEffect(() => {
    if (!selectedSlug) return;
    if (reportFiltersDateRangeInvalid(draftFilters, selectedSlug)) {
      setAppliedFilters(null);
      return;
    }
    triggerFetch(draftFilters);
  }, [selectedSlug, draftFilters, triggerFetch]);

  useEffect(() => {
    if (prevSlugRef.current !== selectedSlug && prevSlugRef.current != null) {
      setReportPage(1);
    }
    prevSlugRef.current = selectedSlug;
  }, [selectedSlug]);

  useEffect(() => {
    if (tab !== "presets" || !selectedSlug) return;
    const next = writeReportsHubSearchParams({
      tab,
      preset: selectedSlug,
      filters: draftFilters,
      page: reportPage,
    });
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [tab, selectedSlug, draftFilters, reportPage, searchParams, setSearchParams]);

  const returnTo = useMemo(() => {
    const q = writeReportsHubSearchParams({
      tab,
      preset: selectedSlug,
      filters: draftFilters,
      page: reportPage,
    }).toString();
    return q ? `/reports?${q}` : "/reports";
  }, [tab, selectedSlug, draftFilters, reportPage]);

  const { data: myReports = [] } = useQuery({
    queryKey: ["reports", "custom"],
    queryFn: () => reportsApi.customList(),
    enabled: tab === "mine" || tab === "shared" || activeCustomId != null,
  });

  const { data: sharedReports = [] } = useQuery({
    queryKey: ["reports", "custom", "shared"],
    queryFn: () => reportsApi.customShared(),
    enabled: tab === "shared" || activeCustomId != null,
  });

  const sharedTabReports = useMemo(
    () => buildSharedTabReports(myReports, sharedReports),
    [myReports, sharedReports],
  );

  const { data: activeCustomReport } = useQuery({
    queryKey: ["reports", "custom", activeCustomId],
    queryFn: () => reportsApi.customGet(activeCustomId!),
    enabled: activeCustomId != null,
  });

  const selectedMeta = presets.find((p) => p.slug === selectedSlug);
  const reportTitle = selectedMeta ? reportPresetDisplayLabel(selectedMeta, t) : "";

  const saveSnapshotMut = useMutation({
    mutationFn: (title: string) => {
      if (!selectedSlug || !presetData || !appliedFilters || !selectedMeta) {
        throw new Error(t("reports.snapshot_save_unavailable"));
      }
      const layout = buildSnapshotLayout({
        preset: selectedMeta,
        filters: appliedFilters,
        snapshot: presetData,
      });
      return reportsApi.customCreate({
        title: title.trim() || defaultSnapshotReportTitle(selectedMeta, appliedFilters, i18n.language),
        layout_json: serializeSavedReportSnapshotLayout(layout),
      });
    },
    onSuccess: (row) => {
      void qc.invalidateQueries({ queryKey: ["reports", "custom"] });
      setSaveSnapshotOpen(false);
      setSaveSnapshotError(null);
      setActiveCustomId(row.id);
      setCustomViewOnly(true);
      setTab("mine");
    },
    onError: (err: Error) => setSaveSnapshotError(err.message),
  });

  const defaultSnapshotTitle =
    selectedMeta && appliedFilters
      ? defaultSnapshotReportTitle(selectedMeta, appliedFilters, i18n.language)
      : "";

  const openCustom = (id: number, viewOnly: boolean) => {
    setActiveCustomId(id);
    setCustomViewOnly(viewOnly);
  };

  const closeCustom = () => {
    setActiveCustomId(null);
    setCustomViewOnly(false);
  };

  if (activeCustomId != null) {
    const isSnapshot = activeCustomReport
      ? isSavedReportSnapshotLayout(activeCustomReport.layout_json)
      : false;
    const canEditLegacy =
      !customViewOnly &&
      !isSnapshot &&
      myReports.some((r) => r.id === activeCustomId && r.owner_user_id === current?.id);
    const canManageSnapshot =
      myReports.some((r) => r.id === activeCustomId && r.owner_user_id === current?.id);

    return (
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">{t("reports.title")}</h1>
        </header>
        {isSnapshot ? (
          <SavedReportSnapshotDetail
            reportId={activeCustomId}
            presets={presets}
            canManage={canManageSnapshot}
            onBack={closeCustom}
            onDeleted={closeCustom}
          />
        ) : (
          <CustomReportEditor
            reportId={activeCustomId}
            presets={presets}
            canEdit={canEditLegacy}
            onBack={closeCustom}
            onDeleted={closeCustom}
          />
        )}
      </div>
    );
  }

  const hubTabs = (
    [
      ["presets", t("reports.tab_presets"), BarChart3],
      ["mine", t("reports.tab_mine"), FileText],
      ["shared", t("reports.tab_shared"), Share2],
    ] as const
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      <header className="no-print flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="shrink-0 text-2xl font-semibold tracking-tight">
          {t("reports.title")}
        </h1>
        <nav className="flex w-full min-w-0 gap-1 rounded-xl border border-[color:var(--color-line)] bg-white p-1 shadow-sm sm:w-auto sm:shrink-0">
          {hubTabs.map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={clsx(
                "inline-flex min-w-0 flex-1 items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs font-medium transition whitespace-nowrap sm:flex-none sm:gap-1.5 sm:px-3 sm:text-sm",
                tab === id
                  ? "bg-[color:var(--color-ink)] text-white shadow-sm"
                  : "text-[color:var(--color-ink-soft)] hover:bg-[color:var(--color-paper-2)]",
              )}
            >
              <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
              <span className="truncate">{label}</span>
            </button>
          ))}
        </nav>
      </header>

      {tab === "presets" && (
        <ReportCustomizeIsland
          presets={presets}
          selectedSlug={selectedSlug}
          onSelectReport={handleSelectReport}
          presetsLoading={presetsLoading}
          filters={draftFilters}
          onChangeFilters={setDraftFilters}
        />
      )}

      {tab === "presets" && (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[color:var(--color-line)] bg-white shadow-sm md:shadow-md">
            {presetsLoading && (
              <div className="flex flex-1 items-center justify-center p-6">
                <p className="text-sm text-[color:var(--color-ink-muted)]">
                  {t("common.loading")}
                </p>
              </div>
            )}
            {!presetsLoading && !selectedSlug && (
              <ReportPresetPicker
                presets={presets}
                loading={presetsLoading}
                onSelect={handleSelectReport}
              />
            )}
            {!presetsLoading && selectedSlug && (
              <div className="no-print flex shrink-0 items-center justify-end border-b border-[color:var(--color-line)]/80 px-4 py-2 md:px-8">
                <button
                  type="button"
                  onClick={() => {
                    setSaveSnapshotError(null);
                    setSaveSnapshotOpen(true);
                  }}
                  disabled={
                    !presetData || dataLoading || dataError || !appliedFilters || saveSnapshotMut.isPending
                  }
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-[color:var(--color-line)] bg-white px-3 text-sm font-medium hover:bg-[color:var(--color-paper-2)] disabled:opacity-50"
                >
                  <Bookmark className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                  {t("reports.snapshot_save_btn")}
                </button>
              </div>
            )}
            {!presetsLoading && selectedSlug && (
              <div
                ref={printRef}
                className="report-print-target flex min-h-0 flex-1 flex-col overflow-y-auto p-4 md:p-8"
              >
                {rangeInvalid && !dataLoading && (
                  <ReportRangeInvalidState message={t("reports.range_max_one_year")} />
                )}
                {dataLoading && !rangeInvalid && <ReportLoadingSkeleton />}
                {dataError && !dataLoading && !rangeInvalid && (
                  <div className="rounded-xl border border-red-200 bg-red-50/80 p-4 text-sm text-red-800">
                    <p className="font-medium">{t("reports.load_error")}</p>
                    <p className="mt-1 text-red-700/90">
                      {dataErr instanceof Error ? dataErr.message : String(dataErr)}
                    </p>
                    <button
                      type="button"
                      onClick={() => void refetchPreset()}
                      className="mt-3 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-red-50"
                    >
                      {t("reports.retry")}
                    </button>
                  </div>
                )}
                {presetData && !dataLoading && !dataError && !rangeInvalid && appliedFilters && (
                  <ReportDocument
                    title={reportTitle}
                    meta={
                      <>
                        <span className="rounded-full border border-[color:var(--color-line)] bg-[color:var(--color-paper-2)]/50 px-2.5 py-0.5">
                          {formatPeriodRangeShort(
                            appliedFilters.dateFrom,
                            appliedFilters.dateTo,
                            i18n.language,
                          )}
                        </span>
                        {appliedFilters.department !== "all" && (
                          <span className="rounded-full border border-[color:var(--color-line)] px-2.5 py-0.5">
                            {departmentLabel(appliedFilters.department)}
                          </span>
                        )}
                        {appliedFilters.status !== "all" && (
                          <span className="rounded-full border border-[color:var(--color-line)] px-2.5 py-0.5">
                            {t(`status.${appliedFilters.status}`, appliedFilters.status)}
                          </span>
                        )}
                        {appliedFilters.priority !== "all" && (
                          <span className="rounded-full border border-[color:var(--color-line)] px-2.5 py-0.5">
                            {t(`priority.${appliedFilters.priority}`, appliedFilters.priority)}
                          </span>
                        )}
                        <span>
                          {t("reports.generated_at", {
                            date:
                              typeof presetData.data.generated_at === "string"
                                ? formatReportDateTime(
                                    presetData.data.generated_at,
                                    i18n.language,
                                  )
                                : new Date().toLocaleString(),
                          })}
                        </span>
                      </>
                    }
                  >
                    <ReportsHubProvider
                      value={{ returnTo, reportPage, setReportPage }}
                    >
                      <PresetReportBody slug={selectedSlug} data={presetData.data} />
                    </ReportsHubProvider>
                  </ReportDocument>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <SaveReportSnapshotDialog
        open={saveSnapshotOpen}
        defaultTitle={defaultSnapshotTitle}
        saving={saveSnapshotMut.isPending}
        error={saveSnapshotError}
        onClose={() => {
          if (!saveSnapshotMut.isPending) setSaveSnapshotOpen(false);
        }}
        onSave={(title) => saveSnapshotMut.mutate(title)}
      />

      {shareReportId != null && (
        <ReportShareDialog
          reportId={shareReportId}
          reportTitle={shareReportTitle}
          open
          onClose={() => {
            setShareReportId(null);
            setShareReportTitle("");
          }}
        />
      )}

      {tab === "mine" && (
        <section className="flex min-h-0 flex-1 flex-col rounded-xl border border-[color:var(--color-line)] bg-white p-4 shadow-sm md:p-6">
          <div className="mb-5 shrink-0">
            <h2 className="text-lg font-semibold">{t("reports.tab_mine")}</h2>
            <p className="mt-0.5 text-sm text-[color:var(--color-ink-soft)]">
              {t("reports.custom_mine_intro")}
            </p>
          </div>
          <SavedReportListPanel
            mode="mine"
            reports={myReports}
            presets={presets}
            emptyMessage={t("reports.custom_empty")}
            emptyAction={{
              label: t("reports.snapshot_go_presets"),
              onClick: () => setTab("presets"),
            }}
            onOpen={(id, viewOnly) => openCustom(id, viewOnly)}
            onShare={(id, title) => {
              setShareReportId(id);
              setShareReportTitle(title);
            }}
          />
        </section>
      )}

      {tab === "shared" && (
        <section className="share-panel-ring flex min-h-0 flex-1 flex-col">
          <div className="share-panel-ring__inner p-4 md:p-6">
            <h2 className="mb-1 flex shrink-0 items-center gap-2 text-lg font-semibold">
              <Share2 className="h-5 w-5 text-[color:var(--color-ink-soft)]" aria-hidden />
              {t("reports.tab_shared")}
            </h2>
            <p className="mb-5 shrink-0 text-sm text-[color:var(--color-ink-soft)]">
              {t("reports.shared_intro")}
            </p>
            <SavedReportListPanel
              mode="shared"
              reports={sharedTabReports}
              presets={presets}
              emptyMessage={t("reports.shared_empty")}
              onOpen={(id) => {
                setTab("shared");
                openCustom(id, true);
              }}
            />
          </div>
        </section>
      )}
    </div>
  );
}
