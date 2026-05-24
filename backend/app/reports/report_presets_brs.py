"""Seventeen hotel analytics reports (BRS)."""
from __future__ import annotations

from collections import Counter, defaultdict
from datetime import date, datetime, timedelta
from typing import Any

from sqlmodel import Session, select

from ..models import Product, Request, RequestItem, StockAdjustment, TimelineEvent, User
from .report_queries import (
    ReportFilters,
    compare_period_range,
    _effective_limit,
    _report_table_limit,
    _timeline_table_limit,
    _period_requests,
    _report_range,
    _request_matches,
)
from ..schemas import StockAdjustmentRead

SHIFT_BUCKETS = {
    "morning_early": (6, 10),
    "morning_late": (10, 14),
    "afternoon": (14, 18),
    "night": (18, 6),  # wraps midnight
}


def _shift_label(hour: int) -> str:
    if 6 <= hour < 10:
        return "morning_early"
    if 10 <= hour < 14:
        return "morning_late"
    if 14 <= hour < 18:
        return "afternoon"
    return "night"


def _request_display_name(r: Request) -> str:
    """Human-readable label for reports (location + items, not REQ code)."""
    items = (r.items_text or "").strip()
    loc = (r.room or "").strip()
    if loc and items:
        return f"{loc} · {items}"
    return items or loc or r.code


def _matches_shift(created_at: datetime, shift: str | None) -> bool:
    if not shift or shift == "all":
        return True
    h = created_at.hour
    if shift not in SHIFT_BUCKETS:
        return True
    start, end = SHIFT_BUCKETS[shift]
    if start < end:
        return start <= h < end
    return h >= start or h < end


def _filter_requests(requests: list[Request], filters: ReportFilters | None) -> list[Request]:
    if not filters:
        return requests
    out = [r for r in requests if _request_matches(r, filters)]
    if filters.shift and filters.shift != "all":
        out = [r for r in out if _matches_shift(r.created_at, filters.shift)]
    return out


def _timeline_map(s: Session, request_ids: list[int]) -> dict[int, list[TimelineEvent]]:
    if not request_ids:
        return {}
    rows = s.exec(
        select(TimelineEvent).where(TimelineEvent.request_id.in_(request_ids)),  # type: ignore[attr-defined]
    ).all()
    m: dict[int, list[TimelineEvent]] = defaultdict(list)
    for e in rows:
        m[e.request_id].append(e)
    for rid in m:
        m[rid].sort(key=lambda x: x.created_at)
    return m


def _event_at(events: list[TimelineEvent], kind: str) -> datetime | None:
    for e in events:
        if e.kind == kind:
            return e.created_at
    return None


def _minutes_between(a: datetime | None, b: datetime | None) -> float | None:
    if not a or not b:
        return None
    return max(0.0, (b - a).total_seconds() / 60)


def _percentile(vals: list[float], p: float) -> float:
    if not vals:
        return 0.0
    s = sorted(vals)
    k = (len(s) - 1) * (p / 100)
    f = int(k)
    c = min(f + 1, len(s) - 1)
    return round(s[f] + (s[c] - s[f]) * (k - f), 1)


def _prev_period_range(days: int, filters: ReportFilters | None) -> tuple[datetime, datetime]:
    since, until = _report_range(days, filters)
    span = until - since
    prev_until = since - timedelta(seconds=1)
    prev_since = prev_until - span
    return prev_since, prev_until


def _metric_delta(current: float, previous: float) -> dict[str, float]:
    delta = round(current - previous, 1)
    pct = round((current - previous) / previous * 100, 1) if previous else (0.0 if current == 0 else 100.0)
    return {"current": current, "previous": previous, "delta": delta, "delta_pct": pct}


def _iso_week_period(dt: datetime) -> str:
    """Sortable period key for ISO calendar week."""
    year, week, _ = dt.isocalendar()
    return f"{year}-W{week:02d}"


def _iso_week_date_bounds(period_key: str) -> tuple[str, str]:
    """Monday–Sunday ISO week as YYYY-MM-DD strings."""
    year_s, week_s = period_key.split("-W", 1)
    year, week = int(year_s), int(week_s)
    start = date.fromisocalendar(year, week, 1)
    end = date.fromisocalendar(year, week, 7)
    return start.isoformat(), end.isoformat()


def _period_meta(days: int, filters: ReportFilters | None) -> dict[str, str]:
    since, until = _report_range(days, filters)
    return {
        "period_days": str(days),
        "range_from": since.isoformat(),
        "range_to": until.isoformat(),
        "generated_at": datetime.utcnow().isoformat(),
    }


def sla_compliance_report(s: Session, days: int, filters: ReportFilters | None = None) -> dict[str, Any]:
    requests = _filter_requests(_period_requests(s, days, filters), filters)
    delivered = [r for r in requests if r.status == "delivered" and r.delivered_at]
    breaches: list[float] = []
    on_time = 0
    by_dept: dict[str, dict[str, Any]] = {}

    for r in delivered:
        if not r.delivered_at:
            continue
        mins = (r.delivered_at - r.created_at).total_seconds() / 60
        if mins <= r.response_minutes:
            on_time += 1
        else:
            breaches.append(mins - r.response_minutes)

    for dept in set(r.department for r in requests):
        sub_del = [
            r for r in delivered
            if r.department == dept and r.delivered_at
        ]
        sub_on = sum(
            1
            for r in sub_del
            if (r.delivered_at - r.created_at).total_seconds() / 60 <= r.response_minutes
        )
        by_dept[dept] = {
            "total": len([r for r in requests if r.department == dept]),
            "delivered": len(sub_del),
            "on_time": sub_on,
            "breached": len(sub_del) - sub_on,
            "compliance_rate": round(sub_on / len(sub_del) * 100, 2) if sub_del else 0.0,
            "avg_breach_minutes": round(
                sum(
                    max(
                        0,
                        (r.delivered_at - r.created_at).total_seconds() / 60 - r.response_minutes,
                    )
                    for r in sub_del
                    if (r.delivered_at - r.created_at).total_seconds() / 60 > r.response_minutes
                )
                / max(1, len(sub_del) - sub_on),
                1,
            ),
        }

    rate = round(on_time / len(delivered) * 100, 2) if delivered else 0.0

    breached_rows: list[dict[str, Any]] = []
    delivered_rows: list[dict[str, Any]] = []
    for r in delivered:
        if not r.delivered_at:
            continue
        mins = round((r.delivered_at - r.created_at).total_seconds() / 60, 1)
        sla = r.response_minutes
        over = round(max(0.0, mins - sla), 1)
        base = {
            "id": r.id,
            "code": r.code,
            "name": _request_display_name(r),
            "department": r.department,
            "delivered_at": r.delivered_at.isoformat(),
            "total_minutes": mins,
            "sla_minutes": sla,
            "breach_minutes": over,
            "on_time": over <= 0,
        }
        delivered_rows.append(base)
        if over > 0:
            breached_rows.append(base)

    breached_rows.sort(key=lambda x: (-x["breach_minutes"], x["delivered_at"]))
    delivered_rows.sort(key=lambda x: x["delivered_at"], reverse=True)
    table_limit = _report_table_limit(filters)
    breach_table = breached_rows if table_limit is None else breached_rows[:table_limit]
    delivered_table = delivered_rows if table_limit is None else delivered_rows[:table_limit]

    weekly: dict[str, dict[str, int]] = defaultdict(lambda: {"on": 0, "total": 0})
    for r in delivered:
        if not r.delivered_at:
            continue
        wk = _iso_week_period(r.delivered_at)
        weekly[wk]["total"] += 1
        mins = (r.delivered_at - r.created_at).total_seconds() / 60
        if mins <= r.response_minutes:
            weekly[wk]["on"] += 1
    weekly_trend = []
    for wk, v in sorted(weekly.items()):
        week_start, week_end = _iso_week_date_bounds(wk)
        weekly_trend.append(
            {
                "period": wk,
                "week_start": week_start,
                "week_end": week_end,
                "on_time": v["on"],
                "breached": v["total"] - v["on"],
                "rate": round(v["on"] / v["total"] * 100, 1),
                "total": v["total"],
            },
        )

    dept_table = sorted(
        [
            {
                "department": dept,
                **vals,
                "breach_rate": round(
                    (vals["breached"] / vals["delivered"] * 100) if vals["delivered"] else 0.0,
                    1,
                ),
            }
            for dept, vals in by_dept.items()
        ],
        key=lambda x: x["compliance_rate"],
    )

    prev_since, prev_until = _prev_period_range(days, filters)
    prev_rows = list(
        s.exec(
            select(Request).where(
                Request.created_at >= prev_since,
                Request.created_at <= prev_until,
                Request.status == "delivered",
            ),
        ).all(),
    )
    if filters:
        prev_rows = [r for r in prev_rows if _request_matches(r, filters)]
    prev_on = sum(
        1
        for r in prev_rows
        if r.delivered_at
        and (r.delivered_at - r.created_at).total_seconds() / 60 <= r.response_minutes
    )
    prev_rate = round(prev_on / len(prev_rows) * 100, 1) if prev_rows else 0.0
    prev_breach = len(prev_rows) - prev_on
    prev_avg_breach = round(
        sum(
            max(0, (r.delivered_at - r.created_at).total_seconds() / 60 - r.response_minutes)
            for r in prev_rows
            if r.delivered_at
            and (r.delivered_at - r.created_at).total_seconds() / 60 > r.response_minutes
        )
        / max(1, prev_breach),
        1,
    ) if prev_breach else 0.0

    since, until = _report_range(days, filters)

    return {
        **_period_meta(days, filters),
        "current_period": {"from": since.isoformat(), "to": until.isoformat()},
        "previous_period": {"from": prev_since.isoformat(), "to": prev_until.isoformat()},
        "compliance_rate": rate,
        "on_time_count": on_time,
        "breach_count": len(delivered) - on_time,
        "total_delivered": len(delivered),
        "avg_breach_minutes": round(sum(breaches) / len(breaches), 1) if breaches else 0.0,
        "target_compliance_rate": 95.0,
        "by_department": by_dept,
        "dept_table": dept_table,
        "weekly_trend": weekly_trend,
        "status_split": {"on_time": on_time, "breached": len(delivered) - on_time},
        "kpi_compare": {
            "compliance_rate": _metric_delta(rate, prev_rate),
            "breach_count": _metric_delta(len(delivered) - on_time, prev_breach),
            "avg_breach_minutes": _metric_delta(
                round(sum(breaches) / len(breaches), 1) if breaches else 0.0,
                prev_avg_breach,
            ),
        },
        "breached_requests": breach_table,
        "delivered_requests": delivered_table,
        "breached_requests_total": len(breached_rows),
        "delivered_requests_total": len(delivered_rows),
        "breach_row_limit": len(breach_table),
        "delivered_row_limit": len(delivered_table),
        "row_limit_capped": table_limit is not None,
    }


def response_time_analysis(s: Session, days: int, filters: ReportFilters | None = None) -> dict[str, Any]:
    requests = _filter_requests(_period_requests(s, days, filters), filters)
    ids = [r.id for r in requests if r.id is not None]
    tmap = _timeline_map(s, ids)

    stages = {
        "created_to_assigned": [],
        "assigned_to_accepted": [],
        "accepted_to_started": [],
        "started_to_delivered": [],
    }
    outliers: list[dict[str, Any]] = []
    by_hour: dict[int, list[float]] = defaultdict(list)

    for r in requests:
        ev = tmap.get(r.id or 0, [])
        created = r.created_at
        assigned = _event_at(ev, "auto_assigned") or r.assignee_since
        accepted = _event_at(ev, "accepted")
        started = _event_at(ev, "started") or _event_at(ev, "resumed")
        delivered = r.delivered_at or _event_at(ev, "delivered")

        pairs = [
            ("created_to_assigned", created, assigned),
            ("assigned_to_accepted", assigned or created, accepted),
            ("accepted_to_started", accepted or assigned or created, started),
            ("started_to_delivered", started or accepted or created, delivered),
        ]
        total_m = 0.0
        for key, a, b in pairs:
            m = _minutes_between(a, b)
            if m is not None and m >= 0:
                stages[key].append(m)
                total_m += m
        sla_total = 0.0
        if r.delivered_at and r.status == "delivered":
            sla_total = (r.delivered_at - r.created_at).total_seconds() / 60
        if sla_total > 35 or total_m > 90:
            outliers.append(
                {
                    "id": r.id,
                    "code": r.code,
                    "name": _request_display_name(r),
                    "department": r.department,
                    "total_minutes": round(total_m, 1),
                    "status": r.status,
                },
            )
        if delivered:
            by_hour[r.created_at.hour].append(total_m)

    stage_stats = {}
    for key, vals in stages.items():
        stage_stats[key] = {
            "avg": round(sum(vals) / len(vals), 1) if vals else 0.0,
            "p50": _percentile(vals, 50),
            "p90": _percentile(vals, 90),
            "p95": _percentile(vals, 95),
            "count": len(vals),
        }

    by_hour_avg = {
        str(h): round(sum(vals) / len(vals), 1) if vals else 0.0
        for h in range(24)
        for vals in [by_hour.get(h, [])]
    }
    by_hour_delivered = {str(h): len(by_hour.get(h, [])) for h in range(24)}
    peak_hour_avg = None
    peak_hour_avg_minutes = 0.0
    hours_with_data = [h for h in range(24) if by_hour.get(h)]
    if hours_with_data:
        peak_hour_avg = max(
            hours_with_data,
            key=lambda h: sum(by_hour[h]) / len(by_hour[h]),
        )
        peak_hour_avg_minutes = by_hour_avg[str(peak_hour_avg)]
    outliers.sort(key=lambda x: -x["total_minutes"])
    outliers_total = len(outliers)
    return {
        **_period_meta(days, filters),
        "stage_stats": stage_stats,
        "by_hour_avg_total": by_hour_avg,
        "by_hour_delivered_count": by_hour_delivered,
        "peak_hour_avg": peak_hour_avg,
        "peak_hour_avg_minutes": peak_hour_avg_minutes,
        "outliers_total": outliers_total,
        "outliers": outliers,
        "sla_end_to_end_avg": round(
            sum(
                (r.delivered_at - r.created_at).total_seconds() / 60
                for r in requests
                if r.delivered_at and r.status == "delivered"
            )
            / max(1, len([r for r in requests if r.delivered_at])),
            1,
        ),
    }


def request_volume_forecast(s: Session, days: int, filters: ReportFilters | None = None) -> dict[str, Any]:
    requests = _filter_requests(_period_requests(s, days, filters), filters)
    by_hour_local: Counter[int] = Counter()
    for r in requests:
        by_hour_local[(r.created_at.hour + 7) % 24] += 1
    weekday_keys = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
    by_weekday = Counter(weekday_keys[r.created_at.weekday()] for r in requests)
    by_dept = dict(Counter(r.department for r in requests))
    daily: dict[str, int] = Counter()
    monthly: dict[str, int] = Counter()
    for r in requests:
        daily[r.created_at.strftime("%Y-%m-%d")] += 1
        monthly[r.created_at.strftime("%Y-%m")] += 1
    daily_sorted = [{"date": d, "count": daily[d]} for d in sorted(daily.keys())]
    monthly_sorted = [{"month": m, "count": monthly[m]} for m in sorted(monthly.keys())]
    peak_hour = max(by_hour_local, key=by_hour_local.get) if by_hour_local else None
    avg_daily = round(len(requests) / max(1, len(daily)), 1) if daily else 0.0
    return {
        **_period_meta(days, filters),
        "total": len(requests),
        "by_hour": {str(h): by_hour_local[h] for h in range(24)},
        "by_hour_local": {str(h): by_hour_local[h] for h in range(24)},
        "by_weekday": dict(by_weekday),
        "by_department": by_dept,
        "daily_volume": daily_sorted,
        "monthly_volume": monthly_sorted,
        "peak_hour": peak_hour,
        "peak_hour_local": peak_hour,
        "avg_daily": avg_daily,
    }


def staff_performance_scorecard(s: Session, days: int, filters: ReportFilters | None = None) -> dict[str, Any]:
    requests = _filter_requests(_period_requests(s, days, filters), filters)
    users = {u.id: u for u in s.exec(select(User)).all()}
    limit = _effective_limit(filters, 20 if not filters else filters.limit)

    stats: dict[int, dict[str, Any]] = defaultdict(
        lambda: {
            "delivered": 0,
            "breach": 0,
            "cancelled": 0,
            "paused": 0,
            "pause_minutes": 0.0,
            "delivery_minutes": [],
        },
    )

    for r in requests:
        if r.assignee_id is None:
            continue
        uid = r.assignee_id
        if r.status == "delivered" and r.delivered_at:
            stats[uid]["delivered"] += 1
            mins = (r.delivered_at - r.created_at).total_seconds() / 60
            stats[uid]["delivery_minutes"].append(mins)
            if mins > r.response_minutes:
                stats[uid]["breach"] += 1
        if r.status == "cancelled":
            stats[uid]["cancelled"] += 1
        if r.status == "paused" or r.pause_reason:
            stats[uid]["paused"] += 1

    rows = []
    for uid, st in stats.items():
        u = users.get(uid)
        if not u:
            continue
        delivered = st["delivered"]
        mins = st["delivery_minutes"]
        on_time_rate = (
            round((delivered - st["breach"]) / delivered * 100, 1) if delivered else 0.0
        )
        avg_m = round(sum(mins) / len(mins), 1) if mins else 0.0
        score = delivered * 2 + on_time_rate - st["breach"] * 3 - st["cancelled"]
        rows.append(
            {
                "user_id": uid,
                "name": u.name,
                "department": u.department,
                "delivered": delivered,
                "avg_minutes": avg_m,
                "on_time_rate": on_time_rate,
                "breach_count": st["breach"],
                "cancelled": st["cancelled"],
                "paused": st["paused"],
                "score": round(score, 1),
            },
        )
    rows.sort(key=lambda x: (-x["score"], -x["delivered"]))
    return {
        **_period_meta(days, filters),
        "staff": rows[:limit],
    }


def workload_distribution(s: Session, days: int, filters: ReportFilters | None = None) -> dict[str, Any]:
    users = {u.id: u for u in s.exec(select(User).where(User.active == True)).all()}  # noqa: E712
    open_statuses = ("assigned", "in_progress", "paused")
    all_open = list(
        s.exec(select(Request).where(Request.status.in_(open_statuses))).all(),  # type: ignore[attr-defined]
    )
    period = _filter_requests(_period_requests(s, days, filters), filters)
    delivered_period = [r for r in period if r.status == "delivered"]

    current: dict[int, dict[str, int]] = defaultdict(lambda: {"open": 0, "in_progress": 0, "paused": 0})
    for r in all_open:
        if r.assignee_id is None:
            continue
        if filters and filters.department and filters.department != "all":
            if r.department != filters.department:
                continue
        current[r.assignee_id][r.status] = current[r.assignee_id].get(r.status, 0) + 1
        current[r.assignee_id]["open"] += 1

    historical: dict[int, int] = Counter(
        r.assignee_id for r in delivered_period if r.assignee_id is not None
    )
    since, until = _report_range(days, filters)
    days_span = max(1, (until - since).days + 1)

    rows = []
    for uid, u in users.items():
        if u.role not in (
            "housekeeper",
            "maintenance",
            "hk_supervisor",
            "bellboy",
            "frontdesk",
        ):
            continue
        cur = current.get(uid, {"open": 0, "in_progress": 0, "paused": 0})
        hist = historical.get(uid, 0)
        workload_score = cur["open"] * 2 + cur["in_progress"] * 3 + cur["paused"]
        rows.append(
            {
                "name": u.name,
                "department": u.department,
                "open": cur["open"],
                "in_progress": cur["in_progress"],
                "paused": cur["paused"],
                "workload_score": workload_score,
                "completed_period": hist,
                "avg_completed_per_day": round(hist / days_span, 1),
            },
        )
    rows.sort(key=lambda x: x["completed_period"], reverse=True)
    hist_rows = rows[:25]

    by_room = Counter(r.room for r in delivered_period)
    return {
        **_period_meta(days, filters),
        "current_staff": rows,
        "historical_staff": hist_rows,
        "open_by_room": dict(by_room.most_common(15)),
        "total_completed_period": sum(historical.values()),
    }


def auto_assignment_effectiveness(s: Session, days: int, filters: ReportFilters | None = None) -> dict[str, Any]:
    requests = _filter_requests(_period_requests(s, days, filters), filters)
    ids = [r.id for r in requests if r.id is not None]
    tmap = _timeline_map(s, ids)

    auto_assigned = 0
    manual = 0
    reassigned = 0
    assign_minutes: list[float] = []
    reasons: Counter[str] = Counter()

    for r in requests:
        ev = tmap.get(r.id or 0, [])
        kinds = [e.kind for e in ev]
        if "auto_assigned" in kinds:
            auto_assigned += 1
        if r.assignee_id and "auto_assigned" not in kinds and "accepted" in kinds:
            manual += 1
        if "reassigned" in kinds:
            reassigned += 1
            for e in ev:
                if e.kind == "reassigned" and e.detail:
                    detail = e.detail[:80]
                    if detail in (
                        "Closer to room",
                        "Guest language preference",
                    ):
                        continue
                    reasons[detail] += 1
        aa = _event_at(ev, "auto_assigned")
        if aa:
            assign_minutes.append((aa - r.created_at).total_seconds() / 60)

    total = len(requests)
    auto_rate = round(auto_assigned / total * 100, 1) if total else 0.0
    success = max(0, auto_assigned - reassigned)
    success_rate = round(success / auto_assigned * 100, 1) if auto_assigned else 0.0
    return {
        **_period_meta(days, filters),
        "total": total,
        "auto_assigned": auto_assigned,
        "manual_assigned": manual,
        "reassigned": reassigned,
        "auto_rate": auto_rate,
        "success_rate": success_rate,
        "avg_assign_minutes": round(sum(assign_minutes) / len(assign_minutes), 1) if assign_minutes else 0.0,
        "reassign_reasons": dict(reasons.most_common(10)),
        "assignment_split": {
            "auto": auto_assigned,
            "manual": manual,
            "reassigned": reassigned,
        },
    }


def stock_consumption_analysis(s: Session, days: int, filters: ReportFilters | None = None) -> dict[str, Any]:
    since, until = _report_range(days, filters)
    days_span = max(1, (until - since).days + 1)
    products = list(s.exec(select(Product).where(Product.active == True)).all())  # noqa: E712
    if filters and filters.department and filters.department != "all":
        products = [p for p in products if p.department == filters.department]

    consumed: Counter[int] = Counter()
    req_ids = [r.id for r in _filter_requests(_period_requests(s, days, filters), filters) if r.id]
    if req_ids:
        items = s.exec(
            select(RequestItem).where(RequestItem.request_id.in_(req_ids)),  # type: ignore[attr-defined]
        ).all()
        for it in items:
            if it.product_id and it.qty > 0:
                consumed[it.product_id] += it.qty

    rows = []
    for p in products:
        if p.is_service or p.on_hand is None:
            continue
        used = consumed.get(p.id or 0, 0)
        daily_avg = round(used / days_span, 2)
        on_hand = p.on_hand or 0
        reorder = p.reorder_at or 0
        days_left = round(on_hand / daily_avg, 1) if daily_avg > 0 else 999.0
        if on_hand <= 0:
            status = "out"
        elif on_hand <= reorder:
            status = "critical" if on_hand <= max(1, reorder // 2) else "low"
        else:
            status = "ok"
        rows.append(
            {
                "sku": p.sku,
                "name": p.name,
                "department": p.department,
                "consumed": used,
                "daily_avg": daily_avg,
                "on_hand": on_hand,
                "reorder_at": reorder,
                "days_remaining": days_left,
                "status": status,
            },
        )
    rows.sort(key=lambda x: -x["consumed"])
    top_ids = [p["sku"] for p in rows[:5]]
    id_by_sku = {p.sku: p.id for p in products if p.sku in top_ids}
    top_product_ids = [id_by_sku[sku] for sku in top_ids if sku in id_by_sku]

    weekly_trends: list[dict[str, Any]] = []
    if top_product_ids and req_ids:
        delivered_reqs = {
            r.id: r
            for r in _filter_requests(_period_requests(s, days, filters), filters)
            if r.status == "delivered" and r.delivered_at and r.id
        }
        week_buckets: dict[str, Counter[int]] = defaultdict(Counter)
        items = s.exec(
            select(RequestItem).where(RequestItem.request_id.in_(list(delivered_reqs.keys()))),  # type: ignore[attr-defined]
        ).all()
        for it in items:
            if not it.product_id or it.product_id not in top_product_ids:
                continue
            req = delivered_reqs.get(it.request_id or 0)
            if not req or not req.delivered_at:
                continue
            wk = _iso_week_period(req.delivered_at)
            week_buckets[wk][it.product_id] += it.qty
        name_by_id = {p.id: p.name for p in products if p.id}
        for pid in top_product_ids:
            series = []
            for wk in sorted(week_buckets.keys()):
                week_start, week_end = _iso_week_date_bounds(wk)
                series.append(
                    {
                        "week": wk,
                        "week_start": week_start,
                        "week_end": week_end,
                        "label": wk,
                        "count": week_buckets[wk].get(pid, 0),
                    },
                )
            weekly_trends.append(
                {
                    "product_id": pid,
                    "name": name_by_id.get(pid, ""),
                    "points": series,
                },
            )

    return {
        **_period_meta(days, filters),
        "products": rows,
        "products_total": len(rows),
        "product_trends": weekly_trends,
    }


def low_stock_stockout_report(s: Session, days: int, filters: ReportFilters | None = None) -> dict[str, Any]:
    products = list(s.exec(select(Product).where(Product.active == True)).all())  # noqa: E712
    if filters and filters.department and filters.department != "all":
        products = [p for p in products if p.department == filters.department]

    status_filter = getattr(filters, "stock_status", None) if filters else None
    alerts = []
    for p in products:
        if p.is_service or p.on_hand is None:
            continue
        on_hand = p.on_hand or 0
        reorder = p.reorder_at or 0
        if on_hand <= 0:
            st = "out"
        elif on_hand <= reorder:
            st = "critical" if on_hand <= max(1, reorder // 2) else "low"
        else:
            st = "ok"
        if status_filter and status_filter != "all" and st != status_filter:
            continue
        est_daily = max(0.5, (reorder or 12) / 7.0)
        days_rem = round(on_hand / est_daily, 1) if on_hand > 0 else 0.0
        alerts.append(
            {
                "sku": p.sku,
                "name": p.name,
                "on_hand": on_hand,
                "reorder_at": reorder,
                "status": st,
                "department": p.department,
                "days_remaining": days_rem,
            },
        )
    alerts.sort(key=lambda x: ({"out": 0, "critical": 1, "low": 2, "ok": 3}[x["status"]], x["on_hand"]))

    period = _filter_requests(_period_requests(s, days, filters), filters)
    stockout_cancelled = sum(1 for r in period if r.status == "cancelled")

    return {
        **_period_meta(days, filters),
        "alerts": alerts,
        "low_count": sum(1 for a in alerts if a["status"] == "low"),
        "critical_count": sum(1 for a in alerts if a["status"] == "critical"),
        "out_count": sum(1 for a in alerts if a["status"] == "out"),
        "cancelled_requests": stockout_cancelled,
    }


def stock_movement_audit(s: Session, days: int, filters: ReportFilters | None = None) -> dict[str, Any]:
    since, until = _report_range(days, filters)
    table_limit = _report_table_limit(filters)
    q = (
        select(StockAdjustment)
        .where(
            StockAdjustment.created_at >= since,
            StockAdjustment.created_at <= until,
        )
        .order_by(StockAdjustment.created_at.desc(), StockAdjustment.id.desc())
    )
    rows = list(s.exec(q).all())
    if filters and filters.department and filters.department != "all":
        prods = {p.id: p for p in s.exec(select(Product)).all()}
        rows = [
            row for row in rows
            if prods.get(row.product_id)
            and prods[row.product_id].department == filters.department
        ]
    by_user = Counter(row.actor_label or "—" for row in rows)
    by_type = Counter(
        "addition" if r.delta > 0 else "deduction" if r.delta < 0 else "adjustment"
        for r in rows
    )
    table_rows = rows if table_limit is None else rows[:table_limit]
    return {
        **_period_meta(days, filters),
        "total_adjustments": len(rows),
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
            for row in table_rows
        ],
        "adjustments_total": len(rows),
        "row_limit": len(table_rows),
        "row_limit_capped": table_limit is not None,
        "by_user": dict(by_user.most_common(15)),
        "by_type": dict(by_type),
    }


TIMELINE_KIND_ORDER = (
    "created",
    "auto_assigned",
    "reassigned",
    "accepted",
    "started",
    "paused",
    "resumed",
    "rushed",
    "unrushed",
    "delivered",
    "dnd_reported",
    "dnd_cleared",
    "dnd_defer",
    "cancelled",
    "note",
)

TIMELINE_CATEGORY_KINDS: dict[str, tuple[str, ...]] = {
    "intake": ("created",),
    "assignment": ("auto_assigned", "reassigned", "accepted"),
    "execution": ("started", "resumed", "paused", "rushed", "unrushed"),
    "completion": ("delivered",),
    "dnd": ("dnd_reported", "dnd_cleared", "dnd_defer"),
    "closure": ("cancelled", "note"),
}


def _timeline_recent_payload(
    events: list[TimelineEvent],
    requests: list[Request],
    limit: int | None,
) -> list[dict[str, Any]]:
    req_codes: dict[int, str] = {r.id: r.code for r in requests if r.id is not None}
    req_names: dict[int, str] = {r.id: _request_display_name(r) for r in requests if r.id is not None}
    return [
        {
            "created_at": e.created_at.isoformat(),
            "request_code": req_codes.get(e.request_id, f"#{e.request_id}"),
            "request_name": req_names.get(
                e.request_id,
                req_codes.get(e.request_id, f"#{e.request_id}"),
            ),
            "request_id": e.request_id,
            "kind": e.kind,
            "title": e.title,
            "detail": e.detail,
            "actor_label": e.actor_label or "—",
        }
        for e in (events if limit is None else events[:limit])
    ]


def _timeline_events_for_period(
    s: Session,
    days: int,
    filters: ReportFilters | None,
) -> tuple[list[Request], list[TimelineEvent]]:
    since, until = _report_range(days, filters)
    requests = _filter_requests(_period_requests(s, days, filters), filters)
    req_ids = [r.id for r in requests if r.id is not None]
    if not req_ids:
        return requests, []
    events = list(
        s.exec(
            select(TimelineEvent)
            .where(
                TimelineEvent.created_at >= since,
                TimelineEvent.created_at <= until,
                TimelineEvent.request_id.in_(req_ids),  # type: ignore[attr-defined]
            )
            .order_by(TimelineEvent.created_at.desc(), TimelineEvent.id.desc()),
        ).all(),
    )
    return requests, events


def service_only_room_requests_report(
    s: Session, days: int, filters: ReportFilters | None = None,
) -> dict[str, Any]:
    """Guest service line items in the period (catalog is_service SKUs only)."""
    requests = _filter_requests(_period_requests(s, days, filters), filters)
    req_by_id = {r.id: r for r in requests if r.id is not None}
    req_ids = list(req_by_id.keys())
    if not req_ids:
        return {
            **_period_meta(days, filters),
            "total_requests": 0,
            "service_line_count": 0,
            "service_qty_total": 0,
            "service_types": 0,
            "unique_rooms": 0,
            "services": [],
            "lines": [],
            "lines_total": 0,
            "row_limit": 0,
            "row_limit_capped": False,
        }

    line_rows = list(
        s.exec(
            select(RequestItem, Product, Request)
            .join(Product, Product.id == RequestItem.product_id)
            .join(Request, Request.id == RequestItem.request_id)
            .where(
                RequestItem.request_id.in_(req_ids),  # type: ignore[attr-defined]
                Product.is_service == True,  # noqa: E712
            ),
        ).all(),
    )

    by_service: Counter[str] = Counter()
    service_meta: dict[str, dict[str, str]] = {}
    rooms: set[str] = set()
    detail_lines: list[dict[str, Any]] = []
    qty_total = 0

    for item, prod, req in line_rows:
        sku = prod.sku
        qty = max(1, item.qty or 1)
        qty_total += qty
        by_service[sku] += qty
        service_meta[sku] = {
            "sku": sku,
            "name": prod.name,
            "department": prod.department,
        }
        room = (req.room or "").strip()
        if room:
            rooms.add(room)
        detail_lines.append(
            {
                "id": req.id,
                "code": req.code,
                "room": req.room,
                "service_sku": sku,
                "service_name": prod.name,
                "department": prod.department,
                "qty": qty,
                "status": req.status,
                "created_at": req.created_at.isoformat(),
            },
        )

    services = [
        {
            "sku": sku,
            "name": service_meta[sku]["name"],
            "department": service_meta[sku]["department"],
            "count": by_service[sku],
        }
        for sku in by_service
    ]
    services.sort(key=lambda x: x["count"], reverse=True)

    detail_lines.sort(key=lambda x: x["created_at"], reverse=True)
    table_limit = _report_table_limit(filters)
    table_rows = detail_lines if table_limit is None else detail_lines[:table_limit]

    return {
        **_period_meta(days, filters),
        "total_requests": len(requests),
        "service_line_count": len(detail_lines),
        "service_qty_total": qty_total,
        "service_types": len(services),
        "unique_rooms": len(rooms),
        "services": services,
        "lines": table_rows,
        "lines_total": len(detail_lines),
        "row_limit": len(table_rows),
        "row_limit_capped": table_limit is not None,
    }


def stock_only_room_requests_report(
    s: Session, days: int, filters: ReportFilters | None = None,
) -> dict[str, Any]:
    """Guest stock/product line items in the period (catalog non-service SKUs only)."""
    requests = _filter_requests(_period_requests(s, days, filters), filters)
    req_by_id = {r.id: r for r in requests if r.id is not None}
    req_ids = list(req_by_id.keys())
    if not req_ids:
        return {
            **_period_meta(days, filters),
            "total_requests": 0,
            "product_line_count": 0,
            "product_qty_total": 0,
            "product_types": 0,
            "unique_rooms": 0,
            "products": [],
            "lines": [],
            "lines_total": 0,
            "row_limit": 0,
            "row_limit_capped": False,
        }

    line_rows = list(
        s.exec(
            select(RequestItem, Product, Request)
            .join(Product, Product.id == RequestItem.product_id)
            .join(Request, Request.id == RequestItem.request_id)
            .where(
                RequestItem.request_id.in_(req_ids),  # type: ignore[attr-defined]
                Product.is_service == False,  # noqa: E712
            ),
        ).all(),
    )

    by_product: Counter[str] = Counter()
    product_meta: dict[str, dict[str, str]] = {}
    rooms: set[str] = set()
    detail_lines: list[dict[str, Any]] = []
    qty_total = 0

    for item, prod, req in line_rows:
        sku = prod.sku
        qty = max(1, item.qty or 1)
        qty_total += qty
        by_product[sku] += qty
        product_meta[sku] = {
            "sku": sku,
            "name": prod.name,
            "department": prod.department,
        }
        room = (req.room or "").strip()
        if room:
            rooms.add(room)
        detail_lines.append(
            {
                "id": req.id,
                "code": req.code,
                "room": req.room,
                "product_sku": sku,
                "product_name": prod.name,
                "department": prod.department,
                "qty": qty,
                "status": req.status,
                "created_at": req.created_at.isoformat(),
            },
        )

    products = [
        {
            "sku": sku,
            "name": product_meta[sku]["name"],
            "department": product_meta[sku]["department"],
            "count": by_product[sku],
        }
        for sku in by_product
    ]
    products.sort(key=lambda x: x["count"], reverse=True)

    detail_lines.sort(key=lambda x: x["created_at"], reverse=True)
    table_limit = _report_table_limit(filters)
    table_rows = detail_lines if table_limit is None else detail_lines[:table_limit]

    return {
        **_period_meta(days, filters),
        "total_requests": len(requests),
        "product_line_count": len(detail_lines),
        "product_qty_total": qty_total,
        "product_types": len(products),
        "unique_rooms": len(rooms),
        "products": products,
        "lines": table_rows,
        "lines_total": len(detail_lines),
        "row_limit": len(table_rows),
        "row_limit_capped": table_limit is not None,
    }


def timeline_activity_log_report(
    s: Session, days: int, filters: ReportFilters | None = None,
) -> dict[str, Any]:
    """Recent timeline events on requests in the selected period (newest first)."""
    table_limit = _timeline_table_limit(filters)
    requests, events = _timeline_events_for_period(s, days, filters)
    recent = _timeline_recent_payload(events, requests, table_limit)
    return {
        **_period_meta(days, filters),
        "total_events": len(events),
        "requests_in_period": len(requests),
        "row_limit": len(recent),
        "row_limit_capped": table_limit is not None,
        "recent_events": recent,
    }


def request_lifecycle_activity_report(
    s: Session, days: int, filters: ReportFilters | None = None,
) -> dict[str, Any]:
    """All timeline events on requests in the selected period."""
    requests, events = _timeline_events_for_period(s, days, filters)
    if not events:
        return {
            **_period_meta(days, filters),
            "total_events": 0,
            "requests_in_period": len(requests),
            "unique_requests_with_events": 0,
            "avg_events_per_request": 0.0,
            "peak_hour": None,
            "by_kind": {},
            "by_category": {},
            "by_hour": {str(h): 0 for h in range(24)},
            "by_actor": {},
            "daily_trend": [],
            "lifecycle": {
                "created": 0,
                "assigned": 0,
                "started": 0,
                "delivered": 0,
                "cancelled": 0,
                "paused": 0,
                "dnd": 0,
            },
        }

    by_kind: Counter[str] = Counter(e.kind for e in events)
    by_hour: Counter[int] = Counter(e.created_at.hour for e in events)
    by_actor: Counter[str] = Counter((e.actor_label or "—") for e in events)
    by_day: Counter[str] = Counter(e.created_at.date().isoformat() for e in events)

    reqs_by_kind: dict[str, set[int]] = defaultdict(set)
    for e in events:
        reqs_by_kind[e.kind].add(e.request_id)

    def _union_kinds(kinds: tuple[str, ...]) -> set[int]:
        out: set[int] = set()
        for k in kinds:
            out |= reqs_by_kind.get(k, set())
        return out

    lifecycle = {
        "created": len(reqs_by_kind.get("created", set())),
        "assigned": len(_union_kinds(("auto_assigned", "reassigned", "accepted"))),
        "started": len(reqs_by_kind.get("started", set())),
        "delivered": len(reqs_by_kind.get("delivered", set())),
        "cancelled": len(reqs_by_kind.get("cancelled", set())),
        "paused": len(reqs_by_kind.get("paused", set())),
        "dnd": len(_union_kinds(("dnd_reported", "dnd_cleared", "dnd_defer"))),
    }

    by_category = {
        cat: sum(by_kind.get(k, 0) for k in kinds)
        for cat, kinds in TIMELINE_CATEGORY_KINDS.items()
    }

    peak_hour = max(by_hour, key=by_hour.get) if by_hour else None
    unique_reqs = len({e.request_id for e in events})
    avg_epr = round(len(events) / max(1, len(requests)), 1)

    return {
        **_period_meta(days, filters),
        "total_events": len(events),
        "requests_in_period": len(requests),
        "unique_requests_with_events": unique_reqs,
        "avg_events_per_request": avg_epr,
        "peak_hour": peak_hour,
        "by_kind": {k: by_kind.get(k, 0) for k in TIMELINE_KIND_ORDER if by_kind.get(k, 0)},
        "by_category": by_category,
        "by_hour": {str(h): by_hour.get(h, 0) for h in range(24)},
        "by_actor": dict(by_actor.most_common(12)),
        "daily_trend": [
            {"label": day, "count": count}
            for day, count in sorted(by_day.items())
        ],
        "lifecycle": lifecycle,
    }


def _cancel_stage_from_events(ev: list[TimelineEvent]) -> str:
    if any(e.kind == "started" for e in ev):
        return "in_progress"
    if any(e.kind in ("accepted", "auto_assigned") for e in ev):
        return "assigned"
    return "pending"


def _cancel_reason_from_events(ev: list[TimelineEvent]) -> tuple[str, str]:
    reason_key = "guest_request"
    detail = ""
    for e in ev:
        if e.kind == "cancelled":
            detail = (e.detail or e.title or "").strip()
            if detail:
                d = detail.lower()
                if "stock" in d:
                    reason_key = "stockout"
                elif "miscommunication" in d or "duplicate" in d:
                    reason_key = "other"
            break
    return reason_key, detail


def cancellation_analysis(s: Session, days: int, filters: ReportFilters | None = None) -> dict[str, Any]:
    requests = _filter_requests(_period_requests(s, days, filters), filters)
    cancelled = [r for r in requests if r.status == "cancelled"]
    total = len(requests)
    rate = round(len(cancelled) / total * 100, 2) if total else 0.0
    table_limit = _report_table_limit(filters)

    by_stage: Counter[str] = Counter()
    reasons: Counter[str] = Counter()
    wasted_hours = 0.0
    mins_before: list[float] = []
    cancelled_rows: list[dict[str, Any]] = []

    ids = [r.id for r in cancelled if r.id]
    tmap = _timeline_map(s, ids)

    for r in cancelled:
        ev = tmap.get(r.id or 0, [])
        stage = _cancel_stage_from_events(ev)
        by_stage[stage] += 1
        reason_key, detail = _cancel_reason_from_events(ev)
        reasons[reason_key] += 1
        if r.cancelled_at:
            mins_before.append((r.cancelled_at - r.created_at).total_seconds() / 60)
            if stage == "in_progress":
                wasted_hours += (r.cancelled_at - r.created_at).total_seconds() / 3600
        cancelled_rows.append(
            {
                "id": r.id,
                "code": r.code,
                "name": _request_display_name(r),
                "department": r.department,
                "stage": stage,
                "reason": reason_key,
                "cancelled_at": r.cancelled_at.isoformat() if r.cancelled_at else "",
                "created_at": r.created_at.isoformat(),
                "detail": detail,
            },
        )

    cancelled_rows.sort(key=lambda row: row["cancelled_at"], reverse=True)
    table_rows = cancelled_rows if table_limit is None else cancelled_rows[:table_limit]

    return {
        **_period_meta(days, filters),
        "cancellation_rate": rate,
        "cancelled_count": len(cancelled),
        "total": total,
        "wasted_hours": round(wasted_hours, 1),
        "avg_minutes_before_cancel": round(
            sum(mins_before) / len(mins_before), 1,
        ) if mins_before else 0.0,
        "by_stage": dict(by_stage),
        "by_reason": dict(reasons.most_common(10)),
        "row_limit": len(table_rows),
        "row_limit_capped": table_limit is not None,
        "cancelled_requests": table_rows,
    }


def _pause_outcome(r: Request, resumed: bool) -> str:
    if r.status == "paused" and not resumed:
        return "paused"
    if resumed:
        return "resumed"
    if r.status == "delivered":
        return "delivered"
    return "ended"


def pause_delay_analysis(s: Session, days: int, filters: ReportFilters | None = None) -> dict[str, Any]:
    requests = _filter_requests(_period_requests(s, days, filters), filters)
    paused_reqs = [r for r in requests if r.status == "paused" or r.pause_reason]
    ids = [r.id for r in requests if r.id]
    tmap = _timeline_map(s, ids)

    pause_durations: list[float] = []
    reasons: Counter[str] = Counter()
    reason_minutes: dict[str, list[float]] = defaultdict(list)
    sla_impact = 0
    pause_rows: list[dict[str, Any]] = []
    paused_request_ids: set[int] = set()

    for r in requests:
        ev = tmap.get(r.id or 0, [])
        pause_events = [e for e in ev if e.kind == "paused"]
        if pause_events and r.id:
            paused_request_ids.add(r.id)
        for pe in pause_events:
            resume = next((e for e in ev if e.created_at > pe.created_at and e.kind == "resumed"), None)
            end = resume.created_at if resume else (r.delivered_at or r.cancelled_at)
            dur = 0.0
            if end:
                dur = (end - pe.created_at).total_seconds() / 60
                pause_durations.append(dur)
            reason = pe.detail or r.pause_reason or "other"
            key = reason[:60]
            reasons[key] += 1
            if dur > 0:
                reason_minutes[key].append(dur)
            pause_rows.append(
                {
                    "id": r.id,
                    "code": r.code,
                    "name": _request_display_name(r),
                    "department": r.department,
                    "paused_at": pe.created_at.isoformat(),
                    "reason": reason,
                    "duration_minutes": round(dur, 1) if dur > 0 else None,
                    "outcome": _pause_outcome(r, resume is not None),
                }
            )
        if not pause_events and (r.status == "paused" or r.pause_reason):
            if r.id:
                paused_request_ids.add(r.id)
            reason = (r.pause_reason or "other").strip() or "other"
            key = reason[:60]
            reasons[key] += 1
            paused_at = r.updated_at or r.created_at
            pause_rows.append(
                {
                    "id": r.id,
                    "code": r.code,
                    "name": _request_display_name(r),
                    "department": r.department,
                    "paused_at": paused_at.isoformat(),
                    "reason": reason,
                    "duration_minutes": None,
                    "outcome": _pause_outcome(r, False),
                }
            )

    for r in paused_reqs:
        if r.status == "delivered" and r.delivered_at:
            mins = (r.delivered_at - r.created_at).total_seconds() / 60
            if mins > r.response_minutes:
                sla_impact += 1

    pause_rows.sort(key=lambda x: x["paused_at"], reverse=True)
    table_limit = _report_table_limit(filters)
    table_rows = pause_rows if table_limit is None else pause_rows[:table_limit]

    total = len(requests)
    pause_rate = round(len(paused_reqs) / total * 100, 2) if total else 0.0
    reason_stats = [
        {
            "reason": k,
            "count": v,
            "avg_minutes": round(sum(reason_minutes[k]) / len(reason_minutes[k]), 1)
            if reason_minutes[k]
            else 0.0,
        }
        for k, v in reasons.most_common(12)
    ]
    reason_stats.sort(key=lambda x: -x["count"])

    pause_events_total = len(pause_rows)

    return {
        **_period_meta(days, filters),
        "pause_count": pause_events_total,
        "pause_events_total": pause_events_total,
        "paused_requests_count": len(paused_request_ids),
        "pause_rate": pause_rate,
        "avg_pause_minutes": round(sum(pause_durations) / len(pause_durations), 1) if pause_durations else 0.0,
        "by_reason": dict(reasons.most_common(12)),
        "reason_stats": reason_stats,
        "sla_breach_with_pause": sla_impact,
        "row_limit": len(table_rows),
        "row_limit_capped": table_limit is not None,
        "paused_requests": table_rows,
    }


def dnd_incident_report(s: Session, days: int, filters: ReportFilters | None = None) -> dict[str, Any]:
    requests = _filter_requests(_period_requests(s, days, filters), filters)
    dnd = [r for r in requests if r.status == "dnd" or (r.dnd_reason and r.dnd_reason.strip())]
    ids = [r.id for r in dnd if r.id]
    tmap = _timeline_map(s, ids)

    incidents = []
    resolution_actions: Counter[str] = Counter()
    unresolved = 0
    resolve_mins: list[float] = []
    by_shift: Counter[str] = Counter()

    for r in dnd:
        ev = tmap.get(r.id or 0, [])
        reported = _event_at(ev, "dnd_reported")
        cleared = _event_at(ev, "dnd_cleared")
        defer = _event_at(ev, "dnd_defer")
        resolved_at = cleared or defer or r.cancelled_at or r.delivered_at
        if resolved_at and reported:
            resolve_mins.append((resolved_at - reported).total_seconds() / 60)
        else:
            unresolved += 1
        action = "unresolved"
        if cleared:
            action = "proceed"
        elif defer:
            action = "defer"
        elif r.status == "cancelled":
            action = "cancelled"
        resolution_actions[action] += 1
        by_shift[_shift_label((reported or r.created_at).hour)] += 1
        escalated = any("escalation" in (e.detail or "") for e in ev)
        incidents.append(
            {
                "id": r.id,
                "code": r.code,
                "name": _request_display_name(r),
                "room": r.room,
                "reported_at": (reported or r.created_at).isoformat(),
                "resolved_at": resolved_at.isoformat() if resolved_at else None,
                "resolution_minutes": round(
                    (resolved_at - reported).total_seconds() / 60, 1,
                )
                if resolved_at and reported
                else None,
                "escalated": escalated,
                "action": action,
            },
        )

    incidents.sort(key=lambda x: x["reported_at"], reverse=True)
    table_limit = _report_table_limit(filters)
    table_rows = incidents if table_limit is None else incidents[:table_limit]

    return {
        **_period_meta(days, filters),
        "total_incidents": len(incidents),
        "unresolved": unresolved,
        "avg_resolution_minutes": round(
            sum(resolve_mins) / len(resolve_mins), 1,
        ) if resolve_mins else 0.0,
        "escalation_count": sum(1 for i in incidents if i["escalated"]),
        "by_shift": dict(by_shift),
        "resolution_actions": dict(resolution_actions),
        "incidents": table_rows,
        "incidents_total": len(incidents),
        "row_limit": len(table_rows),
        "row_limit_capped": table_limit is not None,
    }


def month_over_month_comparison(s: Session, days: int, filters: ReportFilters | None = None) -> dict[str, Any]:
    since, until = _report_range(days, filters)
    custom_prev = compare_period_range(filters)
    if custom_prev:
        prev_since, prev_until = custom_prev
    else:
        span = until - since
        prev_until = since - timedelta(seconds=1)
        prev_since = prev_until - span

    def metrics(start: datetime, end: datetime) -> dict[str, float]:
        rows = list(
            s.exec(
                select(Request).where(
                    Request.created_at >= start,
                    Request.created_at <= end,
                ),
            ).all(),
        )
        if filters:
            rows = [r for r in rows if _request_matches(r, filters)]
        delivered = [r for r in rows if r.status == "delivered" and r.delivered_at]
        on_time = sum(
            1
            for r in delivered
            if (r.delivered_at - r.created_at).total_seconds() / 60 <= r.response_minutes
        )
        cancelled = sum(1 for r in rows if r.status == "cancelled")
        staff_ids = {r.assignee_id for r in delivered if r.assignee_id}
        return {
            "volume": float(len(rows)),
            "sla_rate": round(on_time / len(delivered) * 100, 2) if delivered else 0.0,
            "avg_response": round(
                sum((r.delivered_at - r.created_at).total_seconds() / 60 for r in delivered)
                / len(delivered),
                1,
            )
            if delivered
            else 0.0,
            "cancel_rate": round(cancelled / len(rows) * 100, 2) if rows else 0.0,
            "productivity": round(len(delivered) / max(1, len(staff_ids)), 1) if staff_ids else 0.0,
        }

    cur = metrics(since, until)
    prev = metrics(prev_since, prev_until)

    def chg(key: str) -> dict[str, Any]:
        c, p = cur[key], prev[key]
        delta = round(c - p, 2)
        pct = round((c - p) / p * 100, 1) if p else (100.0 if c else 0.0)
        return {"current": c, "previous": p, "delta": delta, "delta_pct": pct}

    improved = []
    declined = []
    for label, key in [
        ("Request volume", "volume"),
        ("SLA compliance %", "sla_rate"),
        ("Avg response (min)", "avg_response"),
        ("Cancellation %", "cancel_rate"),
        ("Delivered per staff", "productivity"),
    ]:
        d = chg(key)
        if d["delta"] > 0 and key != "cancel_rate" and key != "avg_response":
            improved.append(label)
        elif d["delta"] < 0:
            declined.append(label)
        elif d["delta"] > 0 and key in ("cancel_rate", "avg_response"):
            declined.append(label)
        elif d["delta"] < 0 and key in ("cancel_rate", "avg_response"):
            improved.append(label)

    return {
        **_period_meta(days, filters),
        "current_period": {"from": since.isoformat(), "to": until.isoformat()},
        "previous_period": {"from": prev_since.isoformat(), "to": prev_until.isoformat()},
        "metrics": {k: chg(k) for k in cur},
        "improved": improved,
        "declined": declined,
    }


BRS_HANDLERS = {
    "sla-compliance": sla_compliance_report,
    "response-time-analysis": response_time_analysis,
    "request-volume-forecast": request_volume_forecast,
    "staff-performance-scorecard": staff_performance_scorecard,
    "workload-distribution": workload_distribution,
    "auto-assignment-effectiveness": auto_assignment_effectiveness,
    "stock-consumption-analysis": stock_consumption_analysis,
    "low-stock-stockout": low_stock_stockout_report,
    "stock-movement-audit": stock_movement_audit,
    "request-lifecycle-activity": request_lifecycle_activity_report,
    "timeline-activity-log": timeline_activity_log_report,
    "cancellation-analysis": cancellation_analysis,
    "pause-delay-analysis": pause_delay_analysis,
    "dnd-incident-report": dnd_incident_report,
    "month-over-month-comparison": month_over_month_comparison,
    "service-only-room-requests": service_only_room_requests_report,
    "stock-only-room-requests": stock_only_room_requests_report,
}

BRS_CATALOG = [
    {"slug": "sla-compliance", "category": "operations", "title_key": "reports.presets.sla_compliance", "code": "OP01"},
    {"slug": "response-time-analysis", "category": "operations", "title_key": "reports.presets.response_time_analysis", "code": "OP02"},
    {"slug": "request-volume-forecast", "category": "operations", "title_key": "reports.presets.request_volume_forecast", "code": "OP03"},
    {"slug": "staff-performance-scorecard", "category": "staff", "title_key": "reports.presets.staff_performance_scorecard", "code": "ST01"},
    {"slug": "workload-distribution", "category": "staff", "title_key": "reports.presets.workload_distribution", "code": "ST02"},
    {"slug": "auto-assignment-effectiveness", "category": "operations", "title_key": "reports.presets.auto_assignment_effectiveness", "code": "OP04"},
    {"slug": "stock-consumption-analysis", "category": "inventory", "title_key": "reports.presets.stock_consumption_analysis", "code": "IV01"},
    {"slug": "low-stock-stockout", "category": "inventory", "title_key": "reports.presets.low_stock_stockout", "code": "IV02"},
    {"slug": "stock-movement-audit", "category": "inventory", "title_key": "reports.presets.stock_movement_audit", "code": "IV03"},
    {
        "slug": "request-lifecycle-activity",
        "category": "operations",
        "title_key": "reports.presets.request_lifecycle_activity",
        "code": "OP05",
    },
    {
        "slug": "timeline-activity-log",
        "category": "operations",
        "title_key": "reports.presets.timeline_activity_log",
        "code": "OP06",
    },
    {"slug": "cancellation-analysis", "category": "operations", "title_key": "reports.presets.cancellation_analysis", "code": "OP07"},
    {"slug": "pause-delay-analysis", "category": "operations", "title_key": "reports.presets.pause_delay_analysis", "code": "OP08"},
    {"slug": "dnd-incident-report", "category": "operations", "title_key": "reports.presets.dnd_incident_report", "code": "OP09"},
    {"slug": "month-over-month-comparison", "category": "operations", "title_key": "reports.presets.month_over_month_comparison", "code": "OP10"},
    {
        "slug": "service-only-room-requests",
        "category": "operations",
        "title_key": "reports.presets.service_only_room_requests",
        "code": "OP11",
    },
    {
        "slug": "stock-only-room-requests",
        "category": "operations",
        "title_key": "reports.presets.stock_only_room_requests",
        "code": "OP12",
    },
]
