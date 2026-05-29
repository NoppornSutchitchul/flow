"""CRUD for per-user custom reports and sharing."""
from __future__ import annotations

from datetime import datetime

from fastapi import HTTPException
from sqlmodel import Session, delete, func, select

from ..models import CustomReport, CustomReportShare, User
from ..schemas import CustomReportRead, CustomReportSharesRead, CustomReportShareUserRead
from ..services import can_view_reports, effective_permissions


def user_can_view_reports(u: User | None) -> bool:
    if not u or not u.active:
        return False
    return can_view_reports(effective_permissions(u))


def custom_report_to_read(
    row: CustomReport,
    *,
    owner_name: str | None = None,
    shared_permission: str | None = None,
    individual_share_count: int = 0,
) -> CustomReportRead:
    return CustomReportRead(
        id=row.id,  # type: ignore[arg-type]
        owner_user_id=row.owner_user_id,
        title=row.title,
        description=row.description,
        layout_json=row.layout_json,
        shared_with_all=bool(getattr(row, "shared_with_all", False)),
        individual_share_count=individual_share_count,
        created_at=row.created_at,
        updated_at=row.updated_at,
        owner_name=owner_name,
        shared_permission=shared_permission,
    )


def list_owned(s: Session, user_id: int) -> list[CustomReportRead]:
    rows = s.exec(
        select(CustomReport)
        .where(CustomReport.owner_user_id == user_id)
        .order_by(CustomReport.updated_at.desc()),
    ).all()
    if not rows:
        return []
    ids = [r.id for r in rows if r.id is not None]
    counts: dict[int, int] = {}
    if ids:
        pairs = s.exec(
            select(CustomReportShare.report_id, func.count(CustomReportShare.id))
            .where(CustomReportShare.report_id.in_(ids))
            .group_by(CustomReportShare.report_id),
        ).all()
        counts = {int(rid): int(cnt) for rid, cnt in pairs}
    return [
        custom_report_to_read(r, individual_share_count=counts.get(r.id or 0, 0))
        for r in rows
    ]


def list_shared_with(s: Session, user_id: int) -> list[CustomReportRead]:
    seen: set[int] = set()
    out: list[CustomReportRead] = []

    shares = s.exec(
        select(CustomReportShare).where(
            CustomReportShare.shared_with_user_id == user_id,
        ),
    ).all()
    for sh in shares:
        row = s.get(CustomReport, sh.report_id)
        if not row or row.id in seen:
            continue
        if row.owner_user_id == user_id:
            continue
        seen.add(row.id)  # type: ignore[arg-type]
        owner = s.get(User, row.owner_user_id)
        out.append(
            custom_report_to_read(
                row,
                owner_name=owner.name if owner else None,
                shared_permission=sh.permission,
            ),
        )

    public_rows = s.exec(
        select(CustomReport).where(
            CustomReport.shared_with_all == True,  # noqa: E712
            CustomReport.owner_user_id != user_id,
        ),
    ).all()
    for row in public_rows:
        if row.id in seen:
            continue
        seen.add(row.id)  # type: ignore[arg-type]
        owner = s.get(User, row.owner_user_id)
        out.append(
            custom_report_to_read(
                row,
                owner_name=owner.name if owner else None,
                shared_permission="view",
            ),
        )

    out.sort(key=lambda x: x.updated_at, reverse=True)
    return out


def get_report_for_user(s: Session, report_id: int, user_id: int) -> CustomReport:
    row = s.get(CustomReport, report_id)
    if not row:
        raise HTTPException(404, "report not found")
    if row.owner_user_id == user_id:
        return row
    viewer = s.get(User, user_id)
    if not user_can_view_reports(viewer):
        raise HTTPException(403, "not allowed")
    if bool(getattr(row, "shared_with_all", False)):
        return row
    share = s.exec(
        select(CustomReportShare).where(
            CustomReportShare.report_id == report_id,
            CustomReportShare.shared_with_user_id == user_id,
        ),
    ).first()
    if not share:
        raise HTTPException(403, "not allowed")
    return row


def get_owned_report(s: Session, report_id: int, user_id: int) -> CustomReport:
    row = s.get(CustomReport, report_id)
    if not row:
        raise HTTPException(404, "report not found")
    if row.owner_user_id != user_id:
        raise HTTPException(403, "only owner can manage sharing")
    return row


def list_report_shares(s: Session, report_id: int, user_id: int) -> CustomReportSharesRead:
    row = get_owned_report(s, report_id, user_id)
    shares = s.exec(
        select(CustomReportShare).where(CustomReportShare.report_id == report_id),
    ).all()
    users: list[CustomReportShareUserRead] = []
    for sh in shares:
        u = s.get(User, sh.shared_with_user_id)
        if not u or not user_can_view_reports(u):
            continue
        users.append(
            CustomReportShareUserRead(
                user_id=u.id,  # type: ignore[arg-type]
                name=u.name,
                permission=sh.permission,
            ),
        )
    users.sort(key=lambda x: x.name.lower())
    return CustomReportSharesRead(
        shared_with_all=bool(getattr(row, "shared_with_all", False)),
        users=users,
    )


def update_report_sharing(
    s: Session,
    report_id: int,
    user_id: int,
    *,
    shared_with_all: bool | None,
) -> CustomReportRead:
    row = get_owned_report(s, report_id, user_id)
    if shared_with_all is not None:
        row.shared_with_all = shared_with_all
        s.add(row)
        s.commit()
        s.refresh(row)
    return custom_report_to_read(row)


def unshare_user(s: Session, report_id: int, owner_id: int, target_user_id: int) -> None:
    get_owned_report(s, report_id, owner_id)
    sh = s.exec(
        select(CustomReportShare).where(
            CustomReportShare.report_id == report_id,
            CustomReportShare.shared_with_user_id == target_user_id,
        ),
    ).first()
    if not sh:
        raise HTTPException(404, "share not found")
    s.delete(sh)
    s.commit()


def duplicate_report(s: Session, report_id: int, user_id: int) -> CustomReportRead:
    src = get_report_for_user(s, report_id, user_id)
    now = datetime.utcnow()
    copy = CustomReport(
        owner_user_id=user_id,
        title=f"{src.title} (copy)",
        description=src.description,
        layout_json=src.layout_json,
        shared_with_all=False,
        created_at=now,
        updated_at=now,
    )
    s.add(copy)
    s.commit()
    s.refresh(copy)
    return custom_report_to_read(copy)


def delete_all_custom_reports(s: Session) -> dict[str, int]:
    """Remove every saved custom report and share row (admin reset)."""
    shares = s.exec(select(func.count(CustomReportShare.id))).one() or 0
    reports = s.exec(select(func.count(CustomReport.id))).one() or 0
    s.exec(delete(CustomReportShare))
    s.exec(delete(CustomReport))
    s.commit()
    return {"deleted_custom_reports": reports, "deleted_shares": shares}
