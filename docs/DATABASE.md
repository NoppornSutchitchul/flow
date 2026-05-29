# Database setup (SQLite & PostgreSQL)

Flow supports two databases:

| Environment | Default | How |
|-------------|---------|-----|
| **Local dev** | SQLite | No `DATABASE_URL` — uses `backend/hotelops.db` |
| **Production / demo server** | PostgreSQL | Set `DATABASE_URL` to a Postgres connection string |

---

## Local development (SQLite)

```bash
./backend/run.sh
```

On first start, `init_db()` creates `backend/hotelops.db` and seeds demo users.

Reset local data:

```bash
./backend/scripts/reset_fresh.sh
```

---

## PostgreSQL (production)

### 1. Install driver (once per machine / venv)

```bash
cd backend
./.venv/bin/pip install -r requirements.txt
```

`psycopg[binary]` is listed in `requirements.txt`.

### 2. Create a database

**Option A — free hosted (Neon, Supabase, Railway Postgres)**

1. Create a project and database
2. Copy the connection string (often `postgresql://user:pass@host/db?sslmode=require`)

**Option B — PostgreSQL on the same EC2 as the app**

```bash
sudo apt install postgresql postgresql-contrib
sudo -u postgres createuser flow -P
sudo -u postgres createdb flow -O flow
```

Connection string example:

```text
postgresql://flow:YOUR_PASSWORD@127.0.0.1:5432/flow
```

### 3. Set environment variable

On the server (systemd, `.env`, or export before `uvicorn`):

```bash
export DATABASE_URL="postgresql+psycopg://USER:PASSWORD@HOST:5432/DBNAME?sslmode=require"
```

Notes:

- `postgres://` URLs are auto-converted to `postgresql+psycopg://`
- For Neon/Supabase, keep `sslmode=require` in the URL

### 4. Start the backend

```bash
cd backend
./.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
```

On startup, `init_db()` will:

- Create all tables from SQLModel models (fresh Postgres DB)
- Run seeds (users, products, rooms, settings, …)
- **Skip** SQLite-only `PRAGMA` / `ALTER TABLE` migrations

### 5. Verify

```bash
curl http://localhost:8000/api/health
# Sign in: Admin / 1234
```

---

## Migrating existing SQLite data to PostgreSQL

For a **new** Postgres database, you usually only need steps above (empty DB + seed).

To **copy** data from an existing `hotelops.db`:

```bash
cd backend
# .env must point at PostgreSQL (DATABASE_URL)
./.venv/bin/python scripts/migrate_sqlite_to_postgres.py --sqlite /path/to/hotelops.db
```

The script truncates Postgres tables, copies rows in FK order, and resets id sequences.
Legacy tables not in current models (e.g. `staffovertimelog`) are skipped.

For portfolio/demo, a **fresh seed on Postgres** is also fine if you do not need old SQLite data.

---

## `.env` example

See `.env.example` in the repo root:

```env
DATABASE_URL=postgresql+psycopg://flow:secret@localhost:5432/flow
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `ModuleNotFoundError: psycopg` | `pip install -r backend/requirements.txt` |
| `connection refused` | Check host/port, security group, Postgres listening |
| `SSL required` | Add `?sslmode=require` to URL (Neon/Supabase) |
| `relation "user" does not exist` | Run backend once so `init_db()` creates tables |
| App still uses SQLite | Ensure `DATABASE_URL` is set in the **same environment** as uvicorn |

---

## Code reference

- URL resolution: `backend/app/db.py` → `resolve_database_url()`
- Models: `backend/app/models.py`
- Startup: `backend/app/main.py` → `init_db()` on lifespan
