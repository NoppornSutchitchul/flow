#!/usr/bin/env bash
# Wipe SQLite DB — next backend start recreates schema + users (no request history).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DB="$ROOT/backend/hotelops.db"

stop_port() {
  local port="$1"
  local pids
  pids="$(lsof -ti :"$port" 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    kill $pids 2>/dev/null || true
    sleep 1
    pids="$(lsof -ti :"$port" 2>/dev/null || true)"
    [[ -n "$pids" ]] && kill -9 $pids 2>/dev/null || true
    echo "Stopped processes on port $port"
  fi
}

echo "Stopping dev servers (ports 8000, 5173, 5174)..."
stop_port 8000
stop_port 5173
stop_port 5174

if [[ -f "$DB" ]]; then
  rm -f "$DB"
  echo "Deleted $DB"
else
  echo "No database at $DB (already fresh)"
fi

echo "Done. Start one backend (./backend/run.sh) and one frontend (npm run dev)."
