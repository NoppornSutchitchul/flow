import { ChevronDown, ChevronUp, Clock } from "lucide-react";
import clsx from "clsx";
import { useMemo, useState, type ReactNode, type RefObject } from "react";
import { useTranslation } from "react-i18next";

import type { ScheduleMode } from "../../lib/requestSchedule";
import { AnimateCollapse } from "../ui/AnimateCollapse";

const DELAY_OPTIONS = [
  { minutes: 5, key: "schedule.delay_5" },
  { minutes: 10, key: "schedule.delay_10" },
  { minutes: 15, key: "schedule.delay_15" },
  { minutes: 30, key: "schedule.delay_30" },
  { minutes: 60, key: "schedule.delay_60" },
] as const;

interface Props {
  mode: ScheduleMode;
  onModeChange: (mode: ScheduleMode) => void;
  delayMinutes: number;
  onDelayMinutesChange: (minutes: number) => void;
  atTime: string;
  onAtTimeChange: (time: string) => void;
  /** Open expanded by default (request detail editor). */
  defaultExpanded?: boolean;
  className?: string;
  /** Focus target for keyboard flow from the room picker. */
  triggerRef?: RefObject<HTMLButtonElement | null>;
}

const timeInputClass =
  "rounded-md border border-[color:var(--color-line)] bg-white px-1.5 py-0.5 text-xs tabular-nums focus:outline-none focus:ring-1 focus:ring-[color:var(--color-ink)]/15";

function CompactRow({
  active,
  onSelect,
  label,
  children,
}: {
  active: boolean;
  onSelect: () => void;
  label: string;
  children?: ReactNode;
}) {
  return (
    <label
      className={clsx(
        "flex min-h-[2rem] cursor-pointer items-center gap-2 px-2 py-1 transition-colors",
        active && "bg-[color:var(--color-assigned-bg)]/40",
      )}
    >
      <input
        type="radio"
        name="delivery-schedule"
        checked={active}
        onChange={onSelect}
        className="shrink-0 accent-[color:var(--color-assigned-fg)]"
      />
      <span
        className={clsx(
          "shrink-0 text-xs font-medium",
          active ? "text-[color:var(--color-ink)]" : "text-[color:var(--color-ink-soft)]",
        )}
      >
        {label}
      </span>
      {children ? (
        <span className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-1">
          {children}
        </span>
      ) : null}
    </label>
  );
}

export function DeliverySchedulePicker({
  mode,
  onModeChange,
  delayMinutes,
  onDelayMinutesChange,
  atTime,
  onAtTimeChange,
  defaultExpanded = false,
  className,
  triggerRef,
}: Props) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(defaultExpanded);

  const summary = useMemo(() => {
    if (mode === "immediate") return t("schedule.immediate");
    if (mode === "delay") {
      const opt = DELAY_OPTIONS.find((o) => o.minutes === delayMinutes);
      const delayLabel = opt ? t(opt.key) : `${delayMinutes} min`;
      return `${t("schedule.delay_label")} ${delayLabel}`;
    }
    return `${t("schedule.at_time_short")} ${atTime}`;
  }, [mode, delayMinutes, atTime, t]);

  const selectImmediate = () => {
    onModeChange("immediate");
    setExpanded(false);
  };

  return (
    <div
      className={clsx(
        className ?? "mt-2",
        "overflow-hidden rounded-lg border border-[color:var(--color-line)] bg-white",
        !expanded && mode === "immediate" && "bg-[color:var(--color-assigned-bg)]/25",
      )}
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className={clsx(
          "flex w-full items-center gap-2 px-2.5 py-2 text-left transition-colors",
          "hover:bg-[color:var(--color-paper-2)]/60",
          expanded && "border-b border-[color:var(--color-line)]",
        )}
      >
        <Clock className="h-3.5 w-3.5 shrink-0 text-[color:var(--color-ink-muted)]" />
        <span className="text-xs font-semibold text-[color:var(--color-ink-muted)]">
          {t("schedule.heading")}
        </span>
        <span className="ml-auto flex min-w-0 items-center gap-1.5">
          {!expanded ? (
            <span className="truncate text-xs font-medium text-[color:var(--color-ink)]">
              {summary}
            </span>
          ) : null}
          {expanded ? (
            <ChevronUp className="h-3.5 w-3.5 shrink-0 text-[color:var(--color-ink-muted)]" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[color:var(--color-ink-muted)]" />
          )}
        </span>
      </button>

      <AnimateCollapse show={expanded}>
        <div className="divide-y divide-[color:var(--color-line)]">
          <CompactRow
            active={mode === "immediate"}
            onSelect={selectImmediate}
            label={t("schedule.immediate")}
          />

          <CompactRow
            active={mode === "delay"}
            onSelect={() => onModeChange("delay")}
            label={t("schedule.delay_label")}
          >
            {DELAY_OPTIONS.map((opt) => (
              <button
                key={opt.minutes}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  onModeChange("delay");
                  onDelayMinutesChange(opt.minutes);
                }}
                className={clsx(
                  "rounded border px-1.5 py-0.5 text-[11px] font-semibold leading-none transition-colors",
                  mode === "delay" && delayMinutes === opt.minutes
                    ? "border-[color:var(--color-assigned-fg)] bg-[color:var(--color-assigned-bg)] text-[color:var(--color-assigned-fg)]"
                    : "border-[color:var(--color-line)] bg-[color:var(--color-paper-2)] text-[color:var(--color-ink-soft)] hover:bg-white",
                )}
              >
                {t(opt.key)}
              </button>
            ))}
          </CompactRow>

          <CompactRow
            active={mode === "at_time"}
            onSelect={() => onModeChange("at_time")}
            label={t("schedule.at_time_short")}
          >
            <input
              type="time"
              value={atTime}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => {
                onModeChange("at_time");
                onAtTimeChange(e.target.value);
              }}
              className={timeInputClass}
            />
          </CompactRow>
        </div>
      </AnimateCollapse>
    </div>
  );
}
