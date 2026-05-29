"""Write audit rows for the activity-log report."""
from __future__ import annotations

import json
from typing import Any, Optional

from sqlmodel import Session

from .models import ActivityLog, User


def _actor_label(user: User | None) -> str | None:
    if not user:
        return None
    return (user.name or "").strip() or (user.username or "").strip() or None


def log_activity(
    s: Session,
    *,
    action: str,
    summary: str,
    actor: User | None = None,
    actor_id: int | None = None,
    actor_label: str | None = None,
    entity_type: str | None = None,
    entity_id: int | None = None,
    metadata: dict[str, Any] | None = None,
) -> ActivityLog:
    aid = actor_id if actor_id is not None else (actor.id if actor else None)
    label = actor_label or _actor_label(actor)
    row = ActivityLog(
        actor_id=aid,
        actor_label=label,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        summary=summary.strip(),
        metadata_json=json.dumps(metadata, ensure_ascii=False) if metadata else None,
    )
    s.add(row)
    return row
