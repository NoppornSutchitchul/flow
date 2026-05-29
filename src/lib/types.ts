export type Role =
  | "admin"
  | "manager"
  | "hk_supervisor"
  | "frontdesk"
  | "bellboy"
  | "housekeeper"
  | "maintenance";

/** Department code (seeded defaults + admin-created). */
export type Department = string;

export interface OrgDepartment {
  id: number;
  code: string;
  /** Display name (English only). */
  name: string;
  sort_order: number;
}

export interface BlockerUserRef {
  id: number;
  name: string;
}

export interface JobTitleBlockerRef {
  id: number;
  label: string;
}

export interface ProductBlockerRef {
  id: number;
  sku: string;
  name: string;
}

export interface OrgDeleteCheck {
  can_delete: boolean;
  job_titles?: JobTitleBlockerRef[];
  users?: BlockerUserRef[];
  products?: ProductBlockerRef[];
  blocked_by_products?: boolean;
  blocked_by_requests?: boolean;
}

export type RequestStatus =
  | "pending"
  | "assigned"
  | "in_progress"
  | "paused"
  | "delivered"
  | "dnd"
  | "cancelled";

export type Priority = "normal" | "rush";

export type DeliveryMethod = "ring_bell" | "leave_at_door" | "front_desk";

export type AppFeatureKey =
  | "overview"
  | "requests"
  | "quick_request"
  | "stock"
  | "reports"
  | "admin_hub"
  | "settings"
  | "queue";

/** @deprecated Use AppFeatureKey — kept for gradual migration in types only. */
export type PermissionKey = AppFeatureKey;

export interface UserPermissions {
  overview: boolean;
  requests: boolean;
  quick_request: boolean;
  stock: boolean;
  reports: boolean;
  admin_hub: boolean;
  settings: boolean;
  queue: boolean;
}

export interface User {
  id: number;
  name: string;
  username: string;
  initials: string;
  role: Role;
  department: Department | null;
  job_title?: string | null;
  work_zone?: string | null;
  color: string;
  active: boolean;
  permissions: UserPermissions;
}

/** Admin-defined preset for User.job_title (scoped to one department). */
export interface JobTitle {
  id: number;
  label: string;
  department: Department | null;
  sort_order: number;
}

export interface ProductCategory {
  id: number;
  code: string;
  department: string;
  name: string;
  name_en: string | null;
  icon_emoji: string | null;
  sort_order: number;
  active: boolean;
  builtin: boolean;
  product_count: number;
}

export interface HotelLocation {
  id: number;
  code: string;
  label: string;
  label_en: string | null;
  icon_emoji: string | null;
}

export type RoomOptionKind =
  | "building"
  | "floor"
  | "type"
  | "view"
  | "size"
  | "bed";

export interface RoomAttributeOption {
  id: number;
  kind: RoomOptionKind;
  code: string;
  label_th: string;
  label_en: string;
  label_my?: string | null;
  label_lo?: string | null;
  value_num: number | null;
  sort_order: number;
}

export interface GuestRoom {
  id: number;
  number: string;
  building: number;
  floor: number;
  type: string;
  view: string;
  area_sqm?: number | null;
  bed?: string | null;
  connecting_peer?: string | null;
  active: boolean;
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  name_en: string | null;
  department: Department;
  unit: string | null;
  unit_en: string | null;
  on_hand: number | null;
  reorder_at: number | null;
  is_service: boolean;
  active: boolean;
  icon_emoji: string | null;
  /** null/undefined = any job title in the product department */
  assignee_job_titles?: string[] | null;
  status: "ok" | "low" | "out" | "service" | "inactive";
}

export interface RequestItem {
  product_id: number;
  sku: string;
  name: string;
  name_en: string | null;
  qty: number;
  note?: string | null;
  is_service?: boolean;
  icon_emoji?: string | null;
}

export interface TimelineEvent {
  id: number;
  kind: string;
  title: string;
  detail: string | null;
  actor_id: number | null;
  actor_label: string | null;
  created_at: string;
}

export interface Note {
  id: number;
  body: string;
  author_id: number | null;
  author_label: string | null;
  created_at: string;
}

export interface RequestRead {
  id: number;
  code: string;
  room: string;
  department: Department;
  items_text: string;
  status: RequestStatus;
  priority: Priority;
  delivery_method: DeliveryMethod;
  /** Target window (minutes) to complete the request. */
  response_minutes: number;
  pause_reason: string | null;
  dnd_reason: string | null;
  schedule_mode?: "immediate" | "delay" | "at_time" | "daily";
  scheduled_at?: string | null;
  schedule_daily_time?: string | null;
  assignee: User | null;
  created_by: User | null;
  created_at: string;
  updated_at: string;
  delivered_at: string | null;
  cancelled_at: string | null;
  auto_cancel_at?: string | null;
  items: RequestItem[];
  age_seconds: number;
  /** Waiting for an online assignee after release / failed auto-assign. */
  awaiting_staff?: boolean;
}

export interface RequestDetail extends RequestRead {
  timeline: TimelineEvent[];
  notes: Note[];
}

export interface DashboardStats {
  today_count: number;
  in_progress: number;
  /** Open (active) requests past their response-time target. */
  open_overdue: number;
  low_stock: number;
  delivered_today: number;
  cancelled_today: number;
}

export interface ReportSummary {
  avg_delivery_minutes: number;
  delivered_today: number;
  /** Requests today that exceeded their `response_minutes` budget. */
  overdue_today: number;
  requests_by_dept: Record<string, number>;
  requests_by_status: Record<string, number>;
  top_items: { name: string; qty: number }[];
  daily_volume: { date: string; count: number }[];
  stock_adjustments: StockAdjustmentRead[];
}

export interface ReportPresetMeta {
  slug: string;
  category: "operations" | "staff" | "inventory" | "audit" | string;
  title_key: string;
  code: string;
}

export interface ReportPresetData {
  slug: string;
  data: Record<string, unknown>;
}

export interface CustomReportRead {
  id: number;
  owner_user_id: number;
  title: string;
  description?: string | null;
  layout_json: string;
  shared_with_all?: boolean;
  individual_share_count?: number;
  created_at: string;
  updated_at: string;
  owner_name?: string | null;
  shared_permission?: string | null;
}

export interface CustomReportShareUserRead {
  user_id: number;
  name: string;
  permission: string;
}

export interface CustomReportSharesRead {
  shared_with_all: boolean;
  users: CustomReportShareUserRead[];
}

export type StockWriteOffReason =
  | "damaged"
  | "overfill"
  | "expired"
  | "lost"
  | "count_adjust";

export type StockAdjustReason = StockWriteOffReason | "restock";

export interface StockAdjustmentRead {
  id: number;
  product_sku: string;
  product_name: string;
  delta: number;
  reason: StockAdjustReason;
  on_hand_before: number;
  on_hand_after: number;
  actor_label?: string | null;
  created_at: string;
}

export interface TimeAlertSettings {
  warn: number;
  danger: number;
  breach: number;
}
