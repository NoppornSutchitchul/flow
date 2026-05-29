"""Tiny pub/sub WebSocket hub.

Anything that mutates state (create request, accept, deliver, stock adjust)
publishes an event so every connected client refreshes the relevant query.
"""
from __future__ import annotations

import asyncio
import json
from typing import Any

from fastapi import WebSocket


class Hub:
    def __init__(self) -> None:
        self._clients: set[WebSocket] = set()
        self._user_by_ws: dict[WebSocket, int] = {}
        self._lock = asyncio.Lock()
        # we publish from sync request handlers via the running loop
        self._loop: asyncio.AbstractEventLoop | None = None

    def attach_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

    async def connect(self, ws: WebSocket, *, user_id: int | None = None) -> None:
        await ws.accept()
        async with self._lock:
            self._clients.add(ws)
            if user_id is not None:
                self._user_by_ws[ws] = user_id

    async def disconnect(self, ws: WebSocket) -> int | None:
        async with self._lock:
            self._clients.discard(ws)
            return self._user_by_ws.pop(ws, None)

    async def disconnect_user(self, user_id: int) -> None:
        """Close every socket for this user (logout / session revoked)."""
        async with self._lock:
            targets = [
                ws for ws, uid in self._user_by_ws.items() if uid == user_id
            ]
        for ws in targets:
            try:
                await ws.close(code=1000)
            except Exception:
                pass

    def disconnect_user_sessions(self, user_id: int) -> None:
        """Schedule disconnect_user from sync route handlers."""
        if self._loop and self._loop.is_running():
            asyncio.run_coroutine_threadsafe(
                self.disconnect_user(user_id), self._loop,
            )

    async def _broadcast(self, payload: dict[str, Any]) -> None:
        data = json.dumps(payload, default=str)
        dead: list[WebSocket] = []
        async with self._lock:
            clients = list(self._clients)
        for ws in clients:
            try:
                await ws.send_text(data)
            except Exception:
                dead.append(ws)
        if dead:
            async with self._lock:
                for ws in dead:
                    self._clients.discard(ws)

    def publish(self, topic: str, payload: dict[str, Any] | None = None) -> None:
        """Schedule a broadcast from sync code (FastAPI route handler)."""
        msg = {"topic": topic, "data": payload or {}}
        if self._loop and self._loop.is_running():
            asyncio.run_coroutine_threadsafe(self._broadcast(msg), self._loop)


hub = Hub()
