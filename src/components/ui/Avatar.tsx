import type { ReactNode } from "react";
import clsx from "clsx";

import type { PresenceStatus } from "../../lib/presence";
import type { User } from "../../lib/types";
import { PresenceIndicator } from "./PresenceIndicator";

interface Props {
  user?: Pick<User, "initials" | "color" | "name"> | null;
  size?: "xs" | "sm" | "md";
  className?: string;
  presence?: PresenceStatus;
}

const sizeClass: Record<NonNullable<Props["size"]>, string> = {
  xs: "w-5 h-5 text-[10px]",
  sm: "w-6 h-6 text-[11px]",
  md: "w-9 h-9 text-sm",
};

const presenceDotSize: Record<NonNullable<Props["size"]>, "sm" | "md"> = {
  xs: "sm",
  sm: "sm",
  md: "md",
};

export function Avatar({ user, size = "sm", className, presence }: Props) {
  const wrap = (node: ReactNode) =>
    presence ? (
      <span className={clsx("relative inline-flex shrink-0", className)}>
        {node}
        <span className="absolute -bottom-0.5 -right-0.5">
          <PresenceIndicator status={presence} dotSize={presenceDotSize[size]} />
        </span>
      </span>
    ) : (
      <span className={clsx("inline-flex shrink-0", className)}>{node}</span>
    );

  if (!user) {
    return wrap(
      <span
        className={clsx(
          "inline-flex items-center justify-center rounded-full bg-[color:var(--color-line)] text-[color:var(--color-ink-soft)]",
          sizeClass[size],
        )}
        aria-hidden
      >
        —
      </span>,
    );
  }
  return wrap(
    <span
      className={clsx(
        "inline-flex items-center justify-center rounded-full text-white font-medium select-none",
        sizeClass[size],
      )}
      style={{ backgroundColor: user.color }}
      aria-label={user.name}
    >
      {user.initials}
    </span>,
  );
}
