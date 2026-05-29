"""Who may receive auto-assigned work."""
from __future__ import annotations

from datetime import datetime

from sqlmodel import Session, select

from .models import AuthSession, User
from .presence import is_user_present


def logged_in_user_ids(s: Session, now: datetime | None = None) -> set[int]:
    now = now or datetime.utcnow()
    rows = s.exec(
        select(AuthSession.user_id).where(AuthSession.expires_at > now),
    ).all()
    return {int(uid) for uid in rows}


def accepts_new_assignments(
    user: User,
    s: Session,
    *,
    now: datetime | None = None,
) -> bool:
    """Staff who are logged in and actively connected (online / idle / away tab)."""
    if not user.active or user.id is None:
        return False
    if user.id not in logged_in_user_ids(s, now):
        return False
    return is_user_present(user.id, now=now)
