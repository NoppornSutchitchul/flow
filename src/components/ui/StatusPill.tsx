import { useTranslation } from "react-i18next";
import clsx from "clsx";

import { statusPillClass } from "../../lib/format";
import type { RequestStatus } from "../../lib/types";

interface Props {
  status: RequestStatus;
  /** When true, a `dnd` status is displayed in the gray "guest unreachable" /
   *  "waiting to auto-cancel" style instead of the urgent blinking pink. */
  deferred?: boolean;
  /** No online staff available to take this job. */
  awaitingStaff?: boolean;
  className?: string;
}

export function StatusPill({ status, deferred = false, awaitingStaff = false, className }: Props) {
  const { t } = useTranslation();
  const isUrgentDnd = status === "dnd" && !deferred;
  const isDeferredDnd = status === "dnd" && deferred;
  const pillClass = awaitingStaff
    ? "bg-red-700 text-white status-pill-staff-crisis"
    : isUrgentDnd
    ? "bg-[color:var(--color-dnd-bg)] text-[color:var(--color-dnd-fg)] status-pill-dnd-blink"
    : statusPillClass[status];
  const label = awaitingStaff
    ? t("status.awaiting_staff")
    : isDeferredDnd
      ? t("requests.dnd_defer")
      : t(`status.${status}`);
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        pillClass,
        className,
      )}
    >
      {label}
    </span>
  );
}
