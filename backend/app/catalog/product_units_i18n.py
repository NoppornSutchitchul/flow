"""Thai product unit (classifier) → English."""
from __future__ import annotations

import re

_THAI = re.compile(r"[\u0E00-\u0E7F]")
_ASCII = re.compile(r"^[A-Za-z0-9 .,&'()\-–—/]+$")

TH_TO_EN: dict[str, str] = {
    "คู่": "pair",
    "ขวด": "bottle",
    "ชุด": "set",
    "คัน": "unit",
    "อัน": "pcs",
    "ผืน": "sheet",
    "แผ่น": "sheet",
    "ชิ้น": "piece",
    "กล่อง": "box",
    "ถุง": "bag",
    "หลอด": "tube",
    "แพ็ก": "pack",
    "ใบ": "sheet",
    "เส้น": "strand",
    "ม้วน": "roll",
    "แกลลอน": "gallon",
    "ถัง": "tank",
    "ถ้วย": "cup",
    "ซอง": "sachet",
    "กระป๋อง": "can",
    "ก้อน": "piece",
    "ตัว": "unit",
    "เม็ด": "tablet",
    "เล่ม": "roll",
    "แท่ง": "bar",
    "บาน": "panel",
    "ป้าย": "sign",
    "เครื่อง": "unit",
    "เตียง": "bed",
}


def _unit_needs_locale_fix(stored: str | None, locale: str) -> bool:
    if not stored or not stored.strip():
        return True
    s = stored.strip()
    if locale == "en":
        return bool(_THAI.search(s)) or not _ASCII.match(s)
    return False


def resolved_product_units(
    unit: str | None,
    unit_en: str | None = None,
    unit_my: str | None = None,
    unit_lo: str | None = None,
) -> tuple[str | None, str | None]:
    """Return (unit_th, unit_en). Legacy my/lo columns are ignored."""
    _ = unit_my, unit_lo
    th = (unit or "").strip() or None
    if not th:
        return None, None

    en = (unit_en or "").strip()
    if _unit_needs_locale_fix(en, "en"):
        en = TH_TO_EN.get(th, en)
    en = en or TH_TO_EN.get(th, th)
    return th, en
