#!/usr/bin/env bash
# Start the FastAPI dev server with auto-reload.
set -euo pipefail
cd "$(dirname "$0")"
exec ./.venv/bin/python -m uvicorn app.main:app --reload --reload-dir app --port 8000 --host 0.0.0.0
