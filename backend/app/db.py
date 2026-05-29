"""Database engine + session helpers (SQLite local default, PostgreSQL via DATABASE_URL)."""
from __future__ import annotations

import os
from pathlib import Path

from sqlalchemy import event
from sqlmodel import SQLModel, Session, create_engine

DB_PATH = Path(__file__).resolve().parent.parent / "hotelops.db"
_REPO_ROOT = Path(__file__).resolve().parent.parent.parent


def _load_dotenv() -> None:
    try:
        from dotenv import load_dotenv
    except ImportError:
        return
    load_dotenv(_REPO_ROOT / ".env")
    load_dotenv(_REPO_ROOT / ".env.local", override=True)


_load_dotenv()


def resolve_database_url() -> str:
    """DATABASE_URL from env, else local SQLite file."""
    raw = (os.environ.get("DATABASE_URL") or "").strip()
    if not raw:
        return f"sqlite:///{DB_PATH}"
    if raw.startswith("postgres://"):
        return "postgresql+psycopg://" + raw.removeprefix("postgres://")
    if raw.startswith("postgresql://") and "+psycopg" not in raw:
        return "postgresql+psycopg://" + raw.removeprefix("postgresql://")
    return raw


DATABASE_URL = resolve_database_url()


def _engine_connect_args(url: str) -> dict:
    if url.startswith("sqlite"):
        return {"check_same_thread": False, "timeout": 60}
    return {}


engine = create_engine(
    DATABASE_URL,
    echo=False,
    connect_args=_engine_connect_args(DATABASE_URL),
    pool_pre_ping=True,
)


def dialect_is_sqlite(eng=engine) -> bool:
    return eng.dialect.name == "sqlite"


def _sql_bool_literals(eng=engine) -> tuple[str, str]:
    """SQLite uses 0/1; PostgreSQL requires FALSE/TRUE in raw SQL."""
    if dialect_is_sqlite(eng):
        return "0", "1"
    return "FALSE", "TRUE"


def _sql_user_table(eng=engine) -> str:
    """PostgreSQL reserves USER; quote the table name in raw SQL."""
    return "user" if dialect_is_sqlite(eng) else '"user"'


@event.listens_for(engine, "connect")
def _sqlite_pragmas(dbapi_connection, _connection_record) -> None:
    if not dialect_is_sqlite():
        return
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA busy_timeout=60000")
    cursor.close()


def init_db() -> None:
    from . import models  # noqa: F401 — register tables on metadata before create_all

    SQLModel.metadata.create_all(engine)

    if dialect_is_sqlite():
        _run_sqlite_legacy_migrations(engine)

    from .catalog.product_icon_emoji import backfill_product_icon_emojis
    from .hotel.hotel_location_emoji import backfill_hotel_location_icon_emojis

    backfill_product_icon_emojis(engine)
    _normalize_product_name_suffixes(engine)
    _migrate_user_auth_defaults(engine)
    _normalize_legacy_staff_names(engine)
    _backfill_pending_scheduled_auto_assign(engine)
    _migrate_long_request_codes_to_short(engine)
    _seed_time_alert_settings(engine)
    _migrate_product_categories_department(engine)
    _seed_product_categories(engine)
    backfill_hotel_location_icon_emojis(engine)
    _ensure_request_perf_indexes(engine)
    _backfill_user_departments_from_job_title(engine)


def _run_sqlite_legacy_migrations(eng) -> None:
    """Incremental ALTER TABLE steps for existing SQLite demo DBs."""
    _ensure_product_extra_columns(eng)
    _ensure_user_extra_columns(eng)
    _ensure_user_auth_columns(eng)
    _ensure_request_extra_columns(eng)
    _ensure_requestitem_extra_columns(eng)
    _migrate_request_response_minutes(eng)
    _ensure_productcategory_extra_columns(eng)
    _migrate_hotellocation_slim_columns(eng)
    _ensure_hotellocation_extra_columns(eng)
    _ensure_guestroom_extra_columns(eng)
    _ensure_room_attribute_option_table(eng)
    _ensure_customreport_extra_columns(eng)


def _ensure_room_attribute_option_table(eng) -> None:
    from sqlalchemy import text

    with eng.connect() as conn:
        tables = {
            row[0]
            for row in conn.execute(
                text("SELECT name FROM sqlite_master WHERE type='table'"),
            ).fetchall()
        }
        if "roomattributeoption" not in tables:
            conn.execute(
                text(
                    """
                    CREATE TABLE roomattributeoption (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        kind VARCHAR NOT NULL,
                        code VARCHAR NOT NULL,
                        label_th VARCHAR NOT NULL DEFAULT '',
                        label_en VARCHAR NOT NULL DEFAULT '',
                        value_num INTEGER,
                        sort_order INTEGER NOT NULL DEFAULT 0
                    )
                    """,
                ),
            )
            conn.execute(
                text(
                    "CREATE UNIQUE INDEX ix_roomoption_kind_code "
                    "ON roomattributeoption (kind, code)",
                ),
            )
            conn.commit()
        else:
            rows = conn.execute(text("PRAGMA table_info(roomattributeoption)")).fetchall()
            colnames = {r[1] for r in rows} if rows else set()
            if "label_my" not in colnames:
                conn.execute(text("ALTER TABLE roomattributeoption ADD COLUMN label_my VARCHAR"))
            if "label_lo" not in colnames:
                conn.execute(text("ALTER TABLE roomattributeoption ADD COLUMN label_lo VARCHAR"))
            conn.commit()


def _ensure_guestroom_extra_columns(eng) -> None:
    from sqlalchemy import text

    with eng.connect() as conn:
        cols = {
            row[1]
            for row in conn.execute(text("PRAGMA table_info(guestroom)")).fetchall()
        }
        if "area_sqm" not in cols:
            conn.execute(text("ALTER TABLE guestroom ADD COLUMN area_sqm INTEGER"))
        if "bed" not in cols:
            conn.execute(text("ALTER TABLE guestroom ADD COLUMN bed VARCHAR"))
        if "connecting_peer" not in cols:
            conn.execute(text(
                "ALTER TABLE guestroom ADD COLUMN connecting_peer VARCHAR",
            ))
        conn.commit()


def _migrate_hotellocation_slim_columns(eng) -> None:
    """Drop hint, sort_order, active — keep code for request references."""
    from sqlalchemy import text

    with eng.begin() as conn:
        rows = conn.execute(text("PRAGMA table_info(hotellocation)")).fetchall()
        colnames = {r[1] for r in rows} if rows else set()
        if not colnames or "hint" not in colnames:
            return
        conn.execute(
            text(
                """
                CREATE TABLE hotellocation_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    code VARCHAR NOT NULL UNIQUE,
                    label VARCHAR NOT NULL,
                    icon_emoji VARCHAR
                )
                """,
            ),
        )
        conn.execute(
            text(
                """
                INSERT INTO hotellocation_new (id, code, label, icon_emoji)
                SELECT id, code, label, icon_emoji FROM hotellocation
                """,
            ),
        )
        conn.execute(text("DROP TABLE hotellocation"))
        conn.execute(text("ALTER TABLE hotellocation_new RENAME TO hotellocation"))


def _ensure_hotellocation_extra_columns(eng) -> None:
    from sqlalchemy import text

    with eng.begin() as conn:
        rows = conn.execute(text("PRAGMA table_info(hotellocation)")).fetchall()
        colnames = {r[1] for r in rows} if rows else set()
        if not colnames:
            return
        if "label_en" not in colnames:
            conn.execute(text("ALTER TABLE hotellocation ADD COLUMN label_en VARCHAR"))
        if "label_my" not in colnames:
            conn.execute(text("ALTER TABLE hotellocation ADD COLUMN label_my VARCHAR"))
        if "label_lo" not in colnames:
            conn.execute(text("ALTER TABLE hotellocation ADD COLUMN label_lo VARCHAR"))


def _ensure_productcategory_extra_columns(eng) -> None:
    from sqlalchemy import text

    with eng.begin() as conn:
        rows = conn.execute(text("PRAGMA table_info(productcategory)")).fetchall()
        colnames = {r[1] for r in rows} if rows else set()
        if not colnames:
            return
        if "name_my" not in colnames:
            conn.execute(text("ALTER TABLE productcategory ADD COLUMN name_my VARCHAR"))
        if "name_lo" not in colnames:
            conn.execute(text("ALTER TABLE productcategory ADD COLUMN name_lo VARCHAR"))
        if "department" not in colnames:
            conn.execute(text("ALTER TABLE productcategory ADD COLUMN department VARCHAR"))


def _migrate_product_categories_department(eng) -> None:
    from .catalog.product_category_departments import migrate_product_categories_department

    with Session(eng) as s:
        migrate_product_categories_department(s)


def _seed_product_categories(eng) -> None:
    from .catalog.product_categories_seed import seed_product_categories

    with Session(eng) as s:
        seed_product_categories(s)


def _seed_time_alert_settings(eng) -> None:
    from sqlmodel import Session, select

    from .models import AppSetting

    defaults = {
        "time_warn_min": "5",
        "time_danger_min": "10",
        "time_breach_min": "15",
    }
    with Session(eng) as s:
        for key, value in defaults.items():
            if s.get(AppSetting, key) is None:
                s.add(AppSetting(key=key, value=value))
        s.commit()


def _backfill_pending_scheduled_auto_assign(eng) -> None:
    """Flag deferred auto-assign rows created before pending_auto_assign existed."""
    from sqlalchemy import text

    false_lit, true_lit = _sql_bool_literals(eng)
    with eng.begin() as conn:
        conn.execute(
            text(
                f"UPDATE request SET pending_auto_assign = {true_lit} "
                f"WHERE pending_auto_assign = {false_lit} "
                "AND status = 'pending' "
                "AND assignee_id IS NULL "
                "AND schedule_mode IS NOT NULL "
                "AND schedule_mode != 'immediate' "
                "AND scheduled_at IS NOT NULL",
            ),
        )


def _normalize_legacy_staff_names(eng) -> None:
    """Drop legacy T{n}-{f} zone abbrev from user names; zone lives in work_zone."""
    import re

    from sqlmodel import Session, select

    from .models import User

    legacy = re.compile(r" · T(\d+)-(\d+)$")
    with Session(eng) as s:
        changed = False
        for user in s.exec(select(User)).all():
            m = legacy.search(user.name)
            if not m:
                continue
            tower, floor = m.group(1), m.group(2)
            user.name = legacy.sub("", user.name).strip()
            if not (user.work_zone or "").strip():
                user.work_zone = f"ตึก {tower} · ชั้น {floor}"
            s.add(user)
            changed = True
        if changed:
            s.commit()


def _normalize_product_name_suffixes(eng) -> None:
    from .catalog.product_name_cleanup import (
        backfill_all_product_category_i18n_columns,
        backfill_all_product_i18n_columns,
        normalize_all_product_names,
    )

    with Session(eng) as s:
        normalize_all_product_names(s)
        backfill_all_product_i18n_columns(s)
        backfill_all_product_category_i18n_columns(s)
        s.commit()


def _ensure_product_extra_columns(eng) -> None:
    from sqlalchemy import text

    with eng.begin() as conn:
        rows = conn.execute(text("PRAGMA table_info(product)")).fetchall()
        colnames = {r[1] for r in rows} if rows else set()
        if not colnames:
            return
        if "name_en" not in colnames:
            conn.execute(text("ALTER TABLE product ADD COLUMN name_en VARCHAR"))
        if "name_my" not in colnames:
            conn.execute(text("ALTER TABLE product ADD COLUMN name_my VARCHAR"))
        if "name_lo" not in colnames:
            conn.execute(text("ALTER TABLE product ADD COLUMN name_lo VARCHAR"))
        if "active" not in colnames:
            conn.execute(text("ALTER TABLE product ADD COLUMN active BOOLEAN DEFAULT 1"))
            conn.execute(text("UPDATE product SET active = 1 WHERE active IS NULL"))
        if "icon_emoji" not in colnames:
            conn.execute(text("ALTER TABLE product ADD COLUMN icon_emoji VARCHAR"))
        if "unit_en" not in colnames:
            conn.execute(text("ALTER TABLE product ADD COLUMN unit_en VARCHAR"))
        if "unit_my" not in colnames:
            conn.execute(text("ALTER TABLE product ADD COLUMN unit_my VARCHAR"))
        if "unit_lo" not in colnames:
            conn.execute(text("ALTER TABLE product ADD COLUMN unit_lo VARCHAR"))
        if "assignee_job_titles_json" not in colnames:
            conn.execute(text("ALTER TABLE product ADD COLUMN assignee_job_titles_json VARCHAR"))


def _ensure_user_extra_columns(eng) -> None:
    """Best-effort migrations for SQLite (no Alembic in this prototype)."""
    from sqlalchemy import text

    with eng.begin() as conn:
        rows = conn.execute(text("PRAGMA table_info(user)")).fetchall()
        colnames = {r[1] for r in rows} if rows else set()
        if not colnames:
            return
        if "job_title" not in colnames:
            conn.execute(text("ALTER TABLE user ADD COLUMN job_title VARCHAR"))
        if "work_zone" not in colnames:
            conn.execute(text("ALTER TABLE user ADD COLUMN work_zone VARCHAR"))
        if "permissions_json" not in colnames:
            conn.execute(text("ALTER TABLE user ADD COLUMN permissions_json VARCHAR"))


def _ensure_user_auth_columns(eng) -> None:
    from sqlalchemy import text

    with eng.begin() as conn:
        rows = conn.execute(text("PRAGMA table_info(user)")).fetchall()
        colnames = {r[1] for r in rows} if rows else set()
        if not colnames:
            return
        if "username" not in colnames:
            conn.execute(text("ALTER TABLE user ADD COLUMN username VARCHAR"))
        if "password_hash" not in colnames:
            conn.execute(text("ALTER TABLE user ADD COLUMN password_hash VARCHAR"))


def _migrate_user_auth_defaults(eng) -> None:
    from .auth.password_util import hash_password
    from .auth.user_auth import derive_username, normalize_username

    from sqlmodel import Session, select

    from .models import User

    default_password = hash_password("1234")
    with Session(eng) as s:
        any_changed = False
        for user in s.exec(select(User)).all():
            row_changed = False
            if not (user.username or "").strip():
                user.username = derive_username(s, user.name, exclude_id=user.id)
                row_changed = True
            elif normalize_username(user.username) != user.username:
                user.username = normalize_username(user.username)
                row_changed = True
            if not (user.password_hash or "").strip():
                user.password_hash = default_password
                row_changed = True
            if row_changed:
                s.add(user)
                any_changed = True
        if any_changed:
            s.commit()


def _ensure_request_perf_indexes(eng) -> None:
    from sqlalchemy import text

    with eng.begin() as conn:
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_request_status ON request (status)"))
        conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_request_dept_status "
                "ON request (department, status)",
            ),
        )
        conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_request_auto_cancel "
                "ON request (auto_cancel_at) WHERE auto_cancel_at IS NOT NULL",
            ),
        )
        conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_request_scheduled "
                "ON request (schedule_mode, scheduled_at)",
            ),
        )
        conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_requestitem_request_id "
                "ON requestitem (request_id)",
            ),
        )


def _ensure_request_extra_columns(eng) -> None:
    from sqlalchemy import text

    with eng.begin() as conn:
        rows = conn.execute(text("PRAGMA table_info(request)")).fetchall()
        colnames = {r[1] for r in rows} if rows else set()
        if not colnames:
            return
        if "auto_cancel_at" not in colnames:
            conn.execute(text("ALTER TABLE request ADD COLUMN auto_cancel_at DATETIME"))
        if "schedule_mode" not in colnames:
            conn.execute(
                text("ALTER TABLE request ADD COLUMN schedule_mode VARCHAR DEFAULT 'immediate'"),
            )
        if "scheduled_at" not in colnames:
            conn.execute(text("ALTER TABLE request ADD COLUMN scheduled_at DATETIME"))
        if "schedule_daily_time" not in colnames:
            conn.execute(text("ALTER TABLE request ADD COLUMN schedule_daily_time VARCHAR"))
        if "pending_auto_assign" not in colnames:
            conn.execute(
                text("ALTER TABLE request ADD COLUMN pending_auto_assign BOOLEAN DEFAULT 0"),
            )
        if "preferred_assignee_id" not in colnames:
            conn.execute(text("ALTER TABLE request ADD COLUMN preferred_assignee_id INTEGER"))
        if "assignee_since" not in colnames:
            conn.execute(text("ALTER TABLE request ADD COLUMN assignee_since DATETIME"))
        conn.execute(
            text(
                "UPDATE request SET assignee_since = updated_at "
                "WHERE assignee_since IS NULL AND assignee_id IS NOT NULL",
            ),
        )


def _ensure_requestitem_extra_columns(eng) -> None:
    from sqlalchemy import text

    with eng.begin() as conn:
        rows = conn.execute(text("PRAGMA table_info(requestitem)")).fetchall()
        colnames = {r[1] for r in rows} if rows else set()
        if not colnames:
            return
        if "note" not in colnames:
            conn.execute(text("ALTER TABLE requestitem ADD COLUMN note VARCHAR"))


def _migrate_request_response_minutes(eng) -> None:
    """Rename legacy `sla_minutes` column → `response_minutes` on existing SQLite DBs."""
    from sqlalchemy import text
    from sqlalchemy.exc import OperationalError

    with eng.begin() as conn:
        rows = conn.execute(text("PRAGMA table_info(request)")).fetchall()
        colnames = {r[1] for r in rows} if rows else set()
        if not colnames:
            return
        if "response_minutes" not in colnames:
            conn.execute(text("ALTER TABLE request ADD COLUMN response_minutes INTEGER"))
        if "sla_minutes" in colnames:
            conn.execute(
                text("UPDATE request SET response_minutes = sla_minutes "
                     "WHERE response_minutes IS NULL"),
            )
        conn.execute(
            text("UPDATE request SET response_minutes = 15 "
                 "WHERE response_minutes IS NULL"),
        )
        if "sla_minutes" in colnames:
            try:
                conn.execute(text("ALTER TABLE request DROP COLUMN sla_minutes"))
            except OperationalError:
                pass


def _backfill_user_departments_from_job_title(eng) -> None:
    """Assign organizational department labels for leadership / front office (demo seed)."""
    from sqlalchemy import text

    exec_mgmt = (
        "General Manager",
        "Room Division Manager",
        "System Administrator",
    )
    front_office = (
        "Front Office Manager",
        "Assistant Front Office Manager",
        "Guest Service Agent",
        "Night Guest Service Agent",
        "Guest Relation Manager",
    )
    user_tbl = _sql_user_table(eng)
    with eng.begin() as conn:
        for title in exec_mgmt:
            conn.execute(
                text(
                    f"UPDATE {user_tbl} SET department = 'executive_management' "
                    "WHERE job_title = :t AND (department IS NULL OR department = '')",
                ),
                {"t": title},
            )
        for title in front_office:
            conn.execute(
                text(
                    f"UPDATE {user_tbl} SET department = 'front_office' "
                    "WHERE job_title = :t AND (department IS NULL OR department = '')",
                ),
                {"t": title},
            )


def _ensure_customreport_extra_columns(eng) -> None:
    from sqlalchemy import text

    with eng.begin() as conn:
        tables = {
            row[0]
            for row in conn.execute(
                text("SELECT name FROM sqlite_master WHERE type='table'"),
            ).fetchall()
        }
        if "customreport" not in tables:
            return
        rows = conn.execute(text("PRAGMA table_info(customreport)")).fetchall()
        colnames = {r[1] for r in rows} if rows else set()
        if "shared_with_all" not in colnames:
            conn.execute(
                text(
                    "ALTER TABLE customreport ADD COLUMN shared_with_all BOOLEAN DEFAULT 0",
                ),
            )


def _migrate_long_request_codes_to_short(eng) -> None:
    """REQ-YYYYMMDD-##### → REQ-MMDD-### (legacy demo seed format)."""
    import re
    from sqlmodel import Session, select

    from .models import Request

    long_pat = re.compile(r"^REQ-(\d{8})-(\d+)$")
    short_pat = re.compile(r"^REQ-(\d{4})-(\d{3})$")

    with Session(eng) as s:
        rows = s.exec(select(Request).order_by(Request.id)).all()
        long_rows = [r for r in rows if r.code and long_pat.match(r.code)]
        if not long_rows:
            return

        existing = {r.code for r in rows if r.code}
        max_by_prefix: dict[str, int] = {}
        for code in existing:
            m = short_pat.match(code)
            if m:
                pref = f"REQ-{m.group(1)}-"
                max_by_prefix[pref] = max(max_by_prefix.get(pref, 0), int(m.group(2)))

        changed = False
        for r in long_rows:
            m = long_pat.match(r.code)
            assert m is not None
            pref = f"REQ-{m.group(1)[4:8]}-"
            n = max_by_prefix.get(pref, 0) + 1
            while True:
                new_code = f"{pref}{n:03d}"
                if new_code not in existing:
                    break
                n += 1
            max_by_prefix[pref] = n
            if r.code != new_code:
                existing.discard(r.code)
                existing.add(new_code)
                r.code = new_code
                s.add(r)
                changed = True
        if changed:
            s.commit()


def get_session() -> Session:
    return Session(engine)
