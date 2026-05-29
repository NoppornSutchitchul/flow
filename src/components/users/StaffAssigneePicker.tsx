import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Check, ChevronDown, Search, Sparkles } from "lucide-react";
import clsx from "clsx";

import { staffDisplayName } from "../../lib/assignees";
import type { User } from "../../lib/types";
import { Avatar } from "../ui/Avatar";

type Variant = "housekeeping" | "maintenance" | "front_office" | "bell_boy";

const variantFocus: Record<Variant, string> = {
  housekeeping: "focus:ring-emerald-500/25",
  maintenance: "focus:ring-slate-500/30",
  front_office: "focus:ring-indigo-500/25",
  bell_boy: "focus:ring-amber-600/25",
};

const variantAccent: Record<Variant, string> = {
  housekeeping: "bg-emerald-600/85",
  maintenance: "bg-slate-600/85",
  front_office: "bg-indigo-600/85",
  bell_boy: "bg-amber-700/85",
};

export interface StaffAssigneePickerProps {
  value: number | "";
  onChange: (id: number | "") => void;
  groups: [string, User[]][];
  autoLabel: string;
  /** Accessible name for the trigger control */
  ariaLabel: string;
  variant: Variant;
  /** When false, hide the auto-assign option (e.g. reassign on request detail). */
  showAutoOption?: boolean;
  /** Menu opens above the trigger inside scrollable modals. */
  menuPlacement?: "above" | "below" | "auto";
  density?: "default" | "compact";
}

/**
 * Custom assignee picker (replaces native &lt;select&gt;) with search,
 * avatars, and a subtle accent color per department (HK vs maintenance).
 */
export function StaffAssigneePicker({
  value,
  onChange,
  groups,
  autoLabel,
  ariaLabel,
  variant,
  showAutoOption = true,
  menuPlacement = "auto",
  density = "default",
}: StaffAssigneePickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [menuRect, setMenuRect] = useState<{
    left: number;
    width: number;
    top?: number;
    bottom?: number;
    maxHeight: number;
  } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const filteredUsers = useMemo((): User[] => {
    const q = searchQuery.trim().toLowerCase();
    const out: User[] = [];
    const seen = new Set<number>();
    for (const [zone, users] of groups) {
      const zoneHay = zone.toLowerCase();
      for (const u of users) {
        if (seen.has(u.id)) continue;
        if (q) {
          const display = staffDisplayName(u.name).toLowerCase();
          const hay = [
            u.name,
            display,
            u.initials,
            u.job_title ?? "",
            zoneHay,
          ]
            .join(" ")
            .toLowerCase();
          if (!hay.includes(q)) continue;
        }
        seen.add(u.id);
        out.push(u);
      }
    }
    return out;
  }, [groups, searchQuery]);

  const selectedUser = useMemo(() => {
    if (value === "") return null;
    for (const [, users] of groups) {
      const u = users.find((x) => x.id === value);
      if (u) return u;
    }
    return null;
  }, [value, groups]);

  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      return;
    }
    const id = window.requestAnimationFrame(() => searchRef.current?.focus());
    return () => window.cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
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

  const updateMenuPosition = () => {
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const gap = 6;
    const preferredMax = Math.min(window.innerHeight * 0.55, 288);
    const spaceBelow = window.innerHeight - rect.bottom - gap - 8;
    const spaceAbove = rect.top - gap - 8;

    let placement: "above" | "below" = "below";
    if (menuPlacement === "above") {
      placement = "above";
    } else if (menuPlacement === "below") {
      placement = "below";
    } else if (spaceBelow < preferredMax && spaceAbove > spaceBelow) {
      placement = "above";
    }

    if (placement === "above") {
      setMenuRect({
        left: rect.left,
        width: rect.width,
        bottom: window.innerHeight - rect.top + gap,
        maxHeight: Math.max(120, Math.min(preferredMax, spaceAbove)),
      });
    } else {
      setMenuRect({
        left: rect.left,
        width: rect.width,
        top: rect.bottom + gap,
        maxHeight: Math.max(120, Math.min(preferredMax, spaceBelow)),
      });
    }
  };

  useLayoutEffect(() => {
    if (!open) {
      setMenuRect(null);
      return;
    }
    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open, menuPlacement, groups.length, value]);

  const menu =
    open && menuRect
      ? createPortal(
          <div
            ref={menuRef}
            role="listbox"
            style={{
              position: "fixed",
              left: menuRect.left,
              width: menuRect.width,
              top: menuRect.top,
              bottom: menuRect.bottom,
              maxHeight: menuRect.maxHeight,
              zIndex: 200,
            }}
            className="overflow-auto rounded-xl border border-[color:var(--color-line)] bg-white py-1 shadow-xl"
          >
            <div className="sticky top-0 z-20 border-b border-[color:var(--color-line)]/60 bg-white px-2 py-2">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[color:var(--color-ink-muted)]"
                  aria-hidden
                />
                <input
                  ref={searchRef}
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                  placeholder={t("requests.assignee_search_ph")}
                  aria-label={t("requests.assignee_search_ph")}
                  className="w-full rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-paper)]/40 py-2 pl-8 pr-2 text-sm focus:border-[color:var(--color-ink)]/20 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[color:var(--color-ink)]/10"
                />
              </div>
            </div>

            {showAutoOption && !searchQuery.trim() && (
              <button
                type="button"
                role="option"
                aria-selected={value === ""}
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
                className={clsx(
                  "w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors",
                  "hover:bg-[color:var(--color-paper-2)]/90",
                  value === "" && "bg-[color:var(--color-paper-2)]/95",
                )}
              >
                <span className="grid place-items-center w-8 h-8 rounded-full bg-[color:var(--color-paper-2)] text-[color:var(--color-ink-soft)] shrink-0 ring-1 ring-[color:var(--color-line)]/50">
                  <Sparkles className="w-4 h-4" aria-hidden />
                </span>
                <span className="flex-1 font-medium text-[color:var(--color-ink)]">{autoLabel}</span>
                {value === "" && (
                  <Check className="w-4 h-4 shrink-0 text-emerald-600" aria-hidden />
                )}
              </button>
            )}

            {filteredUsers.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-[color:var(--color-ink-muted)]">
                {t("requests.assignee_search_empty")}
              </p>
            ) : (
              <ul className="py-0.5" role="presentation">
                {filteredUsers.map((u) => {
                  const active = value === u.id;
                  return (
                    <li key={u.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={active}
                        onClick={() => {
                          onChange(u.id);
                          setOpen(false);
                        }}
                        className={clsx(
                          "w-full flex items-start gap-2 pl-2 pr-3 py-2 text-left transition-colors",
                          "hover:bg-[color:var(--color-paper-2)]/85",
                          active && "bg-[color:var(--color-paper-2)]/90",
                        )}
                      >
                        <span
                          className={clsx(
                            "w-1 self-stretch min-h-[2.5rem] rounded-full shrink-0",
                            variantAccent[variant],
                          )}
                          aria-hidden
                        />
                        <Avatar user={u} size="sm" className="shrink-0 mt-0.5" />
                        <span className="flex-1 min-w-0 py-0.5">
                          <span className="block text-[11px] leading-tight text-[color:var(--color-ink-muted)] truncate">
                            {u.job_title ?? "—"}
                          </span>
                          <span className="block text-sm text-[color:var(--color-ink)] truncate">
                            {staffDisplayName(u.name)}
                          </span>
                        </span>
                        {active && (
                          <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-1" aria-hidden />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={clsx(
          "w-full flex items-center border border-[color:var(--color-line)] bg-white text-left shadow-sm transition",
          density === "compact"
            ? "gap-2 rounded-lg px-2.5 min-h-9 py-2"
            : "gap-3 rounded-xl px-3.5 py-3",
          "hover:bg-[color:var(--color-paper-2)]/70 focus:outline-none focus:ring-2 focus:ring-offset-0",
          variantFocus[variant],
        )}
      >
        {selectedUser ? (
          <>
            <Avatar
              user={selectedUser}
              size={density === "compact" ? "xs" : "sm"}
              className="shrink-0 shadow-sm ring-2 ring-white"
            />
            <span className="flex-1 min-w-0">
              {density !== "compact" && (
                <span className="block text-[11px] leading-tight text-[color:var(--color-ink-muted)] truncate">
                  {selectedUser.job_title ?? "—"}
                </span>
              )}
              <span
                className={clsx(
                  "block font-medium text-[color:var(--color-ink)] truncate",
                  density === "compact" ? "text-sm leading-tight" : "text-sm",
                )}
              >
                {staffDisplayName(selectedUser.name)}
              </span>
            </span>
          </>
        ) : (
          <>
            <span
              className={clsx(
                "grid place-items-center rounded-full shrink-0 bg-[color:var(--color-paper-2)] text-[color:var(--color-ink-soft)] ring-1 ring-[color:var(--color-line)]/60",
                density === "compact" ? "w-7 h-7" : "w-8 h-8",
              )}
            >
              <Sparkles className={density === "compact" ? "w-3.5 h-3.5" : "w-4 h-4"} aria-hidden />
            </span>
            <span
              className={clsx(
                "flex-1 font-medium text-[color:var(--color-ink)]",
                density === "compact" ? "text-sm leading-normal" : "text-sm",
              )}
            >
              {autoLabel}
            </span>
          </>
        )}
        <ChevronDown
          className={clsx(
            "w-4 h-4 shrink-0 text-[color:var(--color-ink-muted)] transition-transform",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      {menu}
    </div>
  );
}
