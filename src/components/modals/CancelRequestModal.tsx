import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import clsx from "clsx";
import { AnimateCollapse } from "../ui/AnimateCollapse";
import { AnimateResize } from "../ui/AnimateResize";

export const CANCEL_REASON_KEYS = [
  "customer_cancelled",
  "duplicate_order",
  "guest_unreachable",
  "wrong_info",
  "item_unavailable",
  "other",
] as const;

export type CancelReasonKey = (typeof CANCEL_REASON_KEYS)[number];

export function encodeCancelReason(key: CancelReasonKey, otherText?: string): string {
  if (key === "other") {
    return `cancel_reason:other:${otherText?.trim() ?? ""}`;
  }
  return `cancel_reason:${key}`;
}

type Props = {
  open: boolean;
  pending?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
};

export function CancelRequestModal({ open, pending, onClose, onConfirm }: Props) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<CancelReasonKey | null>(null);
  const [otherText, setOtherText] = useState("");

  useEffect(() => {
    if (!open) return;
    setSelected(null);
    setOtherText("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !pending) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, pending, onClose]);

  if (!open) return null;

  const otherValid = otherText.trim().length >= 2;
  const canSubmit =
    selected != null &&
    !pending &&
    (selected !== "other" || otherValid);

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 bg-black/40 grid place-items-center px-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !pending) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal
        aria-labelledby="cancel-request-title"
        className="w-full max-w-md rounded-2xl border border-[color:var(--color-line)] bg-white p-4 shadow-xl"
      >
        <div className="flex items-start gap-2 mb-3">
          <div className="min-w-0 flex-1">
            <h2 id="cancel-request-title" className="font-semibold text-lg">
              {t("requests.cancel_modal.title")}
            </h2>
            <p className="text-sm text-[color:var(--color-ink-muted)] mt-0.5">
              {t("requests.cancel_modal.subtitle")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-md p-1 hover:bg-[color:var(--color-paper-2)] disabled:opacity-50"
            aria-label={t("common.cancel")}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <AnimateResize>
          <div>
            <fieldset className="space-y-1.5">
              <legend className="sr-only">{t("requests.cancel_modal.title")}</legend>
              {CANCEL_REASON_KEYS.map((key) => {
                const active = selected === key;
                return (
                  <label
                    key={key}
                    className={clsx(
                      "flex items-start gap-3 rounded-xl border px-3 py-2.5 cursor-pointer transition-colors",
                      active
                        ? "border-[color:var(--color-ink)]/25 bg-[color:var(--color-paper-2)]"
                        : "border-[color:var(--color-line)] hover:bg-[color:var(--color-paper-2)]/70",
                    )}
                  >
                    <input
                      type="radio"
                      name="cancel-reason"
                      value={key}
                      checked={active}
                      onChange={() => setSelected(key)}
                      className="mt-1 shrink-0"
                    />
                    <span className="text-sm font-medium leading-snug">
                      {t(`requests.cancel_reason.${key}`)}
                    </span>
                  </label>
                );
              })}
            </fieldset>

            <AnimateCollapse show={selected === "other"} className="mt-3">
              <label className="block text-sm">
                <span className="text-[color:var(--color-ink-soft)]">
                  {t("requests.cancel_modal.other_label")}
                </span>
                <textarea
                  autoFocus={selected === "other"}
                  rows={3}
                  value={otherText}
                  onChange={(e) => setOtherText(e.target.value)}
                  placeholder={t("requests.cancel_modal.other_placeholder")}
                  className="mt-1 w-full rounded-lg border border-[color:var(--color-line)] px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[color:var(--color-ink)]/10"
                />
              </label>
            </AnimateCollapse>
          </div>
        </AnimateResize>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="flex-1 rounded-lg border border-[color:var(--color-line)] bg-white py-2.5 text-sm hover:bg-[color:var(--color-paper-2)] disabled:opacity-50"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => {
              if (!selected) return;
              onConfirm(encodeCancelReason(selected, otherText));
            }}
            className={clsx(
              "flex-[2] rounded-lg py-2.5 text-sm font-semibold",
              !canSubmit
                ? "bg-[color:var(--color-paper-2)] text-[color:var(--color-ink-muted)] cursor-not-allowed"
                : "bg-[color:var(--color-ink)] text-white hover:opacity-90",
            )}
          >
            {pending ? t("common.loading") : t("requests.cancel_modal.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
