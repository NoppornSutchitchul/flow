# Architecture

Flow is a full-stack hotel operations app: staff create and fulfil guest requests,
supervisors monitor response times, and admins manage catalog, stock, users, and reports.

## System overview

```text
┌─────────────────────────────────────────────────────────────┐
│  Browser (React 19 + Vite)                                  │
│  • React Router — pages & lazy routes                       │
│  • TanStack Query — server state & cache                    │
│  • i18next — Thai (default) + English                       │
│  • WebSocket client — live cache patches                    │
└───────────────┬─────────────────────────┬───────────────────┘
                │ HTTP /api/*             │ WS /ws
                │ (Vite proxy in dev)     │
┌───────────────▼─────────────────────────▼───────────────────┐
│  FastAPI (backend/app/main.py)                              │
│  • REST API + OpenAPI (/docs)                               │
│  • Token auth (Bearer) on protected routes                  │
│  • SQLModel + SQLite (backend/hotelops.db)                  │
│  • ws.Hub — pub/sub to connected clients                    │
└─────────────────────────────────────────────────────────────┘
```

In development, the Vite dev server on port **5173** proxies `/api` and `/ws` to
**localhost:8000**, so the frontend can call same-origin URLs.

## Backend layers

| Area | Location | Responsibility |
|------|----------|----------------|
| HTTP routes | `main.py` | REST endpoints, auth, request lifecycle, admin CRUD |
| Domain logic | `services.py` | Request state machine, auto-assign, permissions, stock |
| Persistence | `models.py`, `db.py` | SQLModel tables; `init_db()` creates schema + lightweight migrations |
| API shapes | `schemas.py` | Pydantic read/write models |
| Realtime | `ws.py`, `presence.py` | Broadcast `requests.changed`, `products.changed`, etc. |
| Catalog | `catalog/` | Products, categories, SKU i18n, icons |
| Hotel config | `hotel/` | Locations, guest rooms, room options, hotel-local time |
| Reports | `reports/` | Preset reports (BRS), exports (Excel/PDF), custom saved reports |
| Auth | `auth/` | Login, password hashing, session tokens |
| Seed | `seed/` | Demo users and optional report demo data |

### Request lifecycle (server)

Statuses flow roughly as:

`pending → assigned → in_progress ⇄ paused → delivered`

DND branches from `in_progress`; rush/cancel/reassign are handled in `services.py`.
Delivering a stocked item can decrement inventory.

### Database

- **Engine:** SQLite file at `backend/hotelops.db` (WAL mode).
- **Migrations:** Incremental `ALTER TABLE` helpers in `db.py` run on startup so
  existing local DBs upgrade without a separate migration tool.
- **Reset:** Delete `hotelops.db` (and `-wal`/`-shm` if present) and restart the
  backend to recreate schema and seed users.

## Frontend layers

| Area | Location | Responsibility |
|------|----------|----------------|
| Routes | `App.tsx` | Lazy-loaded pages behind `RequireAuth` + `Layout` |
| API client | `lib/api.ts` | Typed fetch wrapper, Bearer token, error types |
| Auth | `lib/auth.tsx` | Login, `/api/auth/me`, session clear on logout |
| Realtime | `lib/realtime.ts` | Single WebSocket; patches request lists in the query cache |
| Features | `lib/appFeatures.ts` | Role-based nav and route capabilities |
| Pages | `pages/` | Dashboard, Requests, My Queue, Stock, Reports, Admin, … |
| UI | `components/` | Tables, modals, reports hub, layout chrome |

### Data fetching strategy

1. **Primary:** TanStack Query with keys like `["requests", params]`.
2. **Live updates:** WebSocket topics trigger silent cache updates (`requestCache.ts`)
   instead of refetching entire lists when possible.
3. **Fallback:** Slow polling when the socket is disconnected (`polling.ts`).

### Internationalization

- Bundled locales: `src/locales/th.json`, `en.json`.
- `scripts/sync-locale-keys.mjs` keeps `en-to-th.json` aligned for translation workflow
  (`npm run locale`, also runs before `npm run dev` and `npm run build`).

## Authentication

1. `POST /api/auth/login` with username + password → JWT-like token + user profile.
2. Token stored in `localStorage` (`flow_auth_token`); sent as `Authorization: Bearer`.
3. `GET /api/auth/me` hydrates the session on load.
4. Logout calls `POST /api/auth/logout` and clears client caches.

Usernames are derived from display names (e.g. `Admin` for the seeded admin account).
Seeded staff share initial password `1234` until changed in the app.

## Realtime topics (examples)

| Topic | Typical client action |
|-------|------------------------|
| `requests.changed` | Patch or refetch request queries |
| `products.changed` | Refresh product/stock caches |
| `users.changed` | Refresh user lists |
| Presence | Heartbeat for on-duty / online indicators |

If the backend is down or reloading, Vite may log `ws proxy ECONNRESET` — the UI
keeps working via HTTP; the socket reconnects when the API is back.

## Reports

- **Preset hub:** `Reports` page + `report_presets_brs.py` (KPIs, tables, charts).
- **Custom reports:** Saved snapshots and sharing (`custom_reports.py`).
- **Exports:** Excel/PDF via `report_export.py` (openpyxl, reportlab).

## Security notes (prototype)

This repo is a **local/demo** stack: default passwords, SQLite on disk, and no
hardened deployment config. For production you would use a managed database, secrets
management, HTTPS, and stricter CORS — see `.env.example` for placeholders.
