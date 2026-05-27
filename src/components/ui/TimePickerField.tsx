import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Clock } from "lucide-react";
import clsx from "clsx";

type Size = "md" | "sm";

type Props = {
  value: string;
  onChange: (hhmm: string) => void;
  disabled?: boolean;
  size?: Size;
  compact?: boolean;
  className?: string;
  "aria-label"?: string;
};

const shellClass: Record<Size, string> = {
  md: "h-10 rounded-xl text-sm",
  sm: "h-9 rounded-lg text-sm",
};

const inputPad: Record<Size, string> = {
  md: "px-3",
  sm: "px-2.5",
};

const POPOVER_WIDTH_PX = 168;
const POPOVER_GAP_PX = 6;
const VIEWPORT_PAD_PX = 8;
const POPOVER_ESTIMATE_HEIGHT_PX = 220;

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

function parseHhmm(raw: string): { h: string; m: string } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(raw.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return { h: String(h).padStart(2, "0"), m: String(min).padStart(2, "0") };
}

function computePopoverStyle(anchor: HTMLElement, popoverHeight: number): CSSProperties {
  const rect = anchor.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let left = rect.left;
  if (left + POPOVER_WIDTH_PX > vw - VIEWPORT_PAD_PX) {
    left = Math.max(VIEWPORT_PAD_PX, rect.right - POPOVER_WIDTH_PX);
  }

  let top = rect.bottom + POPOVER_GAP_PX;
  if (top + popoverHeight > vh - VIEWPORT_PAD_PX) {
    top = Math.max(VIEWPORT_PAD_PX, rect.top - popoverHeight - POPOVER_GAP_PX);
  }

  return {
    position: "fixed",
    left,
    top,
    width: POPOVER_WIDTH_PX,
    zIndex: 200,
  };
}

function TimeColumn({
  label,
  options,
  selected,
  onSelect,
  listRef,
}: {
  label: string;
  options: string[];
  selected: string;
  onSelect: (v: string) => void;
  listRef: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <span className="border-b border-[color:var(--color-line)]/80 py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-[color:var(--color-ink-muted)]">
        {label}
      </span>
      <div
        ref={listRef}
        className="max-h-[11.5rem] overflow-y-auto overscroll-contain py-0.5 [-webkit-overflow-scrolling:touch]"
        role="listbox"
        aria-label={label}
      >
        {options.map((opt) => {
          const active = opt === selected;
          return (
            <button
              key={opt}
              type="button"
              role="option"
              aria-selected={active}
              data-time-option={opt}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onSelect(opt)}
              className={clsx(
                "flex w-full items-center justify-center py-1.5 text-sm font-medium tabular-nums transition",
                active
                  ? "bg-[color:var(--color-assigned-bg)] text-[color:var(--color-assigned-fg)]"
                  : "text-[color:var(--color-ink)] hover:bg-[color:var(--color-paper-2)]",
              )}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function TimePickerField({
  value,
  onChange,
  disabled = false,
  size = "md",
  compact = false,
  className,
  "aria-label": ariaLabel,
}: Props) {
  const { t } = useTranslation();
  const dialogId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const hourListRef = useRef<HTMLDivElement>(null);
  const minuteListRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties | null>(null);

  const parsed = useMemo(() => parseHhmm(value) ?? { h: "10", m: "00" }, [value]);
  const display = `${parsed.h}:${parsed.m}`;

  const updatePopoverPosition = useCallback(() => {
    if (!wrapRef.current) return;
    const height = popoverRef.current?.offsetHeight ?? POPOVER_ESTIMATE_HEIGHT_PX;
    setPopoverStyle(computePopoverStyle(wrapRef.current, height));
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setPopoverStyle(null);
      return;
    }
    updatePopoverPosition();
    const id = requestAnimationFrame(() => updatePopoverPosition());
    return () => cancelAnimationFrame(id);
  }, [open, updatePopoverPosition]);

  useEffect(() => {
    if (!open) return;
    const scrollActive = (list: HTMLDivElement | null, selected: string) => {
      const el = list?.querySelector(`[data-time-option="${selected}"]`);
      el?.scrollIntoView({ block: "center" });
    };
    scrollActive(hourListRef.current, parsed.h);
    scrollActive(minuteListRef.current, parsed.m);
  }, [open, parsed.h, parsed.m]);

  useEffect(() => {
    if (!open) return;
    const onReflow = () => updatePopoverPosition();
    window.addEventListener("resize", onReflow);
    window.addEventListener("scroll", onReflow, true);
    return () => {
      window.removeEventListener("resize", onReflow);
      window.removeEventListener("scroll", onReflow, true);
    };
  }, [open, updatePopoverPosition]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const target = e.target as Node;
      if (wrapRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const pickHour = (h: string) => {
    onChange(`${h}:${parsed.m}`);
  };

  const pickMinute = (m: string) => {
    onChange(`${parsed.h}:${m}`);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className={clsx("relative min-w-0", className)}>
      <div
        className={clsx(
          "flex w-full min-w-0 items-stretch border bg-white font-medium text-[color:var(--color-ink)] shadow-sm transition",
          shellClass[size],
          "border-[color:var(--color-line)]",
          open && "border-[color:var(--color-ink)]/20 ring-2 ring-[color:var(--color-ink)]/10",
          disabled && "opacity-60",
        )}
      >
        <div
          className={clsx(
            "flex min-w-0 flex-1 items-center tabular-nums text-[color:var(--color-ink)]",
            inputPad[size],
          )}
          aria-label={ariaLabel}
        >
          {display}
        </div>
        <button
          type="button"
          disabled={disabled}
          aria-label={t("schedule.time_picker_open")}
          aria-expanded={open}
          aria-haspopup="dialog"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            if (disabled) return;
            setOpen((v) => !v);
          }}
          className={clsx(
            "grid shrink-0 place-items-center border-l border-[color:var(--color-line)]/80 text-[color:var(--color-ink-muted)] transition",
            compact ? "h-full w-9" : "w-10",
            "hover:bg-[color:var(--color-paper-2)] hover:text-[color:var(--color-ink-soft)]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--color-ink)]/12",
            open && "bg-[color:var(--color-paper-2)] text-[color:var(--color-ink)]",
          )}
        >
          <Clock className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {open &&
        popoverStyle &&
        createPortal(
          <div
            ref={popoverRef}
            id={`${dialogId}-popover`}
            role="dialog"
            aria-modal="false"
            style={popoverStyle}
            className="overflow-hidden rounded-xl border border-[color:var(--color-line)] bg-white shadow-xl"
          >
            <div className="grid grid-cols-2 divide-x divide-[color:var(--color-line)]">
              <TimeColumn
                label={t("schedule.time_picker_hour")}
                options={HOURS}
                selected={parsed.h}
                onSelect={pickHour}
                listRef={hourListRef}
              />
              <TimeColumn
                label={t("schedule.time_picker_minute")}
                options={MINUTES}
                selected={parsed.m}
                onSelect={pickMinute}
                listRef={minuteListRef}
              />
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
