"""Reset operational data and seed multi-year report demo (requests, timeline, stock, logins).

From 1 Jan 2025 → today: Phuket seasonality, uneven staff workload, terminal jobs,
realistic stock (healthy / low / critical / stockout + some restocks).
"""
from __future__ import annotations

import random
from datetime import datetime, timedelta
from typing import Any

from sqlmodel import Session, delete, func, select

from ..db import engine
from ..models import (
    ActivityLog,
    AppSetting,
    GuestRoom,
    HotelLocation,
    Note,
    Product,
    Request,
    RequestItem,
    StockAdjustment,
    TimelineEvent,
    User,
)
from ..catalog.product_catalog import sync_product_catalog
from ..services import (
    is_public_area_staff,
    items_text_for,
)

SEED_MARKER_KEY = "flow_report_demo_seed_v6"
_DEMO_PERIOD_START = datetime(2025, 1, 1)
RNG = random.Random(20250101)

# Phuket (UTC+7): guest requests — quiet 23:00–07:00 local, peak 10:00–20:00
_PHUKET_LOCAL_HOUR_WEIGHTS: list[int] = []
for _lh in range(24):
    if _lh <= 6 or _lh >= 23:
        _PHUKET_LOCAL_HOUR_WEIGHTS.append(2)
    elif 7 <= _lh <= 9:
        _PHUKET_LOCAL_HOUR_WEIGHTS.append(14)
    elif 10 <= _lh <= 14:
        _PHUKET_LOCAL_HOUR_WEIGHTS.append(24)
    elif 15 <= _lh <= 18:
        _PHUKET_LOCAL_HOUR_WEIGHTS.append(28)
    elif 19 <= _lh <= 22:
        _PHUKET_LOCAL_HOUR_WEIGHTS.append(18)
    else:
        _PHUKET_LOCAL_HOUR_WEIGHTS.append(8)

# Month demand index (Mar–Apr = Phuket high season)
_MONTH_DEMAND: dict[int, float] = {
    1: 0.70,
    2: 0.88,
    3: 1.48,
    4: 1.58,
    5: 0.94,
    6: 0.72,
    7: 0.68,
    8: 0.72,
    9: 0.82,
    10: 0.90,
    11: 1.05,
    12: 1.12,
}

_BASE_REQUESTS_PER_DAY = 148
_COMMIT_EVERY_DAYS = 14

def _utc_now() -> datetime:
    return datetime.utcnow()


def _demo_period_start() -> datetime:
    return _DEMO_PERIOD_START.replace(hour=0, minute=0, second=0, microsecond=0)


def _staff_workload_weights(staff: list[User]) -> dict[int, float]:
    """Uneven assignment weights: some staff carry far more jobs than others."""
    weights: dict[int, float] = {}
    for u in staff:
        if u.id is None:
            continue
        roll = RNG.random()
        if roll < 0.18:
            w = RNG.uniform(1.75, 2.55)
        elif roll < 0.72:
            w = RNG.uniform(0.88, 1.12)
        else:
            w = RNG.uniform(0.28, 0.68)
        weights[u.id] = w
    return weights


def _weighted_choice(staff: list[User], weights: dict[int, float]) -> User | None:
    if not staff:
        return None
    ws = [weights.get(u.id, 1.0) if u.id is not None else 1.0 for u in staff]
    if sum(ws) <= 0:
        return RNG.choice(staff)
    return RNG.choices(staff, weights=ws, k=1)[0]


def _rand_dt_between(start: datetime, end: datetime) -> datetime:
    if end <= start:
        return start
    span = int((end - start).total_seconds())
    return start + timedelta(seconds=RNG.randint(0, max(0, span)))


def _local_hour_to_utc(day: datetime, local_hour: int) -> datetime:
    """Store created_at in UTC (hotel is UTC+7)."""
    utc_hour = (local_hour - 7) % 24
    return day.replace(
        hour=utc_hour,
        minute=RNG.randint(0, 59),
        second=RNG.randint(0, 59),
        microsecond=0,
    )


def _pick_request_created_at(day: datetime, now: datetime) -> datetime | None:
    local_h = RNG.choices(range(24), weights=_PHUKET_LOCAL_HOUR_WEIGHTS, k=1)[0]
    created_at = _local_hour_to_utc(day, local_h)
    if created_at > now:
        return None
    return created_at


def _requests_for_day(day: datetime) -> int:
    weekday = day.weekday()
    month_f = _MONTH_DEMAND.get(day.month, 1.0)
    n = _BASE_REQUESTS_PER_DAY * month_f
    if weekday >= 4:
        n *= 1.12
    if weekday == 5:
        n *= 1.06
    if day.day >= 28:
        n *= 1.05
    if day.month == 4 and 11 <= day.day <= 17:
        n *= 1.08
    return max(8, int(n * RNG.uniform(0.88, 1.14)))


def _auto_restock_product(
    s: Session,
    prod: Product,
    *,
    at: datetime,
    actor_id: int | None,
    actor_label: str,
) -> int:
    if prod.is_service or prod.on_hand is None or prod.id is None:
        return 0
    reorder = prod.reorder_at if prod.reorder_at is not None else 12
    par = max(reorder * 4, reorder + 48, 60)
    on_hand = prod.on_hand or 0
    if on_hand > reorder:
        return 0
    delta = par - on_hand
    before = on_hand
    after = par
    prod.on_hand = after
    s.add(prod)
    s.add(
        StockAdjustment(
            product_id=prod.id,
            product_sku=prod.sku,
            product_name=prod.name,
            delta=delta,
            reason="restock",
            on_hand_before=before,
            on_hand_after=after,
            actor_id=actor_id,
            actor_label=actor_label,
            created_at=at + timedelta(minutes=RNG.randint(30, 180)),
        ),
    )
    return 1


def _deduct_stock_for_delivery(
    s: Session,
    req: Request,
    *,
    at: datetime,
    actor_id: int | None,
    actor_label: str,
) -> tuple[int, int]:
    rows = s.exec(
        select(RequestItem, Product)
        .join(Product, Product.id == RequestItem.product_id)
        .where(RequestItem.request_id == req.id),
    ).all()
    deducts = 0
    restocks = 0
    for ri, prod in rows:
        if prod.is_service or prod.on_hand is None:
            continue
        before = prod.on_hand or 0
        qty = ri.qty
        after = max(0, before - qty)
        prod.on_hand = after
        s.add(prod)
        s.add(
            StockAdjustment(
                product_id=prod.id,
                product_sku=prod.sku,
                product_name=prod.name,
                delta=-qty,
                reason="count_adjust",
                on_hand_before=before,
                on_hand_after=after,
                actor_id=actor_id,
                actor_label=actor_label,
                created_at=at,
            ),
        )
        deducts += 1
        if RNG.random() < 0.36:
            restocks += _auto_restock_product(
                s, prod, at=at, actor_id=actor_id, actor_label=actor_label,
            )
    return deducts, restocks


def _timeline(
    s: Session,
    *,
    request_id: int,
    kind: str,
    title: str,
    at: datetime,
    actor_id: int | None,
    actor_label: str,
    detail: str | None = None,
) -> None:
    s.add(
        TimelineEvent(
            request_id=request_id,
            kind=kind,
            title=title,
            detail=detail,
            actor_id=actor_id,
            actor_label=actor_label,
            created_at=at,
        ),
    )


def _pick_assignee_pools(
    *,
    hk_staff: list[User],
    mt_staff: list[User],
    pa_codes: set[str],
) -> tuple[list[User], list[User], list[User]]:
    hk_floor = [
        u for u in hk_staff
        if u.role == "housekeeper" and not is_public_area_staff(u)
    ]
    hk_pa = [
        u for u in hk_staff
        if u.role in ("housekeeper", "hk_supervisor") and is_public_area_staff(u)
    ] or [u for u in hk_staff if u.role == "hk_supervisor"]
    hk_any = hk_floor or hk_staff
    return hk_floor or hk_any, hk_pa or hk_any, mt_staff


def _pick_assignee(
    *,
    dept: str,
    room: str,
    hk_floor: list[User],
    hk_pa: list[User],
    mt_staff: list[User],
    fo_staff: list[User],
    bell_staff: list[User],
    pa_codes: set[str],
    weights: dict[int, float],
    exclude_id: int | None = None,
) -> User | None:
    if dept == "maintenance":
        pool = mt_staff
    elif dept == "front_office":
        pool = fo_staff
    elif dept == "bell_boy":
        pool = bell_staff
    elif room in pa_codes or (room or "").startswith("HK-LOC-"):
        pool = hk_pa
    else:
        pool = hk_floor
    if exclude_id is not None:
        pool = [u for u in pool if u.id != exclude_id]
    return _weighted_choice(pool, weights)


def apply_stock_alert_levels(
    products: list[Product],
    *,
    stockout: int = 2,
    low: int = 2,
) -> dict[str, int]:
    """Set on_hand so dashboard alerts show exactly `stockout` out + `low` low items."""
    eligible = [
        p for p in products if not p.is_service and p.on_hand is not None and p.id is not None
    ]
    eligible.sort(key=lambda p: p.id or 0)
    counts = {"stockout": 0, "low": 0, "healthy": 0}
    alert_total = stockout + low
    for i, prod in enumerate(eligible):
        reorder = prod.reorder_at if prod.reorder_at is not None else 12
        par = max(reorder + 24, reorder * 2, 40)
        if i < stockout:
            prod.on_hand = 0
            counts["stockout"] += 1
        elif i < alert_total:
            prod.on_hand = max(1, reorder - 1) if reorder > 0 else 1
            if reorder > 0 and prod.on_hand > reorder:
                prod.on_hand = reorder
            counts["low"] += 1
        else:
            prod.on_hand = par
            counts["healthy"] += 1
    return counts


def _apply_final_stock_levels(products: list[Product]) -> dict[str, int]:
    """Dashboard stock alerts: 2 out-of-stock + 2 low; rest healthy."""
    return apply_stock_alert_levels(products, stockout=2, low=2)


def reset_report_operational_data(s: Session) -> dict[str, int]:
    counts = {
        "deleted_notes": s.exec(select(func.count(Note.id))).one() or 0,
        "deleted_timeline_events": s.exec(select(func.count(TimelineEvent.id))).one() or 0,
        "deleted_request_items": s.exec(select(func.count(RequestItem.id))).one() or 0,
        "deleted_requests": s.exec(select(func.count(Request.id))).one() or 0,
        "deleted_stock_adjustments": s.exec(select(func.count(StockAdjustment.id))).one() or 0,
        "deleted_activity_logs": s.exec(select(func.count(ActivityLog.id))).one() or 0,
    }
    s.exec(delete(Note))
    s.exec(delete(TimelineEvent))
    s.exec(delete(RequestItem))
    s.exec(delete(Request))
    s.exec(delete(StockAdjustment))
    s.exec(delete(ActivityLog))
    for key in (
        SEED_MARKER_KEY,
        "flow_report_ytd_seed_v4",
        "flow_report_ytd_seed_v2",
        "flow_report_demo_data_v1",
    ):
        row = s.get(AppSetting, key)
        if row:
            s.delete(row)
    s.commit()
    sync_product_catalog()
    return counts


def seed_report_demo_data(*, force: bool = False, reset: bool = False) -> dict[str, Any]:
    """Seed 2025-01-01 → today: terminal HK/MT jobs, uneven staff load, realistic stock."""
    with Session(engine) as s:
        req_count = s.exec(select(func.count(Request.id))).one() or 0
        marker = s.get(AppSetting, SEED_MARKER_KEY)
        if not force and not reset:
            if marker is not None:
                return {"skipped": True, "reason": "already_seeded", "requests": req_count}
            if req_count >= 80:
                return {"skipped": True, "reason": "enough_requests", "requests": req_count}

        cleared: dict[str, int] = {}
        if reset or force:
            cleared = reset_report_operational_data(s)

        users = list(s.exec(select(User).where(User.active == True)).all())  # noqa: E712
        products = list(
            s.exec(select(Product).where(Product.active == True)).all(),  # noqa: E712
        )
        guest_rooms = list(
            s.exec(select(GuestRoom).where(GuestRoom.active == True)).all(),  # noqa: E712
        )
        hotel_locs = list(s.exec(select(HotelLocation)).all())
        if not users or not guest_rooms:
            return {"skipped": True, "reason": "missing_users_or_rooms", "cleared": cleared}

        hk_products = [p for p in products if p.department == "housekeeping" and not p.is_service]
        mt_products = [p for p in products if p.department == "maintenance" and not p.is_service]
        hk_services = [p for p in products if p.department == "housekeeping" and p.is_service]
        mt_services = [p for p in products if p.department == "maintenance" and p.is_service]
        fo_services = [p for p in products if p.department == "front_office" and p.is_service]
        bb_services = [p for p in products if p.department == "bell_boy" and p.is_service]
        stock_products = [p for p in products if not p.is_service and p.on_hand is not None]

        fo_staff = [
            u for u in users
            if u.department == "front_office" and u.role in ("frontdesk", "manager")
        ] or users[:3]
        bell_staff = [
            u for u in users
            if u.role == "bellboy"
            and u.department in ("bell_boy", "front_office")
        ]
        hk_staff = [
            u for u in users
            if u.department == "housekeeping"
            and u.role in ("housekeeper", "hk_supervisor", "manager")
        ]
        mt_staff = [
            u for u in users
            if u.department == "maintenance" and u.role == "maintenance"
        ]
        room_numbers = [r.number for r in guest_rooms]
        pa_codes = [loc.code for loc in hotel_locs if loc.code.startswith("HK-LOC-")]
        pa_code_set = set(pa_codes)
        hk_floor, hk_pa, mt_pool = _pick_assignee_pools(
            hk_staff=hk_staff, mt_staff=mt_staff, pa_codes=pa_code_set,
        )
        assignee_weights: dict[int, float] = {}
        for pool in (hk_floor, hk_pa, mt_pool, hk_staff, fo_staff, bell_staff):
            assignee_weights.update(_staff_workload_weights(pool))

        now = _utc_now()
        period_start = _demo_period_start()
        delivery_methods = ["ring_bell", "leave_at_door", "front_desk"]
        stock_reasons = ["restock", "count_adjust", "damaged", "expired"]

        created_requests = 0
        created_items = 0
        created_events = 0
        created_logs = 0
        created_stock = 0
        stock_from_deliveries = 0
        stock_auto_restock = 0
        code_seq: dict[str, int] = {}
        terminal_statuses = frozenset({"delivered", "cancelled"})

        day = period_start.replace(hour=0, minute=0, second=0, microsecond=0)
        end_day = now.replace(hour=23, minute=59, second=59, microsecond=0)
        days_since_commit = 0

        while day <= end_day:
            n_today = _requests_for_day(day)

            for _ in range(n_today):
                created_at = _pick_request_created_at(day, now)
                if created_at is None:
                    continue

                day_key = created_at.strftime("%m%d")
                code_seq[day_key] = code_seq.get(day_key, 0) + 1
                code = f"REQ-{day_key}-{code_seq[day_key]:03d}"

                dept_roll = RNG.random()
                if dept_roll < 0.035 and bb_services and bell_staff:
                    dept = "bell_boy"
                elif dept_roll < 0.07 and fo_services and fo_staff:
                    dept = "front_office"
                elif RNG.random() < 0.09 and mt_products and mt_staff:
                    dept = "maintenance"
                else:
                    dept = "housekeeping"
                priority = "rush" if RNG.random() < 0.18 else "normal"
                response_minutes = 10 if priority == "rush" else 15

                if dept == "maintenance":
                    room = RNG.choice(room_numbers)
                elif dept in ("front_office", "bell_boy"):
                    room = RNG.choice(room_numbers)
                elif RNG.random() < 0.07 and pa_codes:
                    room = RNG.choice(pa_codes)
                else:
                    room = RNG.choice(room_numbers)

                stock_pool = (
                    mt_products
                    if dept == "maintenance"
                    else hk_products
                    if dept == "housekeeping"
                    else []
                )
                product_ids: list[int] = []
                qty_map: dict[int, int] = {}
                if stock_pool:
                    k = min(len(stock_pool), RNG.randint(1, 3))
                    for prod in RNG.sample(stock_pool, k=k):
                        if prod.id is None:
                            continue
                        product_ids.append(prod.id)
                        qty_map[prod.id] = RNG.randint(1, 3 if day.month in (3, 4) else 2)

                items_text = (
                    items_text_for(s, product_ids, qty_map)
                    if product_ids
                    else "Guest service request"
                )

                creator = RNG.choice(fo_staff)
                terminal_roll = RNG.random()
                is_dnd_case = False
                if terminal_roll < 0.965:
                    status = "delivered"
                elif terminal_roll < 0.988:
                    status = "cancelled"
                else:
                    status = "cancelled"
                    is_dnd_case = True

                req = Request(
                    code=code,
                    room=room,
                    department=dept,
                    items_text=items_text,
                    status=status,
                    priority=priority,
                    delivery_method=RNG.choice(delivery_methods),
                    response_minutes=response_minutes,
                    created_by_id=creator.id,
                    created_at=created_at,
                    updated_at=created_at,
                )
                s.add(req)
                s.flush()
                created_requests += 1

                for pid, qty in qty_map.items():
                    s.add(RequestItem(request_id=req.id, product_id=pid, qty=qty))  # type: ignore[arg-type]
                    created_items += 1

                if dept == "front_office" and fo_services:
                    svc = RNG.choice(fo_services)
                    if svc.id is not None:
                        product_ids = [svc.id]
                        qty_map = {svc.id: 1}
                        items_text = items_text_for(s, product_ids, qty_map)
                        s.add(
                            RequestItem(
                                request_id=req.id,  # type: ignore[arg-type]
                                product_id=svc.id,
                                qty=1,
                            ),
                        )
                        created_items += 1
                elif dept == "bell_boy" and bb_services:
                    svc = RNG.choice(bb_services)
                    if svc.id is not None:
                        product_ids = [svc.id]
                        qty_map = {svc.id: 1}
                        items_text = items_text_for(s, product_ids, qty_map)
                        s.add(
                            RequestItem(
                                request_id=req.id,  # type: ignore[arg-type]
                                product_id=svc.id,
                                qty=1,
                            ),
                        )
                        created_items += 1
                else:
                    service_pool = mt_services if dept == "maintenance" else hk_services
                    if service_pool and RNG.random() < 0.14:
                        svc = RNG.choice(service_pool)
                        if svc.id is not None:
                            s.add(
                                RequestItem(
                                    request_id=req.id,  # type: ignore[arg-type]
                                    product_id=svc.id,
                                    qty=1,
                                ),
                            )
                            created_items += 1

                assignee = _pick_assignee(
                    dept=dept,
                    room=room,
                    hk_floor=hk_floor,
                    hk_pa=hk_pa,
                    mt_staff=mt_pool,
                    fo_staff=fo_staff,
                    bell_staff=bell_staff,
                    pa_codes=pa_code_set,
                    weights=assignee_weights,
                )
                assignee_id = assignee.id if assignee else None
                assignee_label = assignee.name if assignee else "System"
                assigned_at = created_at + timedelta(minutes=RNG.randint(1, 4))

                if assignee_id:
                    req.assignee_id = assignee_id
                    req.assignee_since = assigned_at

                _timeline(
                    s,
                    request_id=req.id,  # type: ignore[arg-type]
                    kind="created",
                    title="Request created",
                    at=created_at,
                    actor_id=creator.id,
                    actor_label=creator.name,
                    detail="Mode: auto-assign",
                )
                created_events += 1

                manual_assign = False
                if assignee_id:
                    if RNG.random() < 0.06:
                        manual_assign = True
                        _timeline(
                            s,
                            request_id=req.id,  # type: ignore[arg-type]
                            kind="accepted",
                            title=f"Manually assigned to {assignee_label}",
                            at=assigned_at,
                            actor_id=creator.id,
                            actor_label=creator.name,
                            detail="Supervisor override",
                        )
                    else:
                        _timeline(
                            s,
                            request_id=req.id,  # type: ignore[arg-type]
                            kind="auto_assigned",
                            title=f"Auto-assigned to {assignee_label}",
                            at=assigned_at,
                            actor_id=creator.id,
                            actor_label=creator.name,
                            detail="Nearest available staff",
                        )
                    created_events += 1

                    if RNG.random() < 0.055 and not manual_assign:
                        reassign_at = assigned_at + timedelta(minutes=RNG.randint(2, 8))
                        alt = _pick_assignee(
                            dept=dept,
                            room=room,
                            hk_floor=hk_floor,
                            hk_pa=hk_pa,
                            mt_staff=mt_pool,
                            fo_staff=fo_staff,
                            bell_staff=bell_staff,
                            pa_codes=pa_code_set,
                            weights=assignee_weights,
                            exclude_id=assignee_id,
                        )
                        if alt and alt.id != assignee_id:
                            assignee_id = alt.id
                            assignee_label = alt.name
                            req.assignee_id = assignee_id
                            req.assignee_since = reassign_at
                            assigned_at = reassign_at
                            _timeline(
                                s,
                                request_id=req.id,  # type: ignore[arg-type]
                                kind="reassigned",
                                title=f"Reassigned to {assignee_label}",
                                at=reassign_at,
                                actor_id=creator.id,
                                actor_label=creator.name,
                                detail=RNG.choice(
                                    [
                                        "Staff on break",
                                        "Workload balance",
                                        "Staff unavailable",
                                        "Equipment issue",
                                    ],
                                ),
                            )
                            created_events += 1

                if status == "delivered":
                    peak = day.month in (3, 4)
                    on_time_roll = RNG.random() > (0.11 if peak else 0.07)
                    if on_time_roll:
                        total_mins = RNG.uniform(
                            max(4.0, response_minutes * 0.4),
                            float(response_minutes) - RNG.uniform(0.4, 1.8),
                        )
                    else:
                        total_mins = RNG.uniform(
                            response_minutes + 2.0,
                            response_minutes + (28.0 if peak else 20.0),
                        )
                    delivered_at = created_at + timedelta(minutes=total_mins)
                    work_mins = max(5, int(total_mins * RNG.uniform(0.35, 0.55)))
                    started_at = delivered_at - timedelta(minutes=work_mins)
                    accepted_at = started_at - timedelta(minutes=RNG.randint(1, 4))
                    if accepted_at < assigned_at + timedelta(seconds=30):
                        accepted_at = assigned_at + timedelta(minutes=RNG.randint(0, 2))

                    if RNG.random() < 0.72:
                        _timeline(
                            s,
                            request_id=req.id,  # type: ignore[arg-type]
                            kind="accepted",
                            title="Accepted",
                            at=accepted_at,
                            actor_id=assignee_id,
                            actor_label=assignee_label,
                        )
                        created_events += 1

                    if RNG.random() < 0.05:
                        paused_at = started_at + timedelta(minutes=RNG.randint(8, 20))
                        resumed_at = paused_at + timedelta(minutes=RNG.randint(5, 15))
                        _timeline(
                            s,
                            request_id=req.id,  # type: ignore[arg-type]
                            kind="started",
                            title="Started work",
                            at=started_at,
                            actor_id=assignee_id,
                            actor_label=assignee_label,
                            detail="Picked up items",
                        )
                        _timeline(
                            s,
                            request_id=req.id,  # type: ignore[arg-type]
                            kind="paused",
                            title="Paused",
                            at=paused_at,
                            actor_id=assignee_id,
                            actor_label=assignee_label,
                            detail=RNG.choice(
                                ["Waiting for parts", "Guest interrupted", "Waiting for help"],
                            ),
                        )
                        _timeline(
                            s,
                            request_id=req.id,  # type: ignore[arg-type]
                            kind="resumed",
                            title="Resumed",
                            at=resumed_at,
                            actor_id=assignee_id,
                            actor_label=assignee_label,
                        )
                        started_at = resumed_at
                        created_events += 3
                    else:
                        _timeline(
                            s,
                            request_id=req.id,  # type: ignore[arg-type]
                            kind="started",
                            title="Started work",
                            at=started_at,
                            actor_id=assignee_id,
                            actor_label=assignee_label,
                            detail="Picked up items",
                        )
                        created_events += 1

                    req.delivered_at = delivered_at
                    req.updated_at = delivered_at
                    d, r = _deduct_stock_for_delivery(
                        s,
                        req,
                        at=delivered_at,
                        actor_id=assignee_id,
                        actor_label=assignee_label,
                    )
                    stock_from_deliveries += d
                    stock_auto_restock += r
                    _timeline(
                        s,
                        request_id=req.id,  # type: ignore[arg-type]
                        kind="delivered",
                        title="Delivered",
                        at=delivered_at,
                        actor_id=assignee_id,
                        actor_label=assignee_label,
                        detail="Handed over at door",
                    )
                    created_events += 1

                elif is_dnd_case:
                    dnd_at = created_at + timedelta(minutes=RNG.randint(12, 45))
                    cleared_at = dnd_at + timedelta(minutes=RNG.randint(15, 120))
                    req.cancelled_at = cleared_at
                    req.updated_at = cleared_at
                    req.dnd_reason = "Do not disturb"
                    _timeline(
                        s,
                        request_id=req.id,  # type: ignore[arg-type]
                        kind="dnd_reported",
                        title="Do not disturb",
                        at=dnd_at,
                        actor_id=assignee_id or creator.id,
                        actor_label=assignee_label if assignee_id else creator.name,
                    )
                    if RNG.random() < 0.55:
                        _timeline(
                            s,
                            request_id=req.id,  # type: ignore[arg-type]
                            kind="dnd_cleared",
                            title="Guest called — proceed",
                            at=cleared_at,
                            actor_id=creator.id,
                            actor_label=creator.name,
                        )
                        created_events += 1
                    else:
                        _timeline(
                            s,
                            request_id=req.id,  # type: ignore[arg-type]
                            kind="cancelled",
                            title="Cancelled",
                            at=cleared_at,
                            actor_id=creator.id,
                            actor_label=creator.name,
                            detail="Guest unreachable (DND)",
                        )
                        created_events += 1
                    created_events += 1

                elif status == "cancelled":
                    cancelled_at = created_at + timedelta(minutes=RNG.randint(8, 90))
                    req.cancelled_at = cancelled_at
                    req.updated_at = cancelled_at
                    cancel_detail = RNG.choices(
                        ["Guest request", "Stock unavailable", "Miscommunication"],
                        weights=[72, 18, 10],
                    )[0]
                    if "Stock" in cancel_detail:
                        req.pause_reason = "stockout"
                    elif "Miscommunication" in cancel_detail:
                        req.pause_reason = "other"
                    else:
                        req.pause_reason = "guest_request"
                    _timeline(
                        s,
                        request_id=req.id,  # type: ignore[arg-type]
                        kind="cancelled",
                        title="Cancelled",
                        at=cancelled_at,
                        actor_id=creator.id,
                        actor_label=creator.name,
                        detail=cancel_detail,
                    )
                    created_events += 1

                assert req.status in terminal_statuses, req.status
                s.add(req)

            days_since_commit += 1
            if days_since_commit >= _COMMIT_EVERY_DAYS:
                s.commit()
                days_since_commit = 0

            day += timedelta(days=1)

        if stock_products:
            restock_rounds = min(36, max(10, (now - period_start).days // 21))
            for _ in range(restock_rounds):
                if RNG.random() > 0.42:
                    continue
                at = _rand_dt_between(period_start, now)
                for _ in range(RNG.randint(1, 4)):
                    prod = RNG.choice(stock_products)
                    if prod.id is None:
                        continue
                    if RNG.random() < 0.55:
                        stock_auto_restock += _auto_restock_product(
                            s,
                            prod,
                            at=at,
                            actor_id=None,
                            actor_label="Inventory system",
                        )
                        continue
                    delta = RNG.choice([6, 10, 12, 16, 20])
                    before = prod.on_hand or 0
                    after = before + delta
                    prod.on_hand = after
                    s.add(prod)
                    s.add(
                        StockAdjustment(
                            product_id=prod.id,
                            product_sku=prod.sku,
                            product_name=prod.name,
                            delta=delta,
                            reason=RNG.choice(stock_reasons),
                            on_hand_before=before,
                            on_hand_after=after,
                            actor_id=None,
                            actor_label="Inventory system",
                            created_at=at,
                        ),
                    )
                    created_stock += 1

        log_users = [u for u in users if u.role not in ("admin",)][:50]
        log_sparse_before = now - timedelta(days=120)
        d = period_start
        while d <= now:
            if d.weekday() < 6:
                sparse = d < log_sparse_before
                for u in log_users:
                    if RNG.random() > (0.78 if sparse else 0.52):
                        continue
                    login_at = d.replace(
                        hour=RNG.randint(0, 2),
                        minute=RNG.randint(0, 59),
                        second=0,
                        microsecond=0,
                    )
                    if login_at > now:
                        continue
                    shift_h = RNG.randint(7, 10)
                    logout_at = login_at + timedelta(hours=shift_h, minutes=RNG.randint(0, 59))
                    if logout_at > now:
                        logout_at = now - timedelta(minutes=RNG.randint(10, 90))
                    for action, summary, at in (
                        ("auth.login", f"{u.name} signed in", login_at),
                        ("auth.logout", f"{u.name} signed out", logout_at),
                    ):
                        s.add(
                            ActivityLog(
                                actor_id=u.id,
                                actor_label=u.name,
                                action=action,
                                summary=summary,
                                created_at=at,
                            ),
                        )
                        created_logs += 1
            d += timedelta(days=1)

        stock_snapshot = _apply_final_stock_levels(stock_products)
        for prod in stock_products:
            s.add(prod)

        s.merge(AppSetting(key=SEED_MARKER_KEY, value=now.isoformat()))
        s.commit()

        total = s.exec(select(func.count(Request.id))).one() or 0
        open_count = s.exec(
            select(func.count(Request.id)).where(
                Request.status.in_(["pending", "assigned", "in_progress", "paused", "dnd"]),  # type: ignore[attr-defined]
            ),
        ).one() or 0
        delivered_count = s.exec(
            select(func.count(Request.id)).where(Request.status == "delivered"),
        ).one() or 0
        cancelled_count = s.exec(
            select(func.count(Request.id)).where(Request.status == "cancelled"),
        ).one() or 0
        service_lines = s.exec(
            select(func.count(RequestItem.id))
            .join(Product, Product.id == RequestItem.product_id)
            .where(Product.is_service == True),  # noqa: E712
        ).one() or 0
        return {
            "ok": True,
            "reset": bool(cleared),
            "cleared": cleared,
            "period_from": period_start.isoformat(),
            "period_to": now.isoformat(),
            "profile": "phuket_2025_2026_reports",
            "requests_created": created_requests,
            "request_items": created_items,
            "timeline_events": created_events,
            "activity_logs": created_logs,
            "stock_adjustments": created_stock + stock_from_deliveries + stock_auto_restock,
            "stock_from_deliveries": stock_from_deliveries,
            "stock_auto_restock": stock_auto_restock,
            "stock_end_snapshot": stock_snapshot,
            "total_requests": total,
            "delivered_count": delivered_count,
            "cancelled_count": cancelled_count,
            "open_requests": open_count,
            "service_line_items": service_lines,
            "assignee_weight_span": (
                round(min(assignee_weights.values()), 2),
                round(max(assignee_weights.values()), 2),
            )
            if assignee_weights
            else None,
        }
