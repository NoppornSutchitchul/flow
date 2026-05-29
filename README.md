# HotelOps

A fullstack prototype for hotel operations: front-desk creates requests,
housekeepers and maintenance staff work them, supervisors and managers
watch response times and stock. Built from the supplied UI mockups.

- **Frontend** — React 19 + Vite + TypeScript + Tailwind v4 + React Router +
  TanStack Query + i18next (TH default / EN)
- **Backend** — FastAPI + SQLModel + SQLite, WebSocket fan-out for live
  updates

## Quick start

In two terminals:

```bash
# 1) backend (auto-creates SQLite + seed data on first run)
./backend/run.sh
# → http://localhost:8000  (docs at /docs)

# 2) frontend
npm run dev
# → http://localhost:5173
```

The Vite dev server proxies `/api` and `/ws` to FastAPI, so the
frontend uses same-origin URLs in dev and prod.

To start fresh, delete `backend/hotelops.db` and restart the backend.

## Project layout

See [docs/PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md) for the full folder map.

```
backend/app/
  main.py, db.py, models.py, schemas.py, services.py, ws.py   # core
  auth/      login, passwords, users
  catalog/   products, categories, SKU i18n
  hotel/     locations, rooms, hotel time
  reports/   presets, exports, queries
  seed/      demo data
  org/       departments, job titles

src/
  components/
    layout/   Header, BottomNav, Layout, RequireAuth
    modals/   QuickRequestModal, catalog & admin dialogs
    requests/ RequestTable, schedule, checklist
    catalog/  product form fields, icon picker
    hotel/    RoomCombobox, location UI
    reports/  Reports hub, charts, presets
    ui/       Avatar, animations, shared pickers
  lib/        api, auth, i18n, realtime, types, …
  locales/    th.json, en.json (+ en-to-th sync source)
  pages/      Dashboard, Requests, Stock, Reports, Admin, …

scripts/
  sync-locale-keys.mjs   # npm run locale / prebuild
  start-dev.mjs          # npm run dev:all
  generate_product_i18n.py
```

## Features

### Roles (switch from the avatar menu top-right)

| Role            | Bottom nav                                                    |
| --------------- | ------------------------------------------------------------- |
| Admin           | Dashboard · Requests · Products · Stock · **+** · Reports · Users · Settings |
| Manager         | Dashboard · Requests · Products · Reports                     |
| HK Supervisor   | Dashboard · Requests · **+** · Products                       |
| Front desk      | Dashboard · **+** · Requests                                  |
| Housekeeper     | My queue · Requests                                           |
| Maintenance     | My queue · Requests                                           |

### Request lifecycle

`pending → assigned → in_progress ⇄ paused → delivered`  
`in_progress → dnd → (cleared | deferred) → in_progress`  
Anything before `delivered` can be `cancelled`. Marking a request
`Rush` flips priority without changing state.

The frontend uses optimistic refetching: any state-changing action
publishes a topic on the shared WebSocket; clients invalidate the
relevant TanStack Query keys and re-fetch. Lists also poll every 5s
as a safety net.

### Quick request

The `+` button opens a modal that:

- accepts a room number
- lets the user pick from products (or free-text)
- auto-detects the responsible department from the picked items
- supports `Normal` or `Rush` priority
- auto-assigns to the lowest-workload available staffer in that dept

### Stock

The `Stock` page (admin) supports inline +/- adjustments, editing the
reorder threshold, and creating new SKUs (service or stocked). The
`Products` page is the read-only inventory view; status pills
(`OK / LOW / OUT / Service`) are derived server-side.

### Reports

Live KPIs (avg delivery time, delivered today, overdue count), plus
breakdown by department / status / top items / daily volume.

### i18n

Default language is Thai; the language toggle in the header (and
`Settings > Language`) flips to English instantly. Status names,
delivery methods, role labels and form copy are all translated.

## Tech notes

- **SQLite** lives at `backend/hotelops.db` — safe to delete to reseed.
- **WebSocket**: a single connection per browser tab is opened on
  startup (`src/lib/realtime.ts`) and re-opens automatically on drops.
- **Response time**: defaults to 15 min per request; row tints and overdue
  emphasis are computed client-side from `age_seconds` and settings.
- **Build**: `npm run build` type-checks (tsc) and produces a
  static bundle in `dist/`.

## API surface (selected)

| Method | Path                                  | Description                  |
| ------ | ------------------------------------- | ---------------------------- |
| GET    | `/api/dashboard/stats`                | KPI counts                   |
| GET    | `/api/requests?status=active&q=…`     | list                         |
| GET    | `/api/requests/{id}`                  | detail with timeline & notes |
| POST   | `/api/requests`                       | create + auto-assign         |
| POST   | `/api/requests/{id}/accept`           | accept                       |
| POST   | `/api/requests/{id}/start`            | start / resume               |
| POST   | `/api/requests/{id}/pause`            | pause with reason            |
| POST   | `/api/requests/{id}/deliver`          | deliver (consumes stock)     |
| POST   | `/api/requests/{id}/report-dnd`       | mark DND                     |
| POST   | `/api/requests/{id}/dnd-clear`        | clear DND                    |
| POST   | `/api/requests/{id}/dnd-defer`        | defer 15 min                 |
| POST   | `/api/requests/{id}/rush`             | mark rush                    |
| POST   | `/api/requests/{id}/cancel`           | cancel                       |
| POST   | `/api/requests/{id}/notes`            | add internal note            |
| GET    | `/api/products` / POST / PATCH        | products                     |
| POST   | `/api/products/{id}/adjust`           | +/- on-hand                  |
| GET    | `/api/users` / POST / PATCH / DELETE  | users                        |
| GET    | `/api/reports/summary?days=7`         | aggregate report             |
| WS     | `/ws`                                 | live updates                 |

OpenAPI docs are available at <http://localhost:8000/docs>.
