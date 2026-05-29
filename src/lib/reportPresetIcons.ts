import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  BarChart3,
  Bot,
  CalendarRange,
  CheckCircle2,
  DoorOpen,
  ClipboardList,
  GitBranch,
  History,
  LineChart,
  Package,
  PauseCircle,
  PhoneOff,
  Timer,
  UserCheck,
  Users,
  XCircle,
} from "lucide-react";

const PRESET_ICONS: Record<string, LucideIcon> = {
  "sla-compliance": CheckCircle2,
  "response-time-analysis": Timer,
  "request-volume-forecast": LineChart,
  "staff-performance-scorecard": UserCheck,
  "workload-distribution": Users,
  "auto-assignment-effectiveness": Bot,
  "stock-consumption-analysis": Package,
  "low-stock-stockout": AlertTriangle,
  "stock-movement-audit": ClipboardList,
  "request-lifecycle-activity": GitBranch,
  "timeline-activity-log": History,
  "cancellation-analysis": XCircle,
  "pause-delay-analysis": PauseCircle,
  "dnd-incident-report": PhoneOff,
  "month-over-month-comparison": CalendarRange,
  "service-only-room-requests": DoorOpen,
  "stock-only-room-requests": Package,
};

export function presetIconForSlug(slug: string): LucideIcon {
  return PRESET_ICONS[slug] ?? BarChart3;
}
