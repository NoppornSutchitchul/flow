import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  BarChart3,
  ChevronDown,
  Clock,
  LayoutDashboard,
  Search,
  Users,
  Warehouse,
} from "lucide-react";
import clsx from "clsx";

import type { ReportPresetMeta } from "../../lib/types";
import { groupPresetsByCategory } from "../../lib/reportPresetCategories";
import {
  reportPresetDisplayLabel,
  reportPresetSearchHaystack,
} from "../../lib/reportPresetLabel";

const CATEGORY_ICONS: Record<string, typeof BarChart3> = {
  executive: LayoutDashboard,
  operations: BarChart3,
  staff: Users,
  inventory: Warehouse,
  audit: Clock,
};

type Props = {
  presets: ReportPresetMeta[];
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
  loading?: boolean;
};

export function ReportPresetCombobox({
  presets,
  selectedSlug,
  onSelect,
  loading = false,
}: Props) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = presets.find((p) => p.slug === selectedSlug);
  const selectedLabel = selected ? reportPresetDisplayLabel(selected, t) : "";

  const grouped = useMemo(() => groupPresetsByCategory(presets), [presets]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return grouped;
    return grouped
      .map(({ category, items }) => {
        const catLabel = t(`reports.category.${category}`);
        const hits = items.filter((p) => {
          const hay = reportPresetSearchHaystack(p, t, catLabel);
          return hay.includes(q) || catLabel.toLowerCase().includes(q);
        });
        return hits.length ? { category, items: hits } : null;
      })
      .filter(Boolean) as { category: string; items: ReportPresetMeta[] }[];
  }, [grouped, query, t]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const pick = (slug: string) => {
    onSelect(slug);
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={rootRef} className="relative min-w-0 w-full">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--color-ink-muted)]"
          aria-hidden
        />
        <input
          type="text"
          value={open ? query : selectedLabel}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={loading ? t("common.loading") : t("reports.preset_search_placeholder")}
          disabled={loading || presets.length === 0}
          className={clsx(
            "h-10 w-full rounded-xl border border-[color:var(--color-line)] bg-white py-2 pl-9 pr-9 text-sm shadow-sm",
            "placeholder:text-[color:var(--color-ink-muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-ink)]/12",
          )}
          aria-label={t("reports.preset_search_placeholder")}
          aria-expanded={open}
          aria-haspopup="listbox"
          autoComplete="off"
        />
        <ChevronDown
          className={clsx(
            "pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--color-ink-muted)] transition",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </div>

      {open && (
        <div
          className="absolute left-0 right-0 z-50 mt-1 max-h-[min(24rem,60dvh)] overflow-y-auto rounded-xl border border-[color:var(--color-line)] bg-white py-2 shadow-lg"
          role="listbox"
        >
          {filtered.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-[color:var(--color-ink-muted)]">
              {t("reports.preset_search_empty")}
            </p>
          ) : (
            filtered.map(({ category, items }) => {
              const Icon = CATEGORY_ICONS[category] ?? BarChart3;
              return (
                <div key={category} className="mb-2 last:mb-0">
                  <p className="mb-1 flex items-center gap-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-[color:var(--color-ink-muted)]">
                    <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    {t(`reports.category.${category}`)}
                  </p>
                  <ul>
                    {items.map((p) => (
                      <li key={p.slug}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={selectedSlug === p.slug}
                          onClick={() => pick(p.slug)}
                          className={clsx(
                            "w-full px-3 py-2 text-left text-sm transition",
                            selectedSlug === p.slug
                              ? "bg-[color:var(--color-ink)] font-medium text-white"
                              : "text-[color:var(--color-ink-soft)] hover:bg-[color:var(--color-paper-2)]",
                          )}
                        >
                          <span className="flex items-center gap-2">
                            <span
                              className={clsx(
                                "shrink-0 font-mono text-xs font-semibold tabular-nums",
                                selectedSlug === p.slug
                                  ? "text-white/90"
                                  : "text-[color:var(--color-ink-muted)]",
                              )}
                            >
                              {p.code}
                            </span>
                            <span className="min-w-0 truncate">{t(p.title_key)}</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
