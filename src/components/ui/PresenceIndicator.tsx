import { useTranslation } from "react-i18next";
import clsx from "clsx";

import type { PresenceStatus } from "../../lib/presence";

const STATUS_CLASS: Record<PresenceStatus, string> = {
  online: "bg-emerald-500",
  idle: "bg-amber-400",
  away: "bg-zinc-400",
  offline: "bg-red-500",
};

const DOT_SIZE = {
  sm: "h-2 w-2",
  md: "h-2.5 w-2.5",
} as const;

interface Props {
  status: PresenceStatus;
  /** Show translated label beside the dot (dropdown / settings). */
  showLabel?: boolean;
  dotSize?: keyof typeof DOT_SIZE;
  className?: string;
}

export function PresenceIndicator({
  status,
  showLabel = false,
  dotSize = "sm",
  className,
}: Props) {
  const { t } = useTranslation();
  const label = t(`presence.${status}`);

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5",
        showLabel ? "text-xs text-[color:var(--color-ink-muted)]" : "",
        className,
      )}
      title={label}
    >
      <span
        className={clsx(
          "shrink-0 rounded-full ring-2 ring-white",
          DOT_SIZE[dotSize],
          STATUS_CLASS[status],
        )}
        aria-hidden
      />
      {showLabel && <span className="truncate">{label}</span>}
      {!showLabel && <span className="sr-only">{label}</span>}
    </span>
  );
}
