import { formatLocationCode } from "./hotelLocations";
import {
  productDisplayName,
  stripLegacyProductSuffix,
  type NamedProduct,
} from "./productDisplayName";

const LOCATION_SEP = " · ";

export type ProductNameLookup = {
  byThaiName: Map<string, NamedProduct>;
  byEnglishName: Map<string, NamedProduct>;
  bySku: Map<string, NamedProduct>;
};

/** Index catalog rows by Thai `name` and `sku` for report / queue label resolution. */
export function buildProductNameLookup(
  products: (NamedProduct & { sku?: string })[],
): ProductNameLookup {
  const byThaiName = new Map<string, NamedProduct>();
  const byEnglishName = new Map<string, NamedProduct>();
  const bySku = new Map<string, NamedProduct>();
  for (const p of products) {
    if (p.sku) bySku.set(p.sku, p);
    for (const raw of [p.name, p.name_en]) {
      const label = (raw ?? "").trim();
      if (!label) continue;
      byThaiName.set(label, p);
      const stripped = stripLegacyProductSuffix(label);
      if (stripped !== label) byThaiName.set(stripped, p);
    }
    const en = (p.name_en ?? "").trim();
    if (en) {
      byEnglishName.set(en.toLowerCase(), p);
      const enStripped = stripLegacyProductSuffix(en);
      if (enStripped !== en) byEnglishName.set(enStripped.toLowerCase(), p);
    }
  }
  return { byThaiName, byEnglishName, bySku };
}

function parseItemSegment(segment: string): { base: string; qty?: number; note?: string } {
  const trimmed = segment.trim();
  if (!trimmed) return { base: "" };

  let note: string | undefined;
  let body = trimmed;
  const noteMatch = trimmed.match(/^(.+?)\s+\(([^)]+)\)\s*$/);
  if (noteMatch) {
    body = noteMatch[1]!.trim();
    note = noteMatch[2]!.trim();
  }

  const qtyMatch = body.match(/^(.+?)\s+x(\d+)$/i);
  if (qtyMatch) {
    return { base: qtyMatch[1]!.trim(), qty: Number(qtyMatch[2]), note };
  }
  return { base: body, note };
}

function formatItemSegment(parsed: { base: string; qty?: number; note?: string }): string {
  let out = parsed.base;
  if (parsed.qty != null && parsed.qty > 1) out += ` x${parsed.qty}`;
  if (parsed.note) out += ` (${parsed.note})`;
  return out;
}

/** Localize comma-separated `items_text` using the product catalog. */
export function localizeItemsText(
  text: string,
  lookup: ProductNameLookup,
  lang?: string,
): string {
  const raw = text.trim();
  if (!raw) return text;

  return raw
    .split(/,\s*/)
    .map((seg) => {
      const parsed = parseItemSegment(seg);
      if (!parsed.base) return seg.trim();
      const localized = resolveProductDisplayLabel(parsed.base, lookup, lang);
      return formatItemSegment({ ...parsed, base: localized });
    })
    .join(", ");
}

export function resolveProductDisplayLabel(
  name: string,
  lookup: ProductNameLookup,
  lang?: string,
  sku?: string,
): string {
  if (sku) {
    const hit = lookup.bySku.get(sku);
    if (hit) return productDisplayName(hit, lang);
  }
  const trimmed = name.trim();
  const key = stripLegacyProductSuffix(trimmed);
  const hit =
    lookup.byThaiName.get(key) ??
    lookup.byThaiName.get(trimmed) ??
    lookup.byEnglishName.get(key.toLowerCase()) ??
    lookup.byEnglishName.get(trimmed.toLowerCase());
  if (hit) return productDisplayName(hit, lang);
  return name;
}

/** `room · items` display name with localized location and catalog item labels. */
export function formatRequestDisplayName(
  name: string,
  labelByCode: Record<string, string>,
  lookup: ProductNameLookup,
  lang?: string,
): string {
  const idx = name.indexOf(LOCATION_SEP);
  if (idx < 0) {
    const trimmed = name.trim();
    if (labelByCode[trimmed] || /^HK-LOC-/i.test(trimmed)) {
      return formatLocationCode(trimmed, labelByCode, lang);
    }
    return localizeItemsText(trimmed, lookup, lang);
  }
  const room = name.slice(0, idx).trim();
  const items = name.slice(idx + LOCATION_SEP.length);
  const roomLabel = formatLocationCode(room, labelByCode, lang);
  return `${roomLabel}${LOCATION_SEP}${localizeItemsText(items, lookup, lang)}`;
}
