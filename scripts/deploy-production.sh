#!/usr/bin/env bash
# Run on the server after `git pull` (main with PostgreSQL support).
# Usage:
#   export DATABASE_URL='postgresql+psycopg://flow:SECRET@127.0.0.1:5432/flow'
#   # or create repo-root .env with DATABASE_URL=
#   ./scripts/deploy-production.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: Set DATABASE_URL (PostgreSQL) in .env or environment." >&2
  echo "See docs/DATABASE.md and .env.example" >&2
  exit 1
fi

echo "==> Backend: venv + dependencies"
cd "$ROOT/backend"
if [[ ! -d .venv ]]; then
  python3 -m venv .venv
fi
./.venv/bin/pip install -q -r requirements.txt

echo "==> Frontend: install + build"
cd "$ROOT"
if [[ -f package-lock.json ]]; then
  npm ci
else
  npm install
fi
npm run build

if [[ -f "$ROOT/backend/hotelops.db" ]]; then
  echo "==> Migrating backend/hotelops.db → PostgreSQL (one-time)"
  ./backend/.venv/bin/python "$ROOT/backend/scripts/migrate_sqlite_to_postgres.py" \
    --sqlite "$ROOT/backend/hotelops.db"
else
  echo "==> No backend/hotelops.db — skip SQLite migration"
  echo "    (First deploy: start backend once so init_db() can seed if DB is empty.)"
fi

echo ""
echo "Deploy build complete."
echo "  DATABASE_URL target: ${DATABASE_URL#*@}"
echo "  Frontend static files: $ROOT/dist"
echo ""
echo "Restart your process manager, e.g.:"
echo "  sudo systemctl restart flow-backend"
echo "  # reload nginx if it serves dist/"
