import type { TFunction } from "i18next";

import type { TimelineEvent } from "./types";
import { staffDisplayName } from "./assignees";
import {
  formatScheduleClock,
  formatUtcClockHhmmLocal,
} from "./requestSchedule";

const DETAIL_KEYS: Record<string, string> = {
  "Mode: auto-assign": "requests.timeline_events.detail_mode_auto",
  "Mode: manual": "requests.timeline_events.detail_mode_manual",
  "Auto-assign • manual pick": "requests.timeline_events.detail_auto_manual_pick",
  "Requested assignee": "requests.timeline_events.detail_requested_assignee",
  "Lowest workload": "requests.timeline_events.detail_lowest_workload",
  "Nearest available staff": "requests.timeline_events.detail_nearest_available",
  "Escalation: Housekeeping Supervisor (1/3 deadline)":
    "requests.timeline_events.detail_escalation_supervisor",
  "Escalation: Housekeeping Manager (2/3 deadline)":
    "requests.timeline_events.detail_escalation_manager",
  "Picked up items": "requests.timeline_events.detail_picked_up",
  "Handed over at door": "requests.timeline_events.detail_handed_over",
  "Guest met at door": "requests.timeline_events.detail_guest_met_at_door",
  "Response-time limit reached — no delivery after guest unreachable":
    "requests.timeline_events.detail_auto_cancel_unreachable",
  "Past response-time limit when marking guest unreachable":
    "requests.timeline_events.detail_auto_cancel_deadline",
  "DND sign on door": "requests.timeline_events.detail_dnd_sign",
  Paused: "requests.timeline_events.detail_paused",
  "Scheduled delivery": "requests.timeline_events.detail_scheduled_delivery",
  room: "schedule.updated_room",
  delivery: "schedule.updated_delivery",
  items: "schedule.updated_items",
};

const ASSIGN_TITLE =
  /^(?:Auto-assigned|Assigned|Reassigned) to (.+)$/i;

const OFFLINE_REASSIGN_TITLES = new Set([
  "Assignee offline",
  "Assignee went offline",
]);

const OFFLINE_RELEASED_DETAIL =
  /^Released from (.+) — re-assigning$/;

function translateCancelReason(detail: string, t: TFunction): string {
  const body = detail.slice("cancel_reason:".length);
  if (body.startsWith("other:")) {
    const text = body.slice("other:".length).trim();
    return text
      ? t("requests.cancel_reason.other_detail", { text })
      : t("requests.cancel_reason.other");
  }
  return t(`requests.cancel_reason.${body}`);
}

function translateDetailSegment(
  segment: string,
  t: TFunction,
  locale?: string,
): string {
  const detail = segment.trim();
  if (!detail) return "";

  const escalationMatch = detail.match(/^escalation:(supervisor|manager):(\d+)$/);
  if (escalationMatch) {
    const [, role, minutes] = escalationMatch;
    return t(`requests.timeline_events.detail_escalation_${role}_minutes`, {
      minutes,
    });
  }

  if (detail.startsWith("cancel_reason:")) {
    return translateCancelReason(detail, t);
  }

  if (detail.startsWith("offline_released:")) {
    const name = staffDisplayName(detail.slice("offline_released:".length).trim());
    return t("requests.timeline_events.detail_offline_released", { name });
  }

  const offlineLegacy = detail.match(OFFLINE_RELEASED_DETAIL);
  if (offlineLegacy?.[1]) {
    return t("requests.timeline_events.detail_offline_released", {
      name: staffDisplayName(offlineLegacy[1]),
    });
  }

  if (detail.startsWith("schedule_at:")) {
    const iso = detail.slice("schedule_at:".length).trim();
    return t("requests.timeline_events.detail_scheduled_at", {
      time: formatScheduleClock(iso, locale),
    });
  }

  if (detail.startsWith("daily_at:")) {
    const time = detail.slice("daily_at:".length).trim();
    return t("requests.timeline_events.detail_daily_at", { time });
  }

  const key = DETAIL_KEYS[detail];
  if (key) return t(key);

  const scheduledLegacy = detail.match(/^Scheduled (\d{2}:\d{2}) UTC$/);
  if (scheduledLegacy) {
    return t("requests.timeline_events.detail_scheduled_at", {
      time: formatUtcClockHhmmLocal(scheduledLegacy[1], locale),
    });
  }

  const dailyLegacy = detail.match(/^Daily at (\S+)$/);
  if (dailyLegacy) {
    return t("requests.timeline_events.detail_daily_at", {
      time: dailyLegacy[1],
    });
  }

  const deadlineMatch = detail.match(
    /^Auto-cancel at response-time deadline \(UTC (.+)\)$/,
  );
  if (deadlineMatch) {
    return t("requests.timeline_events.detail_auto_cancel_at", {
      time: formatUtcClockHhmmLocal(deadlineMatch[1], locale),
    });
  }

  return detail;
}

function translateDetail(
  detail: string | null,
  t: TFunction,
  locale?: string,
): string | null {
  if (!detail?.trim()) return null;

  if (detail.includes(" · ")) {
    const parts = detail
      .split(" · ")
      .map((seg) => translateDetailSegment(seg, t, locale))
      .filter(Boolean);
    return parts.length > 0 ? parts.join(" · ") : null;
  }

  return translateDetailSegment(detail, t, locale);
}

function assigneeFromTitle(title: string): string | null {
  const m = title.match(ASSIGN_TITLE);
  return m?.[1] ? staffDisplayName(m[1]) : null;
}

export function formatTimelineEvent(
  ev: TimelineEvent,
  t: TFunction,
  locale?: string,
): { title: string; detail: string | null; actorLabel: string | null } {
  const actorLabel =
    ev.actor_label === "System"
      ? t("requests.timeline_events.actor_system")
      : ev.actor_label;

  const detail = translateDetail(ev.detail, t, locale);

  let title: string;
  switch (ev.kind) {
    case "created":
      title = t("requests.timeline_events.created");
      break;
    case "auto_assigned": {
      const name = assigneeFromTitle(ev.title) ?? ev.title;
      title = /^Auto-assigned/i.test(ev.title)
        ? t("requests.timeline_events.auto_assigned", { name })
        : t("requests.timeline_events.assigned", { name });
      break;
    }
    case "reassigned": {
      if (OFFLINE_REASSIGN_TITLES.has(ev.title)) {
        title = t("requests.timeline_events.assignee_offline_released");
      } else {
        const name = assigneeFromTitle(ev.title) ?? ev.title;
        title = t("requests.timeline_events.reassigned", { name });
      }
      break;
    }
    case "accepted":
      title = t("requests.timeline_events.accepted");
      break;
    case "started":
      title = t("requests.timeline_events.started");
      break;
    case "resumed":
      title = t("requests.timeline_events.resumed");
      break;
    case "paused":
      title = t("requests.timeline_events.paused");
      break;
    case "delivered":
      title = t("requests.timeline_events.delivered");
      break;
    case "dnd_reported":
      title = t("requests.timeline_events.dnd_reported");
      break;
    case "dnd_cleared":
      title = t("requests.timeline_events.dnd_cleared");
      break;
    case "dnd_defer":
      title = t("requests.timeline_events.dnd_defer");
      break;
    case "rushed":
      title = t("requests.timeline_events.rushed");
      break;
    case "unrushed":
      title = t("requests.timeline_events.unrushed");
      break;
    case "cancelled":
      title =
        ev.title === "Auto-cancelled (overdue)"
          ? t("requests.timeline_events.auto_cancelled")
          : t("requests.timeline_events.cancelled");
      break;
    case "note":
      title =
        ev.title === "Schedule updated"
          ? t("schedule.updated_title")
          : ev.title === "Request updated"
            ? t("schedule.request_updated_title")
            : ev.title;
      break;
    default:
      title = ev.title;
  }

  return { title, detail, actorLabel };
}
