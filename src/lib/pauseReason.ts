import type { TFunction } from "i18next";

/** Stored pause detail (EN phrase or snake_case) → `reports.brs.pause_reason.*` */
const PAUSE_REASON_ALIASES: Record<string, string> = {
  "waiting for parts": "waiting_for_parts",
  waiting_for_parts: "waiting_for_parts",
  "waiting for help": "waiting_for_help",
  waiting_for_help: "waiting_for_help",
  "guest interrupted": "guest_interrupted",
  guest_interrupted: "guest_interrupted",
  guest_request: "guest_request",
  stockout: "stockout",
  other: "other",
  paused: "paused",
};

function pauseReasonKey(reason: string): string | null {
  const raw = reason.trim();
  if (!raw) return "other";
  const lower = raw.toLowerCase();
  if (PAUSE_REASON_ALIASES[lower]) return PAUSE_REASON_ALIASES[lower];
  const snake = lower.replace(/\s+/g, "_");
  if (PAUSE_REASON_ALIASES[snake]) return PAUSE_REASON_ALIASES[snake];
  if (/^[a-z][a-z0-9_]*$/.test(snake)) return snake;
  return null;
}

export function pauseReasonLabel(t: TFunction, reason: string): string {
  const raw = (reason || "").trim();
  if (!raw) return t("reports.brs.pause_reason.other");
  const key = pauseReasonKey(raw);
  if (key) return t(`reports.brs.pause_reason.${key}`, raw);
  return raw;
}
