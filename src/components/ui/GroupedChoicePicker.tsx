import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import clsx from "clsx";

export interface GroupedChoiceGroup<T extends string> {
  title: string;
  /** @deprecated Unused — kept for call-site compatibility. */
  sectionDotClass?: string;
  items: { value: T; label: string; /** @deprecated */ accentBarClass?: string }[];
}

interface GroupedChoicePickerProps<T extends string> {
  value: T;
  onChange: (next: T) => void;
  groups: GroupedChoiceGroup<T>[];
  ariaLabel: string;
  /** Dropdown width is at least this many pixels (avoids wrapping long labels). */
  menuMinWidth?: number;
  /** Extra classes for the trigger button (e.g. match adjacent inputs). */
  className?: string;
  /** When false, list options only (no sticky group header bars). */
  showGroupHeaders?: boolean;
}

type MenuCoords = {
  left: number;
  width: number;
  maxHeight: number;
  top?: number;
  bottom?: number;
};

function measureMenuCoords(button: HTMLButtonElement): MenuCoords {
  const r = button.getBoundingClientRect();
  const maxHeight = Math.min(320, window.innerHeight * 0.52);
  const gap = 6;
  const spaceBelow = window.innerHeight - r.bottom - gap;
  const spaceAbove = r.top - gap;
  const openAbove = spaceBelow < Math.min(maxHeight, 160) && spaceAbove > spaceBelow;

  if (openAbove) {
    return {
      left: r.left,
      width: r.width,
      maxHeight: Math.min(maxHeight, spaceAbove),
      bottom: window.innerHeight - r.top + gap,
    };
  }
  return {
    left: r.left,
    width: r.width,
    maxHeight: Math.min(maxHeight, spaceBelow),
    top: r.bottom + gap,
  };
}

export function GroupedChoicePicker<T extends string>({
  value,
  onChange,
  groups,
  ariaLabel,
  menuMinWidth = 0,
  className,
  showGroupHeaders = false,
}: GroupedChoicePickerProps<T>) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<MenuCoords | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);

  const selectedLabel = useMemo(() => {
    for (const g of groups) {
      const hit = g.items.find((i) => i.value === value);
      if (hit) return hit.label;
    }
    return "";
  }, [groups, value]);

  const syncCoords = useCallback(() => {
    const btn = buttonRef.current;
    if (!btn) return;
    setCoords(measureMenuCoords(btn));
  }, []);

  useEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    syncCoords();
    const onScroll = (e: Event) => {
      const target = e.target as Node | null;
      if (target && listboxRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onResize = () => syncCoords();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open, syncCoords]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || listboxRef.current?.contains(t)) return;
      setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open]);

  const renderOption = (item: GroupedChoiceGroup<T>["items"][number]) => {
    const active = value === item.value;
    return (
      <li key={String(item.value)}>
        <button
          type="button"
          role="option"
          aria-selected={active}
          onClick={() => {
            onChange(item.value);
            setOpen(false);
          }}
          className={clsx(
            "flex w-full items-center gap-2 py-2.5 pl-3 pr-3 text-left text-sm transition-colors",
            "hover:bg-[color:var(--color-paper-2)]/85",
            active && "bg-[color:var(--color-paper-2)]/95",
          )}
        >
          <span className="min-w-0 flex-1 whitespace-nowrap text-[color:var(--color-ink)]">
            {item.label}
          </span>
          {active && <Check className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />}
        </button>
      </li>
    );
  };

  const listbox =
    open && coords ? (
      <div
        ref={listboxRef}
        role="listbox"
        className="fixed z-[250] overflow-y-auto overscroll-contain rounded-xl border border-[color:var(--color-line)] bg-white py-1 shadow-xl"
        onWheel={(e) => e.stopPropagation()}
        style={{
          left: coords.left,
          width: Math.max(coords.width, menuMinWidth),
          maxHeight: coords.maxHeight,
          ...(coords.top != null ? { top: coords.top } : { bottom: coords.bottom }),
        }}
      >
        {showGroupHeaders
          ? groups.map((g) =>
              g.items.length === 0 ? null : (
                <div key={g.title} role="group" aria-label={g.title}>
                  <div className="sticky top-0 z-10 border-y border-[color:var(--color-line)]/55 bg-[color:var(--color-paper-2)]/95 px-3 py-1.5 backdrop-blur-sm">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--color-ink-muted)]">
                      {g.title}
                    </span>
                  </div>
                  <ul className="py-0.5">
                    {g.items.map((item) => renderOption(item))}
                  </ul>
                </div>
              ),
            )
          : (
              <ul className="py-0.5">
                {groups.flatMap((g) => g.items).map((item) => renderOption(item))}
              </ul>
            )}
      </div>
    ) : null;

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          if (open) {
            setOpen(false);
            return;
          }
          if (buttonRef.current) setCoords(measureMenuCoords(buttonRef.current));
          setOpen(true);
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={clsx(
          "flex h-10 w-full min-w-0 items-center gap-2 rounded-lg border border-[color:var(--color-line)] bg-white px-2.5 text-left text-sm shadow-sm transition",
          "hover:bg-[color:var(--color-paper-2)]/70 focus:outline-none focus:ring-2 focus:ring-[color:var(--color-ink)]/15 focus:ring-offset-0",
          className,
        )}
      >
        <span className="min-w-0 flex-1 truncate font-medium text-[color:var(--color-ink)]">
          {selectedLabel}
        </span>
        <ChevronDown
          className={clsx(
            "h-4 w-4 shrink-0 text-[color:var(--color-ink-muted)] transition-transform",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {listbox && typeof document !== "undefined"
        ? createPortal(listbox, document.body)
        : null}
    </div>
  );
}
