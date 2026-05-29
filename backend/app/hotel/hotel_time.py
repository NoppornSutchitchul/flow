"""Hotel-local clock (UTC+7)."""
from __future__ import annotations

from datetime import datetime, timedelta

HOTEL_TZ_OFFSET = timedelta(hours=7)


def hotel_local_now(utc_now: datetime | None = None) -> datetime:
    return (utc_now or datetime.utcnow()) + HOTEL_TZ_OFFSET
