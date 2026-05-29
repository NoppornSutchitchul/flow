"""Thai and English display names for catalog products."""
from __future__ import annotations

from .product_catalog import catalog_thai_name
from .product_name_cleanup import strip_legacy_product_suffix
from .product_names_en import english_product_name


def resolved_product_names(
    sku: str,
    name: str,
    *,
    name_en: str | None = None,
    name_my: str | None = None,
    name_lo: str | None = None,
) -> tuple[str, str]:
    """Return canonical (name_th, name_en). Legacy my/lo columns are ignored."""
    _ = name_my, name_lo
    catalog_th = catalog_thai_name(sku)
    th_raw = strip_legacy_product_suffix(name) or name
    th = catalog_th or th_raw
    en = strip_legacy_product_suffix(name_en) if name_en else None
    en = en or english_product_name(sku, th)
    return th, en


def localized_product_name(sku: str, th_name: str, lang: str) -> str:
    code = (lang or "th").split("-")[0].lower()
    if code == "en":
        return english_product_name(sku, th_name)
    return catalog_thai_name(sku) or th_name
