import clsx from "clsx";
import { useTranslation } from "react-i18next";

import { requestLocationDisplay, type Room } from "../../lib/rooms";
import type { DeliveryMethod } from "../../lib/types";

interface Props {
  room: string;
  deliveryMethod?: DeliveryMethod | string;
  labelByCode?: Record<string, string>;
  guestRooms?: Room[];
  variant?: "badge" | "inline" | "table";
  className?: string;
}

export function RequestLocationDisplay({
  room,
  deliveryMethod,
  labelByCode,
  guestRooms,
  variant = "inline",
  className,
}: Props) {
  const { t } = useTranslation();
  const loc = requestLocationDisplay(room, deliveryMethod, t, {
    labelByCode,
    guestRooms,
  });

  if (variant === "badge") {
    return (
      <span
        className={clsx(
          "inline-flex shrink-0 flex-col items-center justify-center min-h-14 px-3 py-2 rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-stock-low-bg)]/85 text-[color:var(--color-stock-low-fg)] leading-none text-center",
          loc.stacked ? "min-w-[4.5rem]" : "min-w-14",
          className,
        )}
      >
        <span
          className={clsx(
            "font-bold tracking-tight",
            loc.stacked ? "text-sm sm:text-base leading-snug" : "text-2xl tabular-nums",
          )}
        >
          {loc.primary}
        </span>
        {loc.secondary ? (
          <span className="mt-1 text-[10px] font-medium text-[color:var(--color-stock-low-fg)]/80 tabular-nums leading-tight">
            {loc.secondary}
          </span>
        ) : null}
      </span>
    );
  }

  if (variant === "table") {
    if (loc.stacked) {
      return (
        <span
          className={clsx(
            "flex w-full min-w-0 flex-col items-center justify-center gap-0 text-center leading-snug",
            className,
          )}
        >
          <span className="text-[15px] font-semibold leading-snug text-[color:var(--color-ink)]">
            {loc.primary}
          </span>
          {loc.secondary ? (
            <span className="mt-0.5 text-[10px] font-normal leading-tight text-[color:var(--color-ink-muted)] tabular-nums">
              {loc.secondary}
            </span>
          ) : null}
        </span>
      );
    }
    return (
      <span
        className={clsx(
          "block w-full text-center text-[15px] font-bold tabular-nums leading-snug tracking-tight text-[color:var(--color-ink)]",
          className,
        )}
      >
        {loc.primary}
      </span>
    );
  }

  return (
    <span className={className}>
      <span className="font-medium">{loc.primary}</span>
      {loc.secondary ? (
        <span className="block text-xs font-normal text-[color:var(--color-ink-muted)] mt-0.5">
          {loc.secondary}
        </span>
      ) : null}
    </span>
  );
}
