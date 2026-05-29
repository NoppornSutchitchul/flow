"""Product → job-title routing for auto-assign and quick request."""
from __future__ import annotations

import json
from typing import Iterable, Optional

from sqlmodel import Session, select

from ..models import JobTitle, Product, Request, RequestItem, User


def job_title_departments_for_catalog(department: str) -> tuple[str, ...]:
    """Departments whose job-title presets apply to products in `department`."""
    code = (department or "").strip()
    if code == "bell_boy":
        return ("bell_boy", "front_office")
    if code:
        return (code,)
    return ()


def assignee_job_titles_json_from_payload(labels: Optional[list[str]]) -> Optional[str]:
    if not labels:
        return None
    cleaned = [str(x).strip() for x in labels if str(x).strip()]
    if not cleaned:
        return None
    return json.dumps(cleaned, ensure_ascii=False)


def parse_product_assignee_job_titles(product: Product) -> Optional[list[str]]:
    raw = getattr(product, "assignee_job_titles_json", None)
    if not raw or not str(raw).strip():
        return None
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return None
    if not isinstance(data, list):
        return None
    labels = [str(x).strip() for x in data if str(x).strip()]
    return labels or None


def validate_product_assignee_job_titles(
    s: Session,
    *,
    department: str,
    labels: Optional[list[str]],
) -> None:
    from fastapi import HTTPException

    if not labels:
        return
    allowed_depts = set(job_title_departments_for_catalog(department))
    for label in labels:
        clean = str(label).strip()
        if not clean:
            continue
        jt = s.exec(select(JobTitle).where(JobTitle.label == clean)).first()
        if not jt:
            raise HTTPException(400, "assignee job title not found")
        if jt.department not in allowed_depts:
            raise HTTPException(400, "assignee job title does not belong to department")


def allowed_job_titles_for_products(products: Iterable[Product]) -> Optional[set[str]]:
    """Intersection of per-product allowlists; None = no extra restriction."""
    narrowed: list[set[str]] = []
    for product in products:
        labels = parse_product_assignee_job_titles(product)
        if labels:
            narrowed.append(set(labels))
    if not narrowed:
        return None
    out = narrowed[0].copy()
    for extra in narrowed[1:]:
        out &= extra
    return out if out else set()


def user_matches_product_job_titles(
    user: User,
    allowed: Optional[set[str]],
) -> bool:
    if allowed is None:
        return True
    label = (user.job_title or "").strip()
    return label in allowed


def product_ids_for_request(s: Session, request: Request) -> list[int]:
    if request.id is None:
        return []
    items = list(
        s.exec(select(RequestItem).where(RequestItem.request_id == request.id)).all(),
    )
    return [int(i.product_id) for i in items if i.product_id is not None]


def products_for_ids(s: Session, product_ids: Optional[list[int]]) -> list[Product]:
    if not product_ids:
        return []
    out: list[Product] = []
    for pid in product_ids:
        p = s.get(Product, pid)
        if p:
            out.append(p)
    return out


def allowed_job_titles_for_request(
    s: Session,
    request: Request,
    *,
    product_ids: Optional[list[int]] = None,
) -> Optional[set[str]]:
    pids = product_ids if product_ids is not None else product_ids_for_request(s, request)
    return allowed_job_titles_for_products(products_for_ids(s, pids))
