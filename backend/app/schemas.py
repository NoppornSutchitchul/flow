"""Read/write DTOs that the API exposes.

Most lists return enriched objects (joined assignee, items) so the
frontend can render the prototype without N+1 fetching.
"""
from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class UserPermissionsRead(BaseModel):
    overview: bool
    requests: bool
    quick_request: bool
    stock: bool
    reports: bool
    admin_hub: bool
    settings: bool
    queue: bool


class UserRead(BaseModel):
    id: int
    name: str
    username: str
    initials: str
    role: str
    department: Optional[str] = None
    job_title: Optional[str] = None
    work_zone: Optional[str] = None
    color: str
    active: bool
    permissions: UserPermissionsRead


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    token: str
    user: "UserRead"


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class AdminResetPasswordRequest(BaseModel):
    new_password: str


class UserCreate(BaseModel):
    name: str
    username: str
    password: str
    role: str
    department: Optional[str] = None
    job_title: Optional[str] = None
    work_zone: Optional[str] = None
    color: Optional[str] = None
    active: bool = True
    permissions: Optional[dict[str, bool]] = None


class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    department: Optional[str] = None
    job_title: Optional[str] = None
    work_zone: Optional[str] = None
    color: Optional[str] = None
    active: Optional[bool] = None
    permissions: Optional[dict[str, bool]] = None


class JobTitleRead(BaseModel):
    id: int
    label: str
    department: Optional[str] = None
    sort_order: int


class JobTitleCreate(BaseModel):
    label: str
    department: str
    sort_order: int = 0


class JobTitleUpdate(BaseModel):
    label: Optional[str] = None
    department: Optional[str] = None
    sort_order: Optional[int] = None


class OrgDepartmentRead(BaseModel):
    id: int
    code: str
    name: str
    sort_order: int


class OrgDepartmentCreate(BaseModel):
    name: str
    sort_order: int = 0


class OrgDepartmentUpdate(BaseModel):
    name: Optional[str] = None
    sort_order: Optional[int] = None


class BlockerUserRef(BaseModel):
    id: int
    name: str


class JobTitleBlockerRef(BaseModel):
    id: int
    label: str


class ProductBlockerRef(BaseModel):
    id: int
    sku: str
    name: str


class OrgDeleteCheckRead(BaseModel):
    can_delete: bool
    job_titles: List[JobTitleBlockerRef] = []
    users: List[BlockerUserRef] = []
    products: List[ProductBlockerRef] = []
    blocked_by_products: bool = False
    blocked_by_requests: bool = False


class MoveDepartmentJobTitlesBody(BaseModel):
    target_department: str


class HotelLocationRead(BaseModel):
    id: int
    code: str
    label: str
    label_en: Optional[str] = None
    icon_emoji: Optional[str] = None


class HotelLocationCreate(BaseModel):
    label: str
    label_en: str
    icon_emoji: Optional[str] = None
    actor_id: Optional[int] = None


class HotelLocationUpdate(BaseModel):
    label: Optional[str] = None
    label_en: Optional[str] = None
    icon_emoji: Optional[str] = None
    actor_id: Optional[int] = None


class GuestRoomRead(BaseModel):
    id: int
    number: str
    building: int
    floor: int
    type: str
    view: str
    area_sqm: Optional[int] = None
    bed: Optional[str] = None
    connecting_peer: Optional[str] = None
    active: bool


class GuestRoomCreate(BaseModel):
    number: str
    building: int
    floor: int
    type: str = "Superior"
    view: str = "garden"
    area_sqm: Optional[int] = None
    bed: Optional[str] = None
    connecting_peer: Optional[str] = None
    active: bool = True
    actor_id: Optional[int] = None


class GuestRoomUpdate(BaseModel):
    number: Optional[str] = None
    building: Optional[int] = None
    floor: Optional[int] = None
    type: Optional[str] = None
    view: Optional[str] = None
    area_sqm: Optional[int] = None
    bed: Optional[str] = None
    connecting_peer: Optional[str] = None
    active: Optional[bool] = None
    actor_id: Optional[int] = None


class RoomAttributeOptionRead(BaseModel):
    id: int
    kind: str
    code: str
    label_th: str
    label_en: str
    value_num: Optional[int] = None
    sort_order: int


class RoomAttributeOptionCreate(BaseModel):
    kind: str
    code: str
    label_th: Optional[str] = None
    label_en: Optional[str] = None
    value_num: Optional[int] = None
    actor_id: Optional[int] = None


class RoomAttributeOptionUpdate(BaseModel):
    code: Optional[str] = None
    label_th: Optional[str] = None
    label_en: Optional[str] = None
    value_num: Optional[int] = None
    actor_id: Optional[int] = None


class ProductRead(BaseModel):
    id: int
    sku: str
    name: str
    name_en: Optional[str] = None
    department: str
    unit: Optional[str] = None
    unit_en: Optional[str] = None
    on_hand: Optional[int] = None
    reorder_at: Optional[int] = None
    is_service: bool
    active: bool
    icon_emoji: Optional[str] = None
    assignee_job_titles: Optional[list[str]] = None
    status: str  # derived: ok | low | out | service | inactive


class ProductCreate(BaseModel):
    sku: str
    name: str
    name_en: Optional[str] = None
    department: str
    unit: Optional[str] = None
    unit_en: Optional[str] = None
    on_hand: Optional[int] = None
    reorder_at: Optional[int] = None
    is_service: bool = False
    icon_emoji: Optional[str] = None
    assignee_job_titles: Optional[list[str]] = None
    actor_id: Optional[int] = None


class ProductUpdate(BaseModel):
    sku: Optional[str] = None
    name: Optional[str] = None
    name_en: Optional[str] = None
    department: Optional[str] = None
    unit: Optional[str] = None
    unit_en: Optional[str] = None
    on_hand: Optional[int] = None
    reorder_at: Optional[int] = None
    is_service: Optional[bool] = None
    active: Optional[bool] = None
    icon_emoji: Optional[str] = None
    assignee_job_titles: Optional[list[str]] = None
    actor_id: Optional[int] = None


class ProductCategoryRead(BaseModel):
    id: int
    code: str
    department: str
    name: str
    name_en: Optional[str] = None
    icon_emoji: Optional[str] = None
    sort_order: int
    active: bool
    builtin: bool
    product_count: int = 0


class ProductCategoryCreate(BaseModel):
    code: str
    department: str
    name: str
    name_en: Optional[str] = None
    icon_emoji: Optional[str] = None
    sort_order: int = 0
    actor_id: Optional[int] = None


class ProductCategoryUpdate(BaseModel):
    name: Optional[str] = None
    name_en: Optional[str] = None
    icon_emoji: Optional[str] = None
    sort_order: Optional[int] = None
    active: Optional[bool] = None
    actor_id: Optional[int] = None


class StockAdjust(BaseModel):
    delta: int  # may be negative
    reason: Optional[str] = None  # required when delta < 0 — see STOCK_WRITE_OFF_REASONS
    actor_id: Optional[int] = None


class StockCheckLine(BaseModel):
    product_id: int
    qty: int = 1


class StockCheckRequest(BaseModel):
    items: List[StockCheckLine] = []
    exclude_request_id: Optional[int] = None


STOCK_WRITE_OFF_REASONS = frozenset({
    "damaged",
    "overfill",
    "expired",
    "lost",
    "count_adjust",
})


class StockAdjustmentRead(BaseModel):
    id: int
    product_sku: str
    product_name: str
    delta: int
    reason: str
    on_hand_before: int
    on_hand_after: int
    actor_label: Optional[str] = None
    created_at: datetime


class RequestItemRead(BaseModel):
    product_id: int
    sku: str
    name: str
    name_en: Optional[str] = None
    qty: int
    note: Optional[str] = None
    is_service: bool = False
    icon_emoji: Optional[str] = None


class TimelineRead(BaseModel):
    id: int
    kind: str
    title: str
    detail: Optional[str] = None
    actor_id: Optional[int] = None
    actor_label: Optional[str] = None
    created_at: datetime


class NoteRead(BaseModel):
    id: int
    body: str
    author_id: Optional[int] = None
    author_label: Optional[str] = None
    created_at: datetime


class RequestRead(BaseModel):
    id: int
    code: str
    room: str
    department: str
    items_text: str
    status: str
    priority: str
    delivery_method: str
    response_minutes: int
    pause_reason: Optional[str] = None
    dnd_reason: Optional[str] = None
    schedule_mode: str = "immediate"
    scheduled_at: Optional[datetime] = None
    schedule_daily_time: Optional[str] = None
    assignee: Optional[UserRead] = None
    created_by: Optional[UserRead] = None
    created_at: datetime
    updated_at: datetime
    delivered_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    auto_cancel_at: Optional[datetime] = None
    items: List[RequestItemRead] = []
    age_seconds: int  # convenient for UI
    awaiting_staff: bool = False


class RequestDetail(RequestRead):
    timeline: List[TimelineRead] = []
    notes: List[NoteRead] = []


class RequestItemLine(BaseModel):
    product_id: int
    qty: int = 1
    note: Optional[str] = None


class RequestCreate(BaseModel):
    room: str
    # Preferred input: structured lines with qty per item.
    items: List[RequestItemLine] = []
    # Backwards-compat / convenience: bare product ids (qty=1 each).
    product_ids: List[int] = []
    # Free-text fallback when neither items nor product_ids are provided.
    custom_items: Optional[str] = None
    priority: str = "normal"
    delivery_method: str = "ring_bell"
    created_by_id: Optional[int] = None
    auto_assign: bool = True
    # When auto_assign is True, optionally pin the assignee (must belong to
    # the request department). Omit to fall back to lowest-workload routing.
    preferred_assignee_id: Optional[int] = None
    schedule_mode: str = "immediate"
    scheduled_at: Optional[datetime] = None
    schedule_daily_time: Optional[str] = None


class RequestAction(BaseModel):
    actor_id: Optional[int] = None
    reason: Optional[str] = None


class RequestReassign(BaseModel):
    assignee_id: int
    actor_id: Optional[int] = None


class RequestScheduleUpdate(BaseModel):
    schedule_mode: str
    scheduled_at: Optional[datetime] = None
    schedule_daily_time: Optional[str] = None
    actor_id: Optional[int] = None


class RequestHoldUpdate(BaseModel):
    room: Optional[str] = None
    delivery_method: Optional[str] = None
    items: Optional[List[RequestItemLine]] = None
    schedule_mode: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    schedule_daily_time: Optional[str] = None
    actor_id: Optional[int] = None


class NoteCreate(BaseModel):
    body: str
    author_id: Optional[int] = None


class DashboardStats(BaseModel):
    today_count: int
    in_progress: int
    open_overdue: int
    low_stock: int
    delivered_today: int
    cancelled_today: int


class ReportSummary(BaseModel):
    avg_delivery_minutes: float
    delivered_today: int
    overdue_today: int
    requests_by_dept: dict[str, int]
    requests_by_status: dict[str, int]
    top_items: list[dict]  # [{name, qty}]
    daily_volume: list[dict]  # [{date, count}]
    stock_adjustments: list[StockAdjustmentRead] = []


class ReportPresetMeta(BaseModel):
    slug: str
    category: str
    title_key: str
    code: str


class ReportPresetData(BaseModel):
    slug: str
    data: dict


class CustomReportRead(BaseModel):
    id: int
    owner_user_id: int
    title: str
    description: Optional[str] = None
    layout_json: str
    shared_with_all: bool = False
    individual_share_count: int = 0
    created_at: datetime
    updated_at: datetime
    owner_name: Optional[str] = None
    shared_permission: Optional[str] = None


class CustomReportShareUserRead(BaseModel):
    user_id: int
    name: str
    permission: str


class CustomReportSharesRead(BaseModel):
    shared_with_all: bool
    users: list[CustomReportShareUserRead]


class CustomReportSharingUpdate(BaseModel):
    shared_with_all: Optional[bool] = None


class CustomReportCreate(BaseModel):
    title: str
    description: Optional[str] = None
    layout_json: str = "{}"


class CustomReportUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    layout_json: Optional[str] = None


class CustomReportShareCreate(BaseModel):
    user_id: int
    permission: str = "view"


class TimeAlertSettings(BaseModel):
    warn: int
    danger: int
    breach: int


class TimeAlertSettingsUpdate(TimeAlertSettings):
    actor_id: Optional[int] = None


class AssignableStaffDeptRead(BaseModel):
    available: bool
    user_ids: list[int]


class AssignableStaffRead(BaseModel):
    departments: dict[str, AssignableStaffDeptRead]
