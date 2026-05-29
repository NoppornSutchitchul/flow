"""Data queries for preset reports."""
from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any

from sqlmodel import Session, select

from ..models import (
    ActivityLog,
    Product,
    Request,
    RequestItem,
    StockAdjustment,
    TimelineEvent,
    User,
)
from ..schemas import StockAdjustmentRead


def _since(days: int) -> datetime:
    return datetime.utcnow() - timedelta(days=max(1, min(days, 365)))


AUTH_ACTIVITY_ACTIONS = ("auth.login", "auth.logout")


@dataclass
class ReportFilters:
    department: str | None = None
    status: str | None = None
    priority: str | None = None
    assignee_id: int | None = None
    action: str | None = None
    date_from: str | None = None  # YYYY-MM-DD (UTC calendar day)
    date_to: str | None = None
    compare_date_from: str | None = None
    compare_date_to: str | None = None
    limit: int = 100
    shift: str | None = None  # morning_early | morning_late | afternoon | night | all
    stock_status: str | None = None  # low | critical | out | all


def _parse_report_day(value: str, *, end_of_day: bool = False) -> datetime | None:
    try:
        base = datetime.strptime(value.strip()[:10], "%Y-%m-%d")
    except ValueError:
        return None
    if end_of_day:
        return base + timedelta(days=1) - timedelta(microseconds=1)
    return base


def _report_range(
    days: int,
    filters: ReportFilters | None,
) -> tuple[datetime, datetime]:
    now = datetime.utcnow()
    if filters and filters.date_from:
        start = _parse_report_day(filters.date_from)
        if start is None:
            return _since(days), now
        if filters.date_to:
            end = _parse_report_day(filters.date_to, end_of_day=True)
            if end is None:
                end = now
        else:
            end = _parse_report_day(filters.date_from, end_of_day=True) or now
        if end < start:
            start, end = end, start
        return start, end
    return _since(days), now


REPORT_MAX_RANGE_DAYS = 365


def _inclusive_calendar_days(from_iso: str, to_iso: str) -> int:
    start = _parse_report_day(from_iso)
    end = _parse_report_day(to_iso)
    if start is None or end is None:
        return 0
    if end < start:
        start, end = end, start
    return (end.date() - start.date()).days + 1


def validate_report_filter_ranges(filters: ReportFilters) -> None:
    """Reject report windows longer than one calendar year."""
    from fastapi import HTTPException

    if filters.date_from and filters.date_to:
        if _inclusive_calendar_days(filters.date_from, filters.date_to) > REPORT_MAX_RANGE_DAYS:
            raise HTTPException(400, "report date range must not exceed 365 days")
    if filters.compare_date_from and filters.compare_date_to:
        if (
            _inclusive_calendar_days(filters.compare_date_from, filters.compare_date_to)
            > REPORT_MAX_RANGE_DAYS
        ):
            raise HTTPException(400, "compare date range must not exceed 365 days")


def compare_period_range(
    filters: ReportFilters | None,
) -> tuple[datetime, datetime] | None:
    """Explicit comparison window (e.g. month-over-month period B)."""
    if not filters or not filters.compare_date_from or not filters.compare_date_to:
        return None
    start = _parse_report_day(filters.compare_date_from)
    end = _parse_report_day(filters.compare_date_to, end_of_day=True)
    if start is None or end is None:
        return None
    if end < start:
        start, end = end, start
    return start, end


def _request_matches(r: Request, filters: ReportFilters | None) -> bool:
    if not filters:
        return True
    if filters.department and filters.department != "all" and r.department != filters.department:
        return False
    if filters.status and filters.status != "all" and r.status != filters.status:
        return False
    if filters.priority and filters.priority != "all" and r.priority != filters.priority:
        return False
    if filters.assignee_id is not None and r.assignee_id != filters.assignee_id:
        return False
    return True


def _period_requests(
    s: Session,
    days: int,
    filters: ReportFilters | None = None,
) -> list[Request]:
    since, until = _report_range(days, filters)
    rows = list(
        s.exec(
            select(Request).where(
                Request.created_at >= since,
                Request.created_at <= until,
            ),
        ).all(),
    )
    if not filters:
        return rows
    return [r for r in rows if _request_matches(r, filters)]


def _effective_limit(filters: ReportFilters | None, default: int) -> int:
    if filters and filters.limit:
        return max(10, min(filters.limit, 500))
    return default


def _timeline_table_limit(filters: ReportFilters | None) -> int | None:
    """None = return every timeline row in the period (client paginates)."""
    if filters is None or filters.limit == 0:
        return None
    return max(10, filters.limit)


def _report_table_limit(filters: ReportFilters | None) -> int | None:
    """Shared row cap for report tables; 0 = no cap (client-side pagination)."""
    return _timeline_table_limit(filters)


def operations_overview(
    s: Session,
    days: int,
    filters: ReportFilters | None = None,
) -> dict[str, Any]:
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    since = _since(days)

    delivered_today = s.exec(
        select(Request).where(
            (Request.status == "delivered") & (Request.delivered_at >= today_start),
        ),
    ).all()
    durations = [
        (r.delivered_at - r.created_at).total_seconds() / 60
        for r in delivered_today
        if r.delivered_at
    ]
    avg_minutes = round(sum(durations) / len(durations), 1) if durations else 0.0

    all_today = s.exec(
        select(Request).where(Request.created_at >= today_start),
    ).all()
    overdue_today = sum(
        1
        for r in all_today
        if (r.delivered_at or datetime.utcnow()) - r.created_at
        > timedelta(minutes=r.response_minutes)
    )

    period_requests = _period_requests(s, days, filters)

    rows = s.exec(
        select(RequestItem, Product, Request)
        .join(Product, Product.id == RequestItem.product_id)
        .join(Request, Request.id == RequestItem.request_id)
        .where(Request.created_at >= since),
    ).all()
    item_counter: Counter[str] = Counter()
    for ri, p, _r in rows:
        item_counter[p.name] += ri.qty

    buckets: dict[str, int] = defaultdict(int)
    for r in period_requests:
        buckets[r.created_at.strftime("%m-%d")] += 1
    daily_volume = [
        {
            "date": (datetime.utcnow() - timedelta(days=i)).strftime("%m-%d"),
            "count": buckets.get(
                (datetime.utcnow() - timedelta(days=i)).strftime("%m-%d"),
                0,
            ),
        }
        for i in reversed(range(days))
    ]

    stock_rows = s.exec(
        select(StockAdjustment)
        .where(StockAdjustment.created_at >= since)
        .order_by(StockAdjustment.created_at.desc(), StockAdjustment.id.desc())
        .limit(50),
    ).all()

    return {
        "avg_delivery_minutes": avg_minutes,
        "delivered_today": len(delivered_today),
        "overdue_today": overdue_today,
        "requests_by_dept": dict(Counter(r.department for r in period_requests)),
        "requests_by_status": dict(Counter(r.status for r in period_requests)),
        "top_items": [
            {"name": n, "qty": q} for n, q in item_counter.most_common(10)
        ],
        "daily_volume": daily_volume,
        "stock_adjustments": [
            StockAdjustmentRead(
                id=row.id,
                product_sku=row.product_sku,
                product_name=row.product_name,
                delta=row.delta,
                reason=row.reason,
                on_hand_before=row.on_hand_before,
                on_hand_after=row.on_hand_after,
                actor_label=row.actor_label,
                created_at=row.created_at,
            ).model_dump()
            for row in stock_rows
        ],
        "period_days": days,
    }


def top_items(
    s: Session,
    days: int,
    filters: ReportFilters | None = None,
    limit: int = 20,
) -> dict[str, Any]:
    since = _since(days)
    rows = s.exec(
        select(RequestItem, Product, Request)
        .join(Product, Product.id == RequestItem.product_id)
        .join(Request, Request.id == RequestItem.request_id)
        .where(Request.created_at >= since),
    ).all()
    if filters:
        rows = [(ri, p, r) for ri, p, r in rows if _request_matches(r, filters)]
    limit = _effective_limit(filters, limit)
    item_counter: Counter[str] = Counter()
    sku_map: dict[str, str] = {}
    for ri, p, _r in rows:
        item_counter[p.name] += ri.qty
        sku_map[p.name] = p.sku
    items = [
        {"name": n, "sku": sku_map.get(n), "qty": q}
        for n, q in item_counter.most_common(limit)
    ]
    return {"items": items, "period_days": days}


def busy_periods(
    s: Session,
    days: int,
    filters: ReportFilters | None = None,
) -> dict[str, Any]:
    requests = _period_requests(s, days, filters)
    by_hour: Counter[int] = Counter()
    by_weekday: Counter[int] = Counter()
    for r in requests:
        by_hour[r.created_at.hour] += 1
        by_weekday[r.created_at.weekday()] += 1
    weekday_labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    return {
        "by_hour": [
            {"hour": h, "count": by_hour.get(h, 0)} for h in range(24)
        ],
        "by_weekday": [
            {"weekday": weekday_labels[d], "count": by_weekday.get(d, 0)}
            for d in range(7)
        ],
        "peak_hour": max(by_hour, key=by_hour.get) if by_hour else None,
        "total": len(requests),
        "period_days": days,
    }


def staff_workload(
    s: Session,
    days: int,
    filters: ReportFilters | None = None,
) -> dict[str, Any]:
    users = {u.id: u for u in s.exec(select(User)).all()}
    period = _period_requests(s, days, filters)
    delivered = [r for r in period if r.status == "delivered" and r.assignee_id is not None]
    open_statuses = ("assigned", "in_progress", "paused")
    open_rows = [r for r in period if r.status in open_statuses]

    stats: dict[int, dict[str, Any]] = defaultdict(
        lambda: {"delivered": 0, "open": 0, "minutes": []},
    )
    for r in delivered:
        if r.assignee_id is None:
            continue
        stats[r.assignee_id]["delivered"] += 1
        if r.delivered_at:
            stats[r.assignee_id]["minutes"].append(
                (r.delivered_at - r.created_at).total_seconds() / 60,
            )
    for r in open_rows:
        if r.assignee_id is None:
            continue
        stats[r.assignee_id]["open"] += 1

    rows = []
    for uid, st in stats.items():
        u = users.get(uid)
        if not u:
            continue
        mins = st["minutes"]
        rows.append(
            {
                "user_id": uid,
                "name": u.name,
                "department": u.department,
                "delivered": st["delivered"],
                "open": st["open"],
                "avg_delivery_minutes": round(sum(mins) / len(mins), 1) if mins else 0,
            },
        )
    rows.sort(key=lambda x: (-x["delivered"], -x["open"]))
    return {"staff": rows, "period_days": days}


def activity_log_report(
    s: Session,
    days: int,
    filters: ReportFilters | None = None,
    limit: int = 200,
) -> dict[str, Any]:
    since, until = _report_range(days, filters)
    limit = _effective_limit(filters, limit)
    q = (
        select(ActivityLog)
        .where(
            ActivityLog.created_at >= since,
            ActivityLog.created_at <= until,
            ActivityLog.action.in_(AUTH_ACTIVITY_ACTIONS),  # type: ignore[attr-defined]
        )
        .order_by(ActivityLog.created_at.desc(), ActivityLog.id.desc())
    )
    logs = s.exec(q.limit(limit)).all()
    return {
        "entries": [
            {
                "id": row.id,
                "created_at": row.created_at.isoformat(),
                "actor_label": row.actor_label or "—",
                "action": row.action,
                "summary": row.summary,
            }
            for row in logs
        ],
        "period_days": days,
        "range_from": since.isoformat(),
        "range_to": until.isoformat(),
    }


def stock_movements(
    s: Session,
    days: int,
    filters: ReportFilters | None = None,
    limit: int = 100,
) -> dict[str, Any]:
    since = _since(days)
    limit = _effective_limit(filters, limit)
    stock_rows = s.exec(
        select(StockAdjustment)
        .where(StockAdjustment.created_at >= since)
        .order_by(StockAdjustment.created_at.desc(), StockAdjustment.id.desc())
        .limit(limit * 3),
    ).all()
    if filters and filters.department and filters.department != "all":
        products = {p.id: p for p in s.exec(select(Product)).all()}
        stock_rows = [
            row
            for row in stock_rows
            if products.get(row.product_id)
            and products[row.product_id].department == filters.department
        ]
    stock_rows = stock_rows[:limit]
    return {
        "adjustments": [
            StockAdjustmentRead(
                id=row.id,
                product_sku=row.product_sku,
                product_name=row.product_name,
                delta=row.delta,
                reason=row.reason,
                on_hand_before=row.on_hand_before,
                on_hand_after=row.on_hand_after,
                actor_label=row.actor_label,
                created_at=row.created_at,
            ).model_dump()
            for row in stock_rows
        ],
        "period_days": days,
    }


def _pct_change(current: int, previous: int) -> float:
    if previous == 0:
        return 100.0 if current > 0 else 0.0
    return round((current - previous) / previous * 100, 1)


def _filter_by_department(requests: list[Request], department: str | None) -> list[Request]:
    if not department or department == "all":
        return requests
    return [r for r in requests if r.department == department]


def executive_dashboard(
    s: Session,
    days: int,
    filters: ReportFilters | None = None,
) -> dict[str, Any]:
    """Executive summary: KPIs, trends, forecast, multi-dimensional breakdowns."""
    department = filters.department if filters else None
    now = datetime.utcnow()
    since = _since(days)
    prev_start = since - timedelta(days=days)

    period_all = list(
        s.exec(select(Request).where(Request.created_at >= since)).all(),
    )
    prev_all = list(
        s.exec(
            select(Request).where(
                Request.created_at >= prev_start,
                Request.created_at < since,
            ),
        ).all(),
    )
    period_requests = _filter_by_department(period_all, department)
    prev_requests = _filter_by_department(prev_all, department)
    if filters:
        period_requests = [r for r in period_requests if _request_matches(r, filters)]
        prev_requests = [r for r in prev_requests if _request_matches(r, filters)]

    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_requests = [r for r in period_requests if r.created_at >= today_start]

    delivered = [r for r in period_requests if r.status == "delivered"]
    delivered_prev = [r for r in prev_requests if r.status == "delivered"]
    durations = [
        (r.delivered_at - r.created_at).total_seconds() / 60
        for r in delivered
        if r.delivered_at
    ]
    avg_delivery = round(sum(durations) / len(durations), 1) if durations else 0.0

    open_statuses = ("pending", "assigned", "in_progress", "paused")
    open_count = sum(1 for r in period_requests if r.status in open_statuses)
    overdue = sum(
        1
        for r in period_requests
        if r.status not in ("delivered", "cancelled", "dnd")
        and (now - r.created_at) > timedelta(minutes=r.response_minutes)
    )
    rush_count = sum(1 for r in period_requests if r.priority == "rush")
    completion_rate = (
        round(len(delivered) / len(period_requests) * 100, 1)
        if period_requests
        else 0.0
    )

    buckets: dict[str, int] = defaultdict(int)
    for r in period_requests:
        buckets[r.created_at.strftime("%m-%d")] += 1
    daily_volume = [
        {
            "date": (now - timedelta(days=i)).strftime("%m-%d"),
            "count": buckets.get(
                (now - timedelta(days=i)).strftime("%m-%d"),
                0,
            ),
        }
        for i in reversed(range(min(days, 30)))
    ]
    last7 = [d["count"] for d in daily_volume[-7:]]
    avg_daily = sum(last7) / len(last7) if last7 else 0.0
    trend_slope = (
        (last7[-1] - last7[0]) / max(len(last7) - 1, 1) if len(last7) >= 2 else 0.0
    )
    forecast_daily = max(0, round(avg_daily + trend_slope))
    forecast_week = forecast_daily * 7

    by_hour = Counter(r.created_at.hour for r in period_requests)
    weekday_labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    by_weekday = [
        {"weekday": weekday_labels[d], "count": sum(
            1 for r in period_requests if r.created_at.weekday() == d
        )}
        for d in range(7)
    ]
    by_hour_list = [{"hour": h, "count": by_hour.get(h, 0)} for h in range(24)]

    item_rows = s.exec(
        select(RequestItem, Product, Request)
        .join(Product, Product.id == RequestItem.product_id)
        .join(Request, Request.id == RequestItem.request_id)
        .where(Request.created_at >= since),
    ).all()
    if department and department != "all":
        item_rows = [(ri, p, r) for ri, p, r in item_rows if r.department == department]
    item_counter: Counter[str] = Counter()
    sku_map: dict[str, str] = {}
    for ri, p, _r in item_rows:
        item_counter[p.name] += ri.qty
        sku_map[p.name] = p.sku

    staff_data = staff_workload(s, days, filters)["staff"]
    if department and department != "all":
        staff_data = [row for row in staff_data if row.get("department") == department]

    stock_rows = s.exec(
        select(StockAdjustment).where(StockAdjustment.created_at >= since),
    ).all()
    net_stock_delta = sum(r.delta for r in stock_rows)

    dept_options = sorted({r.department for r in period_all if r.department})

    insights: list[dict[str, Any]] = []
    vol_change = _pct_change(len(period_requests), len(prev_requests))
    if vol_change > 15:
        insights.append({"level": "warning", "code": "volume_up", "value": vol_change})
    elif vol_change < -15:
        insights.append({"level": "info", "code": "volume_down", "value": vol_change})
    if overdue >= 3:
        insights.append({"level": "warning", "code": "overdue", "value": overdue})
    if by_hour:
        peak = max(by_hour, key=by_hour.get)
        insights.append({"level": "info", "code": "peak_hour", "value": peak})
    if completion_rate < 70 and period_requests:
        insights.append({"level": "warning", "code": "low_completion", "value": completion_rate})
    if rush_count > len(period_requests) * 0.2 and period_requests:
        insights.append({"level": "warning", "code": "high_rush", "value": rush_count})
    if forecast_week > len(period_requests) * 1.1 and period_requests:
        insights.append({"level": "info", "code": "forecast_up", "value": forecast_week})

    return {
        "period_days": days,
        "filter_department": department or "all",
        "generated_at": now.isoformat(),
        "departments": dept_options,
        "kpis": {
            "total_requests": len(period_requests),
            "delivered": len(delivered),
            "open": open_count,
            "overdue": overdue,
            "rush": rush_count,
            "completion_rate": completion_rate,
            "avg_delivery_minutes": avg_delivery,
            "delivered_today": sum(1 for r in today_requests if r.status == "delivered"),
            "requests_today": len(today_requests),
            "net_stock_delta": net_stock_delta,
        },
        "trends": {
            "total_requests_pct": vol_change,
            "delivered_pct": _pct_change(len(delivered), len(delivered_prev)),
            "avg_delivery_pct": 0.0,
        },
        "forecast": {
            "daily_requests": forecast_daily,
            "weekly_requests": forecast_week,
            "trend_slope": round(trend_slope, 2),
        },
        "dimensions": {
            "by_department": dict(Counter(r.department for r in period_requests)),
            "by_status": dict(Counter(r.status for r in period_requests)),
            "by_priority": dict(Counter(r.priority for r in period_requests)),
            "by_hour": by_hour_list,
            "by_weekday": by_weekday,
        },
        "daily_volume": daily_volume,
        "top_items": [
            {"name": n, "sku": sku_map.get(n), "qty": q}
            for n, q in item_counter.most_common(8)
        ],
        "staff_top": staff_data[:8],
        "insights": insights,
        "recent_timeline": request_timeline_audit(
            s, days, filters, limit=_effective_limit(filters, 100)
        )["events"],
    }


def request_timeline_audit(
    s: Session,
    days: int,
    filters: ReportFilters | None = None,
    limit: int = 150,
) -> dict[str, Any]:
    since, until = _report_range(days, filters)
    limit = _effective_limit(filters, limit)
    allowed_ids: set[int] | None = None
    if filters and (
        (filters.department and filters.department != "all")
        or (filters.status and filters.status != "all")
        or (filters.priority and filters.priority != "all")
        or filters.assignee_id is not None
    ):
        allowed_ids = {r.id for r in _period_requests(s, days, filters) if r.id is not None}
    events = s.exec(
        select(TimelineEvent)
        .where(
            TimelineEvent.created_at >= since,
            TimelineEvent.created_at <= until,
        )
        .order_by(TimelineEvent.created_at.desc(), TimelineEvent.id.desc())
        .limit(limit * 4),
    ).all()
    if allowed_ids is not None:
        events = [e for e in events if e.request_id in allowed_ids]
    events = events[:limit]
    req_codes: dict[int, str] = {}
    if events:
        req_ids = list({e.request_id for e in events})
        if req_ids:
            for r in s.exec(select(Request).where(Request.id.in_(req_ids))).all():  # type: ignore[attr-defined]
                req_codes[r.id] = r.code
    return {
        "events": [
            {
                "created_at": e.created_at.isoformat(),
                "request_code": req_codes.get(e.request_id, f"#{e.request_id}"),
                "kind": e.kind,
                "title": e.title,
                "detail": e.detail,
                "actor_label": e.actor_label or "—",
            }
            for e in events
        ],
        "period_days": days,
        "range_from": since.isoformat(),
        "range_to": until.isoformat(),
    }


def sla_performance(
    s: Session,
    days: int,
    filters: ReportFilters | None = None,
) -> dict[str, Any]:
    now = datetime.utcnow()
    requests = _period_requests(s, days, filters)
    delivered = [r for r in requests if r.status == "delivered" and r.delivered_at]
    durations = [
        (r.delivered_at - r.created_at).total_seconds() / 60
        for r in delivered
        if r.delivered_at
    ]
    on_time = sum(
        1
        for r in delivered
        if r.delivered_at
        and (r.delivered_at - r.created_at).total_seconds() / 60 <= r.response_minutes
    )
    overdue_open = sum(
        1
        for r in requests
        if r.status not in ("delivered", "cancelled", "dnd")
        and (now - r.created_at) > timedelta(minutes=r.response_minutes)
    )
    by_dept: dict[str, dict[str, Any]] = {}
    for dept, group in Counter(r.department for r in requests).items():
        sub = [r for r in requests if r.department == dept]
        sub_del = [r for r in sub if r.status == "delivered" and r.delivered_at]
        sub_on = sum(
            1
            for r in sub_del
            if (r.delivered_at - r.created_at).total_seconds() / 60 <= r.response_minutes
        )
        by_dept[dept] = {
            "total": len(sub),
            "delivered": len(sub_del),
            "on_time_rate": round(sub_on / len(sub_del) * 100, 1) if sub_del else 0.0,
        }
    return {
        "period_days": days,
        "total": len(requests),
        "delivered": len(delivered),
        "on_time_count": on_time,
        "on_time_rate": round(on_time / len(delivered) * 100, 1) if delivered else 0.0,
        "avg_delivery_minutes": round(sum(durations) / len(durations), 1) if durations else 0.0,
        "overdue_open": overdue_open,
        "by_department": by_dept,
    }


def status_breakdown(
    s: Session,
    days: int,
    filters: ReportFilters | None = None,
) -> dict[str, Any]:
    requests = _period_requests(s, days, filters)
    return {
        "period_days": days,
        "total": len(requests),
        "by_status": dict(Counter(r.status for r in requests)),
        "by_priority": dict(Counter(r.priority for r in requests)),
        "by_delivery_method": dict(Counter(r.delivery_method for r in requests)),
    }


def priority_analysis(
    s: Session,
    days: int,
    filters: ReportFilters | None = None,
) -> dict[str, Any]:
    requests = _period_requests(s, days, filters)
    normal = [r for r in requests if r.priority == "normal"]
    rush = [r for r in requests if r.priority == "rush"]

    def _avg_delivered(sub: list[Request]) -> float:
        done = [r for r in sub if r.status == "delivered" and r.delivered_at]
        if not done:
            return 0.0
        mins = [
            (r.delivered_at - r.created_at).total_seconds() / 60
            for r in done
            if r.delivered_at
        ]
        return round(sum(mins) / len(mins), 1)

    return {
        "period_days": days,
        "total": len(requests),
        "rush_count": len(rush),
        "normal_count": len(normal),
        "rush_pct": round(len(rush) / len(requests) * 100, 1) if requests else 0.0,
        "rush_avg_minutes": _avg_delivered(rush),
        "normal_avg_minutes": _avg_delivered(normal),
        "rush_by_status": dict(Counter(r.status for r in rush)),
        "normal_by_status": dict(Counter(r.status for r in normal)),
    }


def department_comparison(
    s: Session,
    days: int,
    filters: ReportFilters | None = None,
) -> dict[str, Any]:
    base = ReportFilters(
        status=filters.status if filters else None,
        priority=filters.priority if filters else None,
        assignee_id=filters.assignee_id if filters else None,
        action=filters.action if filters else None,
        limit=filters.limit if filters else 100,
    )
    requests = _period_requests(s, days, base)
    rows = []
    for dept in sorted({r.department for r in requests}):
        sub = [r for r in requests if r.department == dept]
        delivered = [r for r in sub if r.status == "delivered"]
        rows.append(
            {
                "department": dept,
                "total": len(sub),
                "delivered": len(delivered),
                "open": sum(
                    1
                    for r in sub
                    if r.status in ("pending", "assigned", "in_progress", "paused")
                ),
                "cancelled": sum(1 for r in sub if r.status in ("cancelled", "dnd")),
                "rush": sum(1 for r in sub if r.priority == "rush"),
            },
        )
    rows.sort(key=lambda x: -x["total"])
    return {"period_days": days, "departments": rows}


def room_demand(
    s: Session,
    days: int,
    filters: ReportFilters | None = None,
) -> dict[str, Any]:
    requests = _period_requests(s, days, filters)
    counter = Counter(r.room for r in requests if r.room)
    rooms = [
        {"room": room, "count": count}
        for room, count in counter.most_common(40)
    ]
    return {"period_days": days, "total": len(requests), "rooms": rooms}


def cancellation_summary(
    s: Session,
    days: int,
    filters: ReportFilters | None = None,
) -> dict[str, Any]:
    requests = _period_requests(s, days, filters)
    cancelled = sum(1 for r in requests if r.status == "cancelled")
    dnd = sum(1 for r in requests if r.status == "dnd")
    delivered = sum(1 for r in requests if r.status == "delivered")
    total = len(requests)
    return {
        "period_days": days,
        "total": total,
        "delivered": delivered,
        "cancelled": cancelled,
        "dnd": dnd,
        "cancel_rate": round(cancelled / total * 100, 1) if total else 0.0,
        "dnd_rate": round(dnd / total * 100, 1) if total else 0.0,
        "by_department": {
            dept: {
                "cancelled": sum(
                    1 for r in requests if r.department == dept and r.status == "cancelled"
                ),
                "dnd": sum(
                    1 for r in requests if r.department == dept and r.status == "dnd"
                ),
            }
            for dept in sorted({r.department for r in requests})
        },
    }


def volume_trend(
    s: Session,
    days: int,
    filters: ReportFilters | None = None,
) -> dict[str, Any]:
    now = datetime.utcnow()
    requests = _period_requests(s, days, filters)
    buckets: dict[str, int] = defaultdict(int)
    for r in requests:
        buckets[r.created_at.strftime("%m-%d")] += 1
    daily = [
        {
            "date": (now - timedelta(days=i)).strftime("%m-%d"),
            "count": buckets.get((now - timedelta(days=i)).strftime("%m-%d"), 0),
        }
        for i in reversed(range(min(days, 90)))
    ]
    counts = [d["count"] for d in daily]
    avg = round(sum(counts) / len(counts), 1) if counts else 0.0
    peak = max(counts) if counts else 0
    return {
        "period_days": days,
        "total": len(requests),
        "daily_volume": daily,
        "avg_daily": avg,
        "peak_daily": peak,
    }


def inventory_health(
    s: Session,
    days: int,
    filters: ReportFilters | None = None,
) -> dict[str, Any]:
    products = list(s.exec(select(Product).where(Product.active == True)).all())  # noqa: E712
    if filters and filters.department and filters.department != "all":
        products = [p for p in products if p.department == filters.department]
    low = []
    out = []
    for p in products:
        if p.is_service or p.on_hand is None:
            continue
        reorder = p.reorder_at if p.reorder_at is not None else 0
        if p.on_hand <= 0:
            out.append(p)
        elif p.on_hand <= reorder:
            low.append(p)
    since = _since(days)
    movements = s.exec(
        select(StockAdjustment).where(StockAdjustment.created_at >= since),
    ).all()
    net_delta = sum(m.delta for m in movements)
    return {
        "period_days": days,
        "low_stock": [
            {
                "sku": p.sku,
                "name": p.name,
                "on_hand": p.on_hand,
                "reorder_at": p.reorder_at,
                "department": p.department,
            }
            for p in sorted(low, key=lambda x: x.on_hand or 0)[:50]
        ],
        "out_of_stock": [
            {
                "sku": p.sku,
                "name": p.name,
                "department": p.department,
            }
            for p in out[:30]
        ],
        "net_stock_delta": net_delta,
        "movement_count": len(movements),
    }


def delivery_methods(
    s: Session,
    days: int,
    filters: ReportFilters | None = None,
) -> dict[str, Any]:
    requests = _period_requests(s, days, filters)
    by_method = dict(Counter(r.delivery_method for r in requests))
    return {
        "period_days": days,
        "total": len(requests),
        "by_method": by_method,
    }


PRESET_HANDLERS = {
    "executive-dashboard": executive_dashboard,
    "operations-overview": operations_overview,
    "sla-performance": sla_performance,
    "status-breakdown": status_breakdown,
    "priority-analysis": priority_analysis,
    "department-comparison": department_comparison,
    "volume-trend": volume_trend,
    "top-items": top_items,
    "busy-periods": busy_periods,
    "room-demand": room_demand,
    "cancellation-summary": cancellation_summary,
    "delivery-methods": delivery_methods,
    "staff-workload": staff_workload,
    "activity-log": activity_log_report,
    "stock-movements": stock_movements,
    "inventory-health": inventory_health,
    "request-timeline": request_timeline_audit,
}

from .report_presets_brs import BRS_CATALOG, BRS_HANDLERS  # noqa: E402

PRESET_HANDLERS.update(BRS_HANDLERS)
PRESET_CATALOG: list[dict[str, str]] = list(BRS_CATALOG)
