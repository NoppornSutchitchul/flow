"""Remove legacy (ยืม)/(เติม) suffixes from catalog display names."""
from __future__ import annotations

import re

from sqlmodel import Session, select

from ..db import engine
from ..models import Product, Request
from .product_names_en import english_product_name

TH_SUFFIXES = (" (ยืม)", " (เติม)")
EN_PAREN_SUFFIX_RE = re.compile(
    r"\s+\((?:loan(?:er)?|refill)\)\s*$",
    re.IGNORECASE,
)
EN_TRAILING_WORD_SUFFIX_RE = re.compile(
    r"\s+(?:loan(?:er)?|refill)\s*$",
    re.IGNORECASE,
)
EN_SKIP_TRAILING_RE = re.compile(r"\band\b|/|,", re.IGNORECASE)

ITEMS_TEXT_SUFFIXES = (
    *TH_SUFFIXES,
    " (loan)",
    " (loaner)",
    " (refill)",
    " (Loan)",
    " (Loaner)",
    " (Refill)",
)


def strip_legacy_product_suffix(name: str | None) -> str | None:
    if name is None:
        return None
    trimmed = name.strip()
    if not trimmed:
        return trimmed
    out = trimmed
    for suffix in TH_SUFFIXES:
        out = out.replace(suffix, "")
    out = EN_PAREN_SUFFIX_RE.sub("", out)
    if not EN_SKIP_TRAILING_RE.search(out):
        out = EN_TRAILING_WORD_SUFFIX_RE.sub("", out)
    result = out.strip()
    return result or trimmed


def backfill_all_product_category_i18n_columns(session: Session | None = None) -> int:
    """Fill name_en for every product category."""
    from ..models import ProductCategory
    from .product_categories_i18n import resolved_category_names

    changed = 0

    def _apply(s: Session) -> None:
        nonlocal changed
        for row in s.exec(select(ProductCategory)).all():
            th, en = resolved_category_names(
                row.name,
                name_en=row.name_en,
                name_my=row.name_my,
                name_lo=row.name_lo,
            )
            if row.name == th and (row.name_en or "") == en:
                continue
            row.name = th
            row.name_en = en
            s.add(row)
            changed += 1

    if session is not None:
        _apply(session)
        return changed

    with Session(engine) as s:
        _apply(s)
        s.commit()
    return changed


def backfill_all_product_i18n_columns(session: Session | None = None) -> int:
    """Rewrite name / name_en and unit / unit_en for every product."""
    from .product_names_i18n import resolved_product_names
    from .product_units_i18n import resolved_product_units

    changed = 0

    def _apply(session: Session) -> None:
        nonlocal changed
        for product in session.exec(select(Product)).all():
            th, en = resolved_product_names(
                product.sku,
                product.name,
                name_en=product.name_en,
                name_my=product.name_my,
                name_lo=product.name_lo,
            )
            uth, uen = resolved_product_units(
                product.unit,
                unit_en=product.unit_en,
                unit_my=product.unit_my,
                unit_lo=product.unit_lo,
            )
            if (
                product.name == th
                and product.name_en == en
                and product.unit == uth
                and product.unit_en == uen
            ):
                continue
            product.name = th
            product.name_en = en
            product.unit = uth
            product.unit_en = uen
            session.add(product)
            changed += 1

    if session is not None:
        _apply(session)
        return changed

    with Session(engine) as s:
        _apply(s)
        if changed:
            s.commit()
    return changed


def normalize_all_product_names(session: Session | None = None) -> int:
    """Strip legacy suffixes from every product row and refresh English labels."""
    changed = 0

    def _apply(session: Session) -> None:
        nonlocal changed
        from .product_catalog import catalog_thai_name

        for product in session.exec(select(Product)).all():
            clean_name = strip_legacy_product_suffix(product.name) or product.name
            clean_en = strip_legacy_product_suffix(product.name_en)

            updated = False
            catalog_th = catalog_thai_name(product.sku)
            if catalog_th and clean_name != product.name:
                product.name = catalog_th
                product.name_en = english_product_name(product.sku, catalog_th)
                updated = True
            elif clean_name != product.name:
                product.name = clean_name
                product.name_en = english_product_name(product.sku, clean_name)
                updated = True
            elif clean_en is not None and clean_en != product.name_en:
                product.name_en = clean_en
                updated = True

            if updated:
                session.add(product)
                changed += 1

    if session is not None:
        _apply(session)
        return changed

    with Session(engine) as s:
        _apply(s)
        if changed:
            s.commit()
    return changed


def strip_legacy_suffixes_from_items_text() -> None:
    """Remove legacy suffixes from cached request summaries."""
    with Session(engine) as s:
        changed = False
        for req in s.exec(select(Request)).all():
            if not req.items_text:
                continue
            updated = req.items_text
            for suffix in ITEMS_TEXT_SUFFIXES:
                updated = updated.replace(suffix, "")
            if updated != req.items_text:
                req.items_text = updated
                s.add(req)
                changed = True
        if changed:
            s.commit()
