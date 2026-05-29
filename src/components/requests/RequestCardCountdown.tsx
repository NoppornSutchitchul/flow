import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";

import { requestCountdownFill, parseApiUtcMs } from "../../lib/format";
import type { RequestRead } from "../../lib/types";

type Props = {
  r: RequestRead;
  /** When false, uses server `age_seconds` only (no 1s tick). */
  live?: boolean;
  /** Pass a parent 1s tick to avoid one interval per row in tables. */
  tick?: number;
  /** Field ops (My Queue): soft dark-red pulse when overdue. Dashboard: static tint only. */
  overduePulse?: boolean;
};

export function RequestCardCountdown({
  r,
  live = true,
  tick: externalTick,
  overduePulse = false,
}: Props) {
  const useExternalTick = externalTick !== undefined;
  const frozenNowMs = parseApiUtcMs(r.created_at) + r.age_seconds * 1000;
  const [liveNowMs, setLiveNowMs] = useState(frozenNowMs);

  useEffect(() => {
    if (!live || useExternalTick) return;
    const sync = () => setLiveNowMs(Date.now());
    sync();
    const id = window.setInterval(sync, 1000);
    return () => window.clearInterval(id);
  }, [live, useExternalTick, r.id, r.status]);

  const nowMs = live
    ? useExternalTick
      ? frozenNowMs + externalTick * 1000
      : liveNowMs
    : frozenNowMs;

  const fill = useMemo(() => requestCountdownFill(r, nowMs), [r, nowMs]);

  if (!fill) return null;

  const opacity = fill.overdue
    ? 1
    : fill.progress >= 2 / 3
      ? 0.62
      : fill.progress >= 1 / 3
        ? 0.48
        : 0.38;

  const overdueStyle = fill.overdue
    ? overduePulse
      ? undefined
      : { backgroundColor: "rgba(127, 29, 29, 0.28)", opacity: 1 }
    : { backgroundColor: fill.color, opacity };

  return (
    <div
      className={clsx(
        "absolute inset-y-0 left-0 pointer-events-none transition-[width,background-color] duration-1000 ease-linear",
        fill.overdue && overduePulse && "countdown-fill-overdue",
      )}
      style={{
        width: `${fill.widthPct}%`,
        ...overdueStyle,
      }}
      aria-hidden
    />
  );
}
