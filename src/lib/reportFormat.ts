/** Formatting helpers for executive reports (BRS). */

import i18n from "./i18n";
import { formatPeriodRangeShort as formatPeriodRangeShortLocalized } from "./locale";
import { normalizeLanguage } from "./language";

const ISO_WEEK_KEY = /^(\d{4})-W(\d{1,2})$/i;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toIsoDateLocal(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Monday–Sunday bounds for backend period keys like `2026-W20`. */
export function isoWeekBoundsFromPeriodKey(periodKey: string): { start: string; end: string } | null {
  const m = ISO_WEEK_KEY.exec(periodKey.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const week = Number(m[2]);
  if (!Number.isFinite(year) || !Number.isFinite(week) || week < 1 || week > 53) return null;

  const fromIsoCalendar = (isoDay: number) => {
    const jan4 = new Date(year, 0, 4);
    const jan4IsoDow = jan4.getDay() === 0 ? 7 : jan4.getDay();
    const mondayWeek1 = new Date(jan4);
    mondayWeek1.setDate(jan4.getDate() - (jan4IsoDow - 1));
    const out = new Date(mondayWeek1);
    out.setDate(mondayWeek1.getDate() + (week - 1) * 7 + (isoDay - 1));
    return out;
  };

  return { start: toIsoDateLocal(fromIsoCalendar(1)), end: toIsoDateLocal(fromIsoCalendar(7)) };
}

/** Chart/table week label from ISO bounds or `YYYY-Www` period key (never English `w.label` alone). */
export function weekPeriodLabels(
  w: {
    week_start?: string;
    week_end?: string;
    period?: string;
    week?: string;
    label?: string;
  },
  lang?: string,
): { label: string; title: string } {
  const lng = normalizeLanguage(lang ?? i18n.language ?? "th");
  let start = w.week_start?.slice(0, 10);
  let end = w.week_end?.slice(0, 10);
  const periodKey =
    w.period ??
    w.week ??
    (w.label && ISO_WEEK_KEY.test(w.label.trim()) ? w.label.trim() : undefined);

  if ((!start || !end) && periodKey) {
    const bounds = isoWeekBoundsFromPeriodKey(periodKey);
    if (bounds) {
      start = bounds.start;
      end = bounds.end;
    }
  }

  let title = "";
  if (start && end) {
    title = formatWeekRange(start, end, lng);
  } else if (w.label && !ISO_WEEK_KEY.test(w.label.trim())) {
    title = w.label;
  } else if (periodKey) {
    const bounds = isoWeekBoundsFromPeriodKey(periodKey);
    title = bounds ? formatWeekRange(bounds.start, bounds.end, lng) : periodKey;
  }

  return { label: title, title };
}

export function formatCount(n: number): string {
  return Math.round(n).toLocaleString();
}

export function formatPct(n: number, decimals = 1): string {
  return `${n.toFixed(decimals)}%`;
}

export function formatMinutes(n: number, decimals = 1): string {
  return `${n.toFixed(decimals)} min`;
}

/** Thai-friendly minutes (caller passes translated unit). */
export function formatMinutesUnit(n: number, unit: string, decimals = 1): string {
  return `${n.toFixed(decimals)} ${unit}`;
}

export function formatDays(n: number, decimals = 1): string {
  if (n >= 999) return "—";
  return `${n.toFixed(decimals)}`;
}

export function formatDecimal(n: number, decimals = 1): string {
  return n.toFixed(decimals);
}

export function truncateLabel(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

/** ISO week range for chart axes, e.g. "5–11 พ.ค." or "28 Apr – 4 May". */
export function formatWeekRange(startIso: string, endIso: string, lang?: string): string {
  return formatPeriodRangeShortLocalized(startIso, endIso, lang);
}

/** Inclusive calendar days between two ISO dates (YYYY-MM-DD). */
export function periodDaysInclusive(fromIso: string, toIso: string): number {
  const parse = (iso: string) => {
    const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
    return new Date(y, m - 1, d);
  };
  const start = parse(fromIso);
  const end = parse(toIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

/** Short date range for KPI compare hints (same style as weekly chart axes). */
export function formatPeriodRangeShort(fromIso: string, toIso: string, lang?: string): string {
  return formatPeriodRangeShortLocalized(fromIso, toIso, lang);
}

/** Split week range label for two-line SVG x-axis (avoids rotation clipping). */
export function splitWeekRangeLabel(label: string): [string, string?] {
  if (label.includes(" – ")) {
    const [a, b] = label.split(" – ").map((s) => s.trim());
    return [a, b];
  }
  const lastSpace = label.lastIndexOf(" ");
  if (lastSpace > 0) {
    return [label.slice(0, lastSpace).trim(), label.slice(lastSpace + 1).trim()];
  }
  return [label];
}

export type TrendDirection = "up" | "down" | "flat";

export function trendFromDelta(
  delta: number,
  higherIsBetter = true,
): { direction: TrendDirection; good: boolean; pct: number } {
  const pct = Math.abs(delta);
  if (Math.abs(delta) < 0.05) {
    return { direction: "flat", good: true, pct: 0 };
  }
  const up = delta > 0;
  const good = higherIsBetter ? up : !up;
  return { direction: up ? "up" : "down", good, pct };
}

export function trendArrow(direction: TrendDirection): string {
  if (direction === "up") return "↑";
  if (direction === "down") return "↓";
  return "→";
}
