"""Default department for built-in product category codes."""
from __future__ import annotations

FRONT_OFFICE_CODES = frozenset(
    {
        "FDQ",
        "GFT",
        "KEY",
        "MTG",
        "BNQ",
        "PHN",
        "FNB",
        "KIT",
        "BAR",
        "SPA",
        "SAL",
        "REC",
        "LIB",
        "MUS",
        "CAM",
    },
)

BELL_BOY_CODES = frozenset({"LUG", "CNB"})

MAINTENANCE_CODES = frozenset(
    {
        "ELC",
        "PLM",
        "HVAC",
        "BLB",
        "EQP",
        "ELP",
        "TVR",
        "SFT",
        "FIR",
        "MED",
        "NET",
        "PRT",
        "STN",
        "SEC",
        "TRN",
        "PET",
        "PRK",
        "OUT",
        "GDN",
        "PLS",
        "FIT",
    },
)

def default_department_for_category_code(code: str) -> str:
    c = (code or "").strip().upper()
    if c in BELL_BOY_CODES:
        return "bell_boy"
    if c in MAINTENANCE_CODES:
        return "maintenance"
    if c in FRONT_OFFICE_CODES:
        return "front_office"
    return "housekeeping"


def migrate_product_categories_department(s) -> None:
    from sqlmodel import select

    from ..models import ProductCategory

    for row in s.exec(select(ProductCategory)).all():
        dept = (getattr(row, "department", None) or "").strip()
        if dept:
            continue
        row.department = default_department_for_category_code(row.code)
        s.add(row)
    s.commit()
