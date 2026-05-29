import clsx from "clsx";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { productsApi } from "../../lib/api";
import { ProductItemIcon } from "../../lib/productIcons";
import { productDisplayName } from "../../lib/productDisplayName";
import { refDataQueryOptions } from "../../lib/queryOptions";
import {
  buildProductNameLookup,
  resolveProductDisplayLabel,
  type ProductNameLookup,
} from "../../lib/requestDisplayName";
import type { RequestItem } from "../../lib/types";

export type DisplayItem = {
  name: string;
  qty: number;
  sku?: string;
  isService?: boolean;
  icon_emoji?: string | null;
  note?: string | null;
};

function isServiceSku(sku?: string): boolean {
  return Boolean(sku?.startsWith("HK-SVC-") || sku?.startsWith("MT-SVC-"));
}

export function itemQtySuffix(row: DisplayItem): string | null {
  if (row.isService) return null;
  return `×${row.qty}`;
}

function itemHoverLabel(row: DisplayItem): string {
  const suffix = itemQtySuffix(row);
  return suffix ? `${row.name} ${suffix}` : row.name;
}

function parseTextLine(line: string): DisplayItem {
  const xMatch = line.match(/^(.+?)\s+x(\d+)$/i);
  if (xMatch) {
    return { name: xMatch[1]!.trim(), qty: Number(xMatch[2]) };
  }
  return { name: line.trim(), qty: 1 };
}

function itemsFromText(text: string): DisplayItem[] {
  return text
    .split(/,\s*/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(parseTextLine);
}

export function normalizeRequestItems(
  items: RequestItem[] | undefined,
  text: string,
  lang?: string,
  lookup?: ProductNameLookup,
): DisplayItem[] {
  if (items && items.length > 0) {
    return items.map((i) => ({
      name: productDisplayName(i, lang),
      qty: Math.max(1, i.qty),
      sku: i.sku,
      isService: i.is_service ?? isServiceSku(i.sku),
      icon_emoji: i.icon_emoji,
      note: i.note,
    }));
  }
  return itemsFromText(text).map((row) => ({
    ...row,
    name: lookup
      ? resolveProductDisplayLabel(row.name, lookup, lang)
      : row.name,
  }));
}

export function useProductNameLookup(): ProductNameLookup {
  const { data: catalogProducts = [] } = useQuery({
    queryKey: ["products"],
    queryFn: productsApi.list,
    ...refDataQueryOptions(),
  });
  return useMemo(
    () => buildProductNameLookup(catalogProducts),
    [catalogProducts],
  );
}

interface Props {
  items?: RequestItem[];
  text: string;
  className?: string;
  /** Wrap chips layout — used in compact tables */
  layout?: "chips" | "list" | "compact" | "icons";
  maxVisible?: number;
  /** Icons layout: show as many icons as fit in the row width. */
  fitIcons?: boolean;
  /** Table: show names when they fit on one line, otherwise icon-only. */
  adaptive?: boolean;
  prominent?: boolean;
}

const TABLE_ICON_GAP_PX = 6;
const TABLE_ICON_SLOT_PX = 48; // md icon + qty badge padding
const TABLE_ICON_MORE_PX = 40; // h-10 w-10 "+N" box
const TABLE_ICON_ROW_H = "h-11";

const TABLE_ITEM_TOOLTIP =
  "pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-[color:var(--color-ink)] px-2 py-1 text-[11px] font-medium leading-none text-white shadow-md group-hover/icon:block";

function TableItemIconBadge({ row }: { row: DisplayItem }) {
  const label = itemHoverLabel(row);
  const showQty = !row.isService;

  return (
    <li className="group/icon relative shrink-0 hover:z-30">
      <span
        className="relative inline-flex pb-0.5 pr-0.5 leading-none"
        aria-label={label}
      >
        <ProductItemIcon sku={row.sku} name={row.name} iconEmoji={row.icon_emoji} size="md" />
        {showQty ? (
          <span className="absolute bottom-0 right-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-[color:var(--color-ink)] px-0.5 text-[10px] font-bold tabular-nums leading-none text-white ring-2 ring-white">
            {row.qty}
          </span>
        ) : null}
      </span>
      <span role="tooltip" className={TABLE_ITEM_TOOLTIP}>
        {label}
      </span>
    </li>
  );
}

function TableMoreIconBadge({ count, label }: { count: number; label: string }) {
  return (
    <li className="group/more relative shrink-0 hover:z-30">
      <span
        className="inline-grid h-10 w-10 place-items-center rounded-xl bg-[color:var(--color-paper-2)] text-xs font-bold tabular-nums leading-none text-[color:var(--color-ink-soft)]"
        aria-label={label}
      >
        +{count}
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-[color:var(--color-ink)] px-2 py-1 text-[11px] font-medium leading-none text-white shadow-md group-hover/more:block"
      >
        {label}
      </span>
    </li>
  );
}

function iconsVisibleCount(
  containerWidth: number,
  total: number,
  slotPx: number = TABLE_ICON_SLOT_PX,
): number {
  if (total === 0) return 0;
  if (containerWidth <= 0) return Math.min(total, 1);
  const allFit = Math.floor((containerWidth + TABLE_ICON_GAP_PX) / slotPx);
  if (allFit >= total) return total;
  const withMore = Math.floor(
    (containerWidth - TABLE_ICON_MORE_PX + TABLE_ICON_GAP_PX) / slotPx,
  );
  return Math.max(1, Math.min(withMore, total - 1));
}

function TableIconsRow({
  rows,
  visibleCount,
  className,
  moreLabel,
}: {
  rows: DisplayItem[];
  visibleCount: number;
  className?: string;
  moreLabel?: string;
}) {
  const visible = rows.slice(0, visibleCount);
  const extra = rows.length - visible.length;

  return (
    <ul
      className={clsx(
        TABLE_ICON_ROW_H,
        "m-0 flex min-w-0 list-none items-center gap-1.5 overflow-visible p-0",
        className,
      )}
    >
      {visible.map((row, i) => (
        <TableItemIconBadge key={`${i}-${row.name}`} row={row} />
      ))}
      {extra > 0 && moreLabel ? (
        <TableMoreIconBadge count={extra} label={moreLabel} />
      ) : null}
    </ul>
  );
}

function availableItemsSlotWidth(slot: HTMLElement): number {
  const measureRoot =
    (slot.closest(".request-table-items-cell") as HTMLElement | null) ??
    slot.parentElement;
  if (!measureRoot) return 0;

  let available = measureRoot.clientWidth;
  const contentRow = slot.parentElement;
  if (
    contentRow &&
    contentRow !== measureRoot &&
    measureRoot.contains(contentRow)
  ) {
    const gapPx = 8;
    let gaps = 0;
    for (const child of contentRow.children) {
      const el = child as HTMLElement;
      if (el === slot || el.contains(slot)) continue;
      available -= el.offsetWidth;
      gaps += 1;
    }
    available -= gaps * gapPx;
  }
  return Math.max(0, available);
}

function IconItemsList({
  rows,
  maxVisible,
  fitIcons,
  adaptive,
  className,
}: {
  rows: DisplayItem[];
  maxVisible: number;
  fitIcons: boolean;
  adaptive?: boolean;
  className?: string;
}) {
  if (fitIcons && adaptive) {
    return <AdaptiveTableItemsList rows={rows} className={className} />;
  }
  return (
    <DenseIconItemsList
      rows={rows}
      maxVisible={maxVisible}
      fitIcons={fitIcons}
      className={className}
    />
  );
}

function AdaptiveTableItemsList({
  rows,
  className,
}: {
  rows: DisplayItem[];
  className?: string;
}) {
  const { t } = useTranslation();
  const slotRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(rows.length);

  const recompute = useCallback(() => {
    const slot = slotRef.current;
    if (!slot) return;
    const available = availableItemsSlotWidth(slot);
    if (available <= 0) return;
    setVisibleCount(iconsVisibleCount(available, rows.length));
  }, [rows.length]);

  useLayoutEffect(() => {
    recompute();
    const slot = slotRef.current;
    const parent = slot?.parentElement;
    if (!parent) return;
    const ro = new ResizeObserver(recompute);
    ro.observe(parent);
    return () => ro.disconnect();
  }, [recompute]);

  const extra = rows.length - visibleCount;
  const moreLabel = extra > 0 ? t("requests.icons_more", { count: extra }) : undefined;

  return (
    <div ref={slotRef} className={clsx("flex min-w-0 w-full justify-start", TABLE_ICON_ROW_H)}>
      <TableIconsRow
        rows={rows}
        visibleCount={visibleCount}
        className={className}
        moreLabel={moreLabel}
      />
    </div>
  );
}

function DenseIconItemsList({
  rows,
  maxVisible,
  fitIcons,
  className,
}: {
  rows: DisplayItem[];
  maxVisible: number;
  fitIcons: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const slotRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(() =>
    fitIcons ? rows.length : Math.min(maxVisible, rows.length),
  );

  const recompute = useCallback(() => {
    if (!fitIcons) {
      setVisibleCount(Math.min(maxVisible, rows.length));
      return;
    }
    const slot = slotRef.current;
    if (!slot) return;
    const available = availableItemsSlotWidth(slot);
    if (available <= 0) return;
    setVisibleCount(iconsVisibleCount(available, rows.length));
  }, [fitIcons, maxVisible, rows.length]);

  useLayoutEffect(() => {
    recompute();
    if (!fitIcons) return;
    const slot = slotRef.current;
    if (!slot) return;
    const ro = new ResizeObserver(recompute);
    ro.observe(slot.parentElement ?? slot);
    return () => ro.disconnect();
  }, [fitIcons, recompute]);

  if (!fitIcons) {
    return (
      <ClassicIconItemsList
        rows={rows}
        visibleCount={visibleCount}
        className={className}
        t={t}
      />
    );
  }

  return (
    <div ref={slotRef} className="min-w-0 flex-1 self-stretch">
      <ClassicIconItemsList
        rows={rows}
        visibleCount={visibleCount}
        className={className}
        t={t}
      />
    </div>
  );
}

function ClassicIconItemsList({
  rows,
  visibleCount,
  className,
  t,
}: {
  rows: DisplayItem[];
  visibleCount: number;
  className?: string;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  const extra = rows.length - visibleCount;
  const moreLabel = extra > 0 ? t("requests.icons_more", { count: extra }) : undefined;

  return (
    <TableIconsRow
      rows={rows}
      visibleCount={visibleCount}
      className={className}
      moreLabel={moreLabel}
    />
  );
}

export function RequestItemsChips({
  items,
  text,
  className,
  layout = "chips",
  maxVisible = 4,
  fitIcons = false,
  adaptive = false,
  prominent = false,
}: Props) {
  const { t, i18n } = useTranslation();
  const productLookup = useProductNameLookup();
  const rows = normalizeRequestItems(items, text, i18n.language, productLookup);
  if (rows.length === 0) return null;

  if (layout === "icons") {
    return (
      <IconItemsList
        rows={rows}
        maxVisible={maxVisible}
        fitIcons={fitIcons}
        adaptive={adaptive}
        className={className}
      />
    );
  }

  if (layout === "compact") {
    const visible = rows.slice(0, maxVisible);
    const extra = rows.length - visible.length;
    return (
      <ul
        className={clsx(
          "m-0 flex min-w-0 list-none flex-wrap items-center gap-x-2.5 gap-y-1 p-0",
          className,
        )}
      >
        {visible.map((row, i) => (
          <li
            key={`${i}-${row.name}`}
            className="inline-flex min-w-0 max-w-full items-center gap-1.5 text-[15px]"
          >
            <ProductItemIcon sku={row.sku} name={row.name} iconEmoji={row.icon_emoji} size="xs" />
            <span className="truncate font-medium leading-snug text-[color:var(--color-ink)]">
              {row.name}
            </span>
            {itemQtySuffix(row) && (
              <span className="shrink-0 text-sm font-semibold tabular-nums text-[color:var(--color-ink-muted)]">
                {itemQtySuffix(row)}
              </span>
            )}
          </li>
        ))}
        {extra > 0 && (
          <li className="shrink-0 rounded-md bg-[color:var(--color-paper-2)] px-1.5 py-0.5 text-sm font-semibold text-[color:var(--color-ink-soft)]">
            +{extra}
          </li>
        )}
      </ul>
    );
  }

  if (layout === "list") {
    const totalQty = rows.reduce((sum, row) => sum + row.qty, 0);
    return (
      <div className={className}>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[color:var(--color-ink-muted)]">
          {t("queue.items_heading", {
            count: rows.length,
            total: totalQty,
          })}
        </p>
        <ul className="m-0 list-none overflow-hidden rounded-xl border border-[color:var(--color-line)] bg-white p-0">
          {rows.map((row, i) => (
            <li
              key={`${i}-${row.name}`}
              className={clsx(
                "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5",
                i > 0 && "border-t border-[color:var(--color-line)]",
              )}
            >
              <ProductItemIcon sku={row.sku} name={row.name} iconEmoji={row.icon_emoji} size="md" />
              <span className="text-base font-semibold leading-snug text-[color:var(--color-ink)]">
                {row.name}
              </span>
              {itemQtySuffix(row) ? (
                <span
                  className="flex h-10 min-w-[2.75rem] shrink-0 items-center justify-center rounded-lg bg-[color:var(--color-ink)] px-2 text-lg font-bold tabular-nums leading-none text-white"
                  aria-label={itemQtySuffix(row)!}
                >
                  {itemQtySuffix(row)}
                </span>
              ) : (
                <span className="w-2" aria-hidden />
              )}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const visible = rows.slice(0, maxVisible);
  const extra = rows.length - visible.length;

  return (
    <ul
      className={clsx(
        "m-0 flex flex-wrap list-none p-0",
        prominent ? "gap-2" : "gap-1.5",
        className,
      )}
    >
      {visible.map((row, i) => (
        <li
          key={`${i}-${row.name}`}
          className={clsx(
            "inline-flex items-center gap-2 border border-[color:var(--color-line)] bg-white",
            prominent
              ? "min-h-[2.75rem] rounded-xl px-2.5 py-2 shadow-sm"
              : "rounded-md px-2 py-0.5",
          )}
        >
          <ProductItemIcon
            sku={row.sku}
            name={row.name}
            iconEmoji={row.icon_emoji}
            size={prominent ? "sm" : "sm"}
          />
          <span
            className={clsx(
              "font-semibold leading-snug text-[color:var(--color-ink)]",
              prominent ? "text-base sm:text-[17px]" : "text-xs",
            )}
          >
            {row.name}
          </span>
          {itemQtySuffix(row) && (
            <span
              className={clsx(
                "shrink-0 rounded-md bg-[color:var(--color-ink)] font-bold tabular-nums leading-none text-white",
                prominent
                  ? "min-w-[2.25rem] px-2.5 py-1 text-base"
                  : "min-w-[1.75rem] px-1.5 py-0.5 text-xs",
              )}
              aria-label={itemQtySuffix(row)!}
            >
              {itemQtySuffix(row)}
            </span>
          )}
        </li>
      ))}
      {extra > 0 && (
        <li
          className={clsx(
            "inline-flex items-center rounded-xl bg-[color:var(--color-paper-2)] font-semibold text-[color:var(--color-ink-soft)]",
            prominent ? "min-h-[2.75rem] px-3 py-2 text-sm" : "px-2 py-0.5 text-xs",
          )}
        >
          +{extra}
        </li>
      )}
    </ul>
  );
}
