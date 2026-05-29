"""Permanently remove a user and clear or delete related rows."""
from __future__ import annotations

from sqlmodel import Session, select

from ..models import (
    ActivityLog,
    AuthSession,
    CustomReport,
    CustomReportShare,
    Note,
    Request,
    StockAdjustment,
    TimelineEvent,
    User,
)


def purge_user_in_session(s: Session, user_id: int) -> None:
    u = s.get(User, user_id)
    if not u:
        raise ValueError("user not found")
    if u.role == "admin":
        raise ValueError("cannot purge admin account")

    for req in s.exec(
        select(Request).where(
            (Request.assignee_id == user_id)
            | (Request.preferred_assignee_id == user_id)
            | (Request.created_by_id == user_id),
        ),
    ).all():
        if req.assignee_id == user_id:
            req.assignee_id = None
        if req.preferred_assignee_id == user_id:
            req.preferred_assignee_id = None
        if req.created_by_id == user_id:
            req.created_by_id = None
        s.add(req)

    for ev in s.exec(
        select(TimelineEvent).where(TimelineEvent.actor_id == user_id),
    ).all():
        ev.actor_id = None
        s.add(ev)

    for note in s.exec(select(Note).where(Note.author_id == user_id)).all():
        note.author_id = None
        s.add(note)

    for adj in s.exec(
        select(StockAdjustment).where(StockAdjustment.actor_id == user_id),
    ).all():
        adj.actor_id = None
        s.add(adj)

    for log in s.exec(select(ActivityLog).where(ActivityLog.actor_id == user_id)).all():
        log.actor_id = None
        s.add(log)

    for sess in s.exec(select(AuthSession).where(AuthSession.user_id == user_id)).all():
        s.delete(sess)

    for sh in s.exec(
        select(CustomReportShare).where(
            (CustomReportShare.shared_with_user_id == user_id)
            | (CustomReportShare.shared_by_user_id == user_id),
        ),
    ).all():
        s.delete(sh)

    for report in s.exec(
        select(CustomReport).where(CustomReport.owner_user_id == user_id),
    ).all():
        rid = report.id
        if rid is None:
            continue
        for sh in s.exec(
            select(CustomReportShare).where(CustomReportShare.report_id == rid),
        ).all():
            s.delete(sh)
        s.delete(report)

    s.delete(u)
