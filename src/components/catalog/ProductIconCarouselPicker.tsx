import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Search, X } from "lucide-react";
import clsx from "clsx";

import {
  emojiPickerSections,
  PICKER_RECOMMENDED_ID,
  resolvePickerEmoji,
  type EmojiPickerSection,
} from "../../lib/productIcons";

function EmojiGridCell({
  emoji,
  active,
  onClick,
}: {
  emoji: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={emoji}
      aria-label={emoji}
      aria-pressed={active}
      onClick={onClick}
      className={clsx(
        "flex aspect-square w-full min-h-[2.875rem] items-center justify-center rounded-xl border-2 transition-all sm:min-h-[3.125rem]",
        active
          ? "border-[color:var(--color-ink)]/30 bg-white shadow-sm ring-1 ring-[color:var(--color-ink)]/8"
          : "border-transparent hover:border-[color:var(--color-line)] hover:bg-white/90",
      )}
    >
      <span className="select-none text-[1.75rem] leading-none sm:text-[2rem]" aria-hidden>
        {emoji}
      </span>
    </button>
  );
}

export function EmojiIconPickerModal({
  value,
  onSelect,
  onClose,
}: {
  value: string;
  onSelect: (emoji: string) => void;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const selectedEmoji = resolvePickerEmoji(value);
  const [query, setQuery] = useState("");
  const [activeSection, setActiveSection] = useState(PICKER_RECOMMENDED_ID);
  const [sections, setSections] = useState<EmojiPickerSection[]>([]);
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void emojiPickerSections(t("stock.icon_group_recommended"), i18n.language).then(
      (loaded) => {
        if (!cancelled) {
          setSections(loaded);
          setLoading(false);
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [t, i18n.language]);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setSearchResults([]);
      return;
    }
    let cancelled = false;
    void import("../../lib/unicodeEmojiCatalog").then(({ searchUnicodeEmojis }) => {
      if (!cancelled) setSearchResults(searchUnicodeEmojis(q));
    });
    return () => {
      cancelled = true;
    };
  }, [query]);

  const visibleEmojis = useMemo(() => {
    if (query.trim()) return searchResults;
    const section = sections.find((s) => s.id === activeSection);
    return section?.emojis ?? [];
  }, [query, searchResults, sections, activeSection]);

  const activeLabel = sections.find((s) => s.id === activeSection)?.label ?? "";

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const searching = query.trim().length > 0;

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-[120] grid place-items-center bg-black/45 p-4 sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal
        aria-labelledby="icon-grid-title"
        className="flex max-h-[min(90vh,46rem)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[color:var(--color-line)] bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[color:var(--color-line)] px-5 py-4">
          <h3 id="icon-grid-title" className="text-lg font-semibold tracking-tight">
            {t("stock.icon_picker_title")}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[color:var(--color-ink-soft)] hover:bg-[color:var(--color-paper-2)]"
            aria-label={t("common.cancel")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-[color:var(--color-line)] px-5 py-3.5">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--color-ink-muted)]" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("stock.icon_search_placeholder")}
              className="w-full rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-paper)]/50 py-3 pl-10 pr-3 text-sm focus:border-[color:var(--color-ink)]/20 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[color:var(--color-ink)]/10"
            />
          </label>
        </div>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          {!searching && (
            <nav
              aria-label={t("stock.icon_picker_title")}
              className="shrink-0 border-b border-[color:var(--color-line)] md:w-44 md:border-b-0 md:border-r"
            >
              <ul className="flex flex-wrap gap-1.5 p-3 md:flex md:max-h-none md:flex-col md:gap-1 md:overflow-y-auto md:p-3">
                {sections.map((section) => {
                  const active = activeSection === section.id;
                  return (
                    <li key={section.id} className="md:w-full">
                      <button
                        type="button"
                        onClick={() => setActiveSection(section.id)}
                        className={clsx(
                          "w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium leading-snug transition-colors",
                          active
                            ? "bg-[color:var(--color-ink)] text-white shadow-sm"
                            : "text-[color:var(--color-ink-soft)] hover:bg-[color:var(--color-paper-2)] hover:text-[color:var(--color-ink)]",
                        )}
                      >
                        {section.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
            {loading ? (
              <p className="py-16 text-center text-sm text-[color:var(--color-ink-muted)]">
                {t("common.loading")}
              </p>
            ) : visibleEmojis.length === 0 ? (
              <p className="py-16 text-center text-sm text-[color:var(--color-ink-muted)]">
                {t("stock.icon_search_empty")}
              </p>
            ) : (
              <div className="rounded-xl border border-[color:var(--color-line)]/80 bg-[color:var(--color-paper)]/35 p-3 sm:p-4">
                <div className="mb-4 flex items-baseline justify-between gap-3 border-b border-[color:var(--color-line)]/70 pb-3">
                  <p className="text-sm font-semibold text-[color:var(--color-ink)]">
                    {searching
                      ? t("stock.icon_search_results", { count: visibleEmojis.length })
                      : activeLabel}
                  </p>
                  {!searching && (
                    <span className="shrink-0 text-xs tabular-nums text-[color:var(--color-ink-muted)]">
                      {visibleEmojis.length}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-5 gap-2 sm:grid-cols-6 md:grid-cols-7 lg:grid-cols-8">
                  {visibleEmojis.map((emoji, i) => (
                    <EmojiGridCell
                      key={`${emoji}-${i}`}
                      emoji={emoji}
                      active={selectedEmoji === emoji}
                      onClick={() => {
                        onSelect(emoji);
                        onClose();
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
