"""Default emoji for hotel location codes (admin cards + quick-request)."""
from __future__ import annotations

import re

# Explicit emoji per catalog code — keep in sync with src/lib/hotelLocationEmojiMap.ts
CODE_TO_EMOJI: dict[str, str] = {
    "HK-LOC-HALL": "🏛️",
    "HK-LOC-LOBBY": "🛋️",
    "HK-LOC-FRONT-DESK": "🛎️",
    "HK-LOC-CONCIERGE": "🗺️",
    "HK-LOC-BELL-DESK": "🧳",
    "HK-LOC-LUGGAGE": "🛄",
    "HK-LOC-BUSINESS": "💼",
    "HK-LOC-VIP-LOUNGE": "👑",
    "HK-LOC-LIFT": "🛗",
    "HK-LOC-LOBBY-WR-F": "🚺",
    "HK-LOC-LOBBY-WR-M": "🚻",
    "HK-LOC-POOL-WR-F": "🚺",
    "HK-LOC-POOL-WR-M": "🚻",
    "HK-LOC-STAFF-WR-F": "🚺",
    "HK-LOC-STAFF-WR-M": "🚻",
    "HK-LOC-FRONT-OFFICE": "📋",
    "HK-LOC-OFF-HK": "🧹",
    "HK-LOC-OFF-MT": "🔧",
    "HK-LOC-OFF-FNB": "🍽️",
    "HK-LOC-OFF-SALES": "📈",
    "HK-LOC-OFF-HR": "👥",
    "HK-LOC-OFF-FIN": "💰",
    "HK-LOC-OFF-ENG": "⚙️",
    "HK-LOC-OFF-SEC": "🛡️",
    "HK-LOC-OFF-GM": "🏢",
    "HK-LOC-KITCH-HOT": "🔥",
    "HK-LOC-KITCH-COLD": "🧊",
    "HK-LOC-BANQUET-PREP": "🍱",
    "HK-LOC-STEWARD": "🍽️",
    "HK-LOC-LINEN": "🛏️",
    "HK-LOC-LAUNDRY": "👕",
    "HK-LOC-HK-PANTRY-T1": "🧴",
    "HK-LOC-HK-PANTRY-T2": "🧴",
    "HK-LOC-LOCKER": "🔐",
    "HK-LOC-CANTEEN": "🍛",
    "HK-LOC-UNIFORM": "👔",
    "HK-LOC-LOADING": "🚚",
    "HK-LOC-GARBAGE": "🗑️",
    "HK-LOC-STAFF-ENT": "🚪",
    "HK-LOC-STORAGE": "📦",
    "HK-LOC-RESTAURANT": "🍴",
    "HK-LOC-BAR": "🍸",
    "HK-LOC-CAFE": "☕",
    "HK-LOC-ROOM-SERVICE": "🛎️",
    "HK-LOC-POOL": "🏊",
    "HK-LOC-POOL-DECK": "☀️",
    "HK-LOC-FITNESS": "🏋️",
    "HK-LOC-SPA": "💆",
    "HK-LOC-SAUNA": "🧖",
    "HK-LOC-SALON": "💇",
    "HK-LOC-KIDS": "🧸",
    "HK-LOC-MEETING": "📊",
    "HK-LOC-BALLROOM": "💃",
    "HK-LOC-EVENT": "🎉",
    "HK-LOC-PRE-FUNC": "🥂",
    "HK-LOC-PARKING": "🅿️",
    "HK-LOC-PORTICO": "🏨",
    "HK-LOC-DRIVEWAY": "🛣️",
    "HK-LOC-GARDEN": "🌳",
    "HK-LOC-TERRACE": "🌿",
    "HK-LOC-WALKWAY": "🚶",
    "HK-LOC-ROOFTOP": "🌆",
    "HK-LOC-T1-STAIR": "🪜",
    "HK-LOC-T2-STAIR": "🪜",
    "HK-LOC-WAITING": "⏳",
    "HK-LOC-GIFT-SHOP": "🎁",
    "HK-LOC-MINI-MART": "🏪",
    "HK-LOC-EXEC-LOUNGE": "🥃",
    "HK-LOC-CLUB-LOUNGE": "🎩",
    "HK-LOC-REST-WR-F": "🚺",
    "HK-LOC-REST-WR-M": "🚻",
    "HK-LOC-SPA-WR-F": "🚺",
    "HK-LOC-SPA-WR-M": "🚻",
    "HK-LOC-FIT-WR-F": "🚺",
    "HK-LOC-FIT-WR-M": "🚻",
    "HK-LOC-BALL-WR-F": "🚺",
    "HK-LOC-BALL-WR-M": "🚻",
    "HK-LOC-TERRACE-REST": "🍽️",
    "HK-LOC-LOTUS-GARDEN": "🥟",
    "HK-LOC-RIVERSIDE-GRILL": "🥩",
    "HK-LOC-SKY-BAR": "🌃",
    "HK-LOC-POOL-BAR": "🍹",
    "HK-LOC-LOBBY-LOUNGE": "🫖",
    "HK-LOC-BAKERY": "🥐",
    "HK-LOC-INROOM-PICKUP": "🍱",
    "HK-LOC-TEA-LOUNGE": "🍵",
    "HK-LOC-POOL-KIDS": "👶",
    "HK-LOC-JACUZZI": "♨️",
    "HK-LOC-POOL-TOWEL": "🏖️",
    "HK-LOC-SPA-RECEPT": "📅",
    "HK-LOC-YOGA": "🧘",
    "HK-LOC-GAME-ROOM": "🎮",
    "HK-LOC-MEET-EMERALD": "💚",
    "HK-LOC-MEET-SAPPHIRE": "💙",
    "HK-LOC-MEET-RUBY": "❤️",
    "HK-LOC-BOARDROOM": "🤝",
    "HK-LOC-BRIDAL": "💒",
    "HK-LOC-VALET": "🚗",
    "HK-LOC-TAXI": "🚕",
    "HK-LOC-SHUTTLE": "🚌",
    "HK-LOC-EV-CHARGE": "🔌",
    "HK-LOC-SMOKING": "🚬",
    "HK-LOC-FIRST-AID": "⛑️",
    "HK-LOC-PRAYER": "🕌",
    "HK-LOC-WATER-FEATURE": "⛲",
}

_CORRIDOR_EMOJI = "🚶"
_LIFT_EMOJI = "🛗"
_WR_SUFFIX_EMOJI = {"F": "🚺", "M": "🚻"}


def infer_hotel_location_emoji(code: str) -> str:
    c = (code or "").strip().upper()
    if not c:
        return "📍"
    if c in CODE_TO_EMOJI:
        return CODE_TO_EMOJI[c]

    if re.fullmatch(r"HK-LOC-T\d+-F\d+-CORR", c) or "-CORR" in c:
        return _CORRIDOR_EMOJI
    if re.fullmatch(r"HK-LOC-T\d+-LIFT-[A-Z0-9]+", c) or "-LIFT-" in c:
        return _LIFT_EMOJI
    if "-PANTRY-" in c:
        return "🧴"

    if "WR-" in c or c.endswith("-WR-F") or c.endswith("-WR-M"):
        for suffix, emoji in _WR_SUFFIX_EMOJI.items():
            if c.endswith(f"-{suffix}") or f"-WR-{suffix}" in c:
                return emoji
        return "🚻"

    return "📍"


def backfill_hotel_location_icon_emojis(engine) -> None:
    from sqlalchemy import text
    from sqlmodel import Session, select

    from ..db import dialect_is_sqlite
    from ..models import HotelLocation

    if dialect_is_sqlite(engine):
        with engine.begin() as conn:
            rows = conn.execute(text("PRAGMA table_info(hotellocation)")).fetchall()
            colnames = {r[1] for r in rows} if rows else set()
            if colnames and "icon_emoji" not in colnames:
                conn.execute(text("ALTER TABLE hotellocation ADD COLUMN icon_emoji VARCHAR"))

    with Session(engine) as s:
        for row in s.exec(select(HotelLocation)).all():
            emoji = infer_hotel_location_emoji(row.code)
            if row.icon_emoji != emoji:
                row.icon_emoji = emoji
                s.add(row)
        s.commit()
