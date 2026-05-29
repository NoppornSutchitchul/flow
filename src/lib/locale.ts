import i18n from "./i18n";
import { normalizeLanguage, type AppLang } from "./language";

/** BCP 47 locale for `Intl` / `toLocaleString`. */
export function intlLocaleForApp(lang?: string): string {
  return normalizeLanguage(lang ?? i18n.language ?? "th") === "en"
    ? "en-US"
    : "th-TH";
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatTime24(
  now: Date,
  locale: string,
  opts?: { withSeconds?: boolean },
): string {
  const withSeconds = opts?.withSeconds ?? true;
  const fromIntl = now.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    ...(withSeconds ? { second: "2-digit" as const } : {}),
    hour12: false,
  });
  if (!/^\d/.test(fromIntl)) {
    const h = pad2(now.getHours());
    const m = pad2(now.getMinutes());
    if (!withSeconds) return `${h}:${m}`;
    return `${h}:${m}:${pad2(now.getSeconds())}`;
  }
  return fromIntl;
}

/** Month label for charts / report timestamps. */
export function formatAppMonth(
  date: Date,
  lang?: string,
  length: "long" | "short" = "short",
): string {
  const locale = intlLocaleForApp(lang);
  return date.toLocaleDateString(locale, {
    month: length === "short" ? "short" : "long",
  });
}

function parseIsoLocalDate(iso: string): Date | null {
  const parts = iso.slice(0, 10).split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
  const [y, m, d] = parts;
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
    return null;
  }
  return date;
}

/** Day + short month. */
export function formatAppDayMonth(date: Date, lang?: string): string {
  const locale = intlLocaleForApp(lang);
  return date.toLocaleDateString(locale, { day: "numeric", month: "short" });
}

/** Inclusive ISO date range for KPI cards and compare notes. */
export function formatPeriodRangeShort(
  fromIso: string,
  toIso: string,
  lang?: string,
): string {
  const start = parseIsoLocalDate(fromIso);
  const end = parseIsoLocalDate(toIso);
  if (!start || !end) return `${fromIso.slice(0, 10)} – ${toIso.slice(0, 10)}`;

  const locale = intlLocaleForApp(lang);
  const day = (d: Date) => d.toLocaleDateString(locale, { day: "numeric" });
  const monthShort = (d: Date) => formatAppMonth(d, lang, "short");
  const sameMonth =
    start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  if (sameMonth) {
    return `${day(start)}–${day(end)} ${monthShort(start)}`;
  }
  return `${day(start)} ${monthShort(start)} – ${day(end)} ${monthShort(end)}`;
}

/** Date + time for report headers and tables (locale-aware). */
export function formatLocalizedDateTime(
  date: Date,
  lang?: string,
  opts?: { withSeconds?: boolean; month?: "long" | "short" },
): { date: string; time: string } {
  const locale = intlLocaleForApp(lang);
  const monthLen = opts?.month ?? "short";
  const withSeconds = opts?.withSeconds ?? true;
  return {
    date: date.toLocaleDateString(locale, {
      day: "numeric",
      month: monthLen,
      year: "numeric",
    }),
    time: formatTime24(date, locale, { withSeconds }),
  };
}

/** Datepicker month header. */
export function calendarMonthTitle(
  year: number,
  month: number,
  lang?: string,
): string {
  const locale = intlLocaleForApp(lang);
  return new Date(year, month, 1).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });
}

/** Datepicker weekday column headers (Sunday-first). */
export function calendarWeekdayLabels(lang?: string): string[] {
  const locale = intlLocaleForApp(lang);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(2024, 0, 7 + i);
    return d.toLocaleDateString(locale, { weekday: "narrow" });
  });
}

/** Live clock on the overview (Dashboard) header. */
export function formatDashboardDateTime(
  now: Date,
  lang?: string,
): { weekday: string; dateLine: string; timeLine: string } {
  const locale = intlLocaleForApp(lang);
  return {
    weekday: now.toLocaleDateString(locale, { weekday: "long" }),
    dateLine: now.toLocaleDateString(locale, {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    timeLine: formatTime24(now, locale),
  };
}

/** Locale tag for `localeCompare` (sorting names, codes, etc.). */
export function sortLocaleForApp(lang?: string): string {
  return normalizeLanguage(lang ?? i18n.language ?? "th") === "en" ? "en" : "th";
}

export function isThaiAppLang(lang?: string): boolean {
  return normalizeLanguage(lang ?? i18n.language ?? "th") === "th";
}

export { normalizeLanguage, type AppLang };
