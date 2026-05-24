# Project structure

```text
flow/
├── backend/
│   ├── app/                    # FastAPI application package
│   │   ├── main.py             # Routes, app factory, startup
│   │   ├── db.py               # SQLite engine, init_db, migrations
│   │   ├── models.py           # SQLModel tables
│   │   ├── schemas.py          # API DTOs
│   │   ├── services.py         # Core business logic
│   │   ├── ws.py               # WebSocket hub
│   │   ├── auth/               # Login, passwords, user purge
│   │   ├── catalog/            # Products, categories, i18n, icons
│   │   ├── hotel/              # Locations, rooms, hotel time
│   │   ├── org/                # Departments, job titles
│   │   ├── reports/            # Presets, exports, custom reports
│   │   └── seed/               # Demo users & report seed helpers
│   ├── scripts/
│   │   ├── reset_fresh.sh      # Delete DB + stop dev ports
│   │   └── generate_product_en_by_sku.py
│   ├── requirements.txt
│   ├── run.sh                  # Dev server entrypoint
│   └── hotelops.db             # Created at runtime (gitignored)
│
├── src/                        # React frontend
│   ├── main.tsx                # React root, QueryClient, Router
│   ├── App.tsx                 # Route table (lazy pages)
│   ├── index.css               # Tailwind v4 theme tokens
│   ├── pages/                  # Route-level screens
│   │   ├── Dashboard.tsx
│   │   ├── Requests.tsx
│   │   ├── MyQueue.tsx
│   │   ├── RequestDetail.tsx
│   │   ├── Stock.tsx, Products.tsx
│   │   ├── Reports.tsx
│   │   ├── Users.tsx, Settings.tsx
│   │   ├── LoginPage.tsx
│   │   └── admin/              # Admin hub sub-pages
│   ├── components/
│   │   ├── layout/             # Header, BottomNav, Layout, auth gate
│   │   ├── requests/           # RequestTable, location, checklist
│   │   ├── modals/             # Quick request, catalog, user admin
│   │   ├── reports/            # Hub, charts, BRS body, presets
│   │   ├── catalog/            # Product form fields
│   │   ├── users/              # Pickers, profile widgets
│   │   └── ui/                 # Shared primitives
│   ├── hooks/                  # useClosingRequests, presence, …
│   └── lib/                    # api, auth, i18n, realtime, format, types
│       └── locales/
│           ├── en.json
│           ├── th.json
│           └── en-to-th.json   # Synced by scripts/sync-locale-keys.mjs
│
├── scripts/
│   ├── sync-locale-keys.mjs    # npm run locale
│   ├── start-dev.mjs           # npm run dev:all
│   └── generate_product_i18n.py
│
├── docs/                       # Project documentation
├── public/                     # Static assets (favicon, icons)
├── package.json
├── vite.config.ts              # Dev server, proxy, chunk split
└── README.md
```

## Frontend: `src/pages`

| Page | Route | Audience |
|------|-------|----------|
| Dashboard | `/` | Supervisors, managers, front desk |
| My Queue | `/queue` | Housekeeping, maintenance, bell |
| Requests | `/requests` | List/search/filter by day |
| Request detail | `/requests/:id` | Supervisors+ (field roles often read-only list) |
| Products | `/products` | Inventory view |
| Stock | `/stock` | Admin stock adjustments |
| Reports | `/reports` | Analytics presets & saved reports |
| Users | `/users` | Staff admin |
| Admin hub | `/admin/*` | Catalog, locations, rooms, stock, users |
| Settings | `/settings` | Profile, language, shift, password |
| Login | `/login` | Unauthenticated |

Navigation visibility is filtered by role in `lib/appFeatures.ts` (not every
role sees every route).

## Frontend: key `src/lib` modules

| Module | Role |
|--------|------|
| `api.ts` | HTTP client and endpoint helpers |
| `auth.tsx` | Session provider |
| `realtime.ts` | WebSocket subscription |
| `requestCache.ts` | Merge WS payloads into TanStack Query cache |
| `format.ts` | Dates, urgency sort, shift helpers |
| `types.ts` | Shared TypeScript types mirroring API |
| `appFeatures.ts` | Feature flags per role |
| `reportPresetFilters.ts` | Report date ranges and hub persistence |

## Backend: `app/` packages

| Package | Role |
|---------|------|
| `auth/` | Credential verification, token issue |
| `catalog/` | Product CRUD, categories, bilingual names |
| `hotel/` | Property locations and guest room master data |
| `org/` | Department and job title validation |
| `reports/` | Report definitions, query layer, file export |
| `seed/` | Initial users; optional demo request history |

`main.py` is large because it registers all HTTP routes; business rules belong in
`services.py` when possible.

## Scripts

| Script | When to use |
|--------|-------------|
| `backend/run.sh` | Daily API development |
| `backend/scripts/reset_fresh.sh` | Wipe local DB and start clean |
| `npm run locale` | After editing translation JSON |
| `npm run dev:all` | One-command full stack |

## What not to commit

See root `.gitignore`: `node_modules/`, `dist/`, `backend/.venv/`, `backend/*.db*`.
