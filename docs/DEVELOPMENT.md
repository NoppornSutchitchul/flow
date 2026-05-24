# Development guide

## Prerequisites

- **Node.js** 20+ (for Vite and `npm`)
- **Python** 3.11+ (3.12–3.14 tested with project venv)
- macOS/Linux: `lsof` optional (used by `reset_fresh.sh`)

## First-time setup

```bash
# Frontend dependencies
npm install

# Backend virtualenv + dependencies
cd backend
python3 -m venv .venv
./.venv/bin/pip install -r requirements.txt
cd ..
```

## Run locally

**Option A — two terminals (recommended)**

```bash
# Terminal 1 — API on :8000 (auto-reload)
./backend/run.sh

# Terminal 2 — UI on :5173 (proxies /api and /ws)
npm run dev
```

**Option B — single command**

```bash
npm run dev:all
```

Starts backend and frontend together and prints LAN URL for phone testing.

| URL | Purpose |
|-----|---------|
| http://localhost:5173 | Web app |
| http://localhost:8000/docs | OpenAPI (Swagger) |
| http://localhost:8000/redoc | ReDoc |

### Demo login

After a fresh DB seed, try:

| Field | Value |
|-------|--------|
| Username | `Admin` |
| Password | `1234` |

Other seeded staff use the same initial password. Change passwords under **Settings**
when testing auth flows.

## Environment files

- **`.env.example`** — optional placeholders (`VITE_API_URL`, `SECRET_KEY`, etc.).
- Local overrides: `.env` / `.env.local` (gitignored via `*.local`).

For default local dev you do **not** need a `.env` file; Vite proxies to port 8000.

## npm scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Sync locale keys, then start Vite |
| `npm run dev:all` | Backend + frontend via `scripts/start-dev.mjs` |
| `npm run locale` | Regenerate `src/locales/en-to-th.json` from en/th pairs |
| `npm run build` | `tsc` + production bundle → `dist/` |
| `npm run preview` | Serve production build locally |
| `npm run lint` | ESLint |

## Backend commands

```bash
./backend/run.sh
# uvicorn app.main:app --reload --reload-dir app --port 8000
```

Reset database (stops ports 8000/5173/5174, deletes `hotelops.db`):

```bash
./backend/scripts/reset_fresh.sh
```

Then start backend again — `init_db()` recreates tables and seeds users.

## Locale workflow

1. Edit copy in `src/locales/en.json` and `src/locales/th.json`.
2. Run `npm run locale` to refresh `en-to-th.json` (English string → Thai map).
3. `npm run dev` runs locale sync automatically before Vite starts.

If `en-to-th.json` is missing, `npm run dev` fails — restore it from git or run
locale sync after adding `en.json` / `th.json`.

## WebSocket proxy errors

Messages like `[vite] ws proxy error: read ECONNRESET` usually mean:

- Backend is not running on port **8000**, or
- Uvicorn restarted (`--reload`) and dropped existing sockets.

Fix: start `./backend/run.sh`, refresh the browser. The app still works over HTTP;
realtime catches up when the socket reconnects.

## Production build (frontend only)

```bash
npm run build
```

Output in `dist/`. Serve static files behind a reverse proxy that also forwards
`/api` and `/ws` to the FastAPI process (same pattern as Vite dev proxy).

## Linting & types

```bash
npm run lint
npx tsc -b
```

Backend: no separate type checker in CI by default; run API tests manually via `/docs`.

## Useful paths

| Path | Notes |
|------|--------|
| `backend/hotelops.db` | SQLite data (gitignored) |
| `backend/.venv/` | Python env (gitignored) |
| `node_modules/` | Frontend deps (gitignored) |
| `dist/` | Build output (gitignored) |

Do not commit database files, tokens, or `.env` with secrets.
