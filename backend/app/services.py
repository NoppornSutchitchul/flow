"""Business helpers shared by routes."""
from __future__ import annotations

import json
import re
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Iterable, Optional

from fastapi import HTTPException
from sqlalchemy import and_, or_
from sqlmodel import Session, func, select

from .models import (
    GuestRoom, HotelLocation, Note, Product, Request, RequestItem, TimelineEvent, User,
    AppSetting,
)
from .schemas import (
    NoteRead, ProductRead, RequestDetail, RequestItemRead, RequestRead,
    TimelineRead, UserPermissionsRead, UserRead,
)

FEATURE_KEYS = (
    "overview",
    "requests",
    "quick_request",
    "stock",
    "reports",
    "admin_hub",
    "settings",
    "queue",
)

# Legacy keys stored before feature-based permissions (merged on read).
_LEGACY_PERM_MAP = {
    "report_stock": "stock",
    "manage_catalog": "stock",
    "view_reports": "reports",
    "manage_users": "admin_hub",
}


def to_naive_utc(value: datetime | None) -> datetime | None:
    """Normalize API datetimes (often TZ-aware ISO) to naive UTC for storage/compare."""
    if value is None:
        return None
    if value.tzinfo is not None:
        return value.astimezone(timezone.utc).replace(tzinfo=None)
    return value


def _role_permission_template(**enabled: bool) -> dict[str, bool]:
    base = {k: False for k in FEATURE_KEYS}
    for key, value in enabled.items():
        if key in base:
            base[key] = bool(value)
    return base


# Demo-friendly defaults so fresh clones / reviewers see meaningful dock access per role.
_ROLE_DEFAULTS: dict[str, dict[str, bool]] = {
    "manager": _role_permission_template(
        overview=True, requests=True, stock=True, reports=True,
    ),
    "hk_supervisor": _role_permission_template(
        overview=True, requests=True, quick_request=True, stock=True,
    ),
    "frontdesk": _role_permission_template(
        overview=True, requests=True, quick_request=True,
    ),
    "housekeeper": _role_permission_template(queue=True, requests=True),
    "maintenance": _role_permission_template(queue=True, requests=True),
    "bellboy": _role_permission_template(queue=True, requests=True),
}


def default_permissions(role: str) -> dict[str, bool]:
    """Role-based feature flags; admin has full access."""
    if role == "admin":
        return {k: True for k in FEATURE_KEYS}
    return dict(_ROLE_DEFAULTS.get(role, {k: False for k in FEATURE_KEYS}))


def _apply_override(out: dict[str, bool], key: str, value: object) -> None:
    if not isinstance(value, bool):
        return
    if key in FEATURE_KEYS:
        out[key] = value
        return
    mapped = _LEGACY_PERM_MAP.get(key)
    if mapped:
        out[mapped] = out[mapped] or value


def effective_permissions(u: User) -> dict[str, bool]:
    """Admin always has every feature; others use JSON overrides on top of defaults."""
    if u.role == "admin":
        return {k: True for k in FEATURE_KEYS}
    base = default_permissions(u.role)
    out = dict(base)
    raw = u.permissions_json
    if not raw or not str(raw).strip():
        return out
    try:
        o = json.loads(raw)
    except json.JSONDecodeError:
        return out
    if not isinstance(o, dict):
        return out
    for k, v in o.items():
        _apply_override(out, k, v)
    return out


def store_permissions_json(role: str, effective: dict[str, bool]) -> Optional[str]:
    """Persist only feature flags that differ from role defaults (admin → None)."""
    if role == "admin":
        return None
    base = default_permissions(role)
    diff = {
        k: effective[k]
        for k in FEATURE_KEYS
        if k in effective and bool(effective[k]) != bool(base.get(k))
    }
    return json.dumps(diff) if diff else None


def permissions_json_from_client(role: str, effective: dict[str, bool]) -> Optional[str]:
    """Persist admin UI toggles, including explicit false (e.g. quick_request off)."""
    if role == "admin":
        return None
    out = {k: bool(effective.get(k, False)) for k in FEATURE_KEYS}
    if not any(out.values()):
        return None
    return json.dumps(out)


def can_adjust_inventory(perms: dict[str, bool]) -> bool:
    return bool(perms.get("stock"))


def can_edit_catalog(perms: dict[str, bool]) -> bool:
    return bool(perms.get("stock")) or bool(perms.get("admin_hub"))


def can_view_reports(perms: dict[str, bool]) -> bool:
    return bool(perms.get("reports"))


def can_use_quick_request(perms: dict[str, bool], role: str) -> bool:
    if role == "admin":
        return True
    return bool(perms.get("quick_request"))


def _is_maintenance_staff(user: User) -> bool:
    """Maintenance assignee predicate with legacy engineer compatibility."""
    dept = (user.department or "").strip()
    if dept not in ("maintenance", "engineer"):
        return False
    role = (user.role or "").strip()
    if role in ("maintenance", "manager"):
        return True
    # Legacy seeds used housekeeper role for engineering staff.
    if role != "housekeeper":
        return False
    jt = (user.job_title or "").strip().lower()
    return ("technician" in jt) or ("engineer" in jt) or ("ช่าง" in jt)


def requests_list_scope_for_user(user: User) -> dict[str, object]:
    """Field ops on /requests: today only + own request department."""
    if user.role == "housekeeper" and user.department == "housekeeping":
        return {"restrict": True, "department": "housekeeping"}
    if user.role == "maintenance" and user.department == "maintenance":
        return {"restrict": True, "department": "maintenance"}
    if user.role == "bellboy":
        return {"restrict": True, "department": "bell_boy"}
    return {"restrict": False, "department": None}


# ----- enrichment helpers -----

def user_to_read(u: User | None) -> Optional[UserRead]:
    if not u:
        return None
    eff = effective_permissions(u)
    return UserRead(
        id=u.id, name=u.name, username=u.username, initials=u.initials, role=u.role,
        department=u.department, job_title=u.job_title,
        work_zone=u.work_zone, color=u.color, active=u.active,
        permissions=UserPermissionsRead(
            overview=eff["overview"],
            requests=eff["requests"],
            quick_request=eff["quick_request"],
            stock=eff["stock"],
            reports=eff["reports"],
            admin_hub=eff["admin_hub"],
            settings=eff["settings"],
            queue=eff["queue"],
        ),
    )


def product_status(p: Product) -> str:
    if not getattr(p, "active", True):
        return "inactive"
    if p.is_service:
        return "service"
    if (p.on_hand or 0) <= 0:
        return "out"
    if p.reorder_at is not None and (p.on_hand or 0) <= p.reorder_at:
        return "low"
    return "ok"


def product_to_read(p: Product) -> ProductRead:
    from .catalog.product_names_i18n import resolved_product_names
    from .catalog.product_units_i18n import resolved_product_units

    th, en = resolved_product_names(
        p.sku,
        p.name,
        name_en=p.name_en,
        name_my=p.name_my,
        name_lo=p.name_lo,
    )
    uth, uen = resolved_product_units(
        p.unit,
        unit_en=p.unit_en,
        unit_my=p.unit_my,
        unit_lo=p.unit_lo,
    )
    from .catalog.product_assignees import parse_product_assignee_job_titles

    return ProductRead(
        id=p.id, sku=p.sku, name=th, name_en=en,
        department=p.department,
        unit=uth, unit_en=uen,
        on_hand=p.on_hand, reorder_at=p.reorder_at,
        is_service=p.is_service, active=getattr(p, "active", True),
        icon_emoji=getattr(p, "icon_emoji", None),
        assignee_job_titles=parse_product_assignee_job_titles(p),
        status=product_status(p),
    )


def schedule_timeline_detail(
    mode: str | None,
    scheduled_at: datetime | None,
    daily_time: str | None,
) -> str | None:
    if not mode or mode == "immediate":
        return None
    if mode == "daily" and daily_time:
        return f"daily_at:{daily_time}"
    if scheduled_at:
        at = to_naive_utc(scheduled_at)
        if at:
            return f"schedule_at:{at.replace(microsecond=0).isoformat()}"
    return "Scheduled delivery"


def items_for_request(s: Session, req_id: int) -> list[RequestItemRead]:
    from .catalog.product_names_i18n import resolved_product_names

    rows = s.exec(
        select(RequestItem, Product)
        .join(Product, Product.id == RequestItem.product_id)
        .where(RequestItem.request_id == req_id)
    ).all()
    out: list[RequestItemRead] = []
    for ri, p in rows:
        th, en = resolved_product_names(
            p.sku,
            p.name,
            name_en=p.name_en,
            name_my=p.name_my,
            name_lo=p.name_lo,
        )
        out.append(
            RequestItemRead(
                product_id=p.id,
                sku=p.sku,
                name=th,
                name_en=en,
                qty=ri.qty,
                note=ri.note,
                is_service=p.is_service,
                icon_emoji=getattr(p, "icon_emoji", None),
            ),
        )
    return out


def _age_seconds(r: Request) -> int:
    # closed requests freeze their age
    end = r.delivered_at or r.cancelled_at or datetime.utcnow()
    return int((end - r.created_at).total_seconds())


def is_awaiting_online_staff(r: Request) -> bool:
    """Immediate job waiting for an online assignee (e.g. after offline release)."""
    if is_scheduled_hold(r):
        return False
    if r.status != "pending":
        return False
    if r.assignee_id is not None:
        return False
    return bool(r.pending_auto_assign)


def _request_to_read(
    r: Request,
    *,
    items: list[RequestItemRead],
    assignee: User | None,
    creator: User | None,
) -> RequestRead:
    hold = is_scheduled_hold(r)
    display_assignee = None if hold else assignee
    status = "pending" if hold and r.status not in ("delivered", "cancelled") else r.status
    return RequestRead(
        id=r.id, code=r.code, room=r.room, department=r.department,
        items_text=r.items_text, status=status, priority=r.priority,
        delivery_method=r.delivery_method, response_minutes=r.response_minutes,
        pause_reason=r.pause_reason, dnd_reason=r.dnd_reason,
        schedule_mode=r.schedule_mode or "immediate",
        scheduled_at=r.scheduled_at, schedule_daily_time=r.schedule_daily_time,
        assignee=user_to_read(display_assignee),
        created_by=user_to_read(creator),
        created_at=r.created_at, updated_at=r.updated_at,
        delivered_at=r.delivered_at, cancelled_at=r.cancelled_at,
        auto_cancel_at=r.auto_cancel_at,
        items=items,
        age_seconds=_age_seconds(r),
        awaiting_staff=is_awaiting_online_staff(r),
    )


def request_to_read(s: Session, r: Request) -> RequestRead:
    hold = is_scheduled_hold(r)
    assignee = None if hold else (s.get(User, r.assignee_id) if r.assignee_id else None)
    creator = s.get(User, r.created_by_id) if r.created_by_id else None
    return _request_to_read(
        r,
        items=items_for_request(s, r.id),
        assignee=assignee,
        creator=creator,
    )


def requests_to_read(s: Session, rows: list[Request]) -> list[RequestRead]:
    """Batch variant for list endpoints — avoids N+1 item/user queries."""
    from .catalog.product_names_i18n import resolved_product_names

    if not rows:
        return []
    ids = [r.id for r in rows]
    item_rows = s.exec(
        select(RequestItem, Product)
        .join(Product, Product.id == RequestItem.product_id)
        .where(RequestItem.request_id.in_(ids)),
    ).all()
    items_by_req: dict[int, list[RequestItemRead]] = {i: [] for i in ids}
    for ri, p in item_rows:
        th, en = resolved_product_names(
            p.sku,
            p.name,
            name_en=p.name_en,
            name_my=p.name_my,
            name_lo=p.name_lo,
        )
        items_by_req[ri.request_id].append(
            RequestItemRead(
                product_id=p.id,
                sku=p.sku,
                name=th,
                name_en=en,
                qty=ri.qty,
                note=ri.note,
                is_service=p.is_service,
                icon_emoji=getattr(p, "icon_emoji", None),
            ),
        )
    user_ids: set[int] = set()
    for r in rows:
        if r.assignee_id:
            user_ids.add(r.assignee_id)
        if r.created_by_id:
            user_ids.add(r.created_by_id)
    users_by_id: dict[int, User] = {}
    if user_ids:
        for u in s.exec(select(User).where(User.id.in_(user_ids))).all():
            users_by_id[u.id] = u
    out: list[RequestRead] = []
    for r in rows:
        hold = is_scheduled_hold(r)
        assignee = (
            None
            if hold
            else users_by_id.get(r.assignee_id) if r.assignee_id else None
        )
        creator = users_by_id.get(r.created_by_id) if r.created_by_id else None
        out.append(
            _request_to_read(
                r,
                items=items_by_req.get(r.id, []),
                assignee=assignee,
                creator=creator,
            ),
        )
    return out


def request_to_detail(s: Session, r: Request) -> RequestDetail:
    base = request_to_read(s, r)
    timeline_rows = s.exec(
        select(TimelineEvent)
        .where(TimelineEvent.request_id == r.id)
        .order_by(TimelineEvent.created_at.desc(), TimelineEvent.id.desc())
    ).all()
    timeline = [
        TimelineRead(
            id=t.id, kind=t.kind, title=t.title, detail=t.detail,
            actor_id=t.actor_id, actor_label=t.actor_label,
            created_at=t.created_at,
        )
        for t in timeline_rows
    ]

    note_rows = s.exec(
        select(Note, User)
        .where(Note.request_id == r.id)
        .order_by(Note.created_at.desc(), Note.id.desc())
        .outerjoin(User, User.id == Note.author_id)
    ).all()
    notes = [
        NoteRead(
            id=n.id, body=n.body, author_id=n.author_id,
            author_label=u.name if u else None, created_at=n.created_at,
        )
        for n, u in note_rows
    ]

    return RequestDetail(**base.model_dump(), timeline=timeline, notes=notes)


def apply_pending_auto_cancels(s: Session) -> list[int]:
    """Cancel open requests whose auto_cancel_at is in the past.

    Called from read endpoints (lazy — no background scheduler in this prototype).
    Returns request ids that were auto-cancelled.
    """
    now = datetime.utcnow()
    changed: list[int] = []
    rows = s.exec(
        select(Request).where(
            Request.auto_cancel_at.is_not(None),
            Request.auto_cancel_at <= now,
            Request.status.not_in(("delivered", "cancelled")),
        ),
    ).all()
    for r in rows:
        r.status = "cancelled"
        r.cancelled_at = now
        r.auto_cancel_at = None
        r.dnd_reason = None
        r.updated_at = now
        s.add(r)
        add_event(
            s, r.id, kind="cancelled", title="Auto-cancelled (overdue)",
            detail="cancel_reason:guest_unreachable",
            actor_label="System",
        )
        changed.append(r.id)
    return changed


# ----- timeline + state mutations -----

def add_event(
    s: Session, request_id: int, *, kind: str, title: str,
    detail: str | None = None, actor: User | None = None,
    actor_label: str | None = None,
) -> TimelineEvent:
    ev = TimelineEvent(
        request_id=request_id, kind=kind, title=title, detail=detail,
        actor_id=actor.id if actor else None,
        actor_label=actor_label or (actor.name if actor else None),
    )
    s.add(ev)
    return ev


def department_for_products(s: Session, product_ids: list[int]) -> str:
    if not product_ids:
        return "housekeeping"
    products = s.exec(select(Product).where(Product.id.in_(product_ids))).all()
    depts = {p.department for p in products}
    if len(depts) == 1:
        return next(iter(depts))
    if depts == {"maintenance"}:
        return "maintenance"
    if "bell_boy" in depts:
        return "bell_boy"
    if "front_office" in depts:
        return "front_office"
    return "housekeeping"


def items_text_for(
    s: Session,
    product_ids: list[int],
    qty_map: dict[int, int] | None = None,
    note_map: dict[int, str] | None = None,
) -> str:
    qty_map = qty_map or {}
    note_map = note_map or {}
    products = s.exec(select(Product).where(Product.id.in_(product_ids))).all()
    parts: list[str] = []
    for p in products:
        q = qty_map.get(p.id, 1)
        label = f"{p.name} x{q}" if q > 1 else p.name
        note = (note_map.get(p.id) or "").strip()
        if note:
            label = f"{label} ({note})"
        parts.append(label)
    return ", ".join(parts)


HK_OFFICE_CODE = "HK-OFFICE"
HK_LEGACY_PUBLIC_CODE = "HK-PUBLIC"
HK_AREA_PREFIX = "HK-AREA-"
HK_LOC_PREFIX = "HK-LOC-"


def is_public_area_staff(user: User) -> bool:
    """Floor housekeepers vs public-area (lobby, corridor, pool, etc.)."""
    if user.role != "housekeeper":
        return False
    jt = (user.job_title or "").strip().lower()
    return "public area" in jt or "พื้นที่สาธารณะ" in jt


def is_guest_room_code(s: Session, room: str) -> bool:
    """True when `room` is a guest room number (tower/floor routing applies)."""
    return work_zone_for_room(s, room) is not None


def is_public_area_location(s: Session, room: str) -> bool:
    """Hotel zones outside guest rooms (lobby, F&B, pool, corridors, etc.)."""
    code = (room or "").strip()
    if not code or is_guest_room_code(s, code):
        return False
    if code in (HK_OFFICE_CODE,):
        return False
    if code == HK_LEGACY_PUBLIC_CODE or code.startswith(HK_AREA_PREFIX):
        return True
    if code.startswith(HK_LOC_PREFIX):
        return True
    return s.exec(select(HotelLocation).where(HotelLocation.code == code)).first() is not None


def staff_handles_hk_request(s: Session, user: User, room: str) -> bool:
    """Route HK jobs: PA staff ↔ hotel zones; floor staff ↔ guest rooms."""
    if user.role in ("hk_supervisor", "manager"):
        return True
    if is_public_area_staff(user):
        return is_public_area_location(s, room)
    code = (room or "").strip()
    return is_guest_room_code(s, code) or code == HK_OFFICE_CODE


def eligible_assignee(
    dept: str,
    user: User,
    *,
    room: str | None = None,
    s: Session | None = None,
) -> bool:
    """Whether this user may be assigned service requests for `dept`."""
    if not user.active:
        return False
    if dept == "maintenance":
        return _is_maintenance_staff(user)
    if dept == "front_office":
        return user.department == "front_office" and user.role in (
            "frontdesk",
            "manager",
        )
    if dept == "bell_boy":
        return user.role == "bellboy" and user.department in (
            "bell_boy",
            "front_office",
        )
    if not (
        user.department == "housekeeping"
        and user.role in ("housekeeper", "hk_supervisor", "manager")
    ):
        return False
    if room is not None and s is not None:
        return staff_handles_hk_request(s, user, room)
    return True


def backfill_public_area_staff_work_zones(s: Session) -> int:
    """PA staff must not carry tower/floor zones (seed/demo fix)."""
    changed = 0
    for u in s.exec(select(User).where(User.active == True)).all():
        if not is_public_area_staff(u):
            continue
        if parse_work_zone(u.work_zone) is not None:
            u.work_zone = None
            s.add(u)
            changed += 1
    if changed:
        s.commit()
    return changed


def work_zone_for_room(s: Session, room: str) -> str | None:
    """HK routing zone label for a guest room, e.g. ตึก 1 · ชั้น 4."""
    code = (room or "").strip()
    if not code:
        return None
    if len(code) == 4 and code.isdigit():
        building = int(code[0])
        floor = int(code[1])
        if building >= 1 and floor >= 1:
            return f"ตึก {building} · ชั้น {floor}"
    gr = s.exec(select(GuestRoom).where(GuestRoom.number == code)).first()
    if gr:
        return f"ตึก {gr.building} · ชั้น {gr.floor}"
    return None


OPEN_WORK_STATUSES = ("assigned", "in_progress", "paused", "dnd")

TIME_WARN_KEY = "time_warn_min"
TIME_DANGER_KEY = "time_danger_min"
TIME_BREACH_KEY = "time_breach_min"
DEFAULT_TIME_ALERTS = {TIME_WARN_KEY: 5, TIME_DANGER_KEY: 10, TIME_BREACH_KEY: 15}


def _read_setting_int(s: Session, key: str, default: int) -> int:
    row = s.get(AppSetting, key)
    if not row:
        return default
    try:
        n = int(row.value)
        return n if n >= 0 else default
    except (TypeError, ValueError):
        return default


def get_time_alert_settings(s: Session) -> tuple[int, int, int]:
    return (
        _read_setting_int(s, TIME_WARN_KEY, DEFAULT_TIME_ALERTS[TIME_WARN_KEY]),
        _read_setting_int(s, TIME_DANGER_KEY, DEFAULT_TIME_ALERTS[TIME_DANGER_KEY]),
        _read_setting_int(s, TIME_BREACH_KEY, DEFAULT_TIME_ALERTS[TIME_BREACH_KEY]),
    )


def current_response_budget_minutes(s: Session) -> int:
    """Total response-time budget (countdown deadline) from admin breach setting."""
    _, _, breach = get_time_alert_settings(s)
    return max(1, breach)


def _sync_open_request_response_budget(s: Session, breach: int) -> None:
    """Keep open requests aligned with the configured response-time deadline."""
    budget = max(1, breach)
    rows = s.exec(
        select(Request).where(Request.status.not_in(("delivered", "cancelled"))),
    ).all()
    for r in rows:
        if r.response_minutes != budget:
            r.response_minutes = budget
            s.add(r)


def save_time_alert_settings(
    s: Session, warn: int, danger: int, breach: int,
) -> tuple[int, int, int]:
    for key, val in (
        (TIME_WARN_KEY, warn),
        (TIME_DANGER_KEY, danger),
        (TIME_BREACH_KEY, breach),
    ):
        row = s.get(AppSetting, key)
        if row:
            row.value = str(val)
            s.add(row)
        else:
            s.add(AppSetting(key=key, value=str(val)))
    _sync_open_request_response_budget(s, breach)
    s.commit()
    return warn, danger, breach


def request_sla_anchor(r: Request, now: datetime | None = None) -> datetime | None:
    """When the response-time window starts (respects scheduled delivery)."""
    now = to_naive_utc(now or datetime.utcnow())
    mode = r.schedule_mode or "immediate"
    if mode != "immediate" and r.scheduled_at:
        scheduled = to_naive_utc(r.scheduled_at)
        if scheduled is not None and scheduled <= now:
            return scheduled
        return None
    return r.created_at


def sla_elapsed_ratio(r: Request, now: datetime | None = None) -> float | None:
    """Elapsed share of the response budget (1.0 = deadline)."""
    if r.status in ("delivered", "cancelled"):
        return None
    now = now or datetime.utcnow()
    anchor = request_sla_anchor(r, now)
    if anchor is None:
        return None
    budget_sec = max(1, (r.response_minutes or 15) * 60)
    return (now - anchor).total_seconds() / budget_sec


def set_request_assignee(r: Request, user_id: int | None, now: datetime | None = None) -> None:
    """Update assignee and reset the start-work escalation clock."""
    now = now or datetime.utcnow()
    if r.assignee_id == user_id:
        return
    r.assignee_id = user_id
    r.assignee_since = now if user_id is not None else None


def escalation_elapsed_ratio(r: Request, now: datetime | None = None) -> float | None:
    """Elapsed share of response budget since the current assignee was set."""
    if r.status != "assigned" or not r.assignee_id:
        return None
    now = now or datetime.utcnow()
    sla_anchor = request_sla_anchor(r, now)
    if sla_anchor is None:
        return None
    assign_anchor = r.assignee_since or r.updated_at or r.created_at
    anchor = max(assign_anchor, sla_anchor)
    budget_sec = max(1, (r.response_minutes or 15) * 60)
    return (now - anchor).total_seconds() / budget_sec


def escalation_elapsed_minutes(r: Request, now: datetime | None = None) -> float | None:
    """Minutes since the current assignee was set (for start-work escalation)."""
    ratio = escalation_elapsed_ratio(r, now)
    if ratio is None:
        return None
    budget_sec = max(1, (r.response_minutes or 15) * 60)
    return ratio * budget_sec / 60


def parse_work_zone(zone: str | None) -> tuple[int, int] | None:
    if not zone:
        return None
    m = re.match(r"ตึก\s+(\d+)\s*·\s*ชั้น\s+(\d+)", zone.strip())
    if not m:
        return None
    return int(m.group(1)), int(m.group(2))


def zone_proximity_score(room_zone: str | None, user_zone: str | None) -> int:
    """Lower = closer to the room zone."""
    if not room_zone:
        return 0
    room = parse_work_zone(room_zone)
    staff = parse_work_zone(user_zone)
    if not room or not staff:
        return 10_000
    rb, rf = room
    sb, sf = staff
    if rb != sb:
        return 1_000 * abs(rb - sb) + abs(rf - sf)
    return abs(rf - sf)


def open_workload_by_user(s: Session) -> dict[int, int]:
    rows = s.exec(
        select(Request.assignee_id, func.count(Request.id))
        .where(Request.status.in_(OPEN_WORK_STATUSES))
        .group_by(Request.assignee_id)
    ).all()
    return {aid: c for aid, c in rows if aid is not None}


def _active_users(s: Session, *, department: str, roles: tuple[str, ...]) -> list[User]:
    if department == "maintenance":
        return list(
            s.exec(
                select(User).where(
                    User.active == True,  # noqa: E712
                    User.department.in_(("maintenance", "engineer")),
                ),
            ).all(),
        )
    return list(
        s.exec(
            select(User).where(
                User.active == True,  # noqa: E712
                User.department == department,
                User.role.in_(roles),
            ),
        ).all(),
    )


def _assignable_users(
    s: Session,
    *,
    department: str,
    roles: tuple[str, ...],
) -> list[User]:
    from .assignment_eligibility import accepts_new_assignments

    return [
        u for u in _active_users(s, department=department, roles=roles)
        if accepts_new_assignments(u, s)
    ]


def pick_best_assignee(
    s: Session,
    request: Request,
    candidates: list[User],
    counts: dict[int, int],
) -> User | None:
    """Prefer idle staff nearby; else nearest with the lowest workload."""
    from .assignment_eligibility import accepts_new_assignments

    if not candidates:
        return None
    room_zone = work_zone_for_room(s, request.room)

    def sort_key(u: User) -> tuple[int, int, int, int]:
        load = counts.get(u.id, 0)
        busy = 1 if load > 0 else 0
        prox = zone_proximity_score(room_zone, u.work_zone)
        return (busy, prox, load, u.id)

    for u in sorted(candidates, key=sort_key):
        if accepts_new_assignments(u, s):
            return u
    return None


def auto_assign(s: Session, request: Request) -> User | None:
    """Pick HK/maintenance staff: free + nearby first, else least busy nearby."""
    counts = open_workload_by_user(s)
    candidates = assignment_candidates(s, request)
    if not candidates:
        return None

    if request.department == "maintenance":
        return pick_best_assignee(s, request, candidates, counts)

    if request.department in ("front_office", "bell_boy"):
        return pick_best_assignee(s, request, candidates, counts)

    room = request.room or ""
    for roles in (("housekeeper",), ("hk_supervisor",), ("manager",)):
        pool = [u for u in candidates if u.role in roles]
        pick = pick_best_assignee(s, request, pool, counts)
        if pick:
            return pick
    return None


def assignment_candidates(
    s: Session,
    request: Request,
    *,
    product_ids: list[int] | None = None,
) -> list[User]:
    """Eligible, present staff who could take this request."""
    from .assignment_eligibility import accepts_new_assignments
    from .catalog.product_assignees import (
        allowed_job_titles_for_request,
        user_matches_product_job_titles,
    )

    dept = request.department
    room = request.room or ""

    if dept == "maintenance":
        pool = _assignable_users(s, department="maintenance", roles=("maintenance",))
    elif dept == "front_office":
        pool = _assignable_users(
            s, department="front_office", roles=("frontdesk", "manager"),
        )
    elif dept == "bell_boy":
        pool = list(
            {
                u.id: u
                for part in ("front_office", "bell_boy")
                for u in _assignable_users(s, department=part, roles=("bellboy",))
                if eligible_assignee("bell_boy", u)
            }.values(),
        )
    else:
        pool = [
            u for u in _assignable_users(s, department="housekeeping", roles=(
                "housekeeper", "hk_supervisor", "manager",
            ))
            if staff_handles_hk_request(s, u, room)
        ]

    allowed_titles = allowed_job_titles_for_request(s, request, product_ids=product_ids)
    pool = [u for u in pool if user_matches_product_job_titles(u, allowed_titles)]
    return [u for u in pool if accepts_new_assignments(u, s)]


def has_assignable_staff(
    s: Session,
    *,
    department: str,
    room: str,
    product_ids: list[int] | None = None,
) -> bool:
    probe = Request(department=department, room=room, status="pending")
    return len(assignment_candidates(s, probe, product_ids=product_ids)) > 0


def assignable_staff_snapshot(
    s: Session,
    *,
    room: str,
    departments: Iterable[str],
    product_ids: list[int] | None = None,
) -> dict[str, dict[str, object]]:
    """Online assignable staff per department (for quick-request UI)."""
    from .catalog.product_assignees import products_for_ids

    room_str = (room or "").strip()
    by_dept: dict[str, list[int]] = {}
    if product_ids:
        for p in products_for_ids(s, product_ids):
            by_dept.setdefault(p.department, []).append(int(p.id))  # type: ignore[arg-type]

    out: dict[str, dict[str, object]] = {}
    for raw in departments:
        dept = (raw or "").strip()
        if not dept:
            continue
        probe = Request(department=dept, room=room_str, status="pending")
        dept_product_ids = by_dept.get(dept) or None
        ids = [
            u.id
            for u in assignment_candidates(s, probe, product_ids=dept_product_ids)
            if u.id is not None
        ]
        out[dept] = {"available": len(ids) > 0, "user_ids": ids}
    return out


def apply_escalation_reassignments(s: Session) -> list[int]:
    """Re-route HK jobs that were assigned but never started (⅓ → supervisor, ⅔ → manager)."""
    now = datetime.utcnow()
    counts = open_workload_by_user(s)
    changed: list[int] = []

    supervisors = _assignable_users(
        s, department="housekeeping", roles=("hk_supervisor",),
    )
    managers = _assignable_users(
        s, department="housekeeping", roles=("manager",),
    )

    rows = s.exec(
        select(Request).where(
            Request.department == "housekeeping",
            Request.status == "assigned",
            Request.assignee_id.is_not(None),
        ),
    ).all()
    for r in rows:
        if is_future_scheduled(r.schedule_mode, r.scheduled_at, now):
            continue

        elapsed_min = escalation_elapsed_minutes(r, now)
        if elapsed_min is None:
            continue

        warn_min, danger_min, _ = get_time_alert_settings(s)

        assignee = s.get(User, r.assignee_id)
        if not assignee:
            continue

        new_pick: User | None = None
        detail: str | None = None

        if elapsed_min >= danger_min:
            if assignee.role == "manager":
                continue
            new_pick = pick_best_assignee(s, r, managers, counts)
            detail = f"escalation:manager:{danger_min}"
        elif elapsed_min >= warn_min:
            if assignee.role != "housekeeper":
                continue
            new_pick = pick_best_assignee(s, r, supervisors, counts)
            detail = f"escalation:supervisor:{warn_min}"

        if not new_pick or new_pick.id == r.assignee_id:
            continue

        r.assignee_id = new_pick.id
        r.assignee_since = now
        r.updated_at = now
        s.add(r)
        add_event(
            s,
            r.id,
            kind="reassigned",
            title=f"Reassigned to {new_pick.name}",
            detail=detail,
            actor_label="System",
        )
        changed.append(r.id)
        counts[new_pick.id] = counts.get(new_pick.id, 0) + 1

    return changed


def is_future_scheduled(
    mode: str,
    scheduled_at: datetime | None,
    now: datetime | None = None,
) -> bool:
    if mode == "immediate" or not scheduled_at:
        return False
    now = to_naive_utc(now or datetime.utcnow())
    at = to_naive_utc(scheduled_at)
    if at is None:
        return False
    return at > now


def assign_request_now(
    s: Session,
    req: Request,
    *,
    creator: User | None = None,
    preferred_id: int | None = None,
) -> bool:
    """Try auto-assign. Returns True if an assignee was set."""
    from .assignment_eligibility import accepts_new_assignments

    assigned = False
    if preferred_id is not None:
        pick = s.get(User, preferred_id)

        from .catalog.product_assignees import (
            allowed_job_titles_for_request,
            user_matches_product_job_titles,
        )

        allowed_titles = allowed_job_titles_for_request(s, req)
        if (
            pick
            and eligible_assignee(req.department, pick, room=req.room, s=s)
            and user_matches_product_job_titles(pick, allowed_titles)
            and accepts_new_assignments(pick, s)
        ):
            set_request_assignee(req, pick.id)
            req.status = "assigned"
            req.updated_at = datetime.utcnow()
            assigned = True
            add_event(
                s, req.id, kind="auto_assigned",
                title=f"Assigned to {pick.name}",
                detail="Requested assignee",
                actor=creator,
            )
    if not assigned:
        picked = auto_assign(s, req)
        if picked and accepts_new_assignments(picked, s):
            set_request_assignee(req, picked.id)
            req.status = "assigned"
            req.updated_at = datetime.utcnow()
            add_event(
                s, req.id, kind="auto_assigned",
                title=f"Auto-assigned to {picked.name}",
                detail="Nearest available staff", actor_label="System",
            )
            assigned = True
    return assigned


def release_offline_assignee_jobs(s: Session, user_id: int) -> list[int]:
    """Re-route assigned-but-not-started jobs when assignee goes offline."""
    now = datetime.utcnow()
    changed: list[int] = []
    rows = list(
        s.exec(
            select(Request).where(
                Request.assignee_id == user_id,
                Request.status == "assigned",
            ),
        ).all(),
    )
    for r in rows:
        if is_future_scheduled(r.schedule_mode, r.scheduled_at, now):
            continue

        former = s.get(User, user_id)
        former_name = former.name if former else str(user_id)

        set_request_assignee(r, None)
        r.status = "pending"
        r.pending_auto_assign = True
        r.updated_at = now
        s.add(r)
        add_event(
            s,
            r.id,
            kind="reassigned",
            title="Assignee offline",
            detail=f"offline_released:{former_name}",
            actor_label="System",
        )

        if assign_request_now(s, r, preferred_id=r.preferred_assignee_id):
            r.pending_auto_assign = False
        changed.append(r.id)

    return changed


def sync_offline_user_assignments(user_id: int) -> None:
    """Clear presence and re-route open jobs after logout or WS disconnect."""
    from .db import engine
    from .presence import clear_user_presence

    clear_user_presence(user_id)
    with Session(engine) as s:
        changed = release_offline_assignee_jobs(s, user_id)
        if not changed:
            return
        s.commit()
        for rid in changed:
            publish_request_changed_by_id(s, rid)


def retry_pending_assignments_when_staff_online() -> list[int]:
    """Assign immediate jobs waiting for online staff (e.g. after someone logs in)."""
    from .db import engine

    with Session(engine) as s:
        changed = apply_pending_immediate_auto_assign(s)
        if not changed:
            return []
        s.commit()
        for rid in changed:
            publish_request_changed_by_id(s, rid)
        return changed


def is_scheduled_hold(r: Request, now: datetime | None = None) -> bool:
    """True while a pre-scheduled request is waiting for its delivery window."""
    mode = r.schedule_mode or "immediate"
    return is_future_scheduled(mode, to_naive_utc(r.scheduled_at), now)


def clear_premature_scheduled_assignments(s: Session) -> list[int]:
    """Scheduled holds must not have an assignee until delivery time."""
    now = datetime.utcnow()
    changed: list[int] = []
    rows = s.exec(
        select(Request).where(
            Request.schedule_mode != "immediate",
            Request.scheduled_at.is_not(None),
            Request.scheduled_at > now,
            Request.status.not_in(("delivered", "cancelled")),
        ),
    ).all()
    for r in rows:
        if (
            r.assignee_id is None
            and r.status == "pending"
            and not r.assignee_since
        ):
            continue
        r.assignee_id = None
        r.assignee_since = None
        if r.status not in ("delivered", "cancelled"):
            r.status = "pending"
        r.updated_at = now
        s.add(r)
        changed.append(r.id)
    return changed


def apply_pending_immediate_auto_assign(s: Session) -> list[int]:
    """Retry auto-assign for immediate jobs waiting for online staff."""
    changed: list[int] = []
    rows = s.exec(
        select(Request).where(
            Request.status == "pending",
            Request.assignee_id.is_(None),
            Request.pending_auto_assign == True,  # noqa: E712
            Request.schedule_mode == "immediate",
        ),
    ).all()
    for r in rows:
        if assign_request_now(s, r, preferred_id=r.preferred_assignee_id):
            r.pending_auto_assign = False
            changed.append(r.id)
        s.add(r)
    return changed


def apply_pending_scheduled_assignments(s: Session) -> list[int]:
    """Assign staff when a pre-scheduled request reaches its delivery time."""
    now = datetime.utcnow()
    changed: list[int] = []
    rows = s.exec(
        select(Request).where(
            Request.status == "pending",
            Request.assignee_id.is_(None),
            Request.schedule_mode != "immediate",
            Request.scheduled_at.is_not(None),
            Request.scheduled_at <= now,
        ),
    ).all()
    for r in rows:
        if assign_request_now(s, r, preferred_id=r.preferred_assignee_id):
            r.pending_auto_assign = False
            changed.append(r.id)
        s.add(r)
    return changed


_FLUSH_MIN_INTERVAL_SEC = 8.0
_last_flush_monotonic: float | None = None


def count_low_stock_products(s: Session, department: str | None = None) -> int:
    """Active non-service SKUs at or below reorder / out of stock."""
    stmt = select(func.count(Product.id)).where(
        Product.active == True,  # noqa: E712
        Product.is_service == False,  # noqa: E712
        or_(
            Product.on_hand <= 0,
            and_(
                Product.reorder_at.is_not(None),
                Product.on_hand <= Product.reorder_at,
            ),
        ),
    )
    if department:
        stmt = stmt.where(Product.department == department)
    return int(s.exec(stmt).one() or 0)


def list_stock_alert_products(
    s: Session,
    *,
    department: str | None = None,
    limit: int = 32,
) -> list[ProductRead]:
    stmt = (
        select(Product)
        .where(
            Product.active == True,  # noqa: E712
            Product.is_service == False,  # noqa: E712
            or_(
                Product.on_hand <= 0,
                and_(
                    Product.reorder_at.is_not(None),
                    Product.on_hand <= Product.reorder_at,
                ),
            ),
        )
        .order_by(Product.on_hand.asc(), Product.sku)
        .limit(max(1, min(limit, 64)))
    )
    if department:
        stmt = stmt.where(Product.department == department)
    return [product_to_read(p) for p in s.exec(stmt).all()]


def count_open_overdue_requests(
    s: Session,
    department: str | None = None,
    *,
    now: datetime | None = None,
) -> int:
    now = now or datetime.utcnow()
    stmt = select(
        Request.created_at,
        Request.response_minutes,
    ).where(Request.status.in_(("pending", "assigned", "in_progress")))
    if department:
        stmt = stmt.where(Request.department == department)
    rows = s.exec(stmt).all()
    return sum(
        1
        for created_at, response_minutes in rows
        if (now - created_at).total_seconds() / 60
        > (response_minutes or 15)
    )


def flush_pending_request_timers(s: Session, *, force: bool = False) -> list[int]:
    """Lazy scheduler: release pre-orders, escalate stale assigns, auto-cancel overdue DND."""
    global _last_flush_monotonic
    mono = time.monotonic()
    if (
        not force
        and _last_flush_monotonic is not None
        and mono - _last_flush_monotonic < _FLUSH_MIN_INTERVAL_SEC
    ):
        return []
    changed: list[int] = []
    changed.extend(clear_premature_scheduled_assignments(s))
    changed.extend(apply_pending_scheduled_assignments(s))
    changed.extend(apply_pending_immediate_auto_assign(s))
    changed.extend(apply_escalation_reassignments(s))
    changed.extend(apply_pending_auto_cancels(s))
    _last_flush_monotonic = mono
    return changed


# Open requests still owe stock until delivered or cancelled.
OPEN_STOCK_REQUEST_STATUSES = frozenset({
    "pending",
    "assigned",
    "in_progress",
    "paused",
    "dnd",
})


@dataclass(frozen=True)
class StockShortage:
    product_id: int
    sku: str
    name: str
    requested: int
    available: int
    on_hand: int
    committed: int


def _aggregate_line_qty(lines: Iterable[tuple[int, int]]) -> dict[int, int]:
    out: dict[int, int] = {}
    for pid, qty in lines:
        out[pid] = out.get(pid, 0) + max(1, qty)
    return out


def committed_qty_by_product(
    s: Session,
    *,
    exclude_request_id: int | None = None,
) -> dict[int, int]:
    """Qty already reserved on open (undelivered) requests."""
    stmt = (
        select(RequestItem.product_id, func.sum(RequestItem.qty))
        .join(Request, Request.id == RequestItem.request_id)
        .where(Request.status.in_(tuple(OPEN_STOCK_REQUEST_STATUSES)))
        .group_by(RequestItem.product_id)
    )
    if exclude_request_id is not None:
        stmt = stmt.where(Request.id != exclude_request_id)
    rows = s.exec(stmt).all()
    return {int(pid): int(total or 0) for pid, total in rows}


def stock_shortages_for_lines(
    s: Session,
    lines: Iterable[tuple[int, int]],
    *,
    exclude_request_id: int | None = None,
) -> list[StockShortage]:
    need_by_pid = _aggregate_line_qty(lines)
    if not need_by_pid:
        return []

    committed = committed_qty_by_product(s, exclude_request_id=exclude_request_id)
    shortages: list[StockShortage] = []

    for pid, need in need_by_pid.items():
        p = s.get(Product, pid)
        if not p:
            raise HTTPException(404, "product not found")
        if p.is_service:
            continue
        if not getattr(p, "active", True):
            raise HTTPException(400, f"product {p.sku} is inactive")
        on_hand = p.on_hand or 0
        reserved = committed.get(pid, 0)
        available = on_hand - reserved
        if need > available:
            shortages.append(
                StockShortage(
                    product_id=p.id,
                    sku=p.sku,
                    name=p.name,
                    requested=need,
                    available=max(0, available),
                    on_hand=on_hand,
                    committed=reserved,
                ),
            )

    shortages.sort(key=lambda x: x.name)
    return shortages


def assert_stock_available_for_lines(
    s: Session,
    lines: Iterable[tuple[int, int]],
    *,
    exclude_request_id: int | None = None,
) -> None:
    """Block create/update when on_hand cannot cover open requests plus new lines."""
    shortages = stock_shortages_for_lines(
        s, lines, exclude_request_id=exclude_request_id,
    )
    if not shortages:
        return
    raise HTTPException(
        status_code=400,
        detail={
            "code": "insufficient_stock",
            "products": [
                {
                    "product_id": x.product_id,
                    "sku": x.sku,
                    "name": x.name,
                    "requested": x.requested,
                    "available": x.available,
                    "on_hand": x.on_hand,
                    "committed": x.committed,
                }
                for x in shortages
            ],
        },
    )


def consume_stock(s: Session, request: Request) -> None:
    """Decrement on-hand for non-service items when a request is delivered."""
    rows = s.exec(
        select(RequestItem, Product)
        .join(Product, Product.id == RequestItem.product_id)
        .where(RequestItem.request_id == request.id)
    ).all()
    for ri, p in rows:
        if p.is_service:
            continue
        p.on_hand = max(0, (p.on_hand or 0) - ri.qty)
        s.add(p)


def next_code(s: Session) -> str:
    """Generate REQ-MMDD-### using the date of UTC now + per-day sequence."""
    today = datetime.utcnow()
    prefix = f"REQ-{today.strftime('%m%d')}-"
    count = s.exec(
        select(func.count(Request.id)).where(Request.code.like(f"{prefix}%"))
    ).one()
    n = (count or 0) + 1
    return f"{prefix}{n:03d}"


def publish_request_changed(detail: RequestDetail) -> None:
    """Push a list-row snapshot so clients patch cache without refetching."""
    from .ws import hub

    hub.publish(
        "requests.changed",
        {
            "id": detail.id,
            "request": detail.model_dump(mode="json", exclude={"timeline", "notes"}),
        },
    )


def publish_request_changed_by_id(s: Session, request_id: int) -> None:
    r = s.get(Request, request_id)
    if not r:
        return
    publish_request_changed(request_to_detail(s, r))
