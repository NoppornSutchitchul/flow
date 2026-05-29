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
import { ChevronLeft, ChevronRight } from "lucide-react";
import clsx from "clsx";

import {
  buildMonthGrid,
  parseIsoDate,
  weekdayLabels,
} from "../../lib/datePickerCalendar";
import { calendarMonthTitle, formatDashboardDateTime } from "../../lib/locale";
import { isoDateLocal } from "../../lib/reportPresetFilters";

const POPOVER_WIDTH_PX = 276;
const POPOVER_GAP_PX = 6;
const VIEWPORT_PAD_PX = 8;
const POPOVER_ESTIMATE_HEIGHT_PX = 300;

function computePopoverStyle(anchor: HTMLElement, popoverHeight: number): CSSProperties {
  const rect = anchor.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let left = rect.left + rect.width / 2 - POPOVER_WIDTH_PX / 2;
  if (left + POPOVER_WIDTH_PX > vw - VIEWPORT_PAD_PX) {
    left = vw - VIEWPORT_PAD_PX - POPOVER_WIDTH_PX;
  }
  if (left < VIEWPORT_PAD_PX) left = VIEWPORT_PAD_PX;

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

export function HeaderDateTime({
  lang,
  className,
}: {
  lang: string;
  className?: string;
}) {
  const { t, i18n } = useTranslation();
  const dialogId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => new Date());
  const [open, setOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties | null>(null);

  const todayIso = isoDateLocal(now);
  const today = parseIsoDate(todayIso) ?? now;
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!open) return;
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
  }, [open, todayIso]);

  const updatePopoverPosition = useCallback(() => {
    if (!buttonRef.current) return;
    const height =
      popoverRef.current?.offsetHeight ?? POPOVER_ESTIMATE_HEIGHT_PX;
    setPopoverStyle(computePopoverStyle(buttonRef.current, height));
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
      if (buttonRef.current?.contains(target)) return;
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

  const { weekday, dateLine, timeLine } = formatDashboardDateTime(now, lang);
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

  const goToToday = () => {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={t("reports.date_picker_open")}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? `${dialogId}-popover` : undefined}
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          "inline-flex min-w-0 cursor-pointer items-center justify-center rounded-2xl border border-[color:var(--color-line)] bg-white text-center shadow-sm transition-[box-shadow,border-color,background-color] hover:border-[color:var(--color-ink)]/12 hover:shadow",
          "h-11 min-w-[5.75rem] px-3",
          "sm:h-auto sm:min-w-0 sm:flex-col sm:gap-0.5 sm:px-4 sm:py-2",
          open && "border-[color:var(--color-ink)]/18 shadow-md",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-ink)]/10",
          className,
        )}
      >
        <span className="sr-only sm:hidden">
          {weekday} · {dateLine}
        </span>
        <span className="hidden text-xs font-medium leading-snug text-[color:var(--color-ink-soft)] sm:block sm:text-sm">
          <span className="font-semibold capitalize text-[color:var(--color-ink)]">
            {weekday}
          </span>
          <span className="mx-1 text-[color:var(--color-ink-muted)]" aria-hidden>
            ·
          </span>
          <span>{dateLine}</span>
        </span>
        <span className="text-xl font-bold tabular-nums leading-none tracking-tight text-[color:var(--color-ink)] sm:text-xl">
          {timeLine}
        </span>
      </button>

      {open &&
        popoverStyle &&
        createPortal(
          <div
            ref={popoverRef}
            id={`${dialogId}-popover`}
            role="dialog"
            aria-modal="false"
            aria-label={monthTitle}
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
                const isToday = cell.iso === todayIso;
                return (
                  <span
                    key={`${viewYear}-${viewMonth}-${idx}`}
                    className={clsx(
                      "grid h-8 place-items-center rounded-lg text-xs font-medium tabular-nums",
                      !cell.inMonth && "text-[color:var(--color-ink-muted)]/70",
                      cell.inMonth && "text-[color:var(--color-ink)]",
                      isToday &&
                        "bg-[color:var(--color-ink)] text-white shadow-sm ring-1 ring-[color:var(--color-delivered-fg)]/40",
                    )}
                  >
                    {parseIsoDate(cell.iso)?.getDate()}
                  </span>
                );
              })}
            </div>

            <div className="mt-2 flex justify-end border-t border-[color:var(--color-line)]/80 pt-2">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={goToToday}
                className="rounded-md px-2.5 py-1 text-xs font-semibold text-[color:var(--color-delivered-fg)] hover:bg-[color:var(--color-delivered-bg)]"
              >
                {t("reports.date_preset_today")}
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
