import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronDown, Languages } from "lucide-react";
import clsx from "clsx";

import { normalizeLanguage, type AppLang } from "../../lib/language";

const OPTIONS: { code: AppLang; native: string; sub?: string }[] = [
  { code: "th", native: "ไทย", sub: "Thai" },
  { code: "en", native: "English", sub: "English" },
];

interface Props {
  /** Wide control for settings card vs compact header pill. */
  variant?: "default" | "compact";
}

export function LanguageMenu({ variant = "default" }: Props) {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const current = normalizeLanguage(i18n.language);
  const currentOpt = OPTIONS.find((o) => o.code === current) ?? OPTIONS[0];

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const isCompact = variant === "compact";

  return (
    <div ref={wrapRef} className={clsx("relative", !isCompact && "w-full min-w-0")}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          "flex w-full items-center gap-2 rounded-xl border border-[color:var(--color-line)] bg-white text-left shadow-sm transition-[box-shadow,border-color,background-color]",
          "hover:border-[color:var(--color-ink)]/12 hover:shadow",
          open && "border-[color:var(--color-ink)]/18 shadow-md",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-ink)]/10",
          isCompact ? "pl-1.5 pr-1.5 py-1 sm:pl-2 sm:pr-2" : "px-3 py-2.5",
        )}
      >
        <span
          className={clsx(
            "grid shrink-0 place-items-center text-[color:var(--color-ink-soft)]",
            isCompact
              ? "h-7 w-7 rounded-lg bg-[color:var(--color-paper)]/70 sm:h-8 sm:w-8"
              : "h-9 w-9 rounded-xl bg-[color:var(--color-paper)]/70 ring-1 ring-[color:var(--color-line)]/80",
          )}
        >
          <Languages className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1 flex flex-col gap-0.5">
          <span
            className={clsx(
              "truncate font-semibold leading-tight text-[color:var(--color-ink)] tabular-nums",
              isCompact ? "text-xs sm:text-sm" : "text-base",
            )}
          >
            {currentOpt.native}
          </span>
          {currentOpt.sub && (
            <span
              className={clsx(
                "truncate font-medium leading-tight text-[color:var(--color-ink-muted)]",
                isCompact ? "hidden text-[11px] min-[420px]:block" : "text-[11px]",
              )}
            >
              {currentOpt.sub}
            </span>
          )}
        </span>
        <ChevronDown
          className={clsx(
            "w-4 h-4 shrink-0 text-[color:var(--color-ink-muted)]",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {open && (
        <ul
          role="listbox"
          className={clsx(
            "absolute z-[100] mt-1.5 max-h-[min(320px,70vh)] overflow-auto rounded-xl border border-[color:var(--color-line)] bg-white p-1 shadow-xl",
            isCompact
              ? "right-0 left-auto min-w-full w-max max-w-[min(calc(100vw-1.5rem),16rem)]"
              : "left-0 right-0 w-full",
          )}
        >
          {OPTIONS.map((opt) => {
            const active = opt.code === current;
            return (
              <li key={opt.code} role="option" aria-selected={active}>
                <button
                  type="button"
                  className={clsx(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                    active
                      ? "bg-[color:var(--color-paper-2)] font-medium text-[color:var(--color-ink)]"
                      : "text-[color:var(--color-ink-soft)] hover:bg-[color:var(--color-paper-2)]/80",
                  )}
                  onClick={() => {
                    void i18n.changeLanguage(opt.code);
                    setOpen(false);
                  }}
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span>{opt.native}</span>
                    {opt.sub && (
                      <span className="text-[11px] font-normal text-[color:var(--color-ink-muted)]">
                        {opt.sub}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-[color:var(--color-ink-muted)]">
                    {opt.code}
                  </span>
                  {active && (
                    <Check className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
