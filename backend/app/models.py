"""Persistent models for Flow.

The schema is intentionally lean — it captures everything the prototype
needs (requests, products, users, timeline) without over-modeling the
business. SQLModel is used so each model doubles as the Pydantic schema.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


# ---------- Users ----------

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    """Login id — defaults to display name (English)."""
    username: str = Field(index=True, unique=True)
    password_hash: str = ""
    initials: str
    role: str  # admin | manager | hk_supervisor | frontdesk | bellboy | housekeeper | maintenance
    department: Optional[str] = None  # housekeeping | maintenance | front_office | bell_boy | …
    # Job titles such as Guest Service Agent vs operational role strings above.
    job_title: Optional[str] = None
    # Operational zone label, e.g. "ตึก 1 · ชั้น 3" for housekeeping routing.
    work_zone: Optional[str] = None
    color: str = "#cbb6d3"  # avatar tint
    active: bool = True
    # JSON map of permission overrides; merged with role defaults (see services.effective_permissions).
    permissions_json: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class AuthSession(SQLModel, table=True):
    token: str = Field(primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    expires_at: datetime


# ---------- Job titles (admin-managed presets for user job_title field) ----------

class OrgDepartment(SQLModel, table=True):
    """Staff / ops department codes (housekeeping, front office, custom)."""
    id: Optional[int] = Field(default=None, primary_key=True)
    code: str = Field(index=True, unique=True)
    name: str
    name_en: Optional[str] = None
    name_my: Optional[str] = None
    name_lo: Optional[str] = None
    sort_order: int = 0


class JobTitle(SQLModel, table=True):
    """Preset labels scoped to one OrgDepartment.code (required for user forms)."""
    id: Optional[int] = Field(default=None, primary_key=True)
    label: str = Field(index=True, unique=True)
    department: Optional[str] = None
    sort_order: int = 0


class HotelLocation(SQLModel, table=True):
    """Hotel premises (non guest-room) selectable in quick request."""
    id: Optional[int] = Field(default=None, primary_key=True)
    code: str = Field(index=True, unique=True)  # internal id for requests / i18n keys
    label: str
    label_en: Optional[str] = None
    label_my: Optional[str] = None
    label_lo: Optional[str] = None
    icon_emoji: Optional[str] = None


class GuestRoom(SQLModel, table=True):
    """Guest room inventory (selectable in quick request)."""
    id: Optional[int] = Field(default=None, primary_key=True)
    number: str = Field(index=True, unique=True)
    building: int
    floor: int
    room_type: str = "Superior"  # Superior | Deluxe | Suite
    view: str = "garden"  # sea | garden | pool
    area_sqm: Optional[int] = None
    bed: Optional[str] = None  # king | twin
    connecting_peer: Optional[str] = None
    active: bool = True


class RoomAttributeOption(SQLModel, table=True):
    """Admin-defined choices for guest room fields."""
    id: Optional[int] = Field(default=None, primary_key=True)
    kind: str = Field(index=True)
    code: str = Field(index=True)
    label_th: str = ""
    label_en: str = ""
    label_my: Optional[str] = None
    label_lo: Optional[str] = None
    value_num: Optional[int] = None
    sort_order: int = 0


# ---------- Products / Stock ----------

class ProductCategory(SQLModel, table=True):
    """Code categories that form the middle segment of product SKUs.

    Each category has a fixed 3-4 letter `code` (e.g. BED, BTH, GST) that is
    embedded in product SKUs like HK-BED-005. The code is immutable after
    creation — renaming it would orphan existing SKUs. Categories belong to one
    catalog department (housekeeping, front_office, …) so pickers can filter
    by operational team. Display name, emoji, and ordering can be edited by
    admins. Deletion is blocked when any product is still using the code.
    """
    id: Optional[int] = Field(default=None, primary_key=True)
    code: str = Field(index=True, unique=True)
    department: str = Field(index=True, default="housekeeping")
    name: str
    name_en: Optional[str] = None
    name_my: Optional[str] = None
    name_lo: Optional[str] = None
    icon_emoji: Optional[str] = None
    sort_order: int = 0
    active: bool = True
    builtin: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Product(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    sku: str = Field(index=True, unique=True)
    name: str
    name_en: Optional[str] = None
    name_my: Optional[str] = None
    name_lo: Optional[str] = None
    department: str  # housekeeping | maintenance | front_office | bell_boy
    unit: Optional[str] = None  # Thai label, e.g. ขวด, คู่
    unit_en: Optional[str] = None
    unit_my: Optional[str] = None
    unit_lo: Optional[str] = None
    on_hand: Optional[int] = None  # null for services
    reorder_at: Optional[int] = None
    is_service: bool = False
    active: bool = True
    icon_emoji: Optional[str] = None
    # JSON list of JobTitle.label — empty/null = any title in department may take the job
    assignee_job_titles_json: Optional[str] = None


class StockAdjustment(SQLModel, table=True):
    """Audit log for manual stock changes (restock or write-off)."""
    id: Optional[int] = Field(default=None, primary_key=True)
    product_id: int = Field(foreign_key="product.id", index=True)
    product_sku: str
    product_name: str
    delta: int
    reason: str  # restock | damaged | overfill | expired | lost | count_adjust
    on_hand_before: int
    on_hand_after: int
    actor_id: Optional[int] = Field(default=None, foreign_key="user.id")
    actor_label: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


# ---------- Requests ----------

class Request(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    code: str = Field(index=True, unique=True)  # e.g. REQ-0514-047
    room: str
    department: str
    items_text: str  # human-readable summary (e.g. "Bath towel x2, Slipper x1")
    status: str = "pending"  # pending | assigned | in_progress | paused | delivered | dnd | cancelled
    priority: str = "normal"  # normal | rush
    delivery_method: str = "ring_bell"  # ring_bell | leave_at_door | front_desk
    response_minutes: int = 15
    pause_reason: Optional[str] = None
    dnd_reason: Optional[str] = None
    schedule_mode: str = "immediate"
    scheduled_at: Optional[datetime] = None
    schedule_daily_time: Optional[str] = None
    pending_auto_assign: bool = False
    preferred_assignee_id: Optional[int] = Field(default=None, foreign_key="user.id")
    assignee_id: Optional[int] = Field(default=None, foreign_key="user.id")
    # When the current assignee was set — escalation uses this, not created_at.
    assignee_since: Optional[datetime] = None
    created_by_id: Optional[int] = Field(default=None, foreign_key="user.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    delivered_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    # When set, request is cancelled automatically once this UTC time passes (lazy check on reads).
    auto_cancel_at: Optional[datetime] = None


class RequestItem(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    request_id: int = Field(foreign_key="request.id", index=True)
    product_id: int = Field(foreign_key="product.id")
    qty: int = 1
    note: Optional[str] = Field(default=None)


class TimelineEvent(SQLModel, table=True):
    """Single timeline entry on a request.

    `kind` drives the icon and color on the frontend.
    """
    id: Optional[int] = Field(default=None, primary_key=True)
    request_id: int = Field(foreign_key="request.id", index=True)
    kind: str  # created | auto_assigned | accepted | started | paused | resumed | delivered | dnd_reported | dnd_cleared | dnd_defer | rushed | cancelled | note
    title: str
    detail: Optional[str] = None
    actor_id: Optional[int] = Field(default=None, foreign_key="user.id")
    actor_label: Optional[str] = None  # cached display (e.g. "System")
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Note(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    request_id: int = Field(foreign_key="request.id", index=True)
    author_id: Optional[int] = Field(default=None, foreign_key="user.id")
    body: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


class AppSetting(SQLModel, table=True):
    """Key-value store for hotel-wide config (time thresholds, etc.)."""
    key: str = Field(primary_key=True)
    value: str


# ---------- Reports / audit ----------


class ActivityLog(SQLModel, table=True):
    """System-wide audit trail for reports (login, CRUD, stock, requests)."""
    id: Optional[int] = Field(default=None, primary_key=True)
    actor_id: Optional[int] = Field(default=None, foreign_key="user.id", index=True)
    actor_label: Optional[str] = None
    action: str = Field(index=True)
    entity_type: Optional[str] = None
    entity_id: Optional[int] = None
    summary: str
    metadata_json: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)


class CustomReport(SQLModel, table=True):
    """Per-user saved report layout (builder / snapshot)."""
    id: Optional[int] = Field(default=None, primary_key=True)
    owner_user_id: int = Field(foreign_key="user.id", index=True)
    title: str
    description: Optional[str] = None
    layout_json: str = "{}"
    shared_with_all: bool = Field(default=False, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class CustomReportShare(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    report_id: int = Field(foreign_key="customreport.id", index=True)
    shared_with_user_id: int = Field(foreign_key="user.id", index=True)
    shared_by_user_id: int = Field(foreign_key="user.id")
    permission: str = "view"  # view | duplicate
    shared_at: datetime = Field(default_factory=datetime.utcnow)
