"""Default hotel items & services catalog — synced to inventory on startup."""
from __future__ import annotations

from sqlmodel import Session, select

from ..db import engine
from ..models import Product
from .product_icon_emoji import infer_icon_emoji
from .product_names_en import english_product_name
from .product_name_cleanup import (
    backfill_all_product_i18n_columns,
    normalize_all_product_names,
    strip_legacy_product_suffix,
    strip_legacy_suffixes_from_items_text,
)

# (sku, name, department, unit, on_hand, reorder_at, is_service)
ProductRow = tuple[str, str, str, str | None, int | None, int | None, bool]


def _item(
    sku: str,
    name: str,
    dept: str,
    unit: str,
    on_hand: int,
    reorder: int,
) -> ProductRow:
    return (sku, name, dept, unit, on_hand, reorder, False)


def _service(sku: str, name: str, dept: str) -> ProductRow:
    return (sku, name, dept, None, None, None, True)


PRODUCT_ROWS: list[ProductRow] = [
    # ═══ แม่บ้าน: ผ้าและที่นอน ═══
    _item("HK-SLP-001", "รองเท้าแตะ (ขาว ไซส์เล็ก)", "housekeeping", "คู่", 20, 12),
    _item("HK-SLP-002", "รองเท้าแตะ (ขาว ไซส์กลาง)", "housekeeping", "คู่", 32, 15),
    _item("HK-SLP-003", "รองเท้าแตะ (ขาว ไซส์ใหญ่)", "housekeeping", "คู่", 28, 15),
    _item("HK-SLP-004", "รองเท้าแตะ (ขาว ไซส์ใหญ่พิเศษ)", "housekeeping", "คู่", 18, 10),
    _item("HK-SLP-005", "รองเท้าแตะเด็ก", "housekeeping", "คู่", 15, 8),
    _item("HK-SLP-006", "รองเท้าแตะสระน้ำ", "housekeeping", "คู่", 25, 10),
    _item("HK-TWL-001", "ผ้าเช็ดตัว (ขนาดใหญ่)", "housekeeping", "ผืน", 140, 45),
    _item("HK-TWL-002", "ผ้าเช็ดตัว (ขนาดกลาง)", "housekeeping", "ผืน", 80, 25),
    _item("HK-TWL-003", "ผ้าเช็ดมือ", "housekeeping", "ผืน", 200, 55),
    _item("HK-TWL-004", "ผ้าเช็ดหน้า", "housekeeping", "ผืน", 180, 50),
    _item("HK-TWL-005", "ผ้าเช็ดเท้า", "housekeeping", "ผืน", 160, 45),
    _item("HK-TWL-006", "พรมเช็ดเท้า", "housekeeping", "ผืน", 90, 30),
    _item("HK-TWL-007", "ผ้าเช็ดตัวสระน้ำ", "housekeeping", "ผืน", 40, 15),
    _item("HK-TWL-008", "เสื้อคลุมสระน้ำ", "housekeeping", "ตัว", 35, 12),
    _item("HK-BTH-001", "ชุดคลุมอาบน้ำ (ไซส์กลาง)", "housekeeping", "ชุด", 35, 12),
    _item("HK-BTH-002", "ชุดคลุมอาบน้ำ (ไซส์ใหญ่)", "housekeeping", "ชุด", 40, 12),
    _item("HK-BTH-003", "ชุดคลุมอาบน้ำ (ไซส์ใหญ่พิเศษ)", "housekeeping", "ชุด", 25, 10),
    _item("HK-BTH-004", "ม่านอาบน้ำ (สำรอง)", "housekeeping", "ผืน", 20, 8),
    _item("HK-BTH-005", "พรมกันลื่นห้องน้ำ", "housekeeping", "ผืน", 45, 15),
    _item("HK-BED-001", "หมอนหนุน (นุ่ม)", "housekeeping", "ใบ", 45, 15),
    _item("HK-BED-002", "หมอนหนุน (มาตรฐาน)", "housekeeping", "ใบ", 60, 20),
    _item("HK-BED-003", "หมอนหนุน (แข็ง)", "housekeeping", "ใบ", 35, 12),
    _item("HK-BED-004", "หมอนหนุน (ขนเป็ด)", "housekeeping", "ใบ", 20, 8),
    _item("HK-BED-005", "หมอนหนุน (ป้องกันภูมิแพ้)", "housekeeping", "ใบ", 25, 10),
    _item("HK-BED-006", "หมอนข้าง", "housekeeping", "ใบ", 30, 10),
    _item("HK-BED-007", "หมอนผ้าไหม", "housekeeping", "ใบ", 18, 8),
    _item("HK-BED-008", "หมอนหนุนข้อเท้า", "housekeeping", "ใบ", 15, 6),
    _item("HK-BED-009", "ผ้นห่ม (บาง)", "housekeeping", "ผืน", 55, 18),
    _item("HK-BED-010", "ผ้นห่ม (หนา)", "housekeeping", "ผืน", 40, 15),
    _item("HK-BED-011", "ผ้านวม", "housekeeping", "ผืน", 35, 12),
    _item("HK-BED-012", "ปลอกผ้านวม", "housekeeping", "ผืน", 40, 15),
    _item("HK-BED-013", "ผ้าปูที่นอน (เตียงแฝด)", "housekeeping", "ชุด", 50, 18),
    _item("HK-BED-014", "ผ้าปูที่นอน (เตียงคิง)", "housekeeping", "ชุด", 45, 15),
    _item("HK-BED-015", "ผ้าปูที่นอน (เตียงใหญ่พิเศษ)", "housekeeping", "ชุด", 30, 10),
    _item("HK-BED-016", "ปลอกหมอน", "housekeeping", "ใบ", 120, 40),
    _item("HK-BED-017", "ปลอกหมอนข้าง", "housekeeping", "ใบ", 40, 15),
    _item("HK-BED-018", "แผ่นรองที่นอน", "housekeeping", "ผืน", 30, 10),
    _item("HK-BED-019", "ผ้าห่มชาติ", "housekeeping", "ผืน", 25, 10),
    _item("HK-BED-020", "ไม้แขวนเสื้อ", "housekeeping", "อัน", 200, 60),
    _item("HK-BED-021", "ไม้แขวนกางเกง", "housekeeping", "อัน", 120, 40),
    _item("HK-BED-022", "ที่รองกระเป๋า", "housekeeping", "อัน", 40, 15),
    _item("HK-LND-001", "ถุงใส่เสื้อผ้า (ซักรีด)", "housekeeping", "ใบ", 90, 30),
    _item("HK-LND-002", "ใบแจ้งซักรีด", "housekeeping", "แผ่น", 150, 50),
    _item("HK-LND-003", "ป้ายห้ามรบกวน", "housekeeping", "อัน", 80, 25),
    _item("HK-LND-004", "ป้ายขอทำความสะอาดห้อง", "housekeeping", "อัน", 80, 25),
    _item("HK-LND-005", "ถุงซักผ้า (ตาข่าย)", "housekeeping", "ใบ", 35, 12),
    _item("HK-LND-006", "ไม้แขวนผ้า (สำรอง)", "housekeeping", "อัน", 60, 20),
    # ═══ แม่บ้าน: ของใช้ส่วนตัวในห้องน้ำ ═══
    _item("HK-AMN-001", "แชมพู", "housekeeping", "ขวด", 48, 22),
    _item("HK-AMN-002", "ครีมนวดผม", "housekeeping", "ขวด", 44, 20),
    _item("HK-AMN-003", "สบู่เหลวอาบตัว", "housekeeping", "ขวด", 46, 20),
    _item("HK-AMN-004", "ครีมนวดตัว", "housekeeping", "ขวด", 38, 18),
    _item("HK-AMN-005", "โลชั่นทาผิว", "housekeeping", "ขวด", 38, 18),
    _item("HK-AMN-006", "สบู่ก้อน", "housekeeping", "ก้อน", 80, 30),
    _item("HK-AMN-007", "เจลอาบมือ", "housekeeping", "ขวด", 55, 20),
    _item("HK-AMN-008", "เจลอาบมือ (ฆ่าเชื้อ)", "housekeeping", "ขวด", 40, 15),
    _item("HK-AMN-009", "น้ำยาบ้วนปาก", "housekeeping", "ขวด", 40, 15),
    _item("HK-AMN-010", "ชุดแปรงสีฟัน", "housekeeping", "ชุด", 100, 35),
    _item("HK-AMN-011", "ยาสีฟัน (ซอง)", "housekeeping", "ซอง", 120, 40),
    _item("HK-AMN-012", "ไม้จิ้มฟัน", "housekeeping", "ซอง", 90, 30),
    _item("HK-AMN-013", "ชุดมีดโกน", "housekeeping", "ชุด", 55, 20),
    _item("HK-AMN-014", "โฟมโกนหนวด", "housekeeping", "กระป๋อง", 35, 12),
    _item("HK-AMN-015", "ไม้พันสำลี", "housekeeping", "กล่อง", 60, 22),
    _item("HK-AMN-016", "ชุดเย็บผ้า", "housekeeping", "ชุด", 50, 18),
    _item("HK-AMN-017", "หมวกคลุมอาบน้ำ", "housekeeping", "ใบ", 85, 28),
    _item("HK-AMN-018", "หวี", "housekeeping", "อัน", 65, 22),
    _item("HK-AMN-019", "แปรงผม", "housekeeping", "อัน", 40, 15),
    _item("HK-AMN-020", "ตะกร้าใส่ของอาบน้ำ", "housekeeping", "อัน", 25, 8),
    _item("HK-AMN-021", "เกลืออาบน้ำ", "housekeeping", "ซอง", 45, 15),
    _item("HK-AMN-022", "ใยขัดตัว", "housekeeping", "อัน", 35, 12),
    _item("HK-AMN-023", "ถุงใส่ชุดชั้นใน", "housekeeping", "ใบ", 70, 25),
    _item("HK-AMN-024", "ชุดเครื่องเขียนและของใช้ส่วนตัว", "housekeeping", "ชุด", 55, 18),
    _item("HK-AMN-025", "สเปรย์ปรับอากาศ (ห้อง)", "housekeeping", "กระป๋อง", 40, 15),
    _item("HK-AMN-026", "ทิชชู่เปียก", "housekeeping", "แพ็ก", 65, 22),
    _item("HK-AMN-027", "หน้ากากอนามัย", "housekeeping", "ชิ้น", 100, 35),
    _item("HK-AMN-028", "ผลิตภัณฑ์ลดการกัดกร่อน", "housekeeping", "ซอง", 30, 10),
    _item("HK-AMN-029", "ครีมกันแดด (ซอง)", "housekeeping", "ซอง", 40, 15),
    _item("HK-AMN-030", "น้ำหอมปรับอากาศ (ห้องน้ำ)", "housekeeping", "ขวด", 35, 12),
    # ═══ แม่บ้าน: ของใช้ในห้อง / มินิบาร์ ═══
    _item("HK-HKP-001", "กล่องทิชชู่", "housekeeping", "กล่อง", 80, 28),
    _item("HK-HKP-002", "กระดาษชำระ", "housekeeping", "ม้วน", 120, 40),
    _item("HK-HKP-003", "กระดาษชำระ (แพ็ก)", "housekeeping", "แพ็ก", 60, 20),
    _item("HK-HKP-004", "แก้วน้ำ", "housekeeping", "ใบ", 60, 20),
    _item("HK-HKP-005", "แก้วกาแฟ/ชา", "housekeeping", "ใบ", 55, 18),
    _item("HK-HKP-006", "จานรองแก้ว", "housekeeping", "อัน", 100, 35),
    _item("HK-HKP-007", "น้ำดื่ม (ขวด 500 มล.)", "housekeeping", "ขวด", 96, 36),
    _item("HK-HKP-008", "น้ำดื่ม (ขวด 1 ล.)", "housekeeping", "ขวด", 48, 18),
    _item("HK-HKP-009", "น้ำแร่มีฟอง", "housekeeping", "ขวด", 36, 15),
    _item("HK-HKP-010", "ชุดกาแฟ (ซอง)", "housekeeping", "ชุด", 120, 40),
    _item("HK-HKP-011", "ชุดชา (ซอง)", "housekeeping", "ชุด", 100, 35),
    _item("HK-HKP-012", "ชาผสมสมุนไพร", "housekeeping", "ซอง", 80, 28),
    _item("HK-HKP-013", "ชาดำ/ชาเขียว", "housekeeping", "ซอง", 80, 28),
    _item("HK-HKP-014", "โกโก้ (ซอง)", "housekeeping", "ซอง", 60, 20),
    _item("HK-HKP-015", "น้ำตาล / ครีมเทียม", "housekeeping", "ชุด", 90, 30),
    _item("HK-HKP-016", "ไม้คนน้ำผึ้ง / ช้อน", "housekeeping", "ชุด", 70, 25),
    _item("HK-HKP-017", "ถุงขยะ (ห้อง)", "housekeeping", "ม้วน", 65, 22),
    _item("HK-HKP-018", "ถังขยะ (ห้องน้ำ)", "housekeeping", "อัน", 25, 8),
    _item("HK-HKP-019", "ถังน้ำแข็ง", "housekeeping", "อัน", 20, 8),
    _item("HK-HKP-020", "ที่ตักน้ำแข็ง", "housekeeping", "อัน", 15, 6),
    _item("HK-HKP-021", "ถุงน้ำแข็ง", "housekeeping", "ถุง", 50, 18),
    _item("HK-HKP-022", "สมุดโน้ต + ปากกา", "housekeeping", "ชุด", 90, 30),
    _item("HK-HKP-023", "ไดเรกทอรีโรงแรม", "housekeeping", "เล่ม", 60, 20),
    _item("HK-HKP-024", "ไม้จุดไฟ", "housekeeping", "กล่อง", 30, 10),
    _item("HK-HKP-025", "น้ำผลไม้ (กล่อง)", "housekeeping", "กล่อง", 48, 18),
    _item("HK-HKP-026", "นมกล่องพร้อมดื่ม", "housekeeping", "กล่อง", 36, 12),
    _item("HK-HKP-027", "โยเกิร์ต", "housekeeping", "ถ้วย", 24, 10),
    _item("HK-HKP-028", "ที่เปิดขวด", "housekeeping", "อัน", 30, 10),
    _item("HK-HKP-029", "แก้วมินิบาร์ (สำรอง)", "housekeeping", "ใบ", 40, 15),
    _item("HK-HKP-030", "ถาดมินิบาร์", "housekeeping", "อัน", 20, 8),
    # ═══ แม่บ้าน: มินิบาร์ ═══
    _item("HK-MIN-001", "โค้ก / น้ำอัดลม", "housekeeping", "กระป๋อง", 72, 24),
    _item("HK-MIN-002", "น้ำอัดลม (ไม่มีน้ำตาล)", "housekeeping", "กระป๋อง", 48, 18),
    _item("HK-MIN-003", "น้ำส้ม / น้ำแอปเปิ้ล", "housekeeping", "ขวด", 36, 12),
    _item("HK-MIN-004", "เบียร์ (ในประเทศ)", "housekeeping", "ขวด", 48, 18),
    _item("HK-MIN-005", "เบียร์ (นำเข้า)", "housekeeping", "ขวด", 24, 10),
    _item("HK-MIN-006", "ไวน์แดง (แก้ว)", "housekeeping", "ขวด", 18, 8),
    _item("HK-MIN-007", "ไวน์ขาว (แก้ว)", "housekeeping", "ขวด", 18, 8),
    _item("HK-MIN-008", "สุราและเหล้าสก็อต (มินิบาร์)", "housekeeping", "ขวด", 12, 6),
    _item("HK-MIN-009", "ขนมขบเคี้ยว", "housekeeping", "ซอง", 60, 20),
    _item("HK-MIN-010", "ถั่ว / ลูกเกด", "housekeeping", "ซอง", 40, 15),
    _item("HK-MIN-011", "ช็อกโกแลต", "housekeeping", "แท่ง", 48, 18),
    _item("HK-MIN-012", "บิสกิต", "housekeeping", "ซอง", 36, 12),
    _item("HK-MIN-013", "เครื่องดื่มชูกำลัง", "housekeeping", "กระป๋อง", 24, 10),
    _item("HK-MIN-014", "ข้าวโพดอบ", "housekeeping", "ซอง", 30, 12),
    _item("HK-MIN-015", "มะพร้าวอบ", "housekeeping", "ซอง", 25, 10),
    _item("HK-MIN-016", "ลูกอม / หมากฝรั่ง", "housekeeping", "ซอง", 35, 12),
    _item("HK-MIN-017", "ไอศกรีม (ถ้วย)", "housekeeping", "ถ้วย", 20, 8),
    _item("HK-MIN-018", "น้ำผึ้ง (ซอง)", "housekeeping", "ซอง", 30, 10),
    # ═══ แม่บ้าน: อุปกรณ์ยืม ═══
    _item("HK-EQP-001", "ไดร์เป่าผม", "housekeeping", "เครื่อง", 14, 5),
    _item("HK-EQP-002", "เตารีด", "housekeeping", "เครื่อง", 12, 4),
    _item("HK-EQP-003", "โต๊ะรีดผ้า", "housekeeping", "อัน", 10, 4),
    _item("HK-EQP-004", "เปลเด็ก", "housekeeping", "เตียง", 6, 2),
    _item("HK-EQP-005", "เตียงเสริมพับ", "housekeeping", "เตียง", 8, 3),
    _item("HK-EQP-006", "เครื่องดูดความชื้น", "housekeeping", "เครื่อง", 5, 2),
    _item("HK-EQP-007", "ที่งัดรองเท้า", "housekeeping", "อัน", 30, 10),
    _item("HK-EQP-008", "ที่วางกระเป๋า", "housekeeping", "อัน", 15, 5),
    _item("HK-EQP-009", "ร่ม", "housekeeping", "อัน", 20, 8),
    _item("HK-EQP-010", "ปลั๊กพ่วง / สายต่อ", "housekeeping", "อัน", 25, 10),
    _item("HK-EQP-011", "หัวแปลงปลั๊ก", "housekeeping", "อัน", 20, 8),
    _item("HK-EQP-012", "สายชาร์จ / สายยูเอสบี", "housekeeping", "เส้น", 30, 12),
    _item("HK-EQP-013", "สายเอชดีเอ็มไอ", "housekeeping", "เส้น", 12, 5),
    _item("HK-EQP-014", "ลำโพงบลูทูธ", "housekeeping", "เครื่อง", 6, 3),
    _item("HK-EQP-015", "เครื่องฟอกอากาศ", "housekeeping", "เครื่อง", 4, 2),
    _item("HK-EQP-016", "กล่องอาหารกลางวัน", "housekeeping", "กล่อง", 20, 8),
    _item("HK-EQP-017", "กระติกน้ำร้อน", "housekeeping", "อัน", 15, 6),
    _item("HK-EQP-018", "เครื่องชงกาแฟ (แคปซูล)", "housekeeping", "เครื่อง", 8, 3),
    _item("HK-EQP-019", "เม็ดกาแฟชงในเครื่อง", "housekeeping", "เม็ด", 40, 15),
    _item("HK-EQP-020", "หมวกว่ายน้ำ", "housekeeping", "ใบ", 15, 6),
    _item("HK-EQP-021", "เครื่องชั่งกระเป๋า", "housekeeping", "เครื่อง", 5, 2),
    # ═══ แม่บ้าน: เด็ก / ครอบครัว ═══
    _item("HK-KID-001", "ชุดของใช้ส่วนตัวเด็ก", "housekeeping", "ชุด", 40, 15),
    _item("HK-KID-002", "หมอนเด็ก", "housekeeping", "ใบ", 20, 8),
    _item("HK-KID-003", "ผ้าปูเตียงเด็ก", "housekeeping", "ชุด", 15, 6),
    _item("HK-KID-004", "เก้าอี้ทานข้าวเด็ก", "housekeeping", "อัน", 8, 3),
    _item("HK-KID-005", "เก้าอี้เสริมสำหรับเด็ก", "housekeeping", "อัน", 10, 4),
    _item("HK-KID-006", "หนังสือระบายสี", "housekeeping", "เล่ม", 30, 10),
    _item("HK-KID-007", "ของเล่น (ชุด)", "housekeeping", "ชุด", 15, 6),
    _item("HK-KID-008", "อ่างอาบน้ำเด็ก", "housekeeping", "อัน", 6, 2),
    _item("HK-KID-009", "แชมพู/โลชั่นเด็ก", "housekeeping", "ขวด", 25, 10),
    _item("HK-KID-010", "ที่นั่งชักโครกเด็ก", "housekeeping", "อัน", 5, 2),
    _item("HK-KID-011", "ผ้าอ้อมเด็ก (แพ็ก)", "housekeeping", "แพ็ก", 20, 8),
    _item("HK-KID-012", "เสื่อรองคลานเด็ก", "housekeeping", "ผืน", 8, 3),
    _item("HK-KID-013", "เครื่องทำนมอุ่น", "housekeeping", "เครื่อง", 4, 2),
    # ═══ แม่บ้าน: ผู้พิการ / ผู้สูงอายุ ═══
    _item("HK-ACC-001", "รถเข็น", "housekeeping", "คัน", 4, 2),
    _item("HK-ACC-002", "เก้าอี้อาบน้ำ", "housekeeping", "อัน", 6, 2),
    _item("HK-ACC-003", "ราวจับกันลื่น", "housekeeping", "ชุด", 8, 3),
    _item("HK-ACC-004", "ที่เพิ่มความสูงชักโครก", "housekeeping", "อัน", 5, 2),
    _item("HK-ACC-005", "ชุดผู้พิการทางการได้ยิน", "housekeeping", "ชุด", 4, 2),
    _item("HK-ACC-006", "ราวกั้นเตียง", "housekeeping", "อัน", 6, 2),
    _item("HK-ACC-007", "ไม้เท้า", "housekeeping", "อัน", 4, 2),
    _item("HK-ACC-008", "เครื่องช่วยฟัง", "housekeeping", "เครื่อง", 3, 1),
    # ═══ แม่บ้าน: ส่วนกลาง / พื้นที่สาธารณะ ═══
    _item("HK-PUB-001", "ป้ายพื้นเปียก", "housekeeping", "ป้าย", 30, 10),
    _item("HK-PUB-002", "แปรงขัดโถสุขภัณฑ์", "housekeeping", "อัน", 22, 8),
    _item("HK-PUB-003", "น้ำยาทำความสะอาด (พื้นที่ส่วนกลาง)", "housekeeping", "ขวด", 40, 15),
    _item("HK-PUB-004", "ผ้าไมโครไฟเบอร์ (พื้นที่ส่วนกลาง)", "housekeeping", "ผืน", 60, 20),
    _item("HK-PUB-005", "ถุงมือยาง", "housekeeping", "คู่", 80, 30),
    _item("HK-PUB-006", "ถุงขยะ (ส่วนกลาง)", "housekeeping", "ม้วน", 45, 15),
    _item("HK-PUB-007", "กระดาษเช็ดมือ (แพ็ก)", "housekeeping", "แพ็ก", 55, 18),
    _item("HK-PUB-008", "น้ำยาขจัดคราบกระจก", "housekeeping", "ขวด", 30, 10),
    _item("HK-PUB-009", "ไม้กวาด + ที่โกย", "housekeeping", "ชุด", 12, 4),
    _item("HK-PUB-010", "ถังและไม้ถูพื้น", "housekeeping", "ชุด", 10, 4),
    _item("HK-PUB-011", "น้ำยาฆ่าเชื้อพื้นผิว", "housekeeping", "ขวด", 35, 12),
    _item("HK-PUB-012", "น้ำยาขจัดคราบสนิม", "housekeeping", "ขวด", 20, 8),
    _item("HK-PUB-013", "น้ำยาล้างจาน (แกลลอน)", "housekeeping", "แกลลอน", 15, 6),
    _item("HK-PUB-014", "ฟองน้ำ / ใยขัดจาน", "housekeeping", "ชิ้น", 40, 15),
    _item("HK-PUB-015", "ถุงขยะสี (แยกประเภท)", "housekeeping", "ม้วน", 30, 10),
    _item("HK-PUB-016", "ถังขยะพร้อมฝา (ส่วนกลาง)", "housekeeping", "อัน", 12, 4),
    _item("HK-PUB-017", "น้ำยาขจัดคราบหินปูน", "housekeeping", "ขวด", 25, 10),
    _item("HK-PUB-018", "น้ำยาทำความสะอาดพรม", "housekeeping", "ขวด", 18, 8),
    # ═══ แม่บ้าน: สระว่ายน้ำ / สปา ═══
    _item("HK-PLS-001", "ผ้าเช็ดตัวสระ (ใหญ่)", "housekeeping", "ผืน", 50, 18),
    _item("HK-PLS-002", "ผ้าเช็ดตัวสระ (กลาง)", "housekeeping", "ผืน", 35, 12),
    _item("HK-PLS-003", "เสื้อคลุมสระว่ายน้ำ", "housekeeping", "ตัว", 40, 15),
    _item("HK-PLS-004", "รองเท้าแตะสระ (สีฟ้า)", "housekeeping", "คู่", 30, 12),
    _item("HK-PLS-005", "หมวกว่ายน้ำ", "housekeeping", "ใบ", 25, 10),
    _item("HK-PLS-006", "แว่นตากันแดด", "housekeeping", "อัน", 15, 6),
    _item("HK-PLS-007", "ครีมกันแดด (สระ)", "housekeeping", "ขวด", 20, 8),
    _item("HK-PLS-008", "ห่วงยาง (เด็ก)", "housekeeping", "อัน", 12, 5),
    _item("HK-PLS-009", "ห่วงยาง (ผู้ใหญ่)", "housekeeping", "อัน", 15, 6),
    _item("HK-PLS-010", "เสื้อชูชีพ", "housekeeping", "อัน", 8, 3),
    _item("HK-PLS-011", "ผ้าปูเก้าอี้สระ", "housekeeping", "ผืน", 30, 10),
    _item("HK-PLS-012", "หมอนรองเก้าอี้สระ", "housekeeping", "ใบ", 25, 10),
    _item("HK-PLS-013", "ร่มกันแดด", "housekeeping", "อัน", 20, 8),
    _item("HK-PLS-014", "ถุงใส่ชุดว่ายน้ำเปียก", "housekeeping", "ใบ", 40, 15),
    _item("HK-PLS-015", "น้ำยาฆ่าเชื้อสระ (สำรอง)", "housekeeping", "ขวด", 10, 4),
    _item("HK-SPA-001", "ชุดคลุมสปา", "housekeeping", "ชุด", 30, 12),
    _item("HK-SPA-002", "รองเท้าแตะสปา", "housekeeping", "คู่", 35, 12),
    _item("HK-SPA-003", "ผ้าเช็ดตัวสปา", "housekeeping", "ผืน", 45, 15),
    _item("HK-SPA-004", "ชุดชั้นในสปา (ใช้ครั้งเดียว)", "housekeeping", "ชุด", 60, 20),
    _item("HK-SPA-005", "หมวกอาบน้ำสปา", "housekeeping", "ใบ", 40, 15),
    _item("HK-SPA-006", "รองเท้าแตะสปา (ใช้ครั้งเดียว)", "housekeeping", "คู่", 50, 18),
    _item("HK-SPA-007", "น้ำมันนวด (ขวดเล็ก)", "housekeeping", "ขวด", 25, 10),
    _item("HK-SPA-008", "เกลืออาบน้ำ (สปา)", "housekeeping", "ซอง", 30, 12),
    _item("HK-SPA-009", "หินร้อนนวดเท้า (ชุด)", "housekeeping", "ชุด", 8, 3),
    _item("HK-SPA-010", "ผ้าปูเตียงนวด", "housekeeping", "ผืน", 20, 8),
    # ═══ แม่บ้าน: มินิบาร์เพิ่มเติม ═══
    _item("HK-MIN-019", "น้ำแร่ (ขวดเล็ก)", "housekeeping", "ขวด", 48, 18),
    _item("HK-MIN-020", "น้ำอัดลม (กระป๋องเล็ก)", "housekeeping", "กระป๋อง", 60, 20),
    _item("HK-MIN-021", "น้ำสับปะรด", "housekeeping", "กระป๋อง", 36, 12),
    _item("HK-MIN-022", "น้ำมะนาว", "housekeeping", "กระป๋อง", 36, 12),
    _item("HK-MIN-023", "น้ำมะพร้าว", "housekeeping", "กระป๋อง", 30, 10),
    _item("HK-MIN-024", "ไวน์โรส (แก้ว)", "housekeeping", "ขวด", 12, 6),
    _item("HK-MIN-025", "เหล้าจิน (มินิ)", "housekeeping", "ขวด", 10, 4),
    _item("HK-MIN-026", "เหล้าโวดก้า (มินิ)", "housekeeping", "ขวด", 10, 4),
    _item("HK-MIN-027", "เหล้ารัม (มินิ)", "housekeeping", "ขวด", 10, 4),
    _item("HK-MIN-028", "น้ำผลไม้รวม", "housekeeping", "กล่อง", 24, 10),
    _item("HK-MIN-029", "ชาเย็น (กระป๋อง)", "housekeeping", "กระป๋อง", 24, 10),
    _item("HK-MIN-030", "กาแฟพร้อมดื่ม (กระป๋อง)", "housekeeping", "กระป๋อง", 24, 10),
    # ═══ แม่บ้าน: ของใช้เพิ่มเติมในห้อง ═══
    _item("HK-GST-001", "ผ้าเช็ดแว่นตา", "housekeeping", "ผืน", 80, 28),
    _item("HK-GST-002", "ชุดเครื่องเขียน (สำรอง)", "housekeeping", "ชุด", 70, 25),
    _item("HK-GST-003", "แผ่นรองเมาส์ (โต๊ะทำงาน)", "housekeeping", "แผ่น", 30, 10),
    _item("HK-GST-004", "ปลั๊กพ่วง (ห้อง)", "housekeeping", "อัน", 20, 8),
    _item("HK-GST-005", "โคมไฟอ่านหนังสือ", "housekeeping", "อัน", 10, 4),
    _item("HK-GST-006", "กระจกแต่งหน้า", "housekeeping", "อัน", 8, 3),
    _item("HK-GST-007", "ถังแช่น้ำแข็ง", "housekeeping", "อัน", 6, 2),
    _item("HK-GST-008", "เครื่องทำน้ำอุ่น", "housekeeping", "เครื่อง", 5, 2),
    _item("HK-GST-009", "หมอนรองนั่ง", "housekeeping", "ใบ", 12, 5),
    _item("HK-GST-010", "ผ้าคลุมโต๊ะอาหาร", "housekeeping", "ผืน", 25, 10),
    _item("HK-GST-011", "ชุดช้อนส้อมพลาสติก", "housekeeping", "ชุด", 40, 15),
    _item("HK-GST-012", "จานและชาม (ชุด)", "housekeeping", "ชุด", 30, 12),
    # ═══ แม่บ้าน: ความปลอดภัย ═══
    _item("HK-SEC-001", "ถังดับเพลิง (ขนาดเล็ก)", "housekeeping", "อัน", 8, 3),
    _item("HK-SEC-002", "ผ้าห่มกันไฟ", "housekeeping", "ผืน", 6, 2),
    _item("HK-SEC-003", "ชุดปฐมพยาบาล (ห้อง)", "housekeeping", "ชุด", 10, 4),
    _item("HK-SEC-004", "ปลายทางหนีไฟ (ป้าย)", "housekeeping", "ป้าย", 15, 6),
    _item("HK-SEC-005", "ไฟฉุกเฉิน (แบตเตอรี่สำรอง)", "housekeeping", "อัน", 12, 5),
    _item("HK-SEC-006", "ถุงมือกันบาด", "housekeeping", "คู่", 20, 8),
    _item("HK-SEC-007", "แว่นตานิรภัย", "housekeeping", "อัน", 10, 4),
    _item("HK-SEC-008", "สติกเกอร์ห้ามสูบบุหรี่", "housekeeping", "แผ่น", 30, 10),
    # ═══ แม่บ้าน: ซักรีด / ผ้า ═══
    _item("HK-LIN-001", "น้ำยาซักผ้า (แกลลอน)", "housekeeping", "แกลลอน", 12, 5),
    _item("HK-LIN-002", "น้ำยาปรับผ้านุ่ม (แกลลอน)", "housekeeping", "แกลลอน", 10, 4),
    _item("HK-LIN-003", "น้ำยาฟอกขาว (แกลลอน)", "housekeeping", "แกลลอน", 8, 3),
    _item("HK-LIN-004", "ถุงใส่ผ้าสกปรก (ซักรีด)", "housekeeping", "ใบ", 100, 35),
    _item("HK-LIN-005", "ป้ายติดเสื้อผ้า (ชื่อแขก)", "housekeeping", "ม้วน", 20, 8),
    _item("HK-LIN-006", "ไม้แขวนผ้าเสื้อ (พลาสติก)", "housekeeping", "อัน", 80, 28),
    _item("HK-LIN-007", "ไม้แขวนผ้ากางเกง (พลาสติก)", "housekeeping", "อัน", 60, 20),
    _item("HK-LIN-008", "ถุงพลาสติกใส่ผ้า (ม้วน)", "housekeeping", "ม้วน", 25, 10),
    _item("HK-LIN-009", "ผ้าเช็ดแอร์ (ซักรีด)", "housekeeping", "ผืน", 40, 15),
    _item("HK-LIN-010", "น้ำยาขจัดคราบผ้า", "housekeeping", "ขวด", 18, 8),
    # ═══ แม่บ้าน: ของใช้ส่วนตัวเพิ่ม ═══
    _item("HK-AMN-031", "ครีมโกนหนวด (ซอง)", "housekeeping", "ซอง", 45, 15),
    _item("HK-AMN-032", "แป้งเด็ก (ซอง)", "housekeeping", "ซอง", 30, 10),
    _item("HK-AMN-033", "ผ้าอ้อมผู้ใหญ่ (แพ็ก)", "housekeeping", "แพ็ก", 15, 6),
    _item("HK-AMN-034", "แผ่นอนามัย (แพ็ก)", "housekeeping", "แพ็ก", 25, 10),
    _item("HK-AMN-035", "ถุงยางอนามัย", "housekeeping", "ชิ้น", 20, 8),
    _item("HK-AMN-036", "ผลิตภัณฑ์ดูแลจุดซ่อนเร้น (ซอง)", "housekeeping", "ซอง", 30, 10),
    _item("HK-AMN-037", "น้ำเกลือฉีดจมูก (ซอง)", "housekeeping", "ซอง", 25, 10),
    # ═══ แม่บ้าน: บริการ ═══
    _service("HK-SVC-001", "บริการทำความสะอาดห้อง (แขกพักต่อ)", "housekeeping"),
    _service("HK-SVC-002", "บริการเตรียมที่นอนตอนเย็น", "housekeeping"),
    _service("HK-SVC-003", "ทำความสะอาดห้อง (เบื้องต้น)", "housekeeping"),
    _service("HK-SVC-004", "ทำความสะอาดลึก", "housekeeping"),
    _service("HK-SVC-005", "ทำความสะอาดพรม", "housekeeping"),
    _service("HK-SVC-006", "เติม / ตรวจมินิบาร์", "housekeeping"),
    _service("HK-SVC-010", "บริการซักรีดด่วน", "housekeeping"),
    # ═══ Front Office: บริการ (โทรปลุก / ABF / รับกระเป๋าที่เคาน์เตอร์) ═══
    _service("FO-SVC-001", "บริการโทรปลุก", "front_office"),
    _service("FO-SVC-002", "สั่ง ABF Box", "front_office"),
    _service("FO-SVC-003", "รับกระเป๋า (ลงทะเบียนที่ฟร้อน)", "front_office"),
    # ═══ Front Office: ขนสัมภาระ (แทน BB-SVC-001–003) ═══
    _service("FO-SVC-004", "รับกระเป๋า", "front_office"),
    _service("FO-SVC-005", "ส่งกระเป๋าขึ้นห้อง", "front_office"),
    _service("FO-SVC-006", "ย้ายกระเป๋าระหว่างห้อง", "front_office"),
    _service("HK-SVC-011", "รับผ้าซักรีด", "housekeeping"),
    _service("HK-SVC-012", "บริการขัดรองเท้า", "housekeeping"),
    _service("HK-SVC-013", "จัดดอกไม้ / ของขวัญในห้อง", "housekeeping"),
    _service("HK-SVC-014", "จัดเซอร์ไพรส์วันเกิด", "housekeeping"),
    _service("HK-SVC-015", "จัดห้องฮันนีมูน", "housekeeping"),
    _service("HK-SVC-016", "เตรียมห้องปลอดภูมิแพ้", "housekeeping"),
    _service("HK-SVC-017", "เปลี่ยนหมอนตามเมนูหมอน", "housekeeping"),
    _service("HK-SVC-018", "เปลี่ยนผ้าปู / ผ้าห่ม", "housekeeping"),
    _service("HK-SVC-019", "เปลี่ยนผ้าเช็ดตัว", "housekeeping"),
    _service("HK-SVC-020", "เติมของใช้ในห้องครบชุด", "housekeeping"),
    _service("HK-SVC-021", "ทำความสะอาดระเบียง", "housekeeping"),
    _service("HK-SVC-022", "เก็บขยะ / แยกขยะรีไซเคิล", "housekeeping"),
    _service("HK-SVC-023", "ตรวจห้องหลังแขกออก", "housekeeping"),
    _service("HK-SVC-024", "เตรียมห้องวีไอพี / ก่อนแขกเข้าพัก", "housekeeping"),
    _service("HK-SVC-025", "จัดห้องรองรับสัตว์เลี้ยง", "housekeeping"),
    _service("HK-SVC-026", "ค้นหาของหาย", "housekeeping"),
    _service("HK-SVC-027", "ส่งเอกสาร / แฟกซ์ให้แขก", "housekeeping"),
    _service("HK-SVC-028", "เปลี่ยนน้ำดื่ม / ชุดกาแฟ", "housekeeping"),
    _service("HK-SVC-029", "จัดโต๊ะทำงานในห้อง", "housekeeping"),
    _service("HK-SVC-030", "จัดเตียงแยกสำหรับแขกเพิ่ม", "housekeeping"),
    _service("HK-SVC-031", "ทำความสะอาดห้องครัวส่วนตัว", "housekeeping"),
    _service("HK-SVC-032", "ทำความสะอาดตู้เย็นในห้อง", "housekeeping"),
    _service("HK-SVC-033", "เปลี่ยนผ้าม่าน / ม่าน", "housekeeping"),
    _service("HK-SVC-034", "กำจัดกลิ่นในห้อง", "housekeeping"),
    _service("HK-SVC-035", "บริการจัดเก็บสัมภาระในห้อง", "housekeeping"),
    _service("HK-SVC-036", "บริการซักแห้ง (ส่งร้าน)", "housekeeping"),
    _service("HK-SVC-037", "บริการรีดผ้า", "housekeeping"),
    _service("HK-SVC-038", "บริการซักรองเท้าแตะ", "housekeeping"),
    _service("HK-SVC-099", "งานอื่นๆ (แม่บ้าน) — ระบุในหมายเหตุ", "housekeeping"),
    # ═══ ช่างซ่อม: อะไหล่ ═══
    _item("MT-BLB-001", "หลอดไฟ (ไส้)", "maintenance", "หลอด", 40, 12),
    _item("MT-BLB-002", "หลอดไฟ (แอลอีดี)", "maintenance", "หลอด", 48, 15),
    _item("MT-BLB-003", "หลอดดาวน์ไลท์", "maintenance", "หลอด", 30, 10),
    _item("MT-BLB-004", "หลอดให้ความร้อน (ห้องน้ำ)", "maintenance", "หลอด", 12, 5),
    _item("MT-BLB-005", "หลอดไฟตู้เซฟ", "maintenance", "หลอด", 10, 4),
    _item("MT-PLM-001", "ตัวกรองน้ำก๊อก", "maintenance", "อัน", 25, 10),
    _item("MT-PLM-002", "ฝักบัว", "maintenance", "อัน", 18, 6),
    _item("MT-PLM-003", "สายฝักบัว", "maintenance", "เส้น", 15, 6),
    _item("MT-PLM-004", "ลูกลอยชักโครก", "maintenance", "ชุด", 12, 5),
    _item("MT-PLM-005", "ยางปิดน้ำอ่างล้างหน้า", "maintenance", "อัน", 10, 4),
    _item("MT-PLM-006", "สายน้ำดี / น้ำทิ้ง", "maintenance", "เส้น", 15, 6),
    _item("MT-PLM-007", "ยาแนวกันรั่ว", "maintenance", "หลอด", 20, 8),
    _item("MT-PLM-008", "สายชำระห้องน้ำ", "maintenance", "เส้น", 12, 5),
    _item("MT-PLM-009", "หัวชักโครก", "maintenance", "อัน", 10, 4),
    _item("MT-PLM-010", "ก๊อกน้ำ (สำรอง)", "maintenance", "อัน", 8, 3),
    _item("MT-ELC-001", "รีโมททีวี", "maintenance", "อัน", 10, 4),
    _item("MT-ELC-002", "ถ่านขนาดเอเอ (แพ็ก)", "maintenance", "แพ็ก", 30, 12),
    _item("MT-ELC-003", "ถ่านขนาดเอเอเอ (แพ็ก)", "maintenance", "แพ็ก", 24, 10),
    _item("MT-ELC-004", "ถ่านตู้เซฟ (9 โวลต์)", "maintenance", "ก้อน", 15, 6),
    _item("MT-ELC-005", "ถ่านเครื่องควบคุมอุณหภูมิ", "maintenance", "ก้อน", 12, 5),
    _item("MT-ELC-006", "ถ่านเครื่องตรวจจับควัน", "maintenance", "ก้อน", 20, 8),
    _item("MT-ELC-007", "สายเอชดีเอ็มไอ", "maintenance", "เส้น", 15, 6),
    _item("MT-ELC-008", "สายแลน", "maintenance", "เส้น", 20, 8),
    _item("MT-ELC-009", "ปลั๊กไฟ / สวิตช์", "maintenance", "อัน", 18, 6),
    _item("MT-ELC-010", "หลอดไฟฉุกเฉิน", "maintenance", "หลอด", 12, 5),
    _item("MT-ELC-011", "ฟิวส์ / เบรกเกอร์ (สำรอง)", "maintenance", "ชุด", 10, 4),
    _item("MT-ELC-012", "หลอดไฟตู้เย็น", "maintenance", "หลอด", 8, 3),
    _item("MT-HKP-001", "ที่กั้นประตู", "maintenance", "อัน", 18, 6),
    _item("MT-HKP-002", "ตะขอแขวนเสื้อ", "maintenance", "อัน", 25, 10),
    _item("MT-HKP-003", "บานพับประตู", "maintenance", "ชุด", 12, 5),
    _item("MT-HKP-004", "เครื่องปิดประตูอัตโนมัติ", "maintenance", "อัน", 6, 3),
    _item("MT-HKP-005", "ลูกบิด / มือจับประตู", "maintenance", "ชุด", 10, 4),
    _item("MT-HKP-006", "กุญแจสำรอง / การ์ดทดสอบ", "maintenance", "อัน", 8, 3),
    _item("MT-HKP-007", "สติกเกอร์ซีลประตู", "maintenance", "ม้วน", 15, 6),
    _item("MT-HKP-008", "ม่าน / สายมู่ลี่", "maintenance", "ชุด", 8, 3),
    _item("MT-HKP-009", "กระจกห้องน้ำ (สำรอง)", "maintenance", "ผืน", 4, 2),
    _item("MT-HKP-010", "สีทาผนัง (ทาจุดเล็ก)", "maintenance", "กระป๋อง", 12, 5),
    _item("MT-HKP-011", "ยาแนวกันรั่วประตูและหน้าต่าง", "maintenance", "หลอด", 15, 6),
    _item("MT-HKP-012", "แผ่นรองพื้นห้องน้ำ", "maintenance", "ผืน", 10, 4),
    _item("MT-HVAC-001", "รีโมทแอร์", "maintenance", "อัน", 12, 5),
    _item("MT-HVAC-002", "ฟิลเตอร์แอร์ (ห้อง)", "maintenance", "ผืน", 20, 8),
    _item("MT-HVAC-003", "เก็บประจุแอร์ (สำรอง)", "maintenance", "อัน", 6, 3),
    _item("MT-HVAC-004", "แผ่นกรองอากาศ (ห้อง)", "maintenance", "ผืน", 15, 6),
    _item("MT-FUR-001", "สกรู / น็อตเฟอร์นิเจอร์", "maintenance", "ชุด", 30, 10),
    _item("MT-FUR-002", "ล้อเก้าอี้ / โต๊ะ", "maintenance", "ชุด", 15, 6),
    _item("MT-FUR-003", "กาวไม้ / กาวเฟอร์นิเจอร์", "maintenance", "หลอด", 10, 4),
    _item("MT-FUR-004", "ขาโต๊ะ (สำรอง)", "maintenance", "อัน", 8, 3),
    _item("MT-FUR-005", "ที่รองขาเก้าอี้", "maintenance", "ชุด", 20, 8),
    # ═══ ช่างซ่อม: สระ / สปา / ครัว ═══
    _item("MT-PLS-001", "ปั๊มน้ำสระ (อะไหล่)", "maintenance", "ชุด", 4, 2),
    _item("MT-PLS-002", "ไส้กรองสระ", "maintenance", "อัน", 8, 3),
    _item("MT-PLS-003", "สารฆ่าเชื้อสระ (แกลลอน)", "maintenance", "แกลลอน", 6, 2),
    _item("MT-PLS-004", "สายดูดก้นสระ", "maintenance", "เส้น", 5, 2),
    _item("MT-PLS-005", "หลอดไฟใต้น้ำ", "maintenance", "หลอด", 10, 4),
    _item("MT-PLS-006", "ยางปิดท่อสระ", "maintenance", "อัน", 8, 3),
    _item("MT-KIT-001", "สายแก๊ส (ครัว)", "maintenance", "เส้น", 6, 2),
    _item("MT-KIT-002", "หัวเตาแก๊ส (สำรอง)", "maintenance", "อัน", 4, 2),
    _item("MT-KIT-003", "ยางปิดท่อน้ำทิ้ง", "maintenance", "อัน", 10, 4),
    _item("MT-KIT-004", "สายน้ำเครื่องซักผ้า", "maintenance", "เส้น", 6, 2),
    _item("MT-KIT-005", "สายน้ำเครื่องอบผ้า", "maintenance", "เส้น", 6, 2),
    _item("MT-KIT-006", "สายพานเครื่องซักผ้า", "maintenance", "เส้น", 4, 2),
    _item("MT-KIT-007", "ฟิลเตอร์เครื่องดูดควัน", "maintenance", "ผืน", 8, 3),
    _item("MT-KIT-008", "หลอดไฟเตาแก๊ส", "maintenance", "หลอด", 12, 5),
    _item("MT-SFT-001", "ถังดับเพลิง", "maintenance", "ถัง", 4, 2),
    _item("MT-SFT-002", "สายดับเพลิง (ม้วน)", "maintenance", "ม้วน", 3, 1),
    _item("MT-SFT-003", "หน้ากากกันฝุ่น", "maintenance", "ชิ้น", 50, 18),
    _item("MT-SFT-004", "ถุงมือกันไฟ", "maintenance", "คู่", 6, 2),
    _item("MT-SFT-005", "เชือกนิรภัย", "maintenance", "เส้น", 4, 2),
    _item("MT-SFT-006", "ป้ายทางหนีไฟ (สำรอง)", "maintenance", "ป้าย", 8, 3),
    _item("MT-ELC-013", "หลอดไฟทางเดิน", "maintenance", "หลอด", 24, 10),
    _item("MT-ELC-014", "หลอดไฟล็อบบี้", "maintenance", "หลอด", 20, 8),
    _item("MT-ELC-015", "หลอดไฟลิฟต์", "maintenance", "หลอด", 16, 6),
    _item("MT-HKP-013", "กระจกประตู (สำรอง)", "maintenance", "บาน", 3, 1),
    _item("MT-HKP-014", "ยางปิดประตู (ม้วน)", "maintenance", "ม้วน", 12, 5),
    _item("MT-HKP-015", "ลูกลอยแอร์", "maintenance", "อัน", 8, 3),
    _item("MT-HVAC-005", "น้ำยาล้างคอยล์เย็น", "maintenance", "ขวด", 10, 4),
    _item("MT-HVAC-006", "ท่อระบายน้ำแอร์", "maintenance", "เส้น", 8, 3),
    # ═══ ช่างซ่อม: บริการ ═══
    _service("MT-SVC-001", "ซ่อมแอร์ / แอร์ไม่เย็น", "maintenance"),
    _service("MT-SVC-002", "แอร์มีน้ำหยด / รั่ว", "maintenance"),
    _service("MT-SVC-003", "แอร์มีเสียงดัง", "maintenance"),
    _service("MT-SVC-004", "ปรับประตู / ประตูดัง", "maintenance"),
    _service("MT-SVC-005", "ประตูปิดไม่สนิท", "maintenance"),
    _service("MT-SVC-006", "ทาสีผนัง (จุดเล็ก)", "maintenance"),
    _service("MT-SVC-007", "ทีวีเปิดไม่ติด / ไม่มีสัญญาณ", "maintenance"),
    _service("MT-SVC-008", "รีโมททีวีใช้ไม่ได้", "maintenance"),
    _service("MT-SVC-009", "อินเทอร์เน็ต / ไวไฟใช้งานไม่ได้", "maintenance"),
    _service("MT-SVC-010", "ลำโพงบลูทูธในห้องเสีย", "maintenance"),
    _service("MT-SVC-011", "น้ำรั่ว / ท่อรั่ว", "maintenance"),
    _service("MT-SVC-012", "โถสุขภัณฑ์ตัน", "maintenance"),
    _service("MT-SVC-013", "ชักโครกน้ำไม่หยุด", "maintenance"),
    _service("MT-SVC-014", "อ่างล้างหน้ารั่ว / อุดตัน", "maintenance"),
    _service("MT-SVC-015", "ฝักบัวน้ำไม่ไหล / ไม่ร้อน", "maintenance"),
    _service("MT-SVC-016", "น้ำร้อนไม่ไหล", "maintenance"),
    _service("MT-SVC-017", "น้ำเย็นไม่ไหล", "maintenance"),
    _service("MT-SVC-018", "เต้ารับไฟใช้งานไม่ได้", "maintenance"),
    _service("MT-SVC-019", "ไฟห้องดับ / กระพริบ", "maintenance"),
    _service("MT-SVC-020", "สวิตช์ไฟเสีย", "maintenance"),
    _service("MT-SVC-021", "ตู้เซฟเปิดไม่ได้", "maintenance"),
    _service("MT-SVC-022", "ตู้เซฟรีเซ็ตรหัส", "maintenance"),
    _service("MT-SVC-023", "หน้าต่างเปิดไม่ได้ / ระเบียง", "maintenance"),
    _service("MT-SVC-024", "ม่าน / มู่ลี่ติด / หลุด", "maintenance"),
    _service("MT-SVC-025", "ซ่อมเฟอร์นิเจอร์", "maintenance"),
    _service("MT-SVC-026", "เก้าอี้ / โต๊ะโยก", "maintenance"),
    _service("MT-SVC-027", "กุญแจการ์ด / ล็อกประตู", "maintenance"),
    _service("MT-SVC-028", "ประตูห้องเปิดไม่ได้", "maintenance"),
    _service("MT-SVC-029", "ตู้เย็น / มินิบาร์ไม่เย็น", "maintenance"),
    _service("MT-SVC-030", "เปลี่ยนชุดมินิบาร์", "maintenance"),
    _service("MT-SVC-031", "โทรศัพท์ห้องพักเสีย", "maintenance"),
    _service("MT-SVC-032", "อินเตอร์คอม / กริ่งห้องเสีย", "maintenance"),
    _service("MT-SVC-033", "กระจกเงา / กระจกแตก", "maintenance"),
    _service("MT-SVC-034", "กระจกห้องน้ำเป็นฝ้า", "maintenance"),
    _service("MT-SVC-035", "กลิ่นในห้อง / ท่อระบาย", "maintenance"),
    _service("MT-SVC-036", "เครื่องตรวจจับควันส่งสัญญาณ", "maintenance"),
    _service("MT-SVC-037", "ระบบพ่นน้ำดับเพลิง", "maintenance"),
    _service("MT-SVC-038", "ลิฟต์ / บันไดเลื่อน (แจ้ง)", "maintenance"),
    _service("MT-SVC-039", "สระว่ายน้ำ / อุปกรณ์สระ", "maintenance"),
    _service("MT-SVC-040", "ฟิตเนส / อุปกรณ์ออกกำลัง", "maintenance"),
    _service("MT-SVC-041", "กำจัดแมลง / ปลวก", "maintenance"),
    _service("MT-SVC-042", "รีเซ็ตเครื่องทำน้ำร้อน", "maintenance"),
    _service("MT-SVC-043", "เครื่องควบคุมอุณหภูมิปรับไม่ได้", "maintenance"),
    _service("MT-SVC-044", "ระบบพื้นร้อนไม่ทำงาน", "maintenance"),
    _service("MT-SVC-045", "ช่องชาร์จยูเอสบีใช้ไม่ได้", "maintenance"),
    _service("MT-SVC-046", "อ่างอาบน้ำรั่ว / อุดตัน", "maintenance"),
    _service("MT-SVC-047", "เครื่องชงกาแฟในห้องเสีย", "maintenance"),
    _service("MT-SVC-048", "เครื่องฟอกอากาศในห้องเสีย", "maintenance"),
    _service("MT-SVC-049", "ไดร์เป่าผมในห้องเสีย", "maintenance"),
    _service("MT-SVC-050", "เตารีดในห้องเสีย", "maintenance"),
    _service("MT-SVC-051", "กระจกบานเลื่อนติด", "maintenance"),
    _service("MT-SVC-052", "ประตูระเบียงล็อคไม่ได้", "maintenance"),
    _service("MT-SVC-053", "ห้องมีเสียงดังจากเครื่องจักร", "maintenance"),
    _service("MT-SVC-054", "ตู้เซฟมีเสียงแปลก", "maintenance"),
    _service("MT-SVC-055", "กลิ่าแก๊ส / กลิ่นไหม้ในห้อง", "maintenance"),
    _service("MT-SVC-099", "งานอื่นๆ (ช่างซ่อม) — ระบุในหมายเหตุ", "maintenance"),
]

# Backward-compatible alias used by seed.py sample requests
PRODUCTS = PRODUCT_ROWS

CATALOG_THAI_BY_SKU: dict[str, str] = {
    sku: strip_legacy_product_suffix(name) or name
    for sku, name, *_rest in PRODUCT_ROWS
}


def catalog_thai_name(sku: str) -> str | None:
    """Canonical Thai label from the default catalog (by SKU)."""
    return CATALOG_THAI_BY_SKU.get(sku)


# Permanently removed from catalog and database (no guest medicine service).
PURGED_CATALOG_SKUS: frozenset[str] = frozenset({
    "HK-AMN-038",
    "HK-AMN-039",
    "HK-AMN-040",
    "HK-SVC-007",
    "HK-SVC-008",
    "HK-SVC-009",
    "BB-SVC-001",
    "BB-SVC-002",
    "BB-SVC-003",
})

# Backward-compatible alias
RETIRED_CATALOG_SKUS = PURGED_CATALOG_SKUS


def purge_retired_catalog_products() -> None:
    """Hard-delete catalog rows that must never be offered (e.g. medicine)."""
    from ..models import Product, Request, RequestItem, StockAdjustment
    from ..services import items_text_for

    with Session(engine) as s:
        products = list(
            s.exec(select(Product).where(Product.sku.in_(PURGED_CATALOG_SKUS))).all(),
        )
        if not products:
            return

        product_ids = [p.id for p in products if p.id is not None]
        if not product_ids:
            return

        stale_items = list(
            s.exec(select(RequestItem).where(RequestItem.product_id.in_(product_ids))).all(),
        )
        affected_request_ids = {ri.request_id for ri in stale_items}

        for item in stale_items:
            s.delete(item)

        for adj in s.exec(
            select(StockAdjustment).where(StockAdjustment.product_id.in_(product_ids)),
        ).all():
            s.delete(adj)

        for req_id in affected_request_ids:
            req = s.get(Request, req_id)
            if not req:
                continue
            remaining = list(
                s.exec(select(RequestItem).where(RequestItem.request_id == req_id)).all(),
            )
            if remaining:
                req.items_text = items_text_for(
                    s,
                    [ri.product_id for ri in remaining],
                    {ri.product_id: ri.qty for ri in remaining},
                    {ri.product_id: (ri.note or "") for ri in remaining},
                )
            else:
                req.items_text = ""
            s.add(req)

        for product in products:
            s.delete(product)

        s.commit()


def sync_product_catalog() -> None:
    """Upsert catalog rows by SKU — adds new items without resetting existing stock."""
    from .product_units_i18n import resolved_product_units

    catalog_skus = {row[0] for row in PRODUCT_ROWS}
    legacy_names = {
        "HK-SHP-001": "แชมพู",
    }
    with Session(engine) as s:
        for sku, name, dept, unit, on_hand, reorder, is_svc in PRODUCT_ROWS:
            name = strip_legacy_product_suffix(name) or name
            name_en = english_product_name(sku, name)
            unit_th, unit_en = resolved_product_units(unit)
            row = s.exec(select(Product).where(Product.sku == sku)).first()
            if row:
                row.name = name
                row.name_en = name_en
                row.department = dept
                row.unit = unit_th
                row.unit_en = unit_en
                row.is_service = is_svc
                row.icon_emoji = infer_icon_emoji(sku, name, is_service=is_svc)
                if row.reorder_at is None and reorder is not None:
                    row.reorder_at = reorder
                s.add(row)
                continue
            s.add(
                Product(
                    sku=sku,
                    name=name,
                    name_en=name_en,
                    department=dept,
                    unit=unit_th,
                    unit_en=unit_en,
                    on_hand=None if is_svc else on_hand,
                    reorder_at=reorder,
                    is_service=is_svc,
                    icon_emoji=infer_icon_emoji(sku, name, is_service=is_svc),
                ),
            )
        for sku, name in legacy_names.items():
            if sku in catalog_skus:
                continue
            row = s.exec(select(Product).where(Product.sku == sku)).first()
            if row:
                row.name = strip_legacy_product_suffix(name) or name
                s.add(row)
        s.commit()
    purge_retired_catalog_products()
    normalize_all_product_names()
    backfill_all_product_i18n_columns()
    strip_legacy_suffixes_from_items_text()
