#!/usr/bin/env python3
"""Copy data from SQLite hotelops.db into PostgreSQL (DATABASE_URL in repo .env).

Usage:
  cd backend
  ./.venv/bin/python scripts/migrate_sqlite_to_postgres.py \\
    --sqlite /path/to/hotelops.db

Skips legacy tables not in current models (e.g. staffovertimelog).
"""
from __future__ import annotations

import argparse
import sqlite3
import sys
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import MetaData, Table, create_engine, text
from sqlalchemy.engine import Engine

BACKEND_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_DIR.parent

# Insert order respects foreign keys.
TABLES: tuple[str, ...] = (
    "user",
    "orgdepartment",
    "jobtitle",
    "appsetting",
    "hotellocation",
    "guestroom",
    "roomattributeoption",
    "productcategory",
    "product",
    "authsession",
    "request",
    "requestitem",
    "stockadjustment",
    "timelineevent",
    "note",
    "activitylog",
    "customreport",
    "customreportshare",
)

# SQLite stores booleans as 0/1 in many columns.
BOOL_COLUMNS: dict[str, frozenset[str]] = {
    "user": frozenset({"active"}),
    "guestroom": frozenset({"active"}),
    "productcategory": frozenset({"active", "builtin"}),
    "product": frozenset({"is_service", "active"}),
    "request": frozenset({"pending_auto_assign"}),
    "customreport": frozenset({"shared_with_all"}),
}

DEFAULT_SQLITE_CANDIDATES = (
    BACKEND_DIR / "hotelops.db",
    REPO_ROOT.parent / "flow-backup-20260529" / "backend" / "hotelops.db",
)


def _pg_table(name: str) -> str:
    return '"user"' if name == "user" else name


def _sqlite_table(name: str) -> str:
    return "user" if name == "user" else name


def _resolve_sqlite_path(explicit: str | None) -> Path:
    if explicit:
        p = Path(explicit).expanduser().resolve()
        if not p.is_file():
            raise SystemExit(f"SQLite file not found: {p}")
        return p
    for candidate in DEFAULT_SQLITE_CANDIDATES:
        if candidate.is_file():
            return candidate
    raise SystemExit(
        "No SQLite database found. Pass --sqlite /path/to/hotelops.db",
    )


def _ensure_postgres_schema(pg: Engine) -> None:
    sys.path.insert(0, str(BACKEND_DIR))
    from app import models  # noqa: F401
    from sqlmodel import SQLModel

    SQLModel.metadata.create_all(pg)


def _truncate_postgres(pg: Engine) -> None:
    table_list = ", ".join(_pg_table(t) for t in reversed(TABLES))
    with pg.begin() as conn:
        conn.execute(text(f"TRUNCATE TABLE {table_list} RESTART IDENTITY CASCADE"))


def _row_to_dict(row: sqlite3.Row, table: str) -> dict:
    out = dict(row)
    for col in BOOL_COLUMNS.get(table, ()):
        if col in out and out[col] is not None:
            out[col] = bool(out[col])
    return out


def _copy_table(
    sqlite_path: Path,
    pg: Engine,
    table: str,
    *,
    batch_size: int,
) -> int:
    meta = MetaData()
    pg_table = Table(table, meta, autoload_with=pg)
    col_names = [c.name for c in pg_table.columns]

    conn_sqlite = sqlite3.connect(f"file:{sqlite_path}?mode=ro", uri=True)
    conn_sqlite.row_factory = sqlite3.Row
    try:
        cur = conn_sqlite.execute(f"SELECT * FROM {_sqlite_table(table)}")
        total = 0
        while True:
            rows = cur.fetchmany(batch_size)
            if not rows:
                break
            payload = []
            for row in rows:
                d = _row_to_dict(row, table)
                payload.append({k: d[k] for k in col_names if k in d})
            with pg.begin() as conn:
                conn.execute(pg_table.insert(), payload)
            total += len(rows)
            print(f"  {table}: {total:,} rows", end="\r", flush=True)
    finally:
        conn_sqlite.close()

    print(f"  {table}: {total:,} rows — done")
    return total


def _reset_sequences(pg: Engine) -> None:
    skip = frozenset({"appsetting", "authsession"})
    with pg.begin() as conn:
        for table in TABLES:
            if table in skip:
                continue
            pg_name = _pg_table(table)
            conn.execute(
                text(
                    f"""
                    SELECT setval(
                        pg_get_serial_sequence('{pg_name}', 'id'),
                        COALESCE((SELECT MAX(id) FROM {pg_name}), 1),
                        (SELECT COUNT(*) > 0 FROM {pg_name})
                    )
                    """
                ),
            )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sqlite", help="Path to hotelops.db (SQLite)")
    parser.add_argument("--batch-size", type=int, default=3000)
    parser.add_argument("--skip-truncate", action="store_true")
    args = parser.parse_args()

    load_dotenv(REPO_ROOT / ".env")
    load_dotenv(REPO_ROOT / ".env.local", override=True)

    sys.path.insert(0, str(BACKEND_DIR))
    from app.db import resolve_database_url

    pg_url = resolve_database_url()
    if pg_url.startswith("sqlite"):
        raise SystemExit("DATABASE_URL points to SQLite. Set PostgreSQL in .env first.")

    sqlite_path = _resolve_sqlite_path(args.sqlite)
    print(f"Source: {sqlite_path}")
    print(f"Target: {pg_url.split('@')[-1] if '@' in pg_url else pg_url}")

    pg = create_engine(pg_url, pool_pre_ping=True)

    print("Ensuring PostgreSQL schema…")
    _ensure_postgres_schema(pg)

    if not args.skip_truncate:
        print("Truncating PostgreSQL tables…")
        _truncate_postgres(pg)

    print("Copying tables…")
    grand = 0
    for table in TABLES:
        try:
            grand += _copy_table(sqlite_path, pg, table, batch_size=args.batch_size)
        except Exception as exc:
            raise SystemExit(f"Failed on table {table}: {exc}") from exc

    print("Resetting id sequences…")
    _reset_sequences(pg)

    print(f"Migration complete ({grand:,} rows copied).")
    print("Restart the backend. Legacy staffovertime_* tables were not migrated (removed from app).")


if __name__ == "__main__":
    main()
