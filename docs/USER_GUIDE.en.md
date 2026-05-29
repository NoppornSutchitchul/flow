# 🏨 Flow User Guide (Demo / Showcase)

This document explains how to use **Flow** for demo viewers, developers, and testers.  
Flow is a hotel service-request app for housekeeping, engineering, front office, and managers.

**🌐 Other languages:** [ภาษาไทย (Thai)](./USER_GUIDE.md)

---

## 🔗 Access (Production Demo)

| Item | URL |
|------|-----|
| **Web app** | [http://43.210.162.81/](http://43.210.162.81/) |
| API docs (if enabled) | `http://43.210.162.81/docs` or your backend port |

Use **Chrome, Safari, or Edge** on a tablet-sized screen or larger (mobile works; some lists are long).

---

## 🎬 Demo videos

Watch the overview before reading the full guide:

| # | Title | Video |
|---|--------|--------|
| 0.1 | Flow overview — hotel operations demo | [▶️ YouTube](https://youtu.be/HwL8Q-gJp8k) |

Full episode checklist (0.2–11.x): [VIDEO_SERIES.md](./VIDEO_SERIES.md)

---

## 🔐 Sign in

1. Open [http://43.210.162.81/](http://43.210.162.81/)
2. Enter **Username** and **Password**
3. Sign in

### Demo accounts (after seed data)

| Role | Username (examples) | Password | Good for demo |
|------|---------------------|----------|---------------|
| 👑 System admin | `Admin` | `1234` | Time thresholds, admin hub, reports |
| 🛎️ Front desk | `Nicha` or `Chaiwat` | `1234` | Quick request (+), request list |
| 🧹 Housekeeper | `Malee` or `Niran` | `1234` | My Queue, accept → deliver |
| 🔧 Maintenance | `Anan` or `Somsak` | `1234` | Engineering queue, repair jobs |

> Usernames are derived from display names — if login fails, try the English first name (e.g. `Admin`, `Nicha`, `Anan`).  
> Default seed password for staff is **`1234`** (change under Settings in production).

After sign-in, the header shows your name, role, department, and **Online** status (green dot).

---

## 🌐 System overview

Flow lets you:

1. **Front desk / supervisors** create requests for guest rooms or hotel areas (supplies, services, engineering)
2. The **system** assign jobs to online, available staff (by department / work zone)
3. **Housekeepers / technicians** work from **My Queue** and update status through delivery
4. **Managers** view dashboard KPIs, low stock, reports, and time-alert thresholds

Updates are **real-time via WebSocket** — request lists and stats refresh without frequent page reloads.

---

## 🧭 Bottom navigation

Visible items depend on **role and permissions**.

| Icon | Screen | Short description |
|------|--------|-------------------|
| Home | Dashboard | Open jobs, overdue, low stock, active table |
| Checklist | My Queue | Housekeeping / engineering / bell — assigned work |
| Clipboard | Requests | All requests, filter by day/status |
| **+** (center) | Quick request | Create a new request (`quick_request` permission) |
| Package | Products / Stock | Catalog view or stock adjustments |
| Chart | Reports | Preset and custom reports |
| Gear | Settings | Language, password, time thresholds (admin) |

**Note:** Housekeepers and technicians often land on **My Queue** instead of Dashboard.

---

## 1) 📊 Dashboard — supervisors / front desk / managers

**Route:** `/` (home icon)

### What you see

- **KPI cards** — open jobs, overdue, low stock, rush, etc.
- **Alerts** — e.g. DND waiting for front desk, no staff online
- **Active requests table** — row colors by urgency (yellow → red → overdue)

### How to use

1. Click a KPI card to jump to a related list (when linked)
2. Click a row to open **request detail**
3. Use the center **+** button to create new work

---

## 2) ➕ Quick Request — center + button

**Open from:** bottom **+** or `/?quick=1`

### Steps to create a request

1. **Choose room / location**
   - Type a room number (e.g. `2506`) or pick from the list
   - Room type / view / size show when available in master data

2. **Pick services or supplies**
   - Search in “Select service or items…”
   - Items route to the right department (housekeeping / engineering / front office / bell)
   - Adjust quantity (supplies) or add per-line notes

3. **Delivery timing**
   - **Immediate** — auto-assign to online staff now
   - **Scheduled** — delay / date-time / daily (job waits until the window)

4. **Assignee (optional)**
   - Pick a specific housekeeper or technician, or leave **automatic**

5. **Delivery method** (bottom-right button)
   - Ring bell and deliver / leave at door / front desk (chevron menu)

6. Submit using the selected delivery method button

### Red banner: “No staff online”

Shown when **no one in that department is online and eligible** to take the job.

**To demo successfully:**

- In another tab/device, sign in as **engineering** (`Anan` / `Somsak`) or **housekeeping** and keep **My Queue** open (WebSocket marks you online)
- Then create a request for that department again

### Insufficient stock

If inventory cannot cover open jobs plus the new lines, items show **out of stock** — remove or reduce quantity before submitting.

---

## 3) 📋 Requests list

**Route:** `/requests`

### Main filters

- **Date** — requests created on that day
- **Status** — active / delivered / cancelled / DND / paused, etc.
- **Department** (by permission)

### Reading the table

- Row color by urgency (normal / yellow / red / overdue)
- Badges for **Rush**, **DND**, **awaiting staff**, etc.
- Click a row → **request detail**

---

## 4) 📄 Request detail

**Route:** `/requests/{id}`

### Main sections

- Room / location, line items, assignee
- **Timeline** — every event (created, assigned, accepted, started, delivered, cancelled)
- **Notes** — supervisors can add notes

### Actions (by permission)

| Action | Who typically can |
|--------|-------------------|
| Accept | Assigned staff |
| Start | Field staff |
| Pause | Field staff |
| Deliver | Field staff |
| Report DND | Housekeeper / technician at the door |
| Clear DND / Defer DND | Front desk |
| Rush / Unrush | Supervisors |
| Cancel request | Supervisors / front desk (per policy) |
| Reassign | Supervisors / admin |
| Edit schedule | Supervisors (not-yet-started holds) |

---

## 5) ✅ My Queue — housekeeping / engineering

**Route:** `/queue`

### Sections

| Section | Meaning |
|---------|---------|
| Available | Assigned, waiting for accept |
| In progress | Job started |
| Paused | Temporarily paused |
| DND | Guest Do Not Disturb — front desk follow-up |
| Completed today | Delivered today |

### Standard workflow

1. **Accept** — from an assigned card
2. **Start** — when arriving at the room / starting repair
3. (If needed) **Pause** or **Report DND**
4. **Deliver** — when done (ring / leave at door per request)

### Work zone

Floor housekeepers can set **tower · floor** on the queue page — routing prefers nearby zones.

### Countdown

Cards show time remaining against **response thresholds** set by admin (see Settings).

---

## 6) 📦 Products and stock

| Screen | Route | Use |
|--------|-------|-----|
| Products | `/products` | Catalog; status OK / low / out / service |
| Stock | `/stock` | Adjust on-hand quantities (admin / stock permission) |

Creating requests with supplies **reserves stock** from open jobs; stock is consumed on delivery.

---

## 7) 📈 Reports

**Route:** `/reports`

- Pick a **date range** and report preset (KPI, funnel, OT, stock, etc.)
- Export / save snapshots (by permission)
- Custom reports — build your own layout

Good for showing **back-office analytics**, not only request handling.

---

## 8) ⚙️ Settings

**Route:** `/settings`

### Everyone

- **Language** — Thai / English (header menu too)
- **Change password**
- **About** — version, server health

### System admin only

#### Time-based alert thresholds

Three levels in **ascending** minutes:

1. **Start flashing yellow**
2. **Start flashing red**
3. **Due / overdue** — max response time (countdown) and escalation when work has not started

Click **Save** after editing (admin only).

#### Data management center

Link to **Admin Hub** — catalog, rooms, locations, users.

---

## 9) 🛠️ Admin Hub

**Route:** `/admin` (`admin_hub` feature or system admin)

| Menu | Purpose |
|------|---------|
| Catalog | Products / services, SKU, categories, emoji |
| Locations | Public areas (lobby, pool, etc.) |
| Rooms | Guest room master data |
| Stock | Admin stock adjustments |
| Users | Staff, feature permissions, password reset |

---

## 10) 🏷️ Request statuses (reference)

```
pending → assigned → in_progress ⇄ paused → delivered
                              ↘ dnd (front desk)
                              ↘ cancelled
```

- **pending** — waiting for assignee or online staff
- **assigned** — owner set, not started
- **in_progress** — in progress
- **paused** — paused
- **dnd** — Do Not Disturb
- **delivered** — completed
- **cancelled** — cancelled

---

## 11) ⚡ Behind the scenes (for presentations)

When explaining the demo:

1. **Frontend (React)** — UI, i18n, dock navigation
2. **Backend (FastAPI)** — business rules, assignment, stock, reports
3. **WebSocket** — live request updates and presence
4. **Presence** — staff must **sign in and keep WS connected** to count as online for assignment
5. **Auto-assign** — picks available staff, prefers nearby zones (HK) or lowest workload
6. **Escalation** — assigned but not started past thresholds → HK supervisor / manager

More architecture: [ARCHITECTURE.md](./ARCHITECTURE.md)

---

## 12) 🎭 Demo script (5–10 minutes)

### Scene A — Front desk creates work

1. Sign in `Nicha` / `1234`
2. Tap **+** → room `2506` → pick a housekeeping item (e.g. bath towel)
3. Immediate delivery + ring bell
4. Open Requests and see the new job

### Scene B — Housekeeper completes work

1. Sign in `Malee` / `1234` (new tab / phone)
2. **My Queue** → accept → start → deliver
3. Back on front desk tab — status updates live

### Scene C — Engineering + “no staff online”

1. Log out all technicians → front desk creates **maintenance** job → red banner
2. Sign in `Anan` / `1234`, keep queue open
3. Create maintenance job again → submit works

### Scene D — Manager

1. Sign in `Admin` / `1234`
2. Dashboard → KPIs
3. Settings → set thresholds 5 / 10 / 15 → save
4. Reports → open one preset

---

## 13) 🔧 Troubleshooting

| Symptom | What to try |
|---------|-------------|
| Cannot sign in | Check username/password; try `Admin` / `1234` |
| Cannot submit — no staff online | Have staff in that dept sign in and keep My Queue open |
| Empty screen after login | Role has no menu permissions — try another account |
| Data not updating | Refresh once; check WebSocket not blocked by firewall |
| Cannot save time thresholds | Must sign in as **Admin** |
| Slow first load | Server may be cold-starting — wait 10–30s and retry |

---

## 14) 📚 Related docs

| Doc | Contents |
|-----|----------|
| [README.md](../README.md) | Project overview + local quick start |
| [VIDEO_SERIES.md](./VIDEO_SERIES.md) | Video episode checklist + YouTube links |
| [DEVELOPMENT.md](./DEVELOPMENT.md) | Local dev setup |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System architecture |
| [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) | Folder map |

---

## 📬 Project

- **Demo URL:** [http://43.210.162.81/](http://43.210.162.81/)
- This project is for **portfolio / system demonstration**, not a commercial product.

To update deploy details (AWS, IP, domain), edit the **Access** section here and in README.
