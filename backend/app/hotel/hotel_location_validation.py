"""Validate hotel location display labels (Thai / English)."""
from __future__ import annotations

import re

from fastapi import HTTPException
from sqlmodel import Session, select

from ..models import HotelLocation

_THAI = re.compile(r"[\u0E00-\u0E7F]")
_MYANMAR = re.compile(r"[\u1000-\u109F]")
_LAO = re.compile(r"[\u0E80-\u0EFF]")
_LATIN = re.compile(r"[A-Za-z]")


def _th_ok(value: str) -> bool:
    if not value or _MYANMAR.search(value) or _LAO.search(value):
        return False
    if _LATIN.search(value):
        return False
    return bool(_THAI.search(value)) or value.isdigit()


def _en_ok(value: str) -> bool:
    if not value:
        return False
    return not (_THAI.search(value) or _MYANMAR.search(value) or _LAO.search(value))


def normalize_hotel_location_labels(
    label: str | None,
    label_en: str | None,
    label_my: str | None = None,
    label_lo: str | None = None,
) -> tuple[str, str]:
    _ = label_my, label_lo
    th = (label or "").strip()
    en = (label_en or "").strip()
    if not _th_ok(th):
        raise HTTPException(400, "invalid Thai label")
    if not _en_ok(en):
        raise HTTPException(400, "invalid English label")
    return th, en


def _norm(locale: str, value: str) -> str:
    v = value.strip()
    return v.casefold() if locale == "en" else v


def assert_no_duplicate_labels(
    session: Session,
    th: str,
    en: str,
    my: str | None = None,
    lo: str | None = None,
    *,
    exclude_id: int | None = None,
) -> None:
    _ = my, lo
    pairs = (("th", th), ("en", en))
    rows = list(session.exec(select(HotelLocation)).all())
    for locale, value in pairs:
        needle = _norm(locale, value)
        if not needle:
            continue
        for row in rows:
            if exclude_id is not None and row.id == exclude_id:
                continue
            existing = {
                "th": row.label or "",
                "en": row.label_en or "",
            }[locale]
            if _norm(locale, existing) == needle:
                raise HTTPException(409, "duplicate label")
