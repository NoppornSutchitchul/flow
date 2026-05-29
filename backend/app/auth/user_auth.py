"""Username helpers for staff accounts."""
from __future__ import annotations

import re

from sqlmodel import Session, select

from ..models import User


def normalize_username(value: str) -> str:
    return " ".join(value.strip().split())


_LOGIN_USERNAME_RE = re.compile(r"^[A-Za-z0-9._-]+$")
LOGIN_USERNAME_MIN_LENGTH = 2


def validate_login_username(value: str) -> str:
    """Normalize and validate an admin-chosen login username."""
    u = value.strip()
    if len(u) < LOGIN_USERNAME_MIN_LENGTH:
        raise ValueError("too_short")
    if " " in u or not _LOGIN_USERNAME_RE.match(u):
        raise ValueError("invalid_chars")
    return u


def _last_part_is_initial(part: str) -> bool:
    p = part.rstrip(".").strip()
    return len(p) == 1 and p.isalpha()


def username_base_from_display_name(display_name: str) -> str:
    """Login id from display name — first name + surname initial when present (e.g. Narisa H. → NarisaH)."""
    parts = [p for p in display_name.strip().split() if p]
    if not parts:
        return ""
    first = parts[0]
    if len(parts) >= 2 and _last_part_is_initial(parts[-1]):
        initial = parts[-1].rstrip(".")[0]
        return normalize_username(f"{first}{initial}")
    return normalize_username(first)


def first_name_from_display_name(display_name: str) -> str:
    """First token only (legacy)."""
    parts = display_name.strip().split()
    if not parts:
        return ""
    return normalize_username(parts[0])


def username_taken(
    s: Session,
    username: str,
    exclude_id: int | None = None,
    *,
    extra_taken: frozenset[str] | None = None,
) -> bool:
    key = normalize_username(username).casefold()
    if extra_taken:
        for other in extra_taken:
            if normalize_username(other).casefold() == key:
                return True
    for row in s.exec(select(User)).all():
        if exclude_id is not None and row.id == exclude_id:
            continue
        existing = (row.username or "").strip()
        if existing and normalize_username(existing).casefold() == key:
            return True
    return False


def derive_username(
    s: Session,
    display_name: str,
    exclude_id: int | None = None,
    *,
    extra_taken: frozenset[str] | None = None,
) -> str:
    base = username_base_from_display_name(display_name)
    if not base:
        raise ValueError("empty username")
    if not username_taken(s, base, exclude_id, extra_taken=extra_taken):
        return base
    n = 2
    while username_taken(s, f"{base} ({n})", exclude_id, extra_taken=extra_taken):
        n += 1
    return f"{base} ({n})"


def _login_lookup_keys(raw: str) -> list[str]:
    """Normalized casefold keys to try when matching a login id."""
    u = normalize_username(raw)
    if not u:
        return []
    keys: list[str] = [u.casefold()]
    derived = username_base_from_display_name(u).casefold()
    if derived and derived not in keys:
        keys.append(derived)
    compact = u.replace(" ", "").casefold()
    if compact and compact not in keys:
        keys.append(compact)
    return keys


def find_user_by_username(s: Session, username: str) -> User | None:
    keys = _login_lookup_keys(username)
    if not keys:
        return None
    users = list(s.exec(select(User).order_by(User.id)).all())

    for row in users:
        existing = normalize_username(row.username or "").casefold()
        if existing and existing in keys:
            return row

    for row in users:
        stored_derived = username_base_from_display_name(row.name).casefold()
        if stored_derived and stored_derived in keys:
            return row

    return None
