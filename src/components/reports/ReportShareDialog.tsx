import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Globe, UserPlus, Users, X } from "lucide-react";
import clsx from "clsx";

import { ReportShareUserPickerPanel } from "./ReportShareUserPickerPanel";
import { reportsApi } from "../../lib/api";

type ShareMode = "private" | "users" | "everyone";

type Props = {
  reportId: number;
  reportTitle: string;
  open: boolean;
  onClose: () => void;
};

export function ReportShareDialog({ reportId, reportTitle, open, onClose }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [mode, setMode] = useState<ShareMode>("private");
  const [pendingAddIds, setPendingAddIds] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { data: shares, isLoading } = useQuery({
    queryKey: ["reports", "custom", reportId, "shares"],
    queryFn: () => reportsApi.customGetShares(reportId),
    enabled: open,
  });

  useEffect(() => {
    if (!open || !shares) return;
    if (shares.shared_with_all) setMode("everyone");
    else if (shares.users.length > 0) setMode("users");
    else setMode("private");
    setError(null);
    setPendingAddIds([]);
  }, [open, shares]);

  const setSharingMut = useMutation({
    mutationFn: (sharedWithAll: boolean) =>
      reportsApi.customSetSharing(reportId, { shared_with_all: sharedWithAll }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["reports", "custom", reportId, "shares"] });
      void qc.invalidateQueries({ queryKey: ["reports", "custom"] });
      void qc.invalidateQueries({ queryKey: ["reports", "custom", "shared"] });
      void qc.invalidateQueries({ queryKey: ["reports", "custom", reportId] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const shareManyMut = useMutation({
    mutationFn: (userIds: number[]) =>
      Promise.all(userIds.map((userId) => reportsApi.customShareWith(reportId, { user_id: userId }))),
    onSuccess: () => {
      setError(null);
      setPendingAddIds([]);
      void qc.invalidateQueries({ queryKey: ["reports", "custom", reportId, "shares"] });
      void qc.invalidateQueries({ queryKey: ["reports", "custom", "shared"] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const unshareMut = useMutation({
    mutationFn: (userId: number) => reportsApi.customUnshareUser(reportId, userId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["reports", "custom", reportId, "shares"] });
      void qc.invalidateQueries({ queryKey: ["reports", "custom", "shared"] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const applyMode = async (next: ShareMode) => {
    setMode(next);
    setError(null);
    setPendingAddIds([]);
    try {
      if (next === "everyone") {
        await setSharingMut.mutateAsync(true);
        return;
      }
      if (shares?.shared_with_all) {
        await setSharingMut.mutateAsync(false);
      }
      if (next === "private" && shares?.users.length) {
        await Promise.all(
          shares.users.map((u) => reportsApi.customUnshareUser(reportId, u.user_id)),
        );
        void qc.invalidateQueries({ queryKey: ["reports", "custom", reportId, "shares"] });
        void qc.invalidateQueries({ queryKey: ["reports", "custom", "shared"] });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const sharingUsers = shareManyMut.isPending;

  const busy = setSharingMut.isPending || sharingUsers || unshareMut.isPending;

  const sharedUserIds = shares?.users.map((u) => u.user_id) ?? [];
  const tallLayout = mode === "users";
  const sharedRecipients = shares
    ? [...new Map(shares.users.map((u) => [u.user_id, u])).values()]
    : [];

  if (!open) return null;

  return (
    <div
      className={clsx(
        "fixed inset-0 z-[60] flex items-end justify-center bg-black/40 px-4 pt-4",
        "pb-[calc(5.75rem+env(safe-area-inset-bottom,0px)+0.75rem)]",
        "sm:items-center sm:p-4 sm:pb-4",
      )}
      role="presentation"
      onClick={() => !busy && onClose()}
    >
      <div
        role="dialog"
        aria-labelledby="report-share-title"
        className={clsx(
          "flex w-full flex-col overflow-hidden rounded-2xl border border-[color:var(--color-line)] bg-white shadow-xl",
          tallLayout
            ? "flex h-[min(calc(100dvh-5.75rem-env(safe-area-inset-bottom,0px)-2rem),720px)] max-h-[min(calc(100dvh-5.75rem-env(safe-area-inset-bottom,0px)-2rem),720px)] w-full max-w-lg sm:max-w-2xl lg:max-w-4xl"
            : "w-full max-w-sm sm:max-w-md",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-2 border-b border-[color:var(--color-line)]/80 px-4 py-2.5">
          <div className="min-w-0">
            <h2
              id="report-share-title"
              className="text-lg font-semibold text-[color:var(--color-ink)]"
            >
              {t("reports.share_dialog_title")}
            </h2>
            <p className="mt-0.5 truncate text-sm text-[color:var(--color-ink-soft)]">
              {reportTitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg hover:bg-[color:var(--color-paper-2)]"
            aria-label={t("common.close")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div
          className={clsx(
            "flex flex-col overflow-hidden",
            tallLayout && "min-h-0 flex-1",
          )}
        >
          <p className="shrink-0 px-4 pb-2 pt-2 text-xs text-[color:var(--color-ink-soft)] sm:text-sm">
            {t("reports.share_dialog_intro")}
          </p>

          <div
            className={clsx(
              "flex flex-col gap-3 px-4 pb-3",
              tallLayout && "min-h-0 flex-1 overflow-hidden lg:flex-row lg:items-stretch lg:gap-3",
            )}
          >
            <div
              className={clsx(
                "flex w-full shrink-0 flex-col gap-1.5",
                tallLayout && "lg:w-52 xl:w-56",
              )}
            >
              {(
                [
                  ["private", t("reports.share_mode_private"), Users],
                  ["users", t("reports.share_mode_users"), UserPlus],
                  ["everyone", t("reports.share_mode_everyone"), Globe],
                ] as const
              ).map(([id, label, Icon]) => (
                <button
                  key={id}
                  type="button"
                  disabled={busy || isLoading}
                  onClick={() => void applyMode(id)}
                  className={clsx(
                    "flex w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-sm transition",
                    mode === id
                      ? "border-[color:var(--color-ink)] bg-[color:var(--color-paper-2)]/60"
                      : "border-[color:var(--color-line)] hover:bg-[color:var(--color-paper-2)]/40",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
                  <span className="font-medium leading-snug">{label}</span>
                </button>
              ))}

              {mode === "everyone" && (
                <p className="rounded-lg border border-[color:var(--color-line)]/80 bg-[color:var(--color-paper-2)]/40 px-3 py-2.5 text-sm leading-relaxed text-[color:var(--color-ink-soft)]">
                  {t("reports.share_everyone_hint")}
                </p>
              )}
            </div>

            {mode === "users" &&
              (isLoading ? (
                <p className="flex min-h-0 flex-1 items-center justify-center py-12 text-sm text-[color:var(--color-ink-muted)]">
                  {t("common.loading")}
                </p>
              ) : (
                <ReportShareUserPickerPanel
                  className="min-h-[12rem] min-w-0 flex-1 overflow-hidden rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-paper-2)]/10 px-3 pb-3 pt-2"
                  excludeUserIds={sharedUserIds}
                  sharedRecipients={sharedRecipients}
                  onUnshare={(userId) => unshareMut.mutate(userId)}
                  saving={busy}
                  autoFocusSearch
                  onPendingChange={setPendingAddIds}
                />
              ))}
          </div>
        </div>

        {error && (
          <p role="alert" className="shrink-0 px-4 pb-1 text-sm font-medium text-red-600">
            {error}
          </p>
        )}

        <div className="flex shrink-0 justify-end gap-2 border-t border-[color:var(--color-line)]/80 px-4 py-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="inline-flex h-9 min-w-[7rem] items-center justify-center rounded-lg border border-[color:var(--color-line)] bg-white px-4 text-sm font-medium hover:bg-[color:var(--color-paper-2)] disabled:opacity-50"
          >
            {t("common.close")}
          </button>
          {mode === "users" && pendingAddIds.length > 0 && (
            <button
              type="button"
              onClick={() => shareManyMut.mutate(pendingAddIds)}
              disabled={busy}
              className="inline-flex h-9 min-w-[8.5rem] items-center justify-center gap-2 rounded-lg bg-[color:var(--color-ink)] px-5 text-sm font-semibold text-white disabled:opacity-50"
            >
              <Check className="h-4 w-4" aria-hidden />
              {sharingUsers
                ? t("common.loading")
                : t("reports.share_confirm", { count: pendingAddIds.length })}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
