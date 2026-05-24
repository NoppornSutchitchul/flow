"""Seed demo users (~60). Products and catalog sync on app startup."""
from __future__ import annotations

from sqlmodel import Session, select

from ..db import engine
from ..models import GuestRoom, HotelLocation, JobTitle, OrgDepartment, User


# (name, initials, role, department, color, job_title, work_zone)

CORE_USERS: list[tuple[str, str, str, str | None, str, str | None, str | None]] = [
    ("Admin User", "AD", "admin", "executive_management", "#d9b69a", "System Administrator", None),
    ("Prasert M.", "PM", "manager", "executive_management", "#5c6bc0", "General Manager", None),
    ("Walai R.", "WR", "manager", "executive_management", "#9575cd", "Room Division Manager", None),
    ("Narong F.", "NF", "manager", "front_office", "#4caf50", "Front Office Manager", None),
    ("Orasa P.", "OP", "manager", "front_office", "#26a69a", "Assistant Front Office Manager", None),
    ("Nicha T.", "NT", "frontdesk", "front_office", "#4b576b", "Guest Service Agent", None),
    ("Chaiwat L.", "CL", "frontdesk", "front_office", "#627d98", "Guest Service Agent", None),
    ("Supaporn D.", "SD", "manager", "front_office", "#ad1457", "Guest Relation Manager", None),
    ("Nop K.", "NK", "frontdesk", "front_office", "#546e7a", "Night Guest Service Agent", None),
    # HK leadership — same department enables assignment + routing
    ("Thida H.", "TH", "manager", "housekeeping", "#8d6e63", "Housekeeping Manager", "ภารกิจรวม HK"),
    ("Anong K.", "AK", "hk_supervisor", "housekeeping", "#d8a497", "Housekeeping Supervisor", "QA / ครัวเก็บ"),
    ("Benchamat S.", "BS", "manager", "housekeeping", "#a1887f", "Assistant Housekeeping Manager",
     "ธุรการแม่บ้าน"),
    # Demo-visible floor staff retained for seeded requests (zones match sample rooms)
    ("Malee S.", "MS", "housekeeper", "housekeeping", "#7eb993", "Housekeeper", "ตึก 1 · ชั้น 4"),
    ("Niran K.", "NK", "housekeeper", "housekeeping", "#9bc2a0", "Housekeeper", "ตึก 1 · ชั้น 2"),
]


HK_COLORS = [
    "#7eb993", "#9bc2a0", "#80cbc4", "#b2dfdb", "#a5d6a7", "#c5e1a5",
    "#dce775", "#fff59d", "#ffcc80", "#ffab91", "#bcaaa4", "#b0bec5",
]

HK_JOBS_ROT = ["Housekeeper", "Room Boy", "Public Area Housekeeper"]


def _hk_floor_staff() -> list[tuple[str, str, str, str | None, str, str | None, str | None]]:
    """~40 housekeeping floor staff pinned to towers & floors."""
    rows: list[tuple[str, str, str, str | None, str, str | None, str | None]] = []
    n = 0
    # 2 towers × 9 floors × 2 slots ≈ floor coverage
    for tower in (1, 2):
        for floor in range(1, 10):
            for slot in range(2):
                job = HK_JOBS_ROT[n % len(HK_JOBS_ROT)]
                color = HK_COLORS[n % len(HK_COLORS)]
                zone = (
                    None
                    if job == "Public Area Housekeeper"
                    else f"ตึก {tower} · ชั้น {floor}"
                )
                first = ["Wipa", "Suda", "Jintana", "Kamon", "Pensri", "Rattana", "Sirilak",
                         "Narisa", "Daranee", "Nuchanart", "Kanyarat", "Pawinee", "Sasithorn",
                         "Anchalee", "Siriporn", "Yupin", "Naree", "Busaba", "Pimdao", "Ladda"][n % 20]
                last_initial = chr(65 + (n % 26))
                initials = (first[:1] + last_initial).upper()
                name = f"{first} {last_initial}."
                rows.append((name, initials, "housekeeper", "housekeeping", color, job, zone))
                n += 1
    return rows


def seed_if_empty() -> None:
    from ..auth.password_util import hash_password
    from ..auth.user_auth import derive_username

    default_pw = hash_password("1234")
    with Session(engine) as s:
        if s.exec(select(User)).first():
            return

        spec_rows = CORE_USERS + _hk_floor_staff()

        seen_initials: dict[str, int] = {}
        reserved_usernames: list[str] = []

        def unique_initials(base: str) -> str:
            k = base[:2].upper() if len(base) >= 2 else (base.upper() + "X")[:2]
            if k not in seen_initials:
                seen_initials[k] = 1
                return k
            seen_initials[k] = seen_initials.get(k, 1) + 1
            return f"{k[0]}{seen_initials[k]}"[:2]

        def next_username(display_name: str) -> str:
            username = derive_username(
                s,
                display_name,
                extra_taken=frozenset(reserved_usernames),
            )
            reserved_usernames.append(username)
            return username

        users: list[User] = []
        for tup in spec_rows:
            n, initials, role, dept, color, jt, zone = tup
            ini = unique_initials(initials.replace(".", "").strip())
            users.append(User(
                name=n,
                username=next_username(n),
                password_hash=default_pw,
                initials=ini,
                role=role,
                department=dept,
                job_title=jt,
                work_zone=zone,
                color=color,
            ))

        # Maintenance (demo technicians — initials de-duped with roster)
        users.append(User(
            name="Somsak P.",
            username=next_username("Somsak P."),
            password_hash=default_pw,
            initials=unique_initials("SP"),
            role="maintenance",
            department="maintenance",
            job_title="Technician",
            work_zone=None,
            color="#c9a3a3",
        ))
        users.append(User(
            name="Anan W.",
            username=next_username("Anan W."),
            password_hash=default_pw,
            initials=unique_initials("AW"),
            role="maintenance",
            department="maintenance",
            job_title="Technician",
            work_zone=None,
            color="#a8a8a8",
        ))

        s.add_all(users)
        s.commit()
        # Products, locations, and guest rooms are seeded on startup via
        # sync_product_catalog() and seed_*_if_empty() — no demo requests.


DEFAULT_JOB_TITLE_ROWS: list[tuple[str, str | None, int]] = [
    ("System Administrator", "executive_management", 10),
    ("General Manager", "executive_management", 15),
    ("Room Division Manager", "executive_management", 18),
    ("Front Office Manager", "front_office", 20),
    ("Assistant Front Office Manager", "front_office", 22),
    ("Guest Service Agent", "front_office", 30),
    ("Night Guest Service Agent", "front_office", 32),
    ("Guest Relation Manager", "front_office", 35),
    ("Bell Boy", "bell_boy", 36),
    ("Housekeeping Manager", "housekeeping", 40),
    ("Assistant Housekeeping Manager", "housekeeping", 42),
    ("Housekeeping Supervisor", "housekeeping", 45),
    ("Housekeeper", "housekeeping", 50),
    ("Room Boy", "housekeeping", 52),
    ("Public Area Housekeeper", "housekeeping", 55),
    ("Technician", "maintenance", 60),
]


DEFAULT_ORG_DEPARTMENTS: list[tuple[str, str, int]] = [
    ("executive_management", "Executive Management", 0),
    ("front_office", "Front Office", 10),
    ("bell_boy", "Bell", 15),
    ("housekeeping", "Housekeeping", 20),
    ("maintenance", "Maintenance", 30),
]

BELL_BOY_STAFF: list[tuple[str, str, str, str | None, str, str | None, str | None]] = [
    ("Somkid R.", "SK", "bellboy", "front_office", "#bcaaa4", "Bell Boy", None),
    ("Pichai T.", "PT", "bellboy", "front_office", "#a1887f", "Bell Boy", None),
    ("Arun M.", "AM", "bellboy", "front_office", "#8d6e63", "Bell Boy", None),
]


def seed_departments_if_empty() -> None:
    with Session(engine) as s:
        if s.exec(select(OrgDepartment)).first():
            return
        for code, name, sort_order in DEFAULT_ORG_DEPARTMENTS:
            s.add(
                OrgDepartment(
                    code=code,
                    name=name,
                    sort_order=sort_order,
                ),
            )
        s.commit()


def migrate_renamed_job_title_labels() -> None:
    """Keep user.job_title in sync after catalog renames (e.g. Maintenance Technician → Technician)."""
    renames = {"Maintenance Technician": "Technician"}
    with Session(engine) as s:
        changed = False
        for old, new in renames.items():
            for user in s.exec(select(User).where(User.job_title == old)).all():
                user.job_title = new
                s.add(user)
                changed = True
            row = s.exec(select(JobTitle).where(JobTitle.label == old)).first()
            if row:
                row.label = new
                s.add(row)
                changed = True
        if changed:
            s.commit()


def migrate_usernames_to_first_name() -> None:
    """Login username = first name + surname initial when present (e.g. NarisaH)."""
    from ..auth.user_auth import derive_username

    with Session(engine) as s:
        changed = False
        reserved: list[str] = []
        for user in sorted(s.exec(select(User)).all(), key=lambda u: u.id or 0):
            new_username = derive_username(
                s,
                user.name,
                exclude_id=user.id,
                extra_taken=frozenset(reserved),
            )
            reserved.append(new_username)
            if user.username != new_username:
                user.username = new_username
                s.add(user)
                changed = True
        if changed:
            s.commit()


def migrate_job_titles_restore_department_scope() -> None:
    """Backfill JobTitle.department from catalog defaults when missing."""
    defaults = {label: dept for label, dept, _ in DEFAULT_JOB_TITLE_ROWS}
    with Session(engine) as s:
        changed = False
        for row in s.exec(select(JobTitle)).all():
            if row.department is not None:
                continue
            dept = defaults.get(row.label)
            if dept:
                row.department = dept
                s.add(row)
                changed = True
        if changed:
            s.commit()


def migrate_org_departments_to_english_names() -> None:
    """Ensure org department display names are English (canonical defaults by code)."""
    defaults = {code: name for code, name, _ in DEFAULT_ORG_DEPARTMENTS}
    with Session(engine) as s:
        changed = False
        for row in s.exec(select(OrgDepartment)).all():
            target = defaults.get(row.code)
            if target and row.name != target:
                row.name = target
                row.name_en = None
                row.name_my = None
                row.name_lo = None
                s.add(row)
                changed = True
                continue
            en = (row.name_en or "").strip()
            if en and row.name != en:
                row.name = en
                row.name_en = None
                row.name_my = None
                row.name_lo = None
                s.add(row)
                changed = True
        if changed:
            s.commit()


def sync_job_titles_catalog() -> None:
    """Ensure every default job-title preset exists (idempotent).

    Must run before migrations that insert a single title (e.g. Bell Boy);
    otherwise an early non-empty table would skip the full catalog.
    """
    with Session(engine) as s:
        existing = {row.label for row in s.exec(select(JobTitle)).all()}
        added = False
        for label, dept, so in DEFAULT_JOB_TITLE_ROWS:
            if label in existing:
                continue
            s.add(JobTitle(label=label, department=dept, sort_order=so))
            added = True
        if added:
            s.commit()


def seed_job_titles_if_empty() -> None:
    """Backward-compatible alias — use sync_job_titles_catalog()."""
    sync_job_titles_catalog()


def _corridor_location_rows() -> list[tuple[str, str, str | None, int]]:
    rows: list[tuple[str, str, str | None, int]] = []
    sort = 100
    for building in (1, 2):
        for floor in (1, 2, 3, 4, 5):
            rows.append(
                (
                    f"HK-LOC-T{building}-F{floor}-CORR",
                    f"ทางเดิน (Corridor) ชั้น {floor} ตึก {building}",
                    f"Corridor ตึก {building} ชั้น {floor}",
                    sort,
                ),
            )
            sort += 2
    return rows


def _lift_location_rows() -> list[tuple[str, str, str | None, int]]:
    rows: list[tuple[str, str, str | None, int]] = []
    sort = 40
    for building in (1, 2):
        rows.extend(
            [
                (
                    f"HK-LOC-T{building}-LIFT-1",
                    f"ลิฟต์ ตัวที่ 1 ตึก {building}",
                    f"ลิฟต์โดยสาร ตึก {building}",
                    sort,
                ),
                (
                    f"HK-LOC-T{building}-LIFT-2",
                    f"ลิฟต์ ตัวที่ 2 ตึก {building}",
                    f"ลิฟต์โดยสาร ตึก {building}",
                    sort + 1,
                ),
                (
                    f"HK-LOC-T{building}-LIFT-SVC",
                    f"ลิฟต์แม่บ้าน (Service) ตึก {building}",
                    f"ลิฟต์บริการ ตึก {building}",
                    sort + 2,
                ),
            ],
        )
        sort += 10
    return rows


def _extended_hotel_location_rows() -> list[tuple[str, str, str | None, int]]:
    """Guest-facing & ops zones typical for a ~300-room city/resort hotel."""
    return [
        # — More lobby & guest services —
        ("HK-LOC-WAITING", "ห้องรอรับแขก", "โซนที่นั่งรอเช็คอิน / รอรถ", 26),
        ("HK-LOC-GIFT-SHOP", "ร้านของที่ระลึก", "Gift shop & souvenirs", 28),
        ("HK-LOC-MINI-MART", "มินิมาร์ทโรงแรม", "สินค้าสะดวกซื้อ & ของใช้จำเป็น", 30),
        ("HK-LOC-EXEC-LOUNGE", "Executive Lounge", "เลานจ์ผู้บริหาร / ชั้นสูง", 32),
        ("HK-LOC-CLUB-LOUNGE", "Club Lounge", "เลานจ์สมาชิก / Club floor", 34),
        # — More guest restrooms —
        ("HK-LOC-REST-WR-F", "ห้องน้ำหญิง โซนร้านอาหาร", "ห้องน้ำแขก — ใกล้ F&B", 141),
        ("HK-LOC-REST-WR-M", "ห้องน้ำชาย โซนร้านอาหาร", "ห้องน้ำแขก — ใกล้ F&B", 142),
        ("HK-LOC-SPA-WR-F", "ห้องน้ำหญิง สปา", "ห้องน้ำแขก — โซนสปา", 143),
        ("HK-LOC-SPA-WR-M", "ห้องน้ำชาย สปา", "ห้องน้ำแขก — โซนสปา", 144),
        ("HK-LOC-FIT-WR-F", "ห้องน้ำหญิง ฟิตเนส", "ห้องน้ำแขก — โซนฟิตเนส", 145),
        ("HK-LOC-FIT-WR-M", "ห้องน้ำชาย ฟิตเนส", "ห้องน้ำแขก — โซนฟิตเนส", 146),
        ("HK-LOC-BALL-WR-F", "ห้องน้ำหญิง บอลรูม", "ห้องน้ำแขก — โซนงานเลี้ยง", 147),
        ("HK-LOC-BALL-WR-M", "ห้องน้ำชาย บอลรูม", "ห้องน้ำแขก — โซนงานเลี้ยง", 148),
        # — Named F&B outlets (fictional names) —
        ("HK-LOC-TERRACE-REST", "ร้าน The Terrace", "All Day Dining & บุฟเฟ่ต์", 227),
        ("HK-LOC-LOTUS-GARDEN", "ร้าน Lotus Garden", "อาหารจีน & ติ่มซำ", 228),
        ("HK-LOC-RIVERSIDE-GRILL", "ร้าน Riverside Grill", "ปิ้งย่าง & สเต็ก", 229),
        ("HK-LOC-SKY-BAR", "บาร์ Skyline Lounge", "ค็อกเทล & วิวเมือง — ล็อบบี้", 230),
        ("HK-LOC-POOL-BAR", "บาร์ Pool Bar", "เครื่องดื่ม & ว่ายน้ำ — ริมสระ", 231),
        ("HK-LOC-LOBBY-LOUNGE", "Lobby Lounge", "เครื่องดื่ม & ขนาว — โถงล็อบบี้", 232),
        ("HK-LOC-BAKERY", "เบเกอรี Casa Bloom", "ขนมปัง & กาแฟพิเศษ", 233),
        ("HK-LOC-INROOM-PICKUP", "จุดรับอาหาร In-Room", "หยิบอาหาร Room Service", 234),
        ("HK-LOC-TEA-LOUNGE", "Tea Lounge ชาบู", "น้ำชา & ขนมบ่าย", 235),
        # — Pool & recreation (expanded) —
        ("HK-LOC-POOL-KIDS", "สระเด็ก", "สระน้ำสำหรับเด็ก", 253),
        ("HK-LOC-JACUZZI", "จากุซซี & สระน้ำร้อน", "โซนน้ำร้อนริมสระ", 254),
        ("HK-LOC-POOL-TOWEL", "จุดผ้าเช็ดตัวสระ", "เช็คผ้าเช็ดตัว & เก้าอาด", 255),
        ("HK-LOC-SPA-RECEPT", "รีเซ็ปชันสปา", "ต้อนรับ & นัดหมายนวด", 256),
        ("HK-LOC-YOGA", "สตูดิโอโยคะ", "โยคะ & พิลาทิส", 257),
        ("HK-LOC-GAME-ROOM", "ห้องเกม & บันไดเล่น", "โซนพักผ่อนในร่ม", 258),
        # — MICE (named rooms) —
        ("HK-LOC-MEET-EMERALD", "ห้องประชุม Emerald", "ความจุกลาง — แบ่งห้องได้", 267),
        ("HK-LOC-MEET-SAPPHIRE", "ห้องประชุม Sapphire", "ความจุกลาง", 268),
        ("HK-LOC-MEET-RUBY", "ห้องประชุม Ruby", "ห้องประชุมเล็ก", 269),
        ("HK-LOC-BOARDROOM", "ห้องประชุมผู้บริหาร", "Boardroom", 270),
        ("HK-LOC-BRIDAL", "ห้องเตรียมเจ้าบ่าว-เจ้าสาว", "Bridal suite / prep", 271),
        # — Arrival, transport & outdoor —
        ("HK-LOC-VALET", "จุด Valet", "รับ-ส่งรถหน้าโรงแรม", 293),
        ("HK-LOC-TAXI", "จุดเรียกแท็กซี่", "แท็กซี่ & รถรับจ้าง", 294),
        ("HK-LOC-SHUTTLE", "จุดรถรับส่งโรงแรม", "Shuttle bus / ทัวร์", 295),
        ("HK-LOC-EV-CHARGE", "สถานีชาร์จ EV", "ที่ชาร์จรถไฟฟ้า", 296),
        ("HK-LOC-SMOKING", "โซนสูบบุหรี่ (กลางแจ้ง)", "ที่สูบบุหรี่ที่กำหนด", 297),
        ("HK-LOC-FIRST-AID", "ห้องปฐมพยาบาล", "First aid / พยาบาลประจำโรงแรม", 298),
        ("HK-LOC-PRAYER", "ห้องละหมาด / ห้องสวดมนต์", "ศาสนสถานภายในโรงแรม", 299),
        ("HK-LOC-WATER-FEATURE", "น้ำพุ & ลานกลาง", "จุดถ่ายรูป / ลานกลางโรงแรม", 301),
    ]


def _build_default_hotel_location_rows() -> list[tuple[str, str, str | None, int]]:
    rows: list[tuple[str, str, str | None, int]] = [
        # — Lobby & front-of-house —
        ("HK-LOC-HALL", "โถงล็อบบี้", "ทางเดินหลักและโถงต้อนรับ", 10),
        ("HK-LOC-LOBBY", "ล็อบบี้", "จุดต้อนรับแขก", 12),
        ("HK-LOC-FRONT-DESK", "เคาเตอร์แผนกต้อนรับ", "แผนกต้อนรับ", 14),
        ("HK-LOC-CONCIERGE", "เคาน์เตอร์ Concierge", "บริการ Concierge", 16),
        ("HK-LOC-BELL-DESK", "เคาน์เตอร์ Bell / ขนสัมภาระ", "Bell desk", 18),
        ("HK-LOC-LUGGAGE", "ห้องเก็บกระเป๋า", "Luggage storage", 20),
        ("HK-LOC-BUSINESS", "Business Center", "ศูนย์ธุรกิจ", 22),
        ("HK-LOC-VIP-LOUNGE", "VIP Lounge", "ห้องรับรอง VIP", 24),
        # — Lifts (per tower) —
        ("HK-LOC-LIFT", "ลิฟต์ (ทั่วไป)", "ช่องโดยสาร — ใช้เมื่อไม่ระบุตึก", 38),
        *_lift_location_rows(),
        # — Corridors (per tower × floor) —
        *_corridor_location_rows(),
        # — Restrooms —
        ("HK-LOC-LOBBY-WR-F", "ห้องน้ำหญิง Lobby", "ห้องน้ำแขก — โซนล็อบบี้", 130),
        ("HK-LOC-LOBBY-WR-M", "ห้องน้ำชาย Lobby", "ห้องน้ำแขก — โซนล็อบบี้", 132),
        ("HK-LOC-POOL-WR-F", "ห้องน้ำหญิง ริมสระ", "ห้องน้ำแขก — โซนสระ", 134),
        ("HK-LOC-POOL-WR-M", "ห้องน้ำชาย ริมสระ", "ห้องน้ำแขก — โซนสระ", 136),
        ("HK-LOC-STAFF-WR-F", "ห้องน้ำหญิงพนักงาน", "ห้องน้ำพนักงาน", 138),
        ("HK-LOC-STAFF-WR-M", "ห้องน้ำชายพนักงาน", "ห้องน้ำพนักงาน", 140),
        # — Offices —
        ("HK-LOC-FRONT-OFFICE", "ออฟฟิศแผนกต้อนรับ", "Back office Front Office", 150),
        ("HK-LOC-OFF-HK", "ออฟฟิศแม่บ้าน", "Housekeeping office", 152),
        ("HK-LOC-OFF-MT", "ออฟฟิศช่างซ่อม", "Maintenance office", 154),
        ("HK-LOC-OFF-FNB", "ออฟฟิศ F&B", "Food & Beverage office", 156),
        ("HK-LOC-OFF-SALES", "ออฟฟิศฝ่ายขาย", "Sales & Marketing office", 158),
        ("HK-LOC-OFF-HR", "ออฟฟิศ HR", "Human Resources office", 160),
        ("HK-LOC-OFF-FIN", "ออฟฟิศการเงิน", "Finance office", 162),
        ("HK-LOC-OFF-ENG", "ออฟฟิศวิศวกรรม", "Engineering office", 164),
        ("HK-LOC-OFF-SEC", "ออฟฟิศรักษาความปลอดภัย", "Security office", 166),
        ("HK-LOC-OFF-GM", "ออฟฟิศผู้จัดการ", "General Manager office", 168),
        # — Back-of-house / kitchens —
        ("HK-LOC-KITCH-HOT", "ครัวร้อน", "Hot kitchen", 180),
        ("HK-LOC-KITCH-COLD", "ครัวเย็น", "Cold kitchen / prep", 182),
        ("HK-LOC-BANQUET-PREP", "ครัวเตรียม Banquet", "Banquet prep kitchen", 184),
        ("HK-LOC-STEWARD", "Stewarding / ล้างจาน", "Dish wash & stewarding", 186),
        ("HK-LOC-LINEN", "ห้องผ้า", "Linen room", 188),
        ("HK-LOC-LAUNDRY", "ซักรีด", "Laundry", 190),
        ("HK-LOC-HK-PANTRY-T1", "Pantry แม่บ้าน ตึก 1", "Housekeeping pantry — Tower 1", 192),
        ("HK-LOC-HK-PANTRY-T2", "Pantry แม่บ้าน ตึก 2", "Housekeeping pantry — Tower 2", 194),
        ("HK-LOC-LOCKER", "ล็อกเกอร์พนักงาน", "Staff lockers", 196),
        ("HK-LOC-CANTEEN", "แคนทีนพนักงาน", "Staff canteen", 198),
        ("HK-LOC-UNIFORM", "ห้องเครื่องแบบ", "Uniform room", 200),
        ("HK-LOC-LOADING", "ทางขนของ / Loading dock", "Loading & receiving", 202),
        ("HK-LOC-GARBAGE", "ห้องขยะ", "Garbage / trash room", 204),
        ("HK-LOC-STAFF-ENT", "ทางเข้าพนักงาน", "Staff entrance", 206),
        ("HK-LOC-STORAGE", "ห้องเก็บของ", "General storage", 208),
        # — F&B guest areas —
        ("HK-LOC-RESTAURANT", "ห้องอาหาร", "จุดบริการอาหาร", 220),
        ("HK-LOC-BAR", "บาร์", "จุดเครื่องดื่ม", 222),
        ("HK-LOC-ROOM-SERVICE", "จุดรับส่งอาหารห้องพัก", "หลังบ้าน F&B", 224),
        ("HK-LOC-CAFE", "คาเฟ่ / โรงอาหาร", "Café & light dining", 226),
        # — Pool, spa & wellness —
        ("HK-LOC-POOL", "สระน้ำ", "พื้นที่ริมสระ", 240),
        ("HK-LOC-POOL-DECK", "ลานรอบสระ", "ลานนั่งเล่น", 242),
        ("HK-LOC-FITNESS", "ฟิตเนส", "ห้องออกกำลังกาย", 244),
        ("HK-LOC-SPA", "สปา", "โซนสปาและนวด", 246),
        ("HK-LOC-SAUNA", "ซาวน่า", "ห้องซาวน่า", 248),
        ("HK-LOC-SALON", "ซาลอน", "บริการความงาม", 250),
        ("HK-LOC-KIDS", "Kids Club", "ห้องเด็ก", 252),
        # — MICE —
        ("HK-LOC-MEETING", "ห้องประชุม", "ห้องประชุม", 260),
        ("HK-LOC-BALLROOM", "ห้องบอลรูม", "งานเลี้ยงใหญ่", 262),
        ("HK-LOC-EVENT", "งานอีเวนต์", "โซนจัดงาน", 264),
        ("HK-LOC-PRE-FUNC", "Pre-function", "โซนรอเข้างาน", 266),
        # — Parking & outdoor —
        ("HK-LOC-PARKING", "ลานจอดรถ", "ลานจอดรถ", 280),
        ("HK-LOC-PORTICO", "หลังคาทางเข้า", "ทางเข้าหลัก", 282),
        ("HK-LOC-DRIVEWAY", "ลานรถ", "ทางรถบริการ", 284),
        ("HK-LOC-GARDEN", "สวน", "พื้นที่สวน", 286),
        ("HK-LOC-TERRACE", "ระเบียง", "ระเบียงกลางแจ้ง", 288),
        ("HK-LOC-WALKWAY", "ทางเดินกลางแจ้ง", "ทางเดินกลางแจ้ง", 290),
        ("HK-LOC-ROOFTOP", "ดาดฟ้า", "Rooftop", 292),
        # — Back staircases —
        ("HK-LOC-T1-STAIR", "บันไดหลัง ตึก 1", "Back staircase — Tower 1", 310),
        ("HK-LOC-T2-STAIR", "บันไดหลัง ตึก 2", "Back staircase — Tower 2", 312),
        *_extended_hotel_location_rows(),
    ]
    return rows


DEFAULT_HOTEL_LOCATION_ROWS: list[tuple[str, str, str | None, int]] = (
    _build_default_hotel_location_rows()
)

LEGACY_HOTEL_LOCATION_HINTS = frozenset({"บริเวณในโรงแรม", "บริเวณโรงแรม"})
DEFAULT_HOTEL_LOCATION_HINT_BY_CODE = dict(
    (code, hint) for code, _label, hint, _so in DEFAULT_HOTEL_LOCATION_ROWS
)


def seed_hotel_locations_if_empty() -> None:
    from ..hotel.hotel_location_emoji import infer_hotel_location_emoji

    with Session(engine) as s:
        if s.exec(select(HotelLocation)).first():
            return
        for code, label, _hint, _so in DEFAULT_HOTEL_LOCATION_ROWS:
            s.add(
                HotelLocation(
                    code=code,
                    label=label,
                    icon_emoji=infer_hotel_location_emoji(code),
                ),
            )
        s.commit()


def sync_hotel_locations_catalog() -> None:
    """Upsert catalog rows by code — adds new zones and refreshes default labels."""
    from ..hotel.hotel_location_emoji import infer_hotel_location_emoji

    with Session(engine) as s:
        for code, label, _hint, _so in DEFAULT_HOTEL_LOCATION_ROWS:
            emoji = infer_hotel_location_emoji(code)
            row = s.exec(
                select(HotelLocation).where(HotelLocation.code == code),
            ).first()
            if row:
                row.label = label
                row.icon_emoji = emoji
                s.add(row)
                continue
            s.add(
                HotelLocation(
                    code=code,
                    label=label,
                    icon_emoji=emoji,
                ),
            )
        s.commit()


def purge_unspecified_hotel_location() -> None:
    """Remove the generic 'unspecified zone' option — staff must pick a concrete place."""
    with Session(engine) as s:
        row = s.exec(
            select(HotelLocation).where(HotelLocation.code == "HK-PUBLIC"),
        ).first()
        if row:
            s.delete(row)
            s.commit()


def normalize_hotel_location_hints() -> None:
    """Legacy no-op — hint column removed from hotel locations."""


def _hash01(building: int, floor: int, n: int, salt: int) -> float:
    seed = (building * 1009 + floor * 53 + n) * 9301 + 49297 + salt * 131
    return (((seed % 233280) + 233280) % 233280) / 233280


def _type_for_room(building: int, floor: int, n: int) -> str:
    r = _hash01(building, floor, n, 1)
    suite_boost = (floor - 1) * 0.01
    if r > 0.92 - suite_boost:
        return "Suite"
    if r > 0.65:
        return "Deluxe"
    return "Superior"


def _view_for_room(building: int, floor: int, n: int) -> str:
    r = _hash01(building, floor, n, 7)
    if building == 1:
        if r < 0.55:
            return "sea"
        if r < 0.85:
            return "garden"
        return "pool"
    if r < 0.55:
        return "pool"
    if r < 0.85:
        return "garden"
    return "sea"


def seed_guest_rooms_if_empty() -> None:
    with Session(engine) as s:
        if s.exec(select(GuestRoom)).first():
            return
        for building in (1, 2):
            for floor in range(1, 6):
                for n in range(1, 31):
                    number = f"{building}{floor}{n:02d}"
                    s.add(
                        GuestRoom(
                            number=number,
                            building=building,
                            floor=floor,
                            room_type=_type_for_room(building, floor, n),
                            view=_view_for_room(building, floor, n),
                            active=True,
                        ),
                    )
        s.commit()


def seed_room_options_if_empty() -> None:
    from ..models import RoomAttributeOption

    defaults: list[tuple[str, str, str, str, int | None]] = [
        ("building", "1", "ตึก 1", "Tower 1", None),
        ("building", "2", "ตึก 2", "Tower 2", None),
        *[
            ("floor", str(f), f"ชั้น {f}", f"Floor {f}", None)
            for f in range(1, 6)
        ],
        ("type", "Superior", "ซูพีเรีย", "Superior", None),
        ("type", "Deluxe", "ดีลักซ์", "Deluxe", None),
        ("type", "Suite", "สวีท", "Suite", None),
        ("view", "sea", "วิวทะเล", "Sea view", None),
        ("view", "garden", "วิวสวน", "Garden view", None),
        ("view", "pool", "วิวสระน้ำ", "Pool view", None),
        ("bed", "king", "คิง", "King", None),
        ("bed", "twin", "ทวิน", "Twin", None),
        ("size", "35", "35 ตร.ม.", "35 sqm", 35),
        ("size", "44", "44 ตร.ม.", "44 sqm", 44),
        ("size", "75", "75 ตร.ม.", "75 sqm", 75),
    ]
    with Session(engine) as s:
        if s.exec(select(RoomAttributeOption)).first():
            return
        for i, (kind, code, th, en, vn) in enumerate(defaults):
            s.add(
                RoomAttributeOption(
                    kind=kind,
                    code=code,
                    label_th=th,
                    label_en=en,
                    value_num=vn,
                    sort_order=i,
                ),
            )
        s.commit()


def migrate_ensure_bell_boy_department_and_staff() -> None:
    """Upsert bellboy staff under Front Office; deactivate duplicate seed rows."""
    import json

    from ..auth.password_util import hash_password
    from ..auth.user_auth import derive_username, find_user_by_username

    default_pw = hash_password("1234")
    bell_perms = json.dumps({"queue": True, "requests": True})

    with Session(engine) as s:
        jt = s.exec(select(JobTitle).where(JobTitle.label == "Bell Boy")).first()
        if jt:
            jt.department = "front_office"
            s.add(jt)
        else:
            s.add(JobTitle(label="Bell Boy", department="front_office", sort_order=36))

        reserved = {
            (u.username or "").strip()
            for u in s.exec(select(User)).all()
            if (u.username or "").strip()
        }

        for name, initials, role, dept, color, job_title, zone in BELL_BOY_STAFF:
            matches = s.exec(
                select(User)
                .where(User.name == name, User.role == role)
                .order_by(User.id),
            ).all()
            for dup in matches[1:]:
                dup.active = False
                s.add(dup)
            primary = matches[0] if matches else None
            if primary:
                primary.role = role
                primary.department = dept
                primary.job_title = job_title
                primary.work_zone = zone
                primary.color = color
                primary.active = True
                if not (primary.permissions_json or "").strip():
                    primary.permissions_json = bell_perms
                if not (primary.username or "").strip():
                    uname = derive_username(s, name, extra_taken=frozenset(reserved))
                    primary.username = uname
                    reserved.add(uname)
                s.add(primary)
                continue

            username = derive_username(s, name, extra_taken=frozenset(reserved))
            reserved.add(username)
            ini = initials.replace(".", "").strip()[:2].upper() or "??"
            s.add(
                User(
                    name=name,
                    username=username,
                    password_hash=default_pw,
                    initials=ini,
                    role=role,
                    department=dept,
                    job_title=job_title,
                    work_zone=zone,
                    color=color,
                    permissions_json=bell_perms,
                    active=True,
                ),
            )
        s.commit()
