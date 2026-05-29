import {
  isBeforeScheduledTime,
  requestDashboardSortMs,
  requestSlaAnchorMs,
} from "./requestSchedule";
import { hasAppFeature } from "./appFeatures";
import { formatLocalizedDateTime, isThaiAppLang } from "./locale";
import { jobTitleDisplayLabel } from "./jobTitleDisplay";
import type { OpsRoutedDept } from "./opsDepartment";
import type { RequestRead, RequestStatus, Role, User, TimeAlertSettings } from "./types";

export type TimeBand = "on_track" | "warning" | "breach" | "dnd" | "done";

// User-configurable time-alert thresholds (minutes). Defaults split a 15-minute
// response window into thirds for yellow / red / overdue row emphasis.
export const TIME_ALERT_KEYS = {
  warn: "flow_time_warn_min",
  danger: "flow_time_danger_min",
  breach: "flow_time_breach_min",
} as const;

export const TIME_ALERT_DEFAULTS = { warn: 5, danger: 10, breach: 15 };

function readThreshold(which: keyof typeof TIME_ALERT_KEYS): number {
  const fallback = TIME_ALERT_DEFAULTS[which];
  if (typeof window === "undefined") return fallback;
  const primary = TIME_ALERT_KEYS[which];
  const raw = window.localStorage.getItem(primary);
  if (raw == null) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function getTimeAlertThresholds() {
  return {
    warn: readThreshold("warn"),
    danger: readThreshold("danger"),
    breach: readThreshold("breach"),
  };
}

/** Sync admin settings from API into localStorage for row tint + countdown UI. */
export function applyTimeAlertSettings(settings: TimeAlertSettings) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TIME_ALERT_KEYS.warn, String(settings.warn));
  localStorage.setItem(TIME_ALERT_KEYS.danger, String(settings.danger));
  localStorage.setItem(TIME_ALERT_KEYS.breach, String(settings.breach));
}

export function requestTimeBand(r: RequestRead): TimeBand {
  if (r.status === "dnd") return "dnd";
  if (r.status === "delivered" || r.status === "cancelled") return "done";
  const ageMin = r.age_seconds / 60;
  const { warn, danger } = getTimeAlertThresholds();
  // 2/3 of the allotted window or beyond → red blink
  if (ageMin >= danger) return "breach";
  // 1/3 up to (but not yet 2/3) → yellow blink
  if (ageMin >= warn) return "warning";
  return "on_track";
}

export function ageLabel(seconds: number): string {
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h ${rem}m` : `${h}h`;
}

/** Parse API datetimes: naive ISO from backend is UTC — without `Z`, JS treats as local and skews deadlines. */
export function parseApiUtcMs(iso: string): number {
  const s = iso.trim();
  if (!s) return NaN;
  if (/Z$/i.test(s)) return new Date(s).getTime();
  if (/[+-]\d{2}:?\d{2}$/.test(s)) return new Date(s).getTime();
  const norm = s.includes("T") ? s : s.replace(" ", "T");
  return new Date(`${norm}Z`).getTime();
}

/** Minutes allowed to complete the request (from API or settings fallback). */
export function responseBudgetMinutes(r: RequestRead): number {
  const { breach } = getTimeAlertThresholds();
  if (r.response_minutes > 0) return r.response_minutes;
  return breach > 0 ? breach : TIME_ALERT_DEFAULTS.breach;
}

/** Elapsed seconds since creation; live when `nowMs` is passed for open requests. */
export function elapsedSecondsLive(r: RequestRead, nowMs = Date.now()): number {
  if (r.status === "delivered" || r.status === "cancelled") {
    return r.age_seconds;
  }
  const anchor = requestSlaAnchorMs(r);
  if (!Number.isFinite(anchor)) return r.age_seconds;
  if (isBeforeScheduledTime(r, nowMs)) return 0;
  return Math.max(0, (nowMs - anchor) / 1000);
}

export type CountdownFill = {
  /** 0–100 for the left-to-right fill width */
  widthPct: number;
  /** CSS color for the fill band */
  color: string;
  /** 0–1+ elapsed / budget */
  progress: number;
  overdue: boolean;
};

/** Left-to-right urgency fill: green → yellow → red as the response window elapses. */
export function requestCountdownFill(r: RequestRead, nowMs = Date.now()): CountdownFill | null {
  if (r.status === "delivered" || r.status === "cancelled") return null;
  if (r.status === "dnd") return null;
  if (isBeforeScheduledTime(r, nowMs)) return null;
  const budgetSec = responseBudgetMinutes(r) * 60;
  if (budgetSec <= 0) return null;

  const elapsed = elapsedSecondsLive(r, nowMs);
  const progress = elapsed / budgetSec;
  const widthPct = Math.min(100, progress * 100);
  const overdue = progress >= 1;

  let color: string;
  if (progress < 1 / 3) {
    color = "var(--color-stock-ok-bg)";
  } else if (progress < 2 / 3) {
    color = "var(--color-row-warning)";
  } else if (progress < 1) {
    color = "var(--color-row-breach)";
  } else {
    color = "#991b1b";
  }

  return { widthPct, color, progress, overdue };
}

/** Seconds until the response-time deadline (negative = overdue). Null when request is closed.
 * Uses `r.response_minutes` from the API with fallback to Settings; `created_at` parsed as UTC.
 */
export function timeRemainingSeconds(r: RequestRead): number | null {
  if (r.status === "delivered" || r.status === "cancelled") return null;

  if (r.status === "dnd") {
    if (r.auto_cancel_at) {
      const cancelMs = parseApiUtcMs(r.auto_cancel_at);
      if (Number.isFinite(cancelMs)) {
        return (cancelMs - Date.now()) / 1000;
      }
    }
    return null;
  }

  const scheduledMs = r.scheduled_at ? parseApiUtcMs(r.scheduled_at) : NaN;
  const now = Date.now();
  if (Number.isFinite(scheduledMs) && scheduledMs > now && r.schedule_mode !== "immediate") {
    return (scheduledMs - now) / 1000;
  }

  const anchor = requestSlaAnchorMs(r);
  if (!Number.isFinite(anchor)) return null;
  const { breach } = getTimeAlertThresholds();
  const budgetMin =
    r.response_minutes > 0
      ? r.response_minutes
      : breach > 0
        ? breach
        : TIME_ALERT_DEFAULTS.breach;
  const deadline = anchor + budgetMin * 60 * 1000;
  return (deadline - now) / 1000;
}

/** Live countdown for table cells as HH:MM:SS; overdue shows −HH:MM:SS. */
export function formatTimeRemainingSeconds(remainingSec: number | null): string {
  if (remainingSec === null) return "—";
  const sign = remainingSec < 0 ? "\u2212" : "";
  const total = Math.floor(Math.abs(remainingSec));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${sign}${pad(h)}:${pad(m)}:${pad(s)}`;
}

export type ElapsedTimeBand = "ok" | "warn" | "danger";

/** Color band for elapsed work time — uses Settings thresholds (warn / danger). */
export function elapsedTimeBand(elapsedSec: number): ElapsedTimeBand {
  const min = elapsedSec / 60;
  const { warn, danger } = getTimeAlertThresholds();
  if (min >= danger) return "danger";
  if (min >= warn) return "warn";
  return "ok";
}

/** Elapsed work time as HH:MM:SS for request table cells. */
export function formatElapsedSeconds(elapsedSec: number): string {
  const total = Math.max(0, Math.floor(elapsedSec));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export function elapsedTimeCellClass(band: ElapsedTimeBand): string {
  switch (band) {
    case "danger":
      return "font-semibold text-[color:var(--color-pending-fg)]";
    case "warn":
      return "font-semibold text-[color:var(--color-stock-low-fg)]";
    default:
      return "font-semibold text-[color:var(--color-delivered-fg)]";
  }
}

function isActiveRequest(r: RequestRead): boolean {
  return r.status !== "delivered" && r.status !== "cancelled";
}

/** Housekeeper / maintenance waiting on front desk for DND resolution. */
export function isDndWaiting(r: RequestRead): boolean {
  return r.status === "dnd";
}

/** DND marked unreachable — auto-cancel timer is running. */
export function isDndPendingAutoCancel(r: RequestRead): boolean {
  return r.status === "dnd" && Boolean(r.auto_cancel_at);
}

/**
 * Front desk has acknowledged the DND (either deferred or marked guest
 * unreachable). Until this is true, the row should stay visually "active" so
 * the front desk noticed it and acts. Once true the row is greyed out — we've
 * already responded and are just waiting for the auto-cancel timer.
 */
export function isDndDeferred(r: RequestRead): boolean {
  return isDndPendingAutoCancel(r);
}

export const dndWaitingRowClass =
  "opacity-70 saturate-[0.45] bg-[color:var(--color-paper-2)]/80";

export const dndWaitingCardClass =
  "border-[color:var(--color-line)] bg-[color:var(--color-paper-2)]/90 opacity-80 saturate-[0.5]";

/** Rush first, then least time remaining; DND-waiting jobs always last. */
export function compareRequestUrgency(a: RequestRead, b: RequestRead): number {
  const aDnd = isActiveRequest(a) && isDndWaiting(a);
  const bDnd = isActiveRequest(b) && isDndWaiting(b);
  if (aDnd !== bDnd) return aDnd ? 1 : -1;

  const aRush = isActiveRequest(a) && a.priority === "rush" ? 1 : 0;
  const bRush = isActiveRequest(b) && b.priority === "rush" ? 1 : 0;
  if (aRush !== bRush) return bRush - aRush;

  const aRem = isActiveRequest(a) ? timeRemainingSeconds(a) : null;
  const bRem = isActiveRequest(b) ? timeRemainingSeconds(b) : null;
  if (aRem !== null && bRem !== null && aRem !== bRem) return aRem - bRem;
  if (aRem !== null && bRem === null) return -1;
  if (aRem === null && bRem !== null) return 1;

  return b.id - a.id;
}

export function sortRequestsByUrgency(requests: RequestRead[]): RequestRead[] {
  return [...requests].sort(compareRequestUrgency);
}

/** Newest submitted first (Dashboard active list). */
export function compareRequestsByCreatedDesc(
  a: RequestRead,
  b: RequestRead,
): number {
  const aTime = parseApiUtcMs(a.created_at);
  const bTime = parseApiUtcMs(b.created_at);
  if (aTime !== bTime) return bTime - aTime;
  return b.id - a.id;
}

/** Dashboard: live work first, pre-scheduled holds pinned to the bottom. */
export function compareDashboardActiveRequests(
  a: RequestRead,
  b: RequestRead,
  nowMs = Date.now(),
): number {
  const aHold = isBeforeScheduledTime(a, nowMs);
  const bHold = isBeforeScheduledTime(b, nowMs);
  if (aHold !== bHold) return aHold ? 1 : -1;

  const aCrisis = isAwaitingStaff(a);
  const bCrisis = isAwaitingStaff(b);
  if (aCrisis !== bCrisis) return aCrisis ? -1 : 1;

  if (aHold && bHold) {
    const aSched = parseApiUtcMs(a.scheduled_at ?? "");
    const bSched = parseApiUtcMs(b.scheduled_at ?? "");
    if (aSched !== bSched) return aSched - bSched;
    return b.id - a.id;
  }

  const aTime = requestDashboardSortMs(a, nowMs);
  const bTime = requestDashboardSortMs(b, nowMs);
  if (aTime !== bTime) return bTime - aTime;
  return b.id - a.id;
}

export function sortRequestsByCreatedDesc(
  requests: RequestRead[],
): RequestRead[] {
  return [...requests].sort(compareRequestsByCreatedDesc);
}

export type ActiveRequestAlerts = {
  rush: boolean;
  warning: boolean;
  overdue: boolean;
  staffCrisis: boolean;
};

/** Immediate job stuck with no online staff to assign. */
export function isAwaitingStaff(r: Pick<RequestRead, "awaiting_staff">): boolean {
  return r.awaiting_staff === true;
}

/** Flags for dashboard header chips (Rush / yellow band / overdue / no staff). */
export function activeRequestAlerts(
  rows: RequestRead[],
  nowMs = Date.now(),
): ActiveRequestAlerts {
  let rush = false;
  let warning = false;
  let overdue = false;
  let staffCrisis = false;

  for (const r of rows) {
    if (!isActiveRequest(r)) continue;
    if (isBeforeScheduledTime(r, nowMs)) continue;

    if (isAwaitingStaff(r)) {
      staffCrisis = true;
      continue;
    }

    if (r.priority === "rush") rush = true;

    const fill = requestCountdownFill(r, nowMs);
    if (!fill) continue;

    if (fill.overdue) {
      overdue = true;
    } else if (fill.progress >= 1 / 3) {
      warning = true;
    }
  }

  return { rush, warning, overdue, staffCrisis };
}

export function timeOfDay(iso: string, locale?: string): string {
  const ms = parseApiUtcMs(iso);
  if (!Number.isFinite(ms)) return "—";
  return new Date(ms).toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** Absolute time for reports (e.g. 11:30 น. in Thai). */
export function formatReportDateTime(iso: string, lang?: string): string {
  const ms = parseApiUtcMs(iso);
  if (!Number.isFinite(ms)) return "—";
  const d = new Date(ms);
  const isTh = isThaiAppLang(lang);
  const { date, time } = formatLocalizedDateTime(d, lang, {
    withSeconds: false,
    month: "short",
  });
  return isTh ? `${date} ${time} น.` : `${date} ${time}`;
}

/** Short numeric date for report tables (dd/mm/yyyy; พ.ศ. when lang is Thai). */
export function formatReportDateShort(iso: string, lang?: string): string {
  const ms = parseApiUtcMs(iso);
  if (!Number.isFinite(ms)) return "—";
  const d = new Date(ms);
  const isTh = isThaiAppLang(lang);
  const y = isTh ? d.getFullYear() + 543 : d.getFullYear();
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${y}`;
}

/** Time line under short date in report tables. */
export function formatReportTimeShort(iso: string, lang?: string): string {
  const ms = parseApiUtcMs(iso);
  if (!Number.isFinite(ms)) return "—";
  const d = new Date(ms);
  const isTh = isThaiAppLang(lang);
  const { time } = formatLocalizedDateTime(d, lang, { withSeconds: false });
  return isTh ? `${time} น.` : time;
}

/** Export / CSV: date and time on one line. */
export function formatReportDateTimeCompact(iso: string, lang?: string): string {
  const date = formatReportDateShort(iso, lang);
  if (date === "—") return date;
  return `${date} ${formatReportTimeShort(iso, lang)}`;
}

export function relativeFromNow(iso: string): string {
  const diff = (Date.now() - parseApiUtcMs(iso)) / 1000;
  const m = Math.max(0, Math.round(diff / 60));
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m ago`;
}

export function rowTint(band: TimeBand): string {
  switch (band) {
    case "breach":
      return "row-time-danger";
    case "warning":
      return "row-time-warn";
    case "dnd":
      return dndWaitingRowClass;
    default:
      return "";
  }
}

export const staffCrisisRowClass = "row-staff-crisis";

export const statusPillClass: Record<RequestStatus, string> = {
  pending:
    "bg-[color:var(--color-pending-bg)] text-[color:var(--color-pending-fg)]",
  assigned:
    "bg-[color:var(--color-assigned-bg)] text-[color:var(--color-assigned-fg)]",
  in_progress:
    "bg-[color:var(--color-progress-bg)] text-[color:var(--color-progress-fg)]",
  paused:
    "bg-[color:var(--color-paused-bg)] text-[color:var(--color-paused-fg)]",
  delivered:
    "bg-[color:var(--color-delivered-bg)] text-[color:var(--color-delivered-fg)]",
  dnd:
    "bg-[color:var(--color-paused-bg)] text-[color:var(--color-paused-fg)]",
  cancelled:
    "bg-[color:var(--color-cancelled-bg)] text-[color:var(--color-cancelled-fg)]",
};

/** BRS / report tables — map request status to pill tone. */
export function requestStatusReportTone(
  status: string,
): "success" | "warning" | "danger" | "neutral" | "info" {
  if (status === "delivered") return "success";
  if (status === "cancelled") return "danger";
  if (status === "dnd" || status === "paused") return "warning";
  if (status === "pending" || status === "assigned" || status === "in_progress") {
    return "info";
  }
  return "neutral";
}

/** HK floor staff + maintenance always use My Queue. */
export function roleHasQueue(role: Role): boolean {
  return (
    role === "housekeeper" ||
    role === "maintenance" ||
    role === "bellboy" ||
    role === "frontdesk"
  );
}

/** HK manager / supervisor in housekeeping dept share the field queue UI. */
export function isHousekeepingQueueUser(
  u: Pick<User, "role" | "department">,
): boolean {
  return (
    u.department === "housekeeping" &&
    (u.role === "hk_supervisor" || u.role === "manager")
  );
}

/** May open My Queue (/queue) when admin granted the queue feature. */
export function canAccessQueue(
  u: Pick<User, "role" | "permissions">,
): boolean {
  return hasAppFeature(u, "queue");
}

/** Field staff use My Queue as home at `/` instead of Overview. */
export function queueIsPrimaryHome(
  u: Pick<User, "role" | "department" | "permissions">,
): boolean {
  if (!canAccessQueue(u)) return false;
  // When both overview and queue are granted, `/` is Dashboard and `/queue` is My Queue.
  if (hasAppFeature(u, "overview")) return false;
  return roleHasQueue(u.role) || isHousekeepingQueueUser(u);
}

/** Default landing route after sign-in (matches index `Home` / primary dock item). */
export function homePathForUser(
  u: Pick<User, "role" | "department" | "permissions">,
): string {
  if (queueIsPrimaryHome(u)) return "/";
  if (hasAppFeature(u, "overview")) return "/";
  if (hasAppFeature(u, "queue")) return "/queue";
  return "/";
}

/** @deprecated Use {@link canAccessQueue} or {@link queueIsPrimaryHome}. */
export function userHasQueue(
  u: Pick<User, "role" | "department" | "permissions">,
): boolean {
  return queueIsPrimaryHome(u);
}

/** Quick request (+) on the dock — see `users.feature.quick_request` permission. */
export { canUseQuickRequest } from "./appFeatures";

export function canViewReports(u: Pick<User, "role" | "permissions">): boolean {
  return hasAppFeature(u, "reports");
}

export type RequestsListScope = {
  /** Lock to today and hide date picker on /requests. */
  todayOnly: boolean;
  /** Filter API list to this request department. */
  department?: OpsRoutedDept;
};

/** HK / MT / bellboy field staff: today's requests for their dept only. */
export function requestsListScopeForUser(
  user: Pick<User, "role" | "department"> | null | undefined,
): RequestsListScope {
  if (!user) return { todayOnly: false };
  if (user.role === "housekeeper" && user.department === "housekeeping") {
    return { todayOnly: true, department: "housekeeping" };
  }
  if (user.role === "maintenance" && user.department === "maintenance") {
    return { todayOnly: true, department: "maintenance" };
  }
  if (user.role === "bellboy") {
    return { todayOnly: true, department: "bell_boy" };
  }
  return { todayOnly: false };
}

/** Field ops work from My Queue only — no request detail page. */
export function canViewRequestDetail(
  user: Pick<User, "role" | "department"> | undefined,
): boolean {
  if (!user) return false;
  if (
    user.role === "housekeeper" ||
    user.role === "maintenance" ||
    user.role === "bellboy"
  ) {
    return false;
  }
  return true;
}

/** Line under a staff name: job title when set; otherwise translated app role. */
export function userPositionSubtitle(
  u: Pick<User, "role" | "job_title">,
  translate: (i18nKey: string, options?: { defaultValue?: string }) => string,
): string {
  const jt = u.job_title?.trim();
  if (jt) return jobTitleDisplayLabel(jt);
  return translate(`roles.${u.role}`);
}
