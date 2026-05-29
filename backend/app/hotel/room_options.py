"""Configurable guest-room attribute options (building, floor, type, view, size, bed)."""
from __future__ import annotations

import re

from fastapi import HTTPException
from sqlmodel import Session, select

from ..models import GuestRoom, RoomAttributeOption

ROOM_OPTION_KINDS = frozenset({"building", "floor", "type", "view", "size", "bed"})
BILINGUAL_KINDS = frozenset({"building", "floor", "view", "bed"})

_CODE_RE = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9_-]{0,31}$")


def _read_row(row: RoomAttributeOption) -> dict:
    return {
        "id": row.id,
        "kind": row.kind,
        "code": row.code,
        "label_th": row.label_th or "",
        "label_en": row.label_en or "",
        "value_num": row.value_num,
        "sort_order": row.sort_order,
    }


def list_room_options(s: Session) -> list[dict]:
    rows = list(
        s.exec(
            select(RoomAttributeOption).order_by(
                RoomAttributeOption.kind,
                RoomAttributeOption.sort_order,
                RoomAttributeOption.code,
            ),
        ).all(),
    )
    return [_read_row(r) for r in rows]


def _normalize_code(kind: str, raw: str) -> str:
    code = raw.strip()
    if not code:
        raise HTTPException(400, "code required")
    if kind in ("building", "floor", "size"):
        if not code.isdigit():
            raise HTTPException(400, "code must be numeric")
        return code
    if kind == "type":
        return code  # preserve Superior, Deluxe, etc.
    if not _CODE_RE.match(code):
        raise HTTPException(400, "invalid code")
    return code.lower() if kind in ("view", "bed") else code


def _validate_labels(kind: str, label_th: str | None, label_en: str | None) -> tuple[str, str]:
    th = (label_th or "").strip()
    en = (label_en or "").strip()
    if kind in BILINGUAL_KINDS:
        if not th:
            raise HTTPException(400, "Thai label required")
        if not en:
            raise HTTPException(400, "English label required")
        return th, en
    if kind == "type":
        if not th or not en:
            raise HTTPException(400, "labels required")
        return th, en
    if kind == "size":
        return th or "", en or ""
    return th, en


def _validate_value_num(kind: str, value_num: int | None, code: str) -> int | None:
    if kind != "size":
        return None
    if value_num is None:
        try:
            value_num = int(code)
        except ValueError:
            raise HTTPException(400, "size value required") from None
    if value_num < 15 or value_num > 200:
        raise HTTPException(400, "size must be 15–200 sqm")
    return value_num


def _strip_opt_label(value: str | None) -> str | None:
    if value is None:
        return None
    v = value.strip()
    return v or None


def create_room_option(
    s: Session,
    *,
    kind: str,
    code: str,
    label_th: str | None = None,
    label_en: str | None = None,
    value_num: int | None = None,
) -> dict:
    k = kind.strip().lower()
    if k not in ROOM_OPTION_KINDS:
        raise HTTPException(400, "invalid kind")
    c = _normalize_code(k, code)
    th, en = _validate_labels(k, label_th, label_en)
    vn = _validate_value_num(k, value_num, c)
    if k == "size":
        c = str(vn)
        if not th:
            th = f"{vn} ตร.ม."
        if not en:
            en = f"{vn} sqm"
    dup = s.exec(
        select(RoomAttributeOption).where(
            RoomAttributeOption.kind == k,
            RoomAttributeOption.code == c,
        ),
    ).first()
    if dup:
        raise HTTPException(409, "duplicate option")
    max_sort = s.exec(
        select(RoomAttributeOption.sort_order).where(RoomAttributeOption.kind == k),
    ).all()
    next_sort = (max(max_sort)[0] if max_sort else 0) + 1
    row = RoomAttributeOption(
        kind=k,
        code=c,
        label_th=th,
        label_en=en,
        value_num=vn,
        sort_order=next_sort,
    )
    s.add(row)
    s.commit()
    s.refresh(row)
    return _read_row(row)


def _migrate_guest_rooms_for_code(
    s: Session,
    kind: str,
    old_code: str,
    new_code: str,
) -> None:
    if old_code == new_code:
        return
    if kind == "building":
        old_b, new_b = int(old_code), int(new_code)
        for gr in s.exec(select(GuestRoom).where(GuestRoom.building == old_b)).all():
            gr.building = new_b
            s.add(gr)
        return
    if kind == "floor":
        old_f, new_f = int(old_code), int(new_code)
        for gr in s.exec(select(GuestRoom).where(GuestRoom.floor == old_f)).all():
            gr.floor = new_f
            s.add(gr)
        return
    if kind == "type":
        for gr in s.exec(select(GuestRoom).where(GuestRoom.room_type == old_code)).all():
            gr.room_type = new_code
            s.add(gr)
        return
    if kind == "view":
        for gr in s.exec(select(GuestRoom).where(GuestRoom.view == old_code)).all():
            gr.view = new_code
            s.add(gr)
        return
    if kind == "bed":
        for gr in s.exec(
            select(GuestRoom).where(GuestRoom.bed == old_code),
        ).all():
            gr.bed = new_code
            s.add(gr)
        return
    if kind == "size":
        old_sqm, new_sqm = int(old_code), int(new_code)
        for gr in s.exec(select(GuestRoom).where(GuestRoom.area_sqm == old_sqm)).all():
            gr.area_sqm = new_sqm
            s.add(gr)


def update_room_option(
    s: Session,
    option_id: int,
    *,
    code: str | None = None,
    label_th: str | None = None,
    label_en: str | None = None,
    value_num: int | None = None,
) -> dict:
    row = s.get(RoomAttributeOption, option_id)
    if not row:
        raise HTTPException(404, "option not found")
    if code is not None:
        c = _normalize_code(row.kind, code)
        if c != row.code:
            dup = s.exec(
                select(RoomAttributeOption).where(
                    RoomAttributeOption.kind == row.kind,
                    RoomAttributeOption.code == c,
                    RoomAttributeOption.id != option_id,
                ),
            ).first()
            if dup:
                raise HTTPException(409, "duplicate option")
            _migrate_guest_rooms_for_code(s, row.kind, row.code, c)
            row.code = c
            if row.kind == "size":
                vn = _validate_value_num(row.kind, value_num, c)
                row.value_num = vn
    elif row.kind == "size" and value_num is not None:
        vn = _validate_value_num(row.kind, value_num, row.code)
        if str(vn) != row.code:
            dup = s.exec(
                select(RoomAttributeOption).where(
                    RoomAttributeOption.kind == row.kind,
                    RoomAttributeOption.code == str(vn),
                    RoomAttributeOption.id != option_id,
                ),
            ).first()
            if dup:
                raise HTTPException(409, "duplicate option")
            _migrate_guest_rooms_for_code(s, row.kind, row.code, str(vn))
            row.code = str(vn)
            row.value_num = vn
    th_in = label_th if label_th is not None else row.label_th
    en_in = label_en if label_en is not None else row.label_en
    th, en = _validate_labels(row.kind, th_in, en_in)
    row.label_th = th
    row.label_en = en
    s.add(row)
    s.commit()
    s.refresh(row)
    return _read_row(row)


def delete_room_option(s: Session, option_id: int) -> None:
    row = s.get(RoomAttributeOption, option_id)
    if not row:
        raise HTTPException(404, "option not found")
    in_use = _option_in_use(s, row)
    if in_use:
        raise HTTPException(409, "option in use")
    s.delete(row)
    s.commit()


def _option_in_use(s: Session, row: RoomAttributeOption) -> bool:
    code = row.code
    if row.kind == "building":
        try:
            b = int(code)
        except ValueError:
            return False
        return bool(s.exec(select(GuestRoom).where(GuestRoom.building == b)).first())
    if row.kind == "floor":
        try:
            f = int(code)
        except ValueError:
            return False
        return bool(s.exec(select(GuestRoom).where(GuestRoom.floor == f)).first())
    if row.kind == "type":
        return bool(
            s.exec(select(GuestRoom).where(GuestRoom.room_type == code)).first(),
        )
    if row.kind == "view":
        return bool(s.exec(select(GuestRoom).where(GuestRoom.view == code)).first())
    if row.kind == "bed":
        return bool(s.exec(select(GuestRoom).where(GuestRoom.bed == code)).first())
    if row.kind == "size":
        try:
            sqm = int(code)
        except ValueError:
            return False
        return bool(s.exec(select(GuestRoom).where(GuestRoom.area_sqm == sqm)).first())
    return False


def codes_for_kind(s: Session, kind: str) -> set[str]:
    rows = s.exec(
        select(RoomAttributeOption).where(RoomAttributeOption.kind == kind),
    ).all()
    return {r.code for r in rows}


def assert_guest_room_against_options(
    s: Session,
    *,
    building: int,
    floor: int,
    room_type: str,
    view: str,
    bed: str | None,
    area_sqm: int | None,
) -> None:
    if str(building) not in codes_for_kind(s, "building"):
        raise HTTPException(400, "invalid building")
    if str(floor) not in codes_for_kind(s, "floor"):
        raise HTTPException(400, "invalid floor")
    if room_type not in codes_for_kind(s, "type"):
        raise HTTPException(400, "invalid room type")
    if view not in codes_for_kind(s, "view"):
        raise HTTPException(400, "invalid view")
    if bed and bed not in codes_for_kind(s, "bed"):
        raise HTTPException(400, "invalid bed")
    if area_sqm is not None and str(area_sqm) not in codes_for_kind(s, "size"):
        raise HTTPException(400, "invalid size")
