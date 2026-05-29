"""Initial seed for ProductCategory table.

Mirrors the historical hard-coded list of 3-letter SKU group codes used in the
frontend. Each row has Thai + English display names plus an emoji shown in
pickers. These are flagged `builtin=True` so the admin manager UI can warn
before edits (they map to existing SKUs in the DB).
"""
from __future__ import annotations

from typing import Iterable

from sqlmodel import Session, select

from ..models import ProductCategory
from .product_category_departments import default_department_for_category_code


# (code, name_th, name_en, icon_emoji)
SEED_ROWS: list[tuple[str, str, str, str]] = [
    ("GST", "ทั่วไป", "General", "📦"),
    ("BED", "ที่นอน / หมอน", "Bedding / pillows", "🛏️"),
    ("BTH", "ห้องน้ำ", "Bathroom", "🚿"),
    ("TWL", "ผ้าเช็ดตัว", "Bath towels", "🛁"),
    ("SLP", "รองเท้า / ผ้าเช็ดเท้า", "Slippers / foot towels", "🥿"),
    ("LIN", "ผ้าลินิน", "Linens", "🧺"),
    ("FUR", "เฟอร์นิเจอร์", "Furniture", "🪑"),
    ("AMN", "ของใช้ส่วนตัว", "Amenities", "✨"),
    ("MIN", "มินิบาร์", "Minibar", "🍷"),
    ("CAF", "กาแฟ / ชา", "Coffee / tea", "☕"),
    ("KID", "เด็ก / ทารก", "Kids / baby", "👶"),
    ("ACC", "อุปกรณ์ช่วยเหลือ", "Accessibility", "♿"),
    ("HKP", "อุปกรณ์แม่บ้าน", "Housekeeping supplies", "🧹"),
    ("CLN", "น้ำยาทำความสะอาด", "Cleaning chemicals", "🧽"),
    ("LND", "ซักรีด", "Laundry", "👔"),
    ("PUB", "พื้นที่สาธารณะ", "Public areas", "🏛️"),
    ("WST", "ขยะ / รีไซเคิล", "Waste / recycling", "🗑️"),
    ("FNB", "อาหารและเครื่องดื่ม", "Food & beverage", "🍽️"),
    ("KIT", "ครัว", "Kitchen", "🍳"),
    ("BAR", "บาร์ / เลาจ์", "Bar / lounge", "🍸"),
    ("PLS", "สระว่ายน้ำ", "Swimming pool", "🏊"),
    ("SPA", "สปา", "Spa", "💆"),
    ("FIT", "ฟิตเนส", "Fitness", "🏋️"),
    ("SAL", "ร้านเสริมสวย", "Salon / beauty", "💇"),
    ("REC", "สันทนาการ", "Recreation", "🎮"),
    ("GDN", "สวน / ภายนอก", "Garden / outdoor", "🌳"),
    ("OUT", "กลางแจ้ง / ฝน", "Outdoor / rain", "☂️"),
    ("FDQ", "ฟร้อนท์ / แผนกต้อนรับ", "Front desk", "🛎️"),
    ("LUG", "กระเป๋า / สัมภาระ", "Luggage", "🧳"),
    ("CNB", "เบลล์ / คอนเซียร์จ", "Bell / concierge", "🔔"),
    ("GFT", "ของขวัญ / ของฝาก", "Gifts / amenities", "🎁"),
    ("KEY", "กุญแจ / คีย์การ์ด", "Keys / key cards", "🔑"),
    ("MTG", "ห้องประชุม", "Meetings", "📊"),
    ("BNQ", "จัดเลี้ยง / งานเลี้ยง", "Banquet / events", "🎉"),
    ("ELC", "ไฟฟ้า", "Electrical", "⚡"),
    ("PLM", "ประปา", "Plumbing", "🚰"),
    ("HVAC", "แอร์ / ระบบอากาศ", "HVAC", "❄️"),
    ("BLB", "ไฟ / หลอดไฟ", "Lighting", "💡"),
    ("EQP", "อุปกรณ์ / เครื่องมือ", "Equipment / tools", "🔌"),
    ("SEC", "รักษาความปลอดภัย", "Security", "🛡️"),
    ("SFT", "ความปลอดภัย (PPE)", "Safety (PPE)", "🦺"),
    ("FIR", "ป้องกันอัคคีภัย", "Fire safety", "🚨"),
    ("MED", "ปฐมพยาบาล / การแพทย์", "First aid / medical", "🩹"),
    ("NET", "IT / Wi‑Fi", "IT / Wi‑Fi", "📶"),
    ("PRT", "เครื่องพิมพ์ / สำนักงาน", "Printer / office", "🖨️"),
    ("STN", "เครื่องเขียน", "Stationery", "✏️"),
    ("PRK", "ที่จอดรถ", "Parking", "🅿️"),
    ("TRN", "ขนส่ง / รถ", "Transport / vehicles", "🚗"),
    ("PET", "สัตว์เลี้ยง", "Pets", "🐾"),
    ("IRN", "รีดผ้า / ไอน์", "Iron / laundry press", "👔"),
    ("ICE", "น้ำแข็ง", "Ice", "🧊"),
    ("ELP", "ลิฟต์", "Elevator", "🛗"),
    ("TVR", "ทีวี / รีโมท", "TV / remote", "📺"),
    ("CUR", "ม่าน / หน้าต่าง", "Curtains / windows", "🪟"),
    ("HGR", "ไม้แขวนเสื้อ", "Hangers", "🪝"),
    ("VLT", "ของใช้ในห้องน้ำ", "Toiletries", "🧴"),
    ("CLK", "โทรปลุก / นาฬิกา", "Wake-up / clock", "⏰"),
    ("CAM", "กล้อง / ถ่ายภาพ", "Camera", "📷"),
    ("MUS", "ดนตรี / บันเทิง", "Music / entertainment", "🎵"),
    ("LIB", "ห้องสมุด / หนังสือ", "Library / books", "📚"),
    ("VAC", "เครื่องดูดฝุ่น", "Vacuum cleaner", "🧹"),
    ("PHN", "โทรศัพท์", "Telephone", "☎️"),
    ("RML", "ประตู / ห้อง", "Door / room", "🚪"),
    ("SVC", "บริการ", "Service", "✨"),
]


def seed_product_categories(s: Session) -> None:
    """Insert built-in rows; preserve any admin edits on existing codes."""
    existing = {
        row.code: row
        for row in s.exec(select(ProductCategory)).all()
    }
    next_order = len(existing)
    for idx, (code, name_th, name_en, emoji) in enumerate(SEED_ROWS):
        if code in existing:
            row = existing[code]
            # Only fill in blanks; do not overwrite admin edits.
            if not row.name_en:
                row.name_en = name_en
            if not row.icon_emoji:
                row.icon_emoji = emoji
            if not row.builtin:
                row.builtin = True
            if not getattr(row, "department", None):
                row.department = default_department_for_category_code(code)
            s.add(row)
            continue
        s.add(
            ProductCategory(
                code=code,
                department=default_department_for_category_code(code),
                name=name_th,
                name_en=name_en,
                icon_emoji=emoji,
                sort_order=idx,
                active=True,
                builtin=True,
            ),
        )
    s.commit()


def _iter_seed_codes() -> Iterable[str]:
    for code, _name_th, _name_en, _emoji in SEED_ROWS:
        yield code
