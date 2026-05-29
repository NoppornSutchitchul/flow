"""In-memory staff presence for assignment routing (online / idle / away)."""
from __future__ import annotations

from datetime import datetime, timedelta
from threading import Lock

ASSIGNABLE_STATUSES = frozenset({"online", "idle", "away"})
PRESENCE_TTL = timedelta(seconds=90)

_lock = Lock()
_presence: dict[int, tuple[str, datetime]] = {}


def set_user_presence(user_id: int, status: str) -> None:
    with _lock:
        if status == "offline" or status not in ASSIGNABLE_STATUSES:
            _presence.pop(user_id, None)
            return
        _presence[user_id] = (status, datetime.utcnow())


def clear_user_presence(user_id: int) -> None:
    with _lock:
        _presence.pop(user_id, None)


def is_user_present(user_id: int, *, now: datetime | None = None) -> bool:
    now = now or datetime.utcnow()
    with _lock:
        row = _presence.get(user_id)
        if not row:
            return False
        status, at = row
        if now - at > PRESENCE_TTL:
            _presence.pop(user_id, None)
            return False
        return status in ASSIGNABLE_STATUSES
