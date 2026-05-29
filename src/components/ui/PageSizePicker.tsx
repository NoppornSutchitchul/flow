import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import clsx from "clsx";

interface Props {
  value: number;
  options: readonly number[];
  onChange: (value: number) => void;
  ariaLabel?: string;
  /** Open above trigger when pagination sits at the bottom of the viewport. */
  placement?: "up" | "down";
  /** e.g. map `0` → "ทั้งหมด" for report tables. */
  formatOption?: (value: number) => string;
}

export function PageSizePicker({
  value,
  options,
  onChange,
  ariaLabel,
  placement = "up",
  formatOption,
}: Props) {
  const labelFor = (n: number) => formatOption?.(n) ?? String(n);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
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

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          "inline-flex h-8 min-w-[3.25rem] items-center justify-center gap-1 rounded-lg border border-[color:var(--color-line)] bg-white px-2.5 text-sm font-medium tabular-nums text-[color:var(--color-ink)] shadow-sm transition-[box-shadow,border-color,background-color]",
          "hover:bg-[color:var(--color-paper-2)] hover:border-[color:var(--color-ink)]/12",
          open && "border-[color:var(--color-ink)]/18 shadow-md",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-ink)]/10",
        )}
      >
        {labelFor(value)}
        <ChevronDown
          className={clsx(
            "h-3.5 w-3.5 shrink-0 text-[color:var(--color-ink-muted)] transition-transform",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label={ariaLabel}
          className={clsx(
            "absolute z-[100] min-w-[4.5rem] overflow-hidden rounded-xl border border-[color:var(--color-line)] bg-white p-1 shadow-xl",
            placement === "up" ? "bottom-full right-0 mb-1.5" : "right-0 top-full mt-1.5",
          )}
        >
          {options.map((n) => {
            const active = n === value;
            return (
              <li key={n} role="option" aria-selected={active}>
                <button
                  type="button"
                  className={clsx(
                    "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-sm tabular-nums transition-colors",
                    active
                      ? "bg-[color:var(--color-paper-2)] font-semibold text-[color:var(--color-ink)]"
                      : "text-[color:var(--color-ink-soft)] hover:bg-[color:var(--color-paper-2)]/80",
                  )}
                  onClick={() => {
                    onChange(n);
                    setOpen(false);
                  }}
                >
                  {labelFor(n)}
                  {active && (
                    <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
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
