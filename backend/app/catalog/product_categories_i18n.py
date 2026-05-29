"""English display names for product categories (Thai `name` is canonical)."""
from __future__ import annotations

from .product_categories_seed import SEED_ROWS

_CATEGORY_EN_BY_TH: dict[str, str] = {
    th: en for _code, th, en, _emoji in SEED_ROWS
}


def resolved_category_names(
    name_th: str,
    *,
    name_en: str | None = None,
    name_my: str | None = None,
    name_lo: str | None = None,
) -> tuple[str, str]:
    """Return (name_th, name_en). Legacy my/lo columns are ignored."""
    _ = name_my, name_lo
    th = name_th.strip()
    en = (name_en or "").strip() or _CATEGORY_EN_BY_TH.get(th, th)
    return th, en
