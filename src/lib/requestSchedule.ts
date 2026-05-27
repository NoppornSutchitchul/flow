import { parseApiUtcMs } from "./format";
import type { RequestRead } from "./types";

export type ScheduleMode = "immediate" | "delay" | "at_time";

export type SchedulePickerState = {
  mode: ScheduleMode;
  delayMinutes: number;
  /** Local calendar date YYYY-MM-DD for at_time mode. */
  atDate: string;
  atTime: string;
};

const DELAY_SNAP_MINUTES = [5, 10, 15, 30, 60] as const;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Hotel-local calendar date as YYYY-MM-DD. */
export function localDateYmd(base = new Date()): string {
  const local = new Date(base.getTime() - base.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

/** Map API request schedule fields to quick-request picker state. */
export function readSchedulePickerState(
  r: Pick<RequestRead, "schedule_mode" | "scheduled_at">,
): SchedulePickerState {
  const modeRaw = r.schedule_mode ?? "immediate";
  if (modeRaw === "immediate" || !r.scheduled_at) {
    return { mode: "immediate", delayMinutes: 30, atDate: localDateYmd(), atTime: "10:00" };
  }

  if (modeRaw === "at_time") {
    const ms = parseApiUtcMs(r.scheduled_at);
    const d = new Date(ms);
    return {
      mode: "at_time",
      delayMinutes: 30,
      atDate: localDateYmd(d),
      atTime: `${pad2(d.getHours())}:${pad2(d.getMinutes())}`,
    };
  }

  const diffMin = Math.max(
    1,
    Math.round((parseApiUtcMs(r.scheduled_at) - Date.now()) / 60_000),
  );
  const snap =
    DELAY_SNAP_MINUTES.find((m) => m >= diffMin) ??
    DELAY_SNAP_MINUTES[DELAY_SNAP_MINUTES.length - 1];
  return { mode: "delay", delayMinutes: snap, atDate: localDateYmd(), atTime: "10:00" };
}

export function schedulePickerFieldsEqual(
  a: SchedulePickerState,
  b: SchedulePickerState,
): boolean {
  return (
    a.mode === b.mode
    && a.delayMinutes === b.delayMinutes
    && a.atDate === b.atDate
    && a.atTime === b.atTime
  );
}

export type ScheduleApiFields = {
  schedule_mode: ScheduleMode | "daily";
  scheduled_at?: string;
  schedule_daily_time?: string;
};

/** Local date + clock time (no rollover). */
export function localDateTimeAt(dateYmd: string, hhmm: string): Date {
  const [yRaw, moRaw, dRaw] = dateYmd.split("-");
  const [hRaw, mRaw] = hhmm.split(":");
  const y = Number(yRaw);
  const mo = Number(moRaw);
  const d = Number(dRaw);
  const h = Number(hRaw);
  const m = Number(mRaw);
  const dt = new Date();
  dt.setSeconds(0, 0);
  dt.setMilliseconds(0);
  if (Number.isFinite(y) && Number.isFinite(mo) && Number.isFinite(d)) {
    dt.setFullYear(y, mo - 1, d);
  }
  dt.setHours(Number.isFinite(h) ? h : 0, Number.isFinite(m) ? m : 0, 0, 0);
  return dt;
}

export function buildScheduleApiFields(
  mode: ScheduleMode,
  delayMinutes: number,
  atDate: string,
  atTime: string,
): ScheduleApiFields {
  if (mode === "immediate") {
    return { schedule_mode: "immediate" };
  }
  if (mode === "delay") {
    return {
      schedule_mode: "delay",
      scheduled_at: new Date(Date.now() + delayMinutes * 60_000).toISOString(),
    };
  }
  return {
    schedule_mode: "at_time",
    scheduled_at: localDateTimeAt(atDate || localDateYmd(), atTime).toISOString(),
  };
}

export function isScheduledRequest(
  r: Pick<RequestRead, "schedule_mode">,
): boolean {
  const mode = r.schedule_mode ?? "immediate";
  return mode !== "immediate";
}

export function isBeforeScheduledTime(
  r: Pick<RequestRead, "scheduled_at" | "schedule_mode">,
  nowMs = Date.now(),
): boolean {
  if (!isScheduledRequest(r) || !r.scheduled_at) return false;
  const t = parseApiUtcMs(r.scheduled_at);
  return Number.isFinite(t) && t > nowMs;
}

/** When a scheduled job becomes live, sort by delivery time — not original submit time. */
export function requestDashboardSortMs(
  r: Pick<RequestRead, "created_at" | "scheduled_at" | "schedule_mode">,
  nowMs = Date.now(),
): number {
  if (
    isScheduledRequest(r) &&
    r.scheduled_at &&
    !isBeforeScheduledTime(r, nowMs)
  ) {
    const scheduledMs = parseApiUtcMs(r.scheduled_at);
    if (Number.isFinite(scheduledMs)) return scheduledMs;
  }
  return parseApiUtcMs(r.created_at);
}

/** SLA / urgency timer starts when the guest's delivery window begins. */
export function requestSlaAnchorMs(r: RequestRead): number {
  const scheduledMs = r.scheduled_at ? parseApiUtcMs(r.scheduled_at) : NaN;
  if (Number.isFinite(scheduledMs) && Date.now() >= scheduledMs) {
    return scheduledMs;
  }
  return parseApiUtcMs(r.created_at);
}

export function formatScheduleClock(iso: string, locale?: string): string {
  const ms = parseApiUtcMs(iso);
  if (!Number.isFinite(ms)) return "—";
  return new Date(ms).toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** Legacy timeline detail stored UTC clock only — show in local time. */
export function formatUtcClockHhmmLocal(hhmm: string, locale?: string): string {
  const [hRaw, mRaw] = hhmm.split(":");
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
  return new Date(Date.UTC(2000, 0, 1, h, m)).toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatScheduleDuration(
  seconds: number,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  const total = Math.max(0, Math.ceil(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0 && m > 0) {
    return t("schedule.duration_h_m", { h, m });
  }
  if (h > 0) {
    return t("schedule.duration_h", { h });
  }
  return t("schedule.duration_m", { m: Math.max(1, m) });
}

type ScheduleLabelOpts = {
  t: (key: string, opts?: Record<string, unknown>) => string;
  nowMs?: number;
  locale?: string;
};

export function scheduleSummaryLabel(
  r: Pick<
    RequestRead,
    "schedule_mode" | "scheduled_at" | "schedule_daily_time"
  >,
  { t, nowMs = Date.now(), locale }: ScheduleLabelOpts,
): string | null {
  if (!isScheduledRequest(r)) return null;

  if (r.schedule_mode === "daily" && r.schedule_daily_time) {
    return t("schedule.badge_daily", { time: r.schedule_daily_time });
  }

  if (!r.scheduled_at) return null;
  const targetMs = parseApiUtcMs(r.scheduled_at);
  if (!Number.isFinite(targetMs)) return null;

  const diffSec = (targetMs - nowMs) / 1000;
  if (diffSec > 60) {
    return t("schedule.badge_in", {
      duration: formatScheduleDuration(diffSec, t),
    });
  }

  return t("schedule.badge_at", {
    time: formatScheduleClock(r.scheduled_at, locale),
  });
}
