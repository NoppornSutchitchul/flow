"""Department code helpers."""
from __future__ import annotations

import re

from sqlmodel import Session, select

from ..models import OrgDepartment


def slug_department_code(label: str) -> str:
    raw = re.sub(r"[^A-Za-z0-9]+", "_", label.strip().lower())
    raw = re.sub(r"_+", "_", raw).strip("_")
    return (raw[:48] if raw else "department")


def unique_department_code(label: str, session: Session, *, exclude_id: int | None = None) -> str:
    base = slug_department_code(label)
    code = base
    n = 2
    while True:
        row = session.exec(select(OrgDepartment).where(OrgDepartment.code == code)).first()
        if row is None or (exclude_id is not None and row.id == exclude_id):
            return code
        code = f"{base}_{n}"
        n += 1
