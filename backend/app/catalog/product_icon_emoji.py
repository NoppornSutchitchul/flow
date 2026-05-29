"""Infer item-specific emoji for catalog products (mirrors frontend name rules)."""
from __future__ import annotations

import re

GROUP_EMOJI: dict[str, str] = {
    "GST": "📦",
    "BED": "🛏️",
    "BTH": "🚿",
    "TWL": "🛁",
    "SLP": "🥿",
    "LIN": "🧺",
    "AMN": "🧴",
    "MIN": "🍷",
    "CAF": "☕",
    "KID": "👶",
    "ACC": "♿",
    "HKP": "🧹",
    "CLN": "🧽",
    "LND": "👔",
    "WST": "🗑️",
    "FNB": "🍽️",
    "PLS": "🏊",
    "SPA": "💆",
    "FIT": "🏋️",
    "SAL": "💇",
    "GFT": "🎁",
    "CNB": "🛎️",
    "LUG": "🧳",
    "KEY": "🔑",
    "TVR": "📺",
    "NET": "📶",
    "PHN": "☎️",
    "CLK": "⏰",
    "HGR": "🪝",
    "HVAC": "❄️",
    "BLB": "💡",
    "PLM": "🚰",
    "ELC": "⚡",
    "EQP": "🔧",
    "ELP": "🛗",
    "CUR": "🪟",
    "RML": "🚪",
    "MED": "🩹",
    "FIR": "🚨",
    "MTG": "📊",
    "BNQ": "🎉",
    "PRK": "🅿️",
    "TRN": "🚗",
    "PET": "🐾",
    "IRN": "👔",
    "VAC": "🧹",
    "SVC": "✨",
}

NAME_EMOJI: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"ไม้เท้า", re.I), "🦯"),
    (re.compile(r"รถเข็น", re.I), "♿"),
    (re.compile(r"เก้าอี้อาบน้ำ", re.I), "🪑"),
    (re.compile(r"เครื่องช่วยฟัง", re.I), "🦻"),
    (re.compile(r"ราวจับ|ราวกั้น", re.I), "🤝"),
    (re.compile(r"ที่เพิ่มความสูงชักโครก", re.I), "🚽"),
    (re.compile(r"ผู้พิการทางการได้ยิน", re.I), "🦻"),
    (re.compile(r"แชมพู|ครีมนวดผม|ครีมนวด", re.I), "🧴"),
    (re.compile(r"สบู่เหลว|สบู่ก้อน|สบู่", re.I), "🧼"),
    (re.compile(r"โลชั่น|ครีมนวดตัว", re.I), "🧴"),
    (re.compile(r"เจลอาบมือ", re.I), "🧴"),
    (re.compile(r"น้ำยาบ้วนปาก", re.I), "🧴"),
    (re.compile(r"แปรงสีฟัน|ยาสีฟัน", re.I), "🪥"),
    (re.compile(r"ไม้จิ้มฟัน", re.I), "🪥"),
    (re.compile(r"มีดโกน|โฟมโกน|ครีมโกน", re.I), "🪒"),
    (re.compile(r"ไม้พันสำลี|ทิชชู", re.I), "🧻"),
    (re.compile(r"ชุดเย็บผ้า", re.I), "🪡"),
    (re.compile(r"หวี|แปรงผม", re.I), "🪮"),
    (re.compile(r"หมวกคลุมอาบน้ำ|หมวกอาบ", re.I), "🚿"),
    (re.compile(r"เกลืออาบน้ำ", re.I), "🛁"),
    (re.compile(r"ใยขัด", re.I), "🧽"),
    (re.compile(r"สเปรย์ปรับอากาศ|น้ำหอม", re.I), "🌸"),
    (re.compile(r"ครีมกันแดด", re.I), "🧴"),
    (re.compile(r"หน้ากากอนามัย", re.I), "😷"),
    (re.compile(r"ผ้าอ้อม", re.I), "🧷"),
    (re.compile(r"แผ่นอนามัย", re.I), "🩹"),
    (re.compile(r"ผ้าเช็ดตัว|ผ้าเช็ดมือ|ผ้าเช็ดหน้|ผ้าเช็ดเท้|ผ้าเช็ดแว่น", re.I), "🛁"),
    (re.compile(r"พรมเช็ดเท้|พรมกันลื่น|แผ่นรองพื้น", re.I), "🛁"),
    (re.compile(r"ชุดคลุมอาบน้ำ|เสื้อคลุมสระ|ชุดคลุมสปา", re.I), "🥋"),
    (re.compile(r"ม่านอาบน้ำ", re.I), "🚿"),
    (re.compile(r"ปลอกหมอน", re.I), "🧵"),
    (re.compile(r"ปลอกผ้านวม", re.I), "🧵"),
    (re.compile(r"หมอนหนุน.*ขนเป็ด|ขนเป็ด.*หมอน", re.I), "🪶"),
    (re.compile(r"หมอนผ้าไหม", re.I), "🧵"),
    (re.compile(r"หมอนหนุน|หมอนข้าง|หมอนเด็ก|หมอนรอง", re.I), "💤"),
    (re.compile(r"ผ้นห่ม|ผ้าห่ม", re.I), "🧶"),
    (re.compile(r"ผ้านวม", re.I), "🛋️"),
    (re.compile(r"ผ้าปู", re.I), "🛏️"),
    (re.compile(r"แผ่นรองที่นอน", re.I), "🛏️"),
    (re.compile(r"ไม้แขวน", re.I), "🪝"),
    (re.compile(r"ที่รองกระเป๋า|ที่วางกระเป๋า", re.I), "🧳"),
    (re.compile(r"รองเท้าแตะ|รองเท้า", re.I), "🥿"),
    (re.compile(r"กาแฟ|โกโก้|เม็ดกาแฟ|เครื่องชงกาแฟ", re.I), "☕"),
    (re.compile(r"ชา", re.I), "🍵"),
    (re.compile(r"น้ำดื่ม|น้ำแร่", re.I), "💧"),
    (re.compile(r"น้ำผลไม้|น้ำส้ม|น้ำแอป|น้ำมะ", re.I), "🧃"),
    (re.compile(r"โค้ก|น้ำอัดลม|เครื่องดื่มชูก", re.I), "🥤"),
    (re.compile(r"เบียร์", re.I), "🍺"),
    (re.compile(r"ไวน์|สุรา|เหล้า|จิน|โวดก้า|รัม", re.I), "🍷"),
    (re.compile(r"นมกล่อง|โยเกิร์ต", re.I), "🥛"),
    (re.compile(r"ขนม|ช็อก|บิสก|ถั่ว|ลูกเกด|ลูกอม|หมากฝรั่ง|ไอศกรีม", re.I), "🍫"),
    (re.compile(r"น้ำผึ้ง", re.I), "🍯"),
    (re.compile(r"กระติกน้ำร้อน|ถังน้ำร้อน|เครื่องทำน้ำ", re.I), "🫖"),
    (re.compile(r"ถังน้ำแข็ง|น้ำแข็ง|ที่ตักน้ำแข็ง", re.I), "🧊"),
    (re.compile(r"แก้ว|จานรอง|ถาดมินิบาร์", re.I), "🥤"),
    (re.compile(r"มินิบาร์|ตู้เย็น", re.I), "🧊"),
    (re.compile(r"ถุง.*ซัก|ใบแจ้งซัก|ถุงใส่เสื้อผ้า", re.I), "👔"),
    (re.compile(r"เตารีด|โต๊ะรีด", re.I), "👔"),
    (re.compile(r"ป้ายห้ามรบกวน", re.I), "🚫"),
    (re.compile(r"ป้ายขอทำความสะอาด", re.I), "🧹"),
    (re.compile(r"ถุงขยะ", re.I), "🗑️"),
    (re.compile(r"กระดาษชำระ|ทิชชู่", re.I), "🧻"),
    (re.compile(r"น้ำยาทำความสะอาด|น้ำยาฆ่าเชื้อ|น้ำยาขจัด", re.I), "🧴"),
    (re.compile(r"ไม้กวาด|ถังและไม้ถู", re.I), "🧹"),
    (re.compile(r"ถุงมือ", re.I), "🧤"),
    (re.compile(r"ฟองน้ำ|ใยขัดจาน", re.I), "🧽"),
    (re.compile(r"แปรงขัด", re.I), "🧽"),
    (re.compile(r"น้ำยาซัก|น้ำยาปรับผ้า|น้ำยาฟอก", re.I), "🧴"),
    (re.compile(r"ไดร์เป่าผม", re.I), "💇"),
    (re.compile(r"เครื่องดูดความชื้น|เครื่องฟอกอากาศ", re.I), "💨"),
    (re.compile(r"เปลเด็ก|เตียงเสริม|เตียงเด็ก", re.I), "🛏️"),
    (re.compile(r"ร่ม", re.I), "☂️"),
    (re.compile(r"ปลั๊ก|สายชาร์จ|สายยูเอสบี|สายเอชดี|สายแลน|หัวแปลง", re.I), "🔌"),
    (re.compile(r"ลำโพง", re.I), "🔊"),
    (re.compile(r"กล่องอาหาร", re.I), "🍱"),
    (re.compile(r"หมวกว่ายน้ำ|แว่นตากันแดด", re.I), "🕶️"),
    (re.compile(r"ห่วงยาง|เสื้อชูชีพ", re.I), "🏊"),
    (re.compile(r"เครื่องชั่ง", re.I), "⚖️"),
    (re.compile(r"ที่งัดรองเท้า", re.I), "👞"),
    (re.compile(r"โคมไฟ", re.I), "💡"),
    (re.compile(r"กระจกแต่งหน้า", re.I), "🪞"),
    (re.compile(r"ของเล่น", re.I), "🧸"),
    (re.compile(r"หนังสือระบายสี", re.I), "🖍️"),
    (re.compile(r"อ่างอาบน้ำเด็ก|ที่นั่งชักโครกเด็ก", re.I), "👶"),
    (re.compile(r"เด็ก|ทารก|เตียงเด็ก|ผ้าปูเตียงเด็ก", re.I), "👶"),
    (re.compile(r"เก้าอี้ทานข้าวเด็ก|เก้าอี้เสริม", re.I), "🪑"),
    (re.compile(r"เครื่องทำนม", re.I), "🍼"),
    (re.compile(r"น้ำมันนวด|หินร้อน", re.I), "💆"),
    (re.compile(r"ชุดชั้นในสปา", re.I), "👙"),
    (re.compile(r"สปา", re.I), "💆"),
    (re.compile(r"สระ", re.I), "🏊"),
    (re.compile(r"ถังดับเพลิง|สายดับเพลิง", re.I), "🧯"),
    (re.compile(r"ผ้าห่มกันไฟ", re.I), "🧯"),
    (re.compile(r"ชุดปฐมพยาบาล", re.I), "🩹"),
    (re.compile(r"ปลายทางหนีไฟ|ป้ายทางหนี", re.I), "🚨"),
    (re.compile(r"แว่นตานิรภัย", re.I), "🥽"),
    (re.compile(r"สติกเกอร์ห้ามสูบ", re.I), "🚭"),
    (re.compile(r"หลอดไฟ", re.I), "💡"),
    (re.compile(r"รีโมท", re.I), "📺"),
    (re.compile(r"ถ่าน", re.I), "🔋"),
    (re.compile(r"ฝักบัว|สายฝักบัว|หัวชักโครก", re.I), "🚿"),
    (re.compile(r"ชักโครก|ลูกลอย", re.I), "🚽"),
    (re.compile(r"ก๊อกน้ำ|ตัวกรองน้ำ", re.I), "🚰"),
    (re.compile(r"ยางปิด|ยาแนว", re.I), "🔧"),
    (re.compile(r"แอร์|ฟิลเตอร์แอร์|เก็บประจุ|ลูกลอยแอร์|คอยล์", re.I), "❄️"),
    (re.compile(r"ทีวี", re.I), "📺"),
    (re.compile(r"ไวไฟ|อินเทอร์เน็ต|สาย", re.I), "📶"),
    (re.compile(r"โทรศัพท์|อินเตอร์คอม|กริ่ง", re.I), "☎️"),
    (re.compile(r"กุญแจ|การ์ด", re.I), "🔑"),
    (re.compile(r"ประตู|ลูกบิด|บานพับ|เครื่องปิดประตู|ที่กั้นประตู", re.I), "🚪"),
    (re.compile(r"ม่าน|มู่ลี่|สายมู่ลี่", re.I), "🪟"),
    (re.compile(r"กระจก", re.I), "🪞"),
    (re.compile(r"สีทาผนัง|กาวไม้|สกรู|ล้อเก้าอี้", re.I), "🔧"),
    (re.compile(r"ลิฟต์", re.I), "🛗"),
    (re.compile(r"ตู้เซฟ", re.I), "🔐"),
    (re.compile(r"เครื่องตรวจจับควัน", re.I), "🚨"),
    (re.compile(r"เชือกนิรภัย", re.I), "🪢"),
    (re.compile(r"ดอกไม้", re.I), "💐"),
    (re.compile(r"ของขวัญ|เซอร์ไพรส์|ฮันนีมูน", re.I), "🎁"),
    (re.compile(r"สมุดโน้ต|ปากกา|เครื่องเขียน", re.I), "✏️"),
    (re.compile(r"ไดเรกทอรี", re.I), "📖"),
    (re.compile(r"ไม้จุดไฟ", re.I), "🔥"),
    (re.compile(r"ช้อนส้อม|จานและชาม", re.I), "🍽️"),
    (re.compile(r"ผ้าคลุมโต๊ะ", re.I), "🍽️"),
    (re.compile(r"ซ่อม|เสีย|ใช้ไม่|รั่ว|ตัน|เปิดไม่", re.I), "🔧"),
]


def _sku_group(sku: str) -> str | None:
    m = re.match(r"^[A-Z]{2}-([A-Z]{3})-", sku or "")
    return m.group(1) if m else None


def infer_icon_emoji(sku: str, name: str, *, is_service: bool = False) -> str:
    if sku.endswith("-099") or re.search(r"อื่นๆ", name or ""):
        return "📋"
    if is_service:
        return "🔧" if sku.startswith("MT-") else "✨"
    for pattern, emoji in NAME_EMOJI:
        if pattern.search(name or ""):
            return emoji
    group = _sku_group(sku)
    if group and group in GROUP_EMOJI:
        return GROUP_EMOJI[group]
    return "📦"


def backfill_product_icon_emojis(engine) -> None:
    from sqlmodel import Session, select

    from ..models import Product

    with Session(engine) as s:
        changed = False
        for p in s.exec(select(Product)).all():
            inferred = infer_icon_emoji(p.sku, p.name, is_service=p.is_service)
            if p.icon_emoji != inferred:
                p.icon_emoji = inferred
                s.add(p)
                changed = True
        if changed:
            s.commit()
