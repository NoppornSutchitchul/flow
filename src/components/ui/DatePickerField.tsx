import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import clsx from "clsx";

import {
  buildMonthGrid,
  formatIsoForInput,
  isoInRange,
  parseFlexibleDateInput,
  parseIsoDate,
  weekdayLabels,
} from "../../lib/datePickerCalendar";
import { calendarMonthTitle, isThaiAppLang } from "../../lib/locale";
import { isoDateLocal } from "../../lib/reportPresetFilters";

type Size = "md" | "sm";

type Props = {
  value: string;
  onChange: (iso: string) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
  size?: Size;
  /** Shrink field to fit date text (reports toolbar). */
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

const POPOVER_WIDTH_PX = 276;
const POPOVER_GAP_PX = 6;
const VIEWPORT_PAD_PX = 8;
const POPOVER_ESTIMATE_HEIGHT_PX = 320;

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

export function DatePickerField({
  value,
  onChange,
  min,
  max,
  disabled = false,
  size = "md",
  compact = false,
  className,
  "aria-label": ariaLabel,
}: Props) {
  const { t, i18n } = useTranslation();
  const dialogId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties | null>(null);
  const [draft, setDraft] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [editing, setEditing] = useState(false);

  const useBe = isThaiAppLang(i18n.language);
  const selected = parseIsoDate(value);
  const todayIso = isoDateLocal();

  const initialView = selected ?? parseIsoDate(todayIso) ?? new Date();
  const [viewYear, setViewYear] = useState(initialView.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialView.getMonth());

  useEffect(() => {
    if (!editing) setDraft(formatIsoForInput(value, useBe));
  }, [value, useBe, editing]);

  useEffect(() => {
    if (!open) return;
    const d = parseIsoDate(value) ?? new Date();
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }, [open, value]);

  const updatePopoverPosition = useCallback(() => {
    if (!wrapRef.current) return;
    const height =
      popoverRef.current?.offsetHeight ?? POPOVER_ESTIMATE_HEIGHT_PX;
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
  }, [open, viewYear, viewMonth, updatePopoverPosition]);

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

  const weekdays = useMemo(() => weekdayLabels(i18n.language), [i18n.language]);
  const cells = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  const monthTitle = useMemo(
    () => calendarMonthTitle(viewYear, viewMonth, i18n.language),
    [viewYear, viewMonth, i18n.language],
  );

  const shiftMonth = (delta: number) => {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  const pickDay = (iso: string) => {
    if (!isoInRange(iso, min, max)) return;
    onChange(iso);
    setInvalid(false);
    setEditing(false);
    setOpen(false);
  };

  const revertDraft = () => {
    setDraft(formatIsoForInput(value, useBe));
    setInvalid(false);
    setEditing(false);
  };

  const commitDraft = () => {
    const iso = parseFlexibleDateInput(draft);
    if (!iso || !isoInRange(iso, min, max)) {
      setInvalid(true);
      revertDraft();
      return;
    }
    setInvalid(false);
    setEditing(false);
    if (iso !== value) onChange(iso);
    else setDraft(formatIsoForInput(iso, useBe));
  };

  return (
    <div
      ref={wrapRef}
      className={clsx(
        "relative min-w-0",
        compact ? "max-w-full" : "min-w-0 flex-1",
        className,
      )}
    >
      <div
        className={clsx(
          "flex w-full min-w-0 items-stretch border bg-white font-medium text-[color:var(--color-ink)] shadow-sm transition",
          shellClass[size],
          invalid
            ? "border-red-400 ring-2 ring-red-400/20"
            : "border-[color:var(--color-line)]",
          (open || editing) &&
            !invalid &&
            "border-[color:var(--color-ink)]/20 ring-2 ring-[color:var(--color-ink)]/10",
          disabled && "opacity-60",
        )}
      >
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          disabled={disabled}
          aria-label={ariaLabel}
          aria-invalid={invalid}
          aria-expanded={open}
          aria-controls={open ? `${dialogId}-popover` : undefined}
          placeholder={t("reports.date_input_placeholder")}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setInvalid(false);
            setEditing(true);
          }}
          onFocus={() => setEditing(true)}
          onBlur={() => commitDraft()}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitDraft();
              inputRef.current?.blur();
            }
            if (e.key === "Escape") {
              revertDraft();
              inputRef.current?.blur();
              setOpen(false);
            }
          }}
          className={clsx(
            "border-0 bg-transparent tabular-nums text-[color:var(--color-ink)] placeholder:font-normal placeholder:text-[color:var(--color-ink-muted)]",
            "min-w-0 flex-1",
            inputPad[size],
            "focus:outline-none",
            disabled && "cursor-not-allowed",
          )}
        />
        <button
          type="button"
          disabled={disabled}
          aria-label={t("reports.date_picker_open")}
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
          <Calendar className="h-4 w-4" aria-hidden />
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
          className="rounded-xl border border-[color:var(--color-line)] bg-white p-3 shadow-xl"
        >
          <div className="mb-2 flex items-center justify-between gap-1">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="grid h-8 w-8 place-items-center rounded-lg text-[color:var(--color-ink-soft)] hover:bg-[color:var(--color-paper-2)]"
              aria-label={t("reports.date_picker_prev_month")}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </button>
            <p className="text-center text-sm font-semibold text-[color:var(--color-ink)]">
              {monthTitle}
            </p>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="grid h-8 w-8 place-items-center rounded-lg text-[color:var(--color-ink-soft)] hover:bg-[color:var(--color-paper-2)]"
              aria-label={t("reports.date_picker_next_month")}
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-0.5">
            {weekdays.map((wd) => (
              <span
                key={wd}
                className="py-1 text-center text-[10px] font-medium uppercase tracking-wide text-[color:var(--color-ink-muted)]"
              >
                {wd}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((cell, idx) => {
              const selectable = isoInRange(cell.iso, min, max);
              const isSelected = cell.iso === value;
              const isToday = cell.iso === todayIso;
              return (
                <button
                  key={`${viewYear}-${viewMonth}-${idx}`}
                  type="button"
                  disabled={!selectable}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pickDay(cell.iso)}
                  className={clsx(
                    "h-8 rounded-lg text-xs font-medium tabular-nums transition",
                    !cell.inMonth && "text-[color:var(--color-ink-muted)]/70",
                    cell.inMonth && "text-[color:var(--color-ink)]",
                    isSelected &&
                      "bg-[color:var(--color-ink)] text-white shadow-sm hover:bg-[color:var(--color-ink)]",
                    !isSelected && selectable && "hover:bg-[color:var(--color-paper-2)]",
                    isToday && !isSelected && "ring-1 ring-[color:var(--color-delivered-fg)]/40",
                    !selectable && "cursor-not-allowed opacity-35",
                  )}
                >
                  {parseIsoDate(cell.iso)?.getDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex justify-end border-t border-[color:var(--color-line)]/80 pt-2">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pickDay(todayIso)}
              disabled={!isoInRange(todayIso, min, max)}
              className="rounded-md px-2.5 py-1 text-xs font-semibold text-[color:var(--color-delivered-fg)] hover:bg-[color:var(--color-delivered-bg)] disabled:opacity-40"
            >
              {t("reports.date_preset_today")}
            </button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
