import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, X } from "lucide-react";
import clsx from "clsx";

import { Avatar } from "../ui/Avatar";
import { useDepartments } from "../../lib/departments";
import { userPositionSubtitle } from "../../lib/format";
import type { User } from "../../lib/types";

export type UserRemoveAction = "suspend" | "delete";

type Props = {
  user: User | null;
  pending?: boolean;
  onClose: () => void;
  onConfirm: (action: UserRemoveAction) => void;
};

export function UserRemoveModal({ user, pending, onClose, onConfirm }: Props) {
  const { t } = useTranslation();
  const { departmentLabel } = useDepartments(Boolean(user));
  const [choice, setChoice] = useState<UserRemoveAction | null>(null);
  const [confirmName, setConfirmName] = useState("");

  useEffect(() => {
    if (!user) return;
    setChoice(null);
    setConfirmName("");
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !pending) onClose();
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [user, pending, onClose]);

  if (!user) return null;

  const nameMatches =
    confirmName.trim().length > 0 && confirmName.trim() === user.name.trim();
  const canDelete = choice === "delete" && nameMatches && !pending;
  const canSuspend = choice === "suspend" && !pending;

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-black/45 px-4 py-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !pending) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal
        aria-labelledby="user-remove-modal-title"
        className="w-full max-w-md rounded-2xl border border-[color:var(--color-line)] bg-white shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex min-h-[3.25rem] items-center gap-2 border-b border-[color:var(--color-line)] px-4 py-4 sm:px-5">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" aria-hidden />
          <h2
            id="user-remove-modal-title"
            className="min-w-0 flex-1 text-base font-semibold leading-none sm:text-lg"
          >
            {t("users.remove_modal.title")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg hover:bg-[color:var(--color-paper-2)] disabled:opacity-50"
            aria-label={t("common.close")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col px-4 py-6 sm:px-5">
          <div className="mb-6 flex gap-3 rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-paper-2)]/50 px-3 py-3">
            <Avatar
              user={user}
              size="md"
              className={clsx(!user.active && "opacity-50 grayscale")}
            />
            <div className="min-w-0 flex-1 space-y-2">
              <p
                className={clsx(
                  "text-sm font-semibold truncate",
                  !user.active && "text-[color:var(--color-ink-muted)] line-through",
                )}
              >
                {user.name}
              </p>
              <dl className="grid grid-cols-[5.5rem_1fr] gap-x-2 gap-y-1.5 text-xs">
                <dt className="text-[color:var(--color-ink-muted)]">
                  {t("users.table.role")}
                </dt>
                <dd
                  className={clsx(
                    "text-[color:var(--color-ink-soft)] font-medium",
                    !user.active && "line-through",
                  )}
                >
                  {userPositionSubtitle(user, (k) => t(k))}
                </dd>
                <dt className="text-[color:var(--color-ink-muted)]">
                  {t("users.table.department")}
                </dt>
                <dd
                  className={clsx(
                    "text-[color:var(--color-ink-soft)] font-medium",
                    !user.active && "line-through",
                  )}
                >
                  {user.department ? departmentLabel(user.department) : "—"}
                </dd>
                <dt className="text-[color:var(--color-ink-muted)]">
                  {t("users.table.status")}
                </dt>
                <dd>
                  {user.active ? (
                    <span className="inline-flex rounded-md bg-[color:var(--color-delivered-bg)] text-[color:var(--color-delivered-fg)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider">
                      {t("users.active")}
                    </span>
                  ) : (
                    <span className="inline-flex rounded-md border border-[color:var(--color-line)] bg-[color:var(--color-paper-2)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-ink-muted)]">
                      {t("users.suspended")}
                    </span>
                  )}
                </dd>
              </dl>
            </div>
          </div>

          <fieldset className="m-0 grid grid-cols-2 gap-3 border-0 p-0">
            <legend className="sr-only">{t("users.remove_modal.choice_legend")}</legend>
            <label
              className={clsx(
                "flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-2.5 transition-colors",
                choice === "suspend"
                  ? "border-[color:var(--color-ink)]/25 bg-[color:var(--color-paper-2)]"
                  : "border-[color:var(--color-line)] hover:bg-[color:var(--color-paper-2)]/60",
              )}
            >
              <input
                type="radio"
                name="user-remove-action"
                className="shrink-0"
                checked={choice === "suspend"}
                onChange={() => setChoice("suspend")}
                disabled={pending}
              />
              <span className="text-sm font-semibold whitespace-nowrap">
                {t("users.remove_modal.suspend_title")}
              </span>
            </label>
            <label
              className={clsx(
                "flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-2.5 transition-colors",
                choice === "delete"
                  ? "border-red-500/35 bg-red-50/50"
                  : "border-[color:var(--color-line)] hover:bg-[color:var(--color-paper-2)]/60",
              )}
            >
              <input
                type="radio"
                name="user-remove-action"
                className="shrink-0"
                checked={choice === "delete"}
                onChange={() => setChoice("delete")}
                disabled={pending}
              />
              <span className="text-sm font-semibold text-red-950 whitespace-nowrap">
                {t("users.remove_modal.delete_title")}
              </span>
            </label>
          </fieldset>

          {choice === "delete" && (
            <div className="mt-8 rounded-xl border border-red-500/20 bg-red-50/40 p-6">
              <p className="mb-5 text-sm font-medium leading-relaxed text-[color:var(--color-ink-soft)]">
                {t("users.remove_modal.confirm_label", { name: user.name })}
              </p>
              <input
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                autoComplete="off"
                placeholder={user.name}
                disabled={pending}
                aria-label={t("users.remove_modal.confirm_label", { name: user.name })}
                className="w-full rounded-xl border border-[color:var(--color-line)] bg-white px-3 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500/25"
              />
            </div>
          )}
        </div>

        <div
          className={clsx(
            "flex flex-col-reverse gap-2 border-t border-[color:var(--color-line)] px-4 sm:flex-row sm:justify-end sm:px-5",
            choice === "delete" ? "py-4" : "py-3",
          )}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-xl border border-[color:var(--color-line)] px-4 py-2.5 text-sm font-medium hover:bg-[color:var(--color-paper-2)] disabled:opacity-50"
          >
            {t("common.cancel")}
          </button>
          {choice === "suspend" && (
            <button
              type="button"
              disabled={!canSuspend}
              onClick={() => onConfirm("suspend")}
              className="rounded-xl bg-[color:var(--color-ink)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {pending ? t("common.loading") : t("users.remove_modal.suspend_confirm")}
            </button>
          )}
          {choice === "delete" && (
            <button
              type="button"
              disabled={!canDelete}
              onClick={() => onConfirm("delete")}
              className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40"
            >
              {pending ? t("common.loading") : t("users.remove_modal.delete_confirm")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
