import { calendarWeekdayLabels } from "./locale";
import { isoDateLocal } from "./reportPresetFilters";

export function parseIsoDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const date = new Date(y, mo, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo || date.getDate() !== d) return null;
  return date;
}

export function isoInRange(iso: string, min?: string, max?: string): boolean {
  if (min && iso < min) return false;
  if (max && iso > max) return false;
  return true;
}

export type CalendarCell = { iso: string; inMonth: boolean };

/** Sunday-first month grid (6 rows max). */
export function buildMonthGrid(year: number, month: number): CalendarCell[] {
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: CalendarCell[] = [];

  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  const prevDays = new Date(prevYear, prevMonth + 1, 0).getDate();

  for (let i = firstDow - 1; i >= 0; i--) {
    const day = prevDays - i;
    cells.push({
      iso: isoDateLocal(new Date(prevYear, prevMonth, day)),
      inMonth: false,
    });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({
      iso: isoDateLocal(new Date(year, month, day)),
      inMonth: true,
    });
  }

  let nextMonth = month + 1;
  let nextYear = year;
  if (nextMonth > 11) {
    nextMonth = 0;
    nextYear += 1;
  }
  let day = 1;
  while (cells.length < 42) {
    cells.push({
      iso: isoDateLocal(new Date(nextYear, nextMonth, day)),
      inMonth: false,
    });
    day += 1;
  }

  return cells;
}

export function weekdayLabels(lang?: string): string[] {
  return calendarWeekdayLabels(lang);
}

/** Format ISO date for manual entry (dd/mm/yyyy; Buddhist year when useBe). */
export function formatIsoForInput(iso: string, useBe: boolean): string {
  const d = parseIsoDate(iso);
  if (!d) return "";
  const y = useBe ? d.getFullYear() + 543 : d.getFullYear();
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${y}`;
}

function normalizeYear(raw: number): number | null {
  if (!Number.isFinite(raw)) return null;
  if (raw >= 2400) return raw - 543;
  if (raw >= 1900 && raw < 2400) return raw;
  if (raw >= 0 && raw < 100) return 2000 + raw;
  return null;
}

function toIsoFromParts(day: number, month: number, year: number): string | null {
  const y = normalizeYear(year);
  if (y == null || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(y, month - 1, day);
  if (date.getFullYear() !== y || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return isoDateLocal(date);
}

/** Parse typed dates: ISO, D/M/Y (พ.ศ. when year ≥ 2400). */
export function parseFlexibleDateInput(text: string): string | null {
  const s = text.trim();
  if (!s) return null;

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (iso) return toIsoFromParts(Number(iso[3]), Number(iso[2]), Number(iso[1]));

  const dmy = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(s);
  if (dmy) return toIsoFromParts(Number(dmy[1]), Number(dmy[2]), Number(dmy[3]));

  const compact = /^(\d{2})(\d{2})(\d{4})$/.exec(s);
  if (compact) {
    return toIsoFromParts(Number(compact[1]), Number(compact[2]), Number(compact[3]));
  }

  return null;
}
