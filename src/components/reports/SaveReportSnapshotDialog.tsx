import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Save, X } from "lucide-react";

type Props = {
  open: boolean;
  defaultTitle: string;
  saving: boolean;
  error?: string | null;
  onClose: () => void;
  onSave: (title: string) => void;
};

export function SaveReportSnapshotDialog({
  open,
  defaultTitle,
  saving,
  error,
  onClose,
  onSave,
}: Props) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(defaultTitle);

  useEffect(() => {
    if (open) setTitle(defaultTitle);
  }, [open, defaultTitle]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-labelledby="save-snapshot-title"
        className="w-full max-w-md rounded-2xl border border-[color:var(--color-line)] bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2
              id="save-snapshot-title"
              className="text-lg font-semibold text-[color:var(--color-ink)]"
            >
              {t("reports.snapshot_save_title")}
            </h2>
            <p className="mt-1 text-sm text-[color:var(--color-ink-soft)]">
              {t("reports.snapshot_save_hint")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg hover:bg-[color:var(--color-paper-2)]"
            aria-label={t("common.close")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-[color:var(--color-ink-muted)]">
            {t("reports.snapshot_name_label")}
          </span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            className="w-full rounded-lg border border-[color:var(--color-line)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--color-ink)]/12"
          />
        </label>
        {error && (
          <p role="alert" className="mt-2 text-sm font-medium text-red-600">
            {error}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="inline-flex h-10 items-center rounded-xl border border-[color:var(--color-line)] bg-white px-4 text-sm font-medium hover:bg-[color:var(--color-paper-2)] disabled:opacity-50"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={() => onSave(title.trim())}
            disabled={saving || !title.trim()}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[color:var(--color-ink)] px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            <Save className="h-4 w-4" aria-hidden />
            {saving ? t("common.loading") : t("reports.snapshot_save_confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
