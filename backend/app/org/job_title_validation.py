"""Validate admin job-title preset labels (English only)."""
from __future__ import annotations

import re

from fastapi import HTTPException

_THAI = re.compile(r"[\u0E00-\u0E7F]")
_MYANMAR = re.compile(r"[\u1000-\u109F]")
_LAO = re.compile(r"[\u0E80-\u0EFF]")
_LATIN = re.compile(r"[A-Za-z]")


def normalize_english_label(raw: str) -> str:
    label = (raw or "").strip()
    if not label:
        raise HTTPException(400, "label required")
    if _THAI.search(label) or _MYANMAR.search(label) or _LAO.search(label):
        raise HTTPException(400, "label must be English only")
    if not _LATIN.search(label):
        raise HTTPException(400, "label must contain English letters")
    return label


def normalize_job_title_label(raw: str) -> str:
    """Alias for job titles and department names."""
    return normalize_english_label(raw)
