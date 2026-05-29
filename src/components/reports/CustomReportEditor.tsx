import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ChevronLeft, Plus, Save, Trash2 } from "lucide-react";
import clsx from "clsx";

import { CustomReportView } from "./CustomReportView";
import { reportsApi } from "../../lib/api";
import {
  defaultCustomReportLayout,
  parseCustomReportLayout,
  serializeCustomReportLayout,
  type CustomReportBlock,
  type CustomReportLayout,
} from "../../lib/customReportLayout";
import { reportPresetDisplayLabel } from "../../lib/reportPresetLabel";
import type { CustomReportRead, ReportPresetMeta } from "../../lib/types";

const PERIOD_OPTIONS = [7, 30, 90] as const;

type Props = {
  reportId: number;
  presets: ReportPresetMeta[];
  canEdit: boolean;
  onBack: () => void;
  onDeleted?: () => void;
};

export function CustomReportEditor({
  reportId,
  presets,
  canEdit,
  onBack,
  onDeleted,
}: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [layout, setLayout] = useState<CustomReportLayout>(defaultCustomReportLayout());
  const [dirty, setDirty] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { data: report, isLoading } = useQuery({
    queryKey: ["reports", "custom", reportId],
    queryFn: () => reportsApi.customGet(reportId),
  });

  useEffect(() => {
    if (!report) return;
    setTitle(report.title);
    setDescription(report.description ?? "");
    setLayout(parseCustomReportLayout(report.layout_json));
    setDirty(false);
  }, [report]);

  const layoutJson = useMemo(() => serializeCustomReportLayout(layout), [layout]);

  const saveMut = useMutation({
    mutationFn: () =>
      reportsApi.customUpdate(reportId, {
        title: title.trim() || t("reports.custom_untitled"),
        description: description.trim() || undefined,
        layout_json: layoutJson,
      }),
    onSuccess: (row: CustomReportRead) => {
      setDirty(false);
      setSaveError(null);
      setTitle(row.title);
      void qc.invalidateQueries({ queryKey: ["reports", "custom"] });
      void qc.invalidateQueries({ queryKey: ["reports", "custom", reportId] });
    },
    onError: (err: Error) => setSaveError(err.message),
  });

  const deleteMut = useMutation({
    mutationFn: () => reportsApi.customDelete(reportId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["reports", "custom"] });
      onDeleted?.();
      onBack();
    },
  });

  const duplicateMut = useMutation({
    mutationFn: () => reportsApi.customDuplicate(reportId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["reports", "custom"] });
    },
  });

  const markDirty = () => setDirty(true);

  const updateBlock = (index: number, block: CustomReportBlock) => {
    setLayout((prev) => ({
      ...prev,
      blocks: prev.blocks.map((b, i) => (i === index ? block : b)),
    }));
    markDirty();
  };

  const moveBlock = (index: number, dir: -1 | 1) => {
    const next = index + dir;
    if (next < 0 || next >= layout.blocks.length) return;
    setLayout((prev) => {
      const blocks = [...prev.blocks];
      [blocks[index], blocks[next]] = [blocks[next], blocks[index]];
      return { ...prev, blocks };
    });
    markDirty();
  };

  const removeBlock = (index: number) => {
    setLayout((prev) => ({
      ...prev,
      blocks: prev.blocks.filter((_, i) => i !== index),
    }));
    markDirty();
  };

  const addBlock = (block: CustomReportBlock) => {
    setLayout((prev) => ({ ...prev, blocks: [...prev.blocks, block] }));
    markDirty();
  };

  if (isLoading || !report) {
    return (
      <p className="text-sm text-[color:var(--color-ink-muted)]">{t("common.loading")}</p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-9 items-center gap-1 rounded-lg border border-[color:var(--color-line)] bg-white px-3 text-sm font-medium hover:bg-[color:var(--color-paper-2)]"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          {t("common.back")}
        </button>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => duplicateMut.mutate()}
            disabled={duplicateMut.isPending}
            className="inline-flex h-9 items-center rounded-lg border border-[color:var(--color-line)] bg-white px-3 text-sm font-medium hover:bg-[color:var(--color-paper-2)] disabled:opacity-50"
          >
            {t("reports.custom_duplicate")}
          </button>
          {canEdit && (
            <button
              type="button"
              onClick={() => {
                if (!window.confirm(t("reports.custom_delete_confirm"))) return;
                deleteMut.mutate();
              }}
              disabled={deleteMut.isPending}
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              {t("common.delete")}
            </button>
          )}
          {canEdit && (
            <button
              type="button"
              onClick={() => saveMut.mutate()}
              disabled={!dirty || saveMut.isPending || !title.trim()}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[color:var(--color-ink)] px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              <Save className="h-4 w-4" aria-hidden />
              {saveMut.isPending ? t("common.loading") : t("reports.custom_save")}
            </button>
          )}
        </div>
      </div>

      {saveError && (
        <p role="alert" className="text-sm font-medium text-red-600">
          {saveError}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,18rem)_1fr]">
        {canEdit && (
          <aside className="space-y-4 rounded-xl border border-[color:var(--color-line)] bg-white p-4 shadow-sm lg:sticky lg:top-4 lg:self-start">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[color:var(--color-ink-muted)]">
                {t("reports.custom_title_label")}
              </span>
              <input
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  markDirty();
                }}
                className="w-full rounded-lg border border-[color:var(--color-line)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--color-ink)]/12"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[color:var(--color-ink-muted)]">
                {t("reports.custom_desc_label")}
              </span>
              <textarea
                value={description}
                rows={2}
                onChange={(e) => {
                  setDescription(e.target.value);
                  markDirty();
                }}
                className="w-full resize-none rounded-lg border border-[color:var(--color-line)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--color-ink)]/12"
              />
            </label>
            <div>
              <span className="mb-1 block text-xs font-medium text-[color:var(--color-ink-muted)]">
                {t("reports.period_label")}
              </span>
              <div className="flex rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-paper-2)]/40 p-0.5">
                {PERIOD_OPTIONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => {
                      setLayout((prev) => ({ ...prev, period_days: d }));
                      markDirty();
                    }}
                    className={clsx(
                      "flex-1 rounded-md py-1.5 text-xs font-medium transition",
                      layout.period_days === d
                        ? "bg-[color:var(--color-ink)] text-white"
                        : "text-[color:var(--color-ink-soft)]",
                    )}
                  >
                    {t("reports.period_days", { count: d })}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[color:var(--color-ink-muted)]">
                {t("reports.custom_blocks")}
              </p>
              <ul className="mb-3 max-h-64 space-y-2 overflow-y-auto">
                {layout.blocks.map((block, index) => (
                  <li
                    key={index}
                    className="rounded-lg border border-[color:var(--color-line)]/80 bg-[color:var(--color-paper-2)]/30 p-2"
                  >
                    <div className="mb-1 flex items-center justify-between gap-1">
                      <span className="text-[10px] font-semibold uppercase text-[color:var(--color-ink-muted)]">
                        {block.type === "preset"
                          ? t("reports.block_preset")
                          : block.type === "heading"
                            ? t("reports.block_heading")
                            : t("reports.block_note")}
                      </span>
                      <div className="flex gap-0.5">
                        <button
                          type="button"
                          onClick={() => moveBlock(index, -1)}
                          disabled={index === 0}
                          className="grid h-6 w-6 place-items-center rounded hover:bg-white disabled:opacity-30"
                          aria-label={t("reports.move_up")}
                        >
                          <ArrowUp className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveBlock(index, 1)}
                          disabled={index === layout.blocks.length - 1}
                          className="grid h-6 w-6 place-items-center rounded hover:bg-white disabled:opacity-30"
                          aria-label={t("reports.move_down")}
                        >
                          <ArrowDown className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeBlock(index)}
                          className="grid h-6 w-6 place-items-center rounded text-red-600 hover:bg-red-50"
                          aria-label={t("common.delete")}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    {block.type === "preset" && (
                      <select
                        value={block.slug}
                        onChange={(e) =>
                          updateBlock(index, { type: "preset", slug: e.target.value })
                        }
                        className="w-full rounded-md border border-[color:var(--color-line)] bg-white px-2 py-1 text-xs"
                      >
                        {presets.map((p) => (
                          <option key={p.slug} value={p.slug}>
                            {reportPresetDisplayLabel(p, t)}
                          </option>
                        ))}
                      </select>
                    )}
                    {(block.type === "heading" || block.type === "note") && (
                      <input
                        value={block.text}
                        onChange={(e) =>
                          updateBlock(index, {
                            type: block.type,
                            text: e.target.value,
                          } as CustomReportBlock)
                        }
                        className="w-full rounded-md border border-[color:var(--color-line)] bg-white px-2 py-1 text-xs"
                      />
                    )}
                  </li>
                ))}
              </ul>
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() =>
                    addBlock({
                      type: "preset",
                      slug: presets[0]?.slug ?? "operations-overview",
                    })
                  }
                  className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-dashed border-[color:var(--color-line)] text-xs font-medium hover:bg-[color:var(--color-paper-2)]"
                >
                  <Plus className="h-3 w-3" />
                  {t("reports.custom_add_preset")}
                </button>
                <button
                  type="button"
                  onClick={() => addBlock({ type: "heading", text: "" })}
                  className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-dashed border-[color:var(--color-line)] text-xs font-medium hover:bg-[color:var(--color-paper-2)]"
                >
                  <Plus className="h-3 w-3" />
                  {t("reports.custom_add_heading")}
                </button>
                <button
                  type="button"
                  onClick={() => addBlock({ type: "note", text: "" })}
                  className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-dashed border-[color:var(--color-line)] text-xs font-medium hover:bg-[color:var(--color-paper-2)]"
                >
                  <Plus className="h-3 w-3" />
                  {t("reports.custom_add_note")}
                </button>
              </div>
            </div>
          </aside>
        )}

        <div className="min-w-0 rounded-xl border border-[color:var(--color-line)] bg-white p-4 shadow-sm md:p-6">
          {!canEdit && (
            <div className="mb-4">
              <h2 className="text-lg font-semibold">{title}</h2>
              {description ? (
                <p className="mt-1 text-sm text-[color:var(--color-ink-soft)]">
                  {description}
                </p>
              ) : null}
            </div>
          )}
          <div>
            <CustomReportView layoutJson={layoutJson} />
          </div>
        </div>
      </div>
    </div>
  );
}
