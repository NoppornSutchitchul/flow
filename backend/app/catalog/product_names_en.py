"""English display names for catalog products (Thai names remain canonical in DB)."""
from __future__ import annotations

import re

from .product_en_by_sku import PRODUCT_EN_BY_SKU

# Longest-match phrase replacements (Thai → English).
_PHRASES: list[tuple[str, str]] = [
    ("รองเท้าแตะสระน้ำ", "Pool slippers"),
    ("รองเท้าแตะเด็ก", "Kids slippers"),
    ("รองเท้าแตะสปา", "Spa slippers"),
    ("รองเท้าแตะ", "Slippers"),
    ("ผ้าเช็ดตัวสระน้ำ", "Pool towel"),
    ("ผ้าเช็ดตัวสระ", "Pool towel"),
    ("ผ้าเช็ดตัว", "Bath towel"),
    ("ผ้าเช็ดมือ", "Hand towel"),
    ("ผ้าเช็ดหน้า", "Face towel"),
    ("ผ้าเช็ดเท้า", "Foot towel"),
    ("ผ้าเช็ดแว่นตา", "Lens cloth"),
    ("พรมเช็ดเท้า", "Bath mat"),
    ("เสื้อคลุมสระน้ำ", "Pool cover-up"),
    ("ชุดคลุมอาบน้ำ", "Bathrobe"),
    ("ม่านอาบน้ำ (สำรอง)", "Shower curtain (spare)"),
    ("ม่านอาบน้ำ", "Shower curtain"),
    ("พรมกันลื่นห้องน้ำ", "Non-slip bath mat"),
    ("หมอนหนุน (นุ่ม)", "Pillow (soft)"),
    ("หมอนหนุน (มาตรฐาน)", "Pillow (standard)"),
    ("หมอนหนุน (แข็ง)", "Pillow (firm)"),
    ("หมอนหนุน", "Pillow"),
    ("หมอน", "Pillow"),
    ("ผ้นห่ม", "Blanket"),
    ("ผ้าปูที่นอน", "Bed sheet"),
    ("ปลอกหมอน", "Pillowcase"),
    ("ปลอกผ้านวม", "Duvet cover"),
    ("ผ้านวม", "Duvet"),
    ("หลอดดาวน์ไลท์", "Downlight bulb"),
    ("หลอดให้ความร้อน (ห้องน้ำ)", "Heat lamp (bathroom)"),
    ("หลอดไฟตู้เซฟ", "Safe light bulb"),
    ("หลอดไฟ (แอลอีดี)", "Light bulb (LED)"),
    ("หลอดไฟ (ไส้)", "Light bulb (filament)"),
    ("หลอดไฟ", "Light bulb"),
    ("กระดาษชำระ", "Toilet paper"),
    ("ครีมนวดผม", "Conditioner"),
    ("แชมพู", "Shampoo"),
    ("สบู่", "Soap"),
    ("โลชั่น", "Lotion"),
    ("เก็บขยะ / แยกขยะรีไซเคิล", "Trash / recycling collection"),
    ("เก็บขยะ", "Trash collection"),
    ("กำจัดกลิ่น", "Odor removal"),
    ("ทำความสะอาด", "Room cleaning"),
    ("ซ่อมแอร์", "AC repair"),
    ("น้ำรั่ว", "Water leak"),
    ("กระติกน้ำร้อน", "Hot water kettle"),
    ("แก้วน้ำ", "Water glass"),
    ("แก้ว", "Glass"),
    ("ถังขยะ", "Waste bin"),
    ("ถุงขยะ", "Trash bag"),
    ("ไม้แขวนเสื้อ", "Clothes hanger"),
    ("ไม้แขวน", "Hanger"),
    ("ผ้าไมโครไฟเบอร์", "Microfiber cloth"),
    ("ผ้าเช็ด", "Cloth"),
    ("น้ำดื่ม", "Drinking water"),
    ("มินิบาร์", "Minibar"),
    ("เครื่องทำน้ำอุ่น", "Water heater"),
    ("รีโมท", "Remote control"),
    ("แบตเตอรี่", "Battery"),
    ("สายชาร์จ", "Charging cable"),
    ("ปลั๊ก", "Plug"),
    ("กุญแจ", "Key"),
    ("ล็อค", "Lock"),
    ("ประตู", "Door"),
    ("หน้าต่าง", "Window"),
    ("กระจก", "Mirror"),
    ("โซฟา", "Sofa"),
    ("เก้าอี้", "Chair"),
    ("โต๊ะ", "Table"),
    ("ตู้", "Cabinet"),
    ("ลิฟต์", "Elevator"),
    ("สระว่ายน้ำ", "Swimming pool"),
    ("สปา", "Spa"),
    ("เครื่องฟอกอากาศ", "Air purifier"),
    ("ไดร์เป่าผม", "Hair dryer"),
    ("เตารีด", "Iron"),
    ("ตู้เซฟ", "Safe"),
    ("เครื่องปรับอากาศ", "Air conditioner"),
    ("แอร์", "AC"),
    ("ท่อน้ำ", "Water pipe"),
    ("ก๊อกน้ำ", "Faucet"),
    ("ชักโครก", "Toilet"),
    ("อ่างล้างหน้า", "Sink"),
    ("ฝักบัว", "Shower head"),
    ("สายฝักบัว", "Shower hose"),
    ("น้ำยาทำความสะอาด", "Cleaning solution"),
    ("ไม้กวาด", "Broom"),
    ("ไม้ถูพื้น", "Mop"),
    ("ถัง", "Bucket"),
    ("ถุงมือ", "Gloves"),
    ("หน้ากาก", "Mask"),
    ("สำรอง", "spare"),
]

_SIZE_COLOR: list[tuple[str, str]] = [
    ("ไซส์ใหญ่พิเศษ", "size XL"),
    ("ไซส์เล็ก", "size S"),
    ("ไซส์กลาง", "size M"),
    ("ไซส์ใหญ่", "size L"),
    ("ขนาดใหญ่", "large"),
    ("ขนาดกลาง", "medium"),
    ("ขาว", "white"),
    ("ดำ", "black"),
    ("น้ำเงิน", "blue"),
    ("เขียว", "green"),
    ("แดง", "red"),
    ("เด็ก", "kids"),
]

_SKU_CATEGORY: dict[str, str] = {
    "SLP": "Slippers",
    "TWL": "Towel",
    "BTH": "Bathrobe",
    "BED": "Bedding",
    "LND": "Laundry supply",
    "AMN": "Amenity",
    "HKP": "In-room item",
    "MIN": "Minibar item",
    "EQP": "Equipment",
    "KID": "Kids item",
    "ACC": "Accessibility item",
    "PUB": "Public area supply",
    "PLS": "Pool item",
    "SPA": "Spa item",
    "GST": "Guest room extra",
    "SEC": "Safety item",
    "LIN": "Linen",
    "SVC": "Service",
    "BLB": "Light bulb",
    "PLM": "Plumbing part",
    "ELC": "Electrical part",
    "HVAC": "HVAC part",
    "FUR": "Furniture part",
    "KIT": "Kitchen part",
    "SFT": "Safety equipment",
    "SHP": "Shampoo",
}


def english_product_name(sku: str, th_name: str) -> str:
    """Return an English label for a catalog product."""
    if sku in PRODUCT_EN_BY_SKU:
        return PRODUCT_EN_BY_SKU[sku]
    text = th_name
    for th, en in sorted(_PHRASES, key=lambda p: len(p[0]), reverse=True):
        if th in text:
            text = text.replace(th, en)
    for th, en in sorted(_SIZE_COLOR, key=lambda p: len(p[0]), reverse=True):
        text = text.replace(th, en)
    text = re.sub(r"\((\w+)\s+(size\s+\w+)\)", r"(\1, \2)", text)
    text = re.sub(r"\s+", " ", text.strip())
    if re.search(r"[\u0E00-\u0E7F]", text):
        parts = sku.split("-")
        cat = parts[1] if len(parts) > 1 else ""
        base = _SKU_CATEGORY.get(cat, "Item")
        # Keep any English fragments; never append SKU (shown in its own column).
        latin = re.sub(r"[\u0E00-\u0E7F]+", " ", text)
        latin = re.sub(r"\s+", " ", latin).strip(" ,·()")
        if latin:
            return latin
        return base
    return text
