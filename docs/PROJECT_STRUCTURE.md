# Project structure

## Backend (`backend/app/`)

| Folder | Purpose |
|--------|---------|
| *(root)* | Entry & core: `main.py`, `db.py`, `models.py`, `schemas.py`, `services.py`, `ws.py`, `presence.py`, `activity_log.py`, `assignment_eligibility.py` |
| `auth/` | Login, passwords, users |
| `catalog/` | Products, categories, SKU/i18n helpers |
| `hotel/` | Locations, rooms, hotel time |
| `reports/` | Reports, exports, presets |
| `seed/` | Demo/seed data |
| `org/` | Departments, job titles |

## Frontend (`src/components/`)

| Folder | Purpose |
|--------|---------|
| `layout/` | Shell: header, nav, logo, auth gate |
| `ui/` | Shared UI: animations, pickers, avatar, pills |
| `modals/` | All `*Modal` dialogs |
| `requests/` | Request list, items, schedule, quick-request pieces |
| `catalog/` | Stock/product form fields & icon picker |
| `users/` | Staff assignee, user settings fields |
| `hotel/` | Rooms & locations UI |
| `admin/` | Admin layout helpers |
| `reports/` | Reports hub (unchanged) |

Pages stay in `src/pages/`, shared logic in `src/lib/`.

## Scripts (`scripts/`)

| File | Purpose |
|------|---------|
| `sync-locale-keys.mjs` | Keeps `en-to-th.json` in sync (`npm run locale`) |
| `start-dev.mjs` | Starts backend + Vite (`npm run dev:all`) |
| `localLanIp.mjs` | LAN IP helper for dev server |
| `generate_product_i18n.py` | Regenerates catalog i18n artifacts (maintainer) |

`backend/scripts/` holds backend-only utilities (e.g. `generate_product_en_by_sku.py`).
