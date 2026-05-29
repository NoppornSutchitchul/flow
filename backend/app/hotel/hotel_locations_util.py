"""Helpers for hotel location codes (internal — not edited in admin UI)."""
from __future__ import annotations

import re

from sqlmodel import Session, select

from ..models import HotelLocation

_CODE_PREFIX = "HK-LOC-"


def slug_code_from_label(label: str) -> str:
    raw = re.sub(r"[^A-Za-z0-9]+", "-", label.strip().upper())
    raw = re.sub(r"-+", "-", raw).strip("-")
    body = (raw[:40] if raw else "PLACE")
    return f"{_CODE_PREFIX}{body}"


def unique_hotel_location_code(label: str, session: Session, *, exclude_id: int | None = None) -> str:
    base = slug_code_from_label(label)
    code = base
    n = 2
    while True:
        row = session.exec(select(HotelLocation).where(HotelLocation.code == code)).first()
        if row is None or (exclude_id is not None and row.id == exclude_id):
            return code
        code = f"{base}-{n}"
        n += 1
