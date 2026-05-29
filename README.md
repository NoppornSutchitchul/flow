# Flow

Hotel operations web app: front desk and supervisors create guest requests,
housekeeping and maintenance fulfil them from a queue, and managers track
response times, stock, and reports.

**Stack:** React 19 · Vite · TypeScript · Tailwind v4 · TanStack Query · i18next (TH/EN) ·
FastAPI · SQLModel · **SQLite (dev)** / **PostgreSQL (production via `DATABASE_URL`)** · WebSockets

## Live demo

| | |
|---|---|
| **Web app** | [http://43.210.162.81/](http://43.210.162.81/) |
| **Demo login** | Username `Admin` · Password `1234` |

**User guides (detailed):** [Thai](docs/USER_GUIDE.md) · [English](docs/USER_GUIDE.en.md) — login, quick request, queue, reports, time thresholds, demo script

## Quick start

```bash
# 1) Backend (creates SQLite + seed users on first run)
./backend/run.sh
# → http://localhost:8000  (OpenAPI at /docs)

# 2) Frontend (proxies /api and /ws to the backend)
npm run dev
# → http://localhost:5173
```

Or run both: `npm run dev:all`

**Demo sign-in** (after fresh seed): username `Admin`, password `1234`.

To reset all local data, delete `backend/hotelops.db` and restart the backend, or run
`./backend/scripts/reset_fresh.sh`.

## Documentation

| Doc                                                    | Contents                                     |
| ------------------------------------------------------ | -------------------------------------------- |
| [docs/USER_GUIDE.md](docs/USER_GUIDE.md)               | **User guide (TH)** — live demo usage & demo script |
| [docs/USER_GUIDE.en.md](docs/USER_GUIDE.en.md)         | **User guide (EN)** — same content in English       |
| [docs/DATABASE.md](docs/DATABASE.md)                   | SQLite vs PostgreSQL, `DATABASE_URL`, deploy DB     |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)             | Setup, scripts, locale sync, troubleshooting |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)           | System design, auth, realtime, data flow     |
| [docs/PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md) | Folder map and module guide                  |

## Features (summary)

### Roles

Bottom navigation depends on role (admin, manager, supervisors, front desk,
housekeeper, maintenance). See `src/lib/appFeatures.ts`.

| Role                      | Typical nav                                                                  |
| ------------------------- | ---------------------------------------------------------------------------- |
| Admin                     | Dashboard · Requests · Products · Stock · **+** · Reports · Users · Settings |
| Manager                   | Dashboard · Requests · Products · Reports                                    |
| HK Supervisor             | Dashboard · Requests · **+** · Products                                      |
| Front desk                | Dashboard · **+** · Requests                                                 |
| Housekeeper / Maintenance | My queue · Requests                                                          |

### Requests

Lifecycle: `pending → assigned → in_progress ⇄ paused → delivered`, with DND,
rush, cancel, reassign, and scheduled delivery. Quick request (`+`) picks room,
items, priority, and auto-assigns by department workload.

### Stock & catalog

Admins adjust stock and SKUs on **Stock**; **Products** is the read-only catalog view.
Status pills (`OK / LOW / OUT / Service`) come from the API.

### Reports

KPIs, departmental breakdowns, preset tables (including OT summaries), charts,
and saved custom reports with export.

### i18n

Default UI language is Thai; English is available from the header language menu.
Copy lives in `src/locales/th.json` and `en.json`.

## API (selected)

| Method    | Path                          | Description                           |
| --------- | ----------------------------- | ------------------------------------- |
| POST      | `/api/auth/login`             | Sign in                               |
| GET       | `/api/auth/me`                | Current user                          |
| GET       | `/api/dashboard/stats`        | Dashboard KPIs                        |
| GET       | `/api/requests`               | List (filters: status, date, dept, …) |
| GET       | `/api/requests/{id}`          | Detail + timeline                     |
| POST      | `/api/requests`               | Create                                |
| POST      | `/api/requests/{id}/accept` … | State transitions                     |
| GET/PATCH | `/api/products`               | Catalog & stock                       |
| GET       | `/api/reports/...`            | Presets & exports                     |
| WS        | `/ws`                         | Live updates                          |

Full schema: http://localhost:8000/docs

## Build

```bash
npm run build    # tsc + Vite → dist/
npm run preview  # serve production bundle locally
```

## License

© 2026 Nopporn Sutchitchul. All rights reserved.

This repository is published for portfolio and job-application review only.
You may not copy, modify, distribute, or use this software for commercial
purposes without written permission from the author.
