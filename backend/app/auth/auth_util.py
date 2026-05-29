"""Session tokens for API authentication."""
from __future__ import annotations

import secrets
from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, HTTPException, Header
from sqlmodel import Session, select

from ..db import engine
from ..models import AuthSession, User


def create_session_token() -> str:
    return secrets.token_urlsafe(32)


def create_auth_session(user_id: int) -> str:
    token = create_session_token()
    with Session(engine) as s:
        s.add(
            AuthSession(
                token=token,
                user_id=user_id,
                expires_at=session_expiry(),
            ),
        )
        s.commit()
    return token


def revoke_auth_session(token: str) -> None:
    with Session(engine) as s:
        row = s.get(AuthSession, token)
        if row:
            s.delete(row)
            s.commit()


def get_user_for_token(token: str) -> Optional[User]:
    with Session(engine) as s:
        sess = s.get(AuthSession, token)
        if not sess:
            return None
        if sess.expires_at < datetime.utcnow():
            s.delete(sess)
            s.commit()
            return None
        return s.get(User, sess.user_id)


def session_expiry() -> datetime:
    return datetime.utcnow() + timedelta(days=30)


def get_current_user(
    authorization: Optional[str] = Header(default=None),
) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "not authenticated")
    token = authorization[7:].strip()
    user = get_user_for_token(token)
    if not user:
        raise HTTPException(401, "invalid or expired session")
    if not user.active:
        raise HTTPException(403, "account suspended")
    return user


def get_optional_user(
    authorization: Optional[str] = Header(default=None),
) -> Optional[User]:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    token = authorization[7:].strip()
    return get_user_for_token(token)
