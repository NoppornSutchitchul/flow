"""Password hashing (stdlib only — no extra dependencies)."""
from __future__ import annotations

import hashlib
import hmac
import re
import secrets

PASSWORD_MIN_LENGTH = 4
# Printable ASCII except space: A–Z, a–z, 0–9, and special characters.
_PASSWORD_CHARS_RE = re.compile(r"^[\x21-\x7E]+$")

_ITERATIONS = 260_000
_SALT_BYTES = 16


def validate_new_password(plain: str) -> None:
    """Raise ValueError with a short code if password rules fail."""
    pw = (plain or "").strip()
    if len(pw) < PASSWORD_MIN_LENGTH:
        raise ValueError("too_short")
    if not _PASSWORD_CHARS_RE.match(pw):
        raise ValueError("invalid_chars")


def hash_password(plain: str) -> str:
    salt = secrets.token_bytes(_SALT_BYTES)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        plain.encode("utf-8"),
        salt,
        _ITERATIONS,
    )
    return f"pbkdf2_sha256${_ITERATIONS}${salt.hex()}${digest.hex()}"


def verify_password(plain: str, stored: str) -> bool:
    if not stored or not plain:
        return False
    try:
        algo, iterations_s, salt_hex, digest_hex = stored.split("$", 3)
        if algo != "pbkdf2_sha256":
            return False
        iterations = int(iterations_s)
        salt = bytes.fromhex(salt_hex)
        expected = bytes.fromhex(digest_hex)
    except (ValueError, TypeError):
        return False
    got = hashlib.pbkdf2_hmac(
        "sha256",
        plain.encode("utf-8"),
        salt,
        iterations,
    )
    return hmac.compare_digest(got, expected)
