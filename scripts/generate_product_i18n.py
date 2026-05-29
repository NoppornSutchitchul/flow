#!/usr/bin/env python3
"""Generate English→Burmese/Lao fragment maps for product names."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.catalog.product_catalog import PRODUCT_ROWS  # noqa: E402
from app.catalog.product_names_en import (  # noqa: E402
    _PHRASES,
    _SIZE_COLOR,
    _SKU_CATEGORY,
    english_product_name,
)

# English fragment → (Burmese, Lao), longest keys applied first at runtime.
EN_LOCAL: dict[str, tuple[str, str]] = {
    "Pool slippers": ("ရေကူးကန် ဆလစ်ပါ", "ເກີບແຕະສະລ໌"),
    "Kids slippers": ("ကလေး ဆလစ်ပါ", "ເກີບແຕະເດັກ"),
    "Spa slippers": ("စပါ ဆလစ်ပါ", "ເກີບແຕະສປາ"),
    "Slippers": ("ဆလစ်ပါ", "ເກີບແຕະ"),
    "Pool towel": ("ရေကူးကန် ပဝါ", "ຜ້າເຊັດຕົວສະລ໌"),
    "Bath towel": ("ရေချိုးပဝါ", "ຜ້າເຊັດຕົວ"),
    "Hand towel": ("လက်သုတ်ပဝါ", "ຜ້າເຊັດມື"),
    "Face towel": ("မျက်နှာသုတ်ပဝါ", "ຜ້າເຊັດໜ້າ"),
    "Foot towel": ("ခြေသုတ်ပဝါ", "ຜ້າເຊັດຕີນ"),
    "Lens cloth": ("မှန်သုတ်ပဝါ", "ຜ້າເຊັດແວ່ນຕາ"),
    "Bath mat": ("ရေချိုးမဲ", "ພົມເຊັດຕີນ"),
    "Pool cover-up": ("ရေကူးကန် အင်္ကျီ", "ເສື້ອຄຸມສະລ໌"),
    "Bathrobe": ("ရေချိုးအင်္ကျီ", "ຊຸດຄຸມອາບນ້ຳ"),
    "Shower curtain (spare)": ("ရေချိုးဖာတိန် (สำรอง)", "ຜ້າກັ້ງອາບນ້ຳ (ສຳຮອງ)"),
    "Shower curtain": ("ရေချိုးဖာတိန်", "ຜ້າກັ້ງອາບນ້ຳ"),
    "Non-slip bath mat": ("ချောင်မဲ", "ພົມກັນລື່ນ"),
    "Pillow (soft)": ("ခေါင်းအုံ (နူး)", "ຫມອນ (ນຸ່ມ)"),
    "Pillow (standard)": ("ခေါင်းအုံ (စံနှုန်း)", "ຫມອນ (ມາດຕະຖານ)"),
    "Pillow (firm)": ("ခေါင်းအုံ (မာ)", "ຫມອນ (ແຂງ)"),
    "Pillow": ("ခေါင်းအုံ", "ຫມອນ"),
    "Blanket": ("စောင်", "ຜ້ນຫ่ม"),
    "Bed sheet": ("ကုတင်ခင်း", "ຜ້າປູທີ່ນອນ"),
    "Pillowcase": ("ခေါင်းအုံအိတ်", "ປลอกหมอน"),
    "Duvet cover": ("စောင်အိတ်", "ປลอกผ้านวม"),
    "Duvet": ("စောင်", "ຜ้านวม"),
    "Downlight bulb": ("downlight မီး", "ໂຄມ downlight"),
    "Heat lamp (bathroom)": ("နွေးမီး (ห้องน้ำ)", "ໂຄມให้ความร้อน (ຫ້ອງນ້ຳ)"),
    "Safe light bulb": ("ဘဏ်ခွက်မီး", "ໂຄມตู้เซฟ"),
    "Light bulb (LED)": ("LED မီးလုံး", "ໂຄມ LED"),
    "Light bulb (filament)": ("မီးလုံး (filament)", "ໂຄມໄຟ (ໄສ້)"),
    "Light bulb": ("မီးလုံး", "ໂຄມໄຟ"),
    "Toilet paper": ("စan's paper", "ກະດาษຊຳระ"),
    "Conditioner": ("ခေါင်းလျှော်နောက်ဆီး", "ຄຣີມບຳລຸງຜົມ"),
    "Shampoo": ("ခေါင်းလျှော်ရည်", "ແຊມພູ"),
    "Soap": ("ဆabo", "ສบู่"),
    "Lotion": ("lotion", "ໂລຊັ່ນ"),
    "Trash / recycling collection": ("အမှိုက်စု / recycle", "ເກັບຂີ້ / ແຍກຂີ້"),
    "Trash collection": ("အမှိုက်စု", "ເກັບຂີ້"),
    "Odor removal": ("အနံ့ဖယ်ရှား", "ກຳจัดกลิ่น"),
    "Room cleaning": ("အခန်းသန့်ရှင်းရေး", "ທำความสะอาด"),
    "AC repair": ("AC ပြင်ဆင်", "ຊ่อมແອຣ໌"),
    "Water leak": ("ရေယိုစိမ်", "ນ้ำรั่ว"),
    "Hot water kettle": ("ရေနွေးအိုးမီး", "ກະຕິກນ້ຳຮ້ອນ"),
    "Umbrella": ("ထီး", "ຄຳຮ່າມ"),
    "Water glass": ("ရေခွက်", "ແກ้วน้ำ"),
    "Glass": ("ခွက်", "ແກ้ว"),
    "Waste bin": ("အမှိုက်ပုံး", "ຖังขยะ"),
    "Trash bag": ("အမှိုက်အိတ်", "ຖุงขยะ"),
    "Clothes hanger": ("အဝတ်ချိတ်တုံး", "ໄม้แขวนเสื้อ"),
    "Hanger": ("အဝတ်ချိတ်တုံး", "ໄม้แขวน"),
    "Microfiber cloth": ("microfiber ပဝါ", "ຜ้าไมโครไฟเบอร์"),
    "Cloth": ("ပဝါ", "ຜ้าเช็ด"),
    "Drinking water": ("သောက်ရေ", "ນ้ำดื่ม"),
    "Minibar": ("minibar", "มินิบาร์"),
    "Minibar item": ("minibar", "ມິນິບາ"),
    "Water heater": ("ရေနွေးစက်", "ເຄรื่องทำน้ำอุ่น"),
    "Remote control": ("remote", "ຣີໂມດ"),
    "Battery": ("battery", "ແບตเตอรี่"),
    "Charging cable": ("charging cable", "สายชาร์จ"),
    "Plug": ("plug", "ปลั๊ก"),
    "Key": ("သော့", "กุญแจ"),
    "Lock": ("lock", "ล็อค"),
    "Door": ("တံခါး", "ประตู"),
    "Window": ("ပြတင်းပေါက်", "หน้าต่าง"),
    "Mirror": ("မှန်", "กระจก"),
    "Sofa": ("sofa", "โซฟา"),
    "Chair": ("ထိုင်ခုံ", "เก้าอี้"),
    "Table": ("စားပွဲ", "โต๊ะ"),
    "Cabinet": ("ตู้", "ตู้"),
    "Elevator": ("lift", "ลิฟต์"),
    "Swimming pool": ("ရေကူးကန်", "สระว่ายน้ำ"),
    "Spa": ("spa", "ສປາ"),
    "Air purifier": ("လေသန့်စင်စက်", "ເຄື່ອງຟອກອາກາດ"),
    "Shower head": ("ရေချိုးခေါင်းတိုင်", "ຫົວຝັງບົວ"),
    "Shower hose": ("ရေချိုးပြွန်လုံး", "ສາຍຝັງບົວ"),
    "shower head": ("ရေချိုးခေါင်းတိုင်", "ຫົວຝັງບົວ"),
    "shower hose": ("ရေချိုးပြွန်လုံး", "ສາຍຝັງບົວ"),
    "Hair dryer": ("ဆံပင်ခြေက်", "ไดร์เป่าผม"),
    "Iron": ("အ ironing", "เตารีด"),
    "Safe": ("ဘဏ်ခွက်", "ตู้เซฟ"),
    "Air conditioner": ("AC", "ເຄรื่องปรับอากาศ"),
    "AC": ("AC", "ແອຣ໌"),
    "Water pipe": ("ရေပိုက်", "ท่อน้ำ"),
    "Faucet": ("ရေကွက်", "ก๊อกน้ำ"),
    "Toilet": ("အ toilet", "ชักโครก"),
    "Sink": ("ရေချိုးခန်း", "อ่างล้างหน้า"),
    "Shower head": ("shower head", "ฝักบัว"),
    "Shower hose": ("shower hose", "สายฝักบัว"),
    "Cleaning solution": ("သန့်ရှင်းရေးဆေး", "ນ้ำยาทำความสะอาด"),
    "Broom": ("ဗြဲ", "ไม้กวาด"),
    "Mop": ("ပြင်ဆင်မဲ", "ไม้ถูพื้น"),
    "Bucket": ("ဗလာ", "ถัง"),
    "Gloves": ("ถุงมือ", "ถุงมือ"),
    "Mask": ("mask", "หน้ากาก"),
    "spare": ("สำรอง", "ສຳຮອງ"),
    "refill": ("เติม", "ເຕີມ"),
    "size XL": ("size XL", "size XL"),
    "size S": ("size S", "size S"),
    "size M": ("size M", "size M"),
    "size L": ("size L", "size L"),
    "large": ("ကြီး", "ໃຫຍ່"),
    "medium": ("အလတ်", "ກາງ"),
    "white": ("အဖြူ", "ສີຂາວ"),
    "black": ("အမည်း", "ສີດຳ"),
    "blue": ("အပြာ", "ສີน้ำเงิน"),
    "green": ("အစိမ်း", "ສີเขียว"),
    "red": ("အနီ", "ສີแดง"),
    "kids": ("kids", "ເດັກ"),
    "Bedding": ("ကုတင်ပစ္စည်း", "ເຄື່ອງນອນ"),
    "Laundry supply": ("လျှော်ဝတ်ပစ္စည်း", "ອຸປະกรณ์ซัก"),
    "Amenity": ("amenity", "ຂองใช้"),
    "In-room item": ("အခန်းပစ္စည်း", "ของในห้อง"),
    "Equipment": ("equipment", "อุปกรณ์"),
    "Kids item": ("ကလေးပစ္စည်း", "ของเด็ก"),
    "Accessibility item": ("accessibility", "สิ่งอำนวยความสะดวก"),
    "Public area supply": ("public area", "พื้นที่ส่วนกลาง"),
    "Pool item": ("pool", "สระน้ำ"),
    "Spa item": ("spa", "ສປາ"),
    "Guest room extra": ("guest room extra", "ของเพิ่มในห้อง"),
    "Safety item": ("safety", "ความปลอดภัย"),
    "Linen": ("linen", "ผ้าลินิน"),
    "Service": ("ဝန်ဆောင်မှု", "ບໍລິການ"),
    "Light bulb": ("မီးလုံး", "ໂຄມໄຟ"),
    "Plumbing part": ("plumbing", "ท่อน้ำ"),
    "Electrical part": ("electrical", "ไฟฟ้า"),
    "HVAC part": ("HVAC", "HVAC"),
    "Furniture part": ("furniture", "เฟอร์นิเจอร์"),
    "Kitchen part": ("kitchen", "ครัว"),
    "Safety equipment": ("safety equipment", "อุปกรณ์ความปลอดภัย"),
    "Item": ("ပစ္စည်း", "ລາຍการ"),
    "Towel": ("ပဝါ", "ຜ້າເຊັດ"),
    # Bathroom amenities (HK-AMN — PRODUCT_EN_BY_SKU)
    "Body wash": ("ရေချိုးဆပ်ပြာ", "ນ້ຳຍາອາບຕົວ"),
    "Body lotion": ("ခန္ဓာကိုယ်လိုရှင်းရှင်း", "ໂລຊັ່ນທາຜິວ"),
    "Bar soap": ("ဆပ်ပြင်တုံး", "ສະບູ່ກອນ"),
    "Hand wash gel": ("လက်ဆေးဂျယ်", "ເຈລລ້າງມື"),
    "Antibacterial hand gel": ("လက်သန့်စင်ဂျယ်", "ເຈລລ້າງມືຆ່າເຊື້ອ"),
    "Mouthwash": ("ပါးသစ်ဆေးရည်", "ນ້ຳຍາບ້ວນປາກ"),
    "Toothbrush set": ("သွားတိုက်တုံးအစုံ", "ຊຸດແປງສີຟັນ"),
    "Toothpaste sachet": ("သွားတိုက်ဆေးအိတ်", "ຢາສີຟັນ (ຊອງ)"),
    "Dental floss sachet": ("သွားကြားသန့်ရှင်းကြိုး", "ໄມ້ຈິ້ມຟັນ (ຊອງ)"),
    "Shaving kit": ("မျက်နှာသွေးအစုံ", "ຊຸດໂກມຫນວດ"),
    "Shaving foam can": ("သွေးဖုံးပေါအိတ်", "ໂຟມໂກມຫນວດ"),
    "Cotton swabs box": ("ဝတ်ဆံပြာတိုက်", "ໄມ້ພັນສຳລີ (ກັບ)"),
    "Sewing kit": ("ချုပ်အပ်အစုံ", "ຊຸດເຢັບຜ້າ"),
    "Shower cap": ("ရေချိုးဦးထုပ်", "ຫມວກຄຸມອາບນ້ຳ"),
    "Comb": ("နှီးခြင်း", "ຫວີ"),
    "Hairbrush": ("ဆံပင်ပြင်တန်း", "ແປງຜົມ"),
    "Bathroom amenity basket": ("ရေချိုးသုံးပစ္စည်းတိုက်", "ຕະກລ້າຂອງອາບນ້ຳ"),
    "Bath salts sachet": ("ရေချိုးဆားအိတ်", "ເກືອອາບນ້ຳ (ຊອງ)"),
    "Body sponge": ("ရေချိုးဖယ်", "ໃຍຂັດຕົວ"),
    "Undergarment laundry bag": ("အတွင်းခံအဝတ်အိတ်", "ຖົງໃສ່ຊຸດຊັ້ນໃນ"),
    "Stationery and amenity kit": ("စာရေးကိရိယာနှင့်သုံးပစ္စည်းအစုံ", "ຊຸດเครื่องเขียนและของใช้"),
    "Room air freshener spray": ("အခန်းရေရှည်ဖျန်းဆေး", "ສເປຣຍປรับອາກາດ (ຫ້ອງ)"),
    "Wet wipes pack": ("စိုထိုင်းသုတ်ပဝါ", "ທິຊຊູ່ເປີກ"),
    "Face mask": ("မျက်နှာဖုံး", "ໜ້າກອກອນາມັຍ"),
    "Corrosion inhibitor sachet": ("သံမဏိမှုတ်ကာအိတ်", "ຜลิตภัณฑ์ลดการกัดกร่อน (ຊອງ)"),
    "Sunscreen sachet": ("နေရောင်ကာအိတ်", "ຄຣີມກັນແດດ (ຊອງ)"),
    "Bathroom air freshener": ("ရေချိုးခန်းရေရှည်ဆေး", "ນ້ຳหอมปรับอากาศ (ຫ້ອງນ້ຳ)"),
    "Shaving cream sachet": ("သွေးခရင်မ်အိတ်", "ຄຣີມໂກມ (ຊອງ)"),
    "Talcum powder sachet": ("ပုလိပ်အိတ်", "ແປ້ງเด็ก (ຊອງ)"),
    "Adult diapers pack": ("လူကြီးအတွက်အဝတ်အစားအိတ်", "ຜ້າອ້ອມຜູ້ໃຫຍ່ (ແພັກ)"),
    "Sanitary pads pack": ("သန့်ရှင်းရေး ပတ်တိန်အထုပ်", "ແຜ່ນອນາມັຍ (ແພັກ)"),
    "Condoms": ("ကိုယ်ဝန်တားကွန်ဒုံး", "ຖົງຢາງອນາມັຍ"),
    "Intimate care product sachet": ("ကိုယ်ပိုင်အစောင့်အရှောက်အိတ်", "ຜลิตภัณฑ์ดูแลจุดซ่อนเร้น (ຊອງ)"),
    "Saline nasal spray sachet": ("နှာခေါင်းဆေးအိတ်", "ນ້ຳເກືອສີດຈມູກ (ຊອງ)"),
    # Bell / front-office services
    "Luggage pickup": ("အိတ်ယူဆောင်ခြင်း", "ຮັບກະເປົາ"),
    "Deliver luggage to room": ("အခန်းသို့အိတ်ပို့ခြင်း", "ສົ່ງກະເປົາເຂົ້າຫ້ອງ"),
    "Move luggage between rooms": ("အခန်းအကြားအိတ်ရွှေ့ခြင်း", "ຍ້າຍກະເປົາລະຫວ່າງຫ້ອງ"),
    "Wake-up call service": ("နိုးစားဝန်ဆောင်မှု", "ບໍລິການໂທປຸກ"),
    "ABF box order": ("ABF box မှာယူခြင်း", "ສັ່ງ ABF box"),
    "Luggage receive (front desk)": ("အိတ်လက်ခံခြင်း (ဖရွန့်)", "ຮັບກະເປົາ (ຟຣອນ)"),
    # Accessibility / common stock (PRODUCT_EN_BY_SKU)
    "Wheelchair": ("ဘီးတပ်ထိုင်ခုံ", "ລໍ້ເຂັນ"),
    "Shower chair": ("ရေချိုးထိုင်ခုံ", "ເກົ້າອີ້ອາບນ້ຳ"),
    "Grab bar set": ("လက်ကိုင်ဘားအတွဲ", "ຊຸດມືຈັບກັນລື່ນ"),
    "Toilet seat riser": ("ရေအိမ်ခုံ မြင့်တင်ကိရိယာ", "ທີ່ເພີ່ມຄວາມສູງຊັກະໂຄກ"),
    "Hearing accessibility kit": ("နားမကြားသူအတွက်အစုံအလင်", "ຊຸດອຸປະກອນຜູ້ບກຫູ"),
    "Bed rail": ("ကုတင်ကွက်အကာ", "ຣາວກັ້ນເຕີງ"),
    "Walking cane": ("လမ်းလျှောက်တောင်ဝှေး", "ໄມ້ເທົ້າ"),
    "Hearing aid": ("နားကြားကိရိယာ", "ເຄື່ອງຊ່ວຍຟັງ"),
    "Bottle warmer": ("နို့အပူစက်", "ເຄື່ອງທໍານ້ຳນົມອຸ່ນ"),
    "Rubber gloves": ("ရာဘာလက်အိတ်", "ຖົງມືຢາງ"),
    "Large pool towel": ("ရေကူးကန်ပဝါ (အကြီး)", "ຜ້າເຊັດຕົວສະລ໌ (ໃຫຍ່)"),
    "Medium pool towel": ("ရေကူးကန်ပဝါ (အလတ်)", "ຜ້າເຊັດຕົວສະລ໌ (ກາງ)"),
    "Room power strip": ("ပလပ်တိုး (အခန်း)", "ປັກຕ່ອ (ຫ້ອງ)"),
    "Bath towel (large)": ("ရေချိုးပဝါ (အကြီး)", "ຜ້າເຊັດຕົວ (ຂະໜາດໃຫຍ່)"),
    "Bath towel": ("ရေချိုးပဝါ", "ຜ້າເຊັດຕົວ"),
    "(large)": ("(အကြီး)", "(ໃຫຍ່)"),
    "(ขนาดใหญ่)": ("(အကြီး)", "(ຂະໜາດໃຫຍ່)"),
    "(ขนาดกลาง)": ("(အလတ်)", "(ກາງ)"),
}

# Force-fix labels that otherwise stay English in SKU maps / fragments.
EN_LOCAL.update({
    "Cola or soft drink can": ("ကိုကာဝင် / အချိုရည်", "ໂກ້ / ນ້ຳອັດລົມ"),
    "Soft drink (sugar-free)": ("အချိုရည် (မပါသကြား)", "ນ້ຳອັດລົມ (ບໍ່ມີນ້ຳຕານ)"),
    "Domestic beer bottle": ("ပြည်တွင်းယမကာ", "ເບຍພາຍໃນ"),
    "Imported beer bottle": ("တင်သွင်းယမကာ", "ເບຍນຳເຂົ້າ"),
    "Tissue box": ("တစ်ရှူးဗူး", "ກ່ອງທິຊຊູ່"),
    "Shoe horn": ("ဖိနပ်တိုး", "ບ່ອນງັດຮອງເທົ້າ"),
    "Luggage rack": ("အိတ်ထားခုံ", "ທີ່ວາງກະເປົາ"),
    "Wood or furniture glue": ("သစ်သား / ပရိဘောဂ ကပ်ရည်", "ກາວໄມ້ / ກາວເຟີນິເຈີ"),
    "Minibar glass (spare)": ("မီနီဘားဖန်ခွက် (အပို)", "ແກ້ວມິນິບາ (ສຳຮອງ)"),
    "Chinese liquor (mini)": ("တရုတ်အရက်သိုက် (သေး)", "ເຫຼົ້າຈີນ (ມິນິ)"),
    "Room extension plug": ("ပလပ်တိုး (အခန်း)", "ປັກຕ່ອ (ຫ້ອງ)"),
    "Ironing board": ("အဝတ်ချိပ်ခုံ", "ໂຕະລີດຜ້າ"),
    "Paper roll": ("စာရွက်လိပ်", "ມ້ວນກະດາຩ"),
    "Iced tea (can)": ("လက်ဖက်အေး (ဗူး)", "ຊາເຢັນ (ກະປ໋ອງ)"),
    "Kids amenity set": ("ကလေးသုံးပစ္စည်းအစုံ", "ຊຸດຂອງໃຊ້ສ່ວນຕົວເດັກ"),
    "Wet swimsuit bag": ("ရေကူးဝတ်အဝတ်အိတ်", "ຖົງໃສ່ຊຸດວ່າຍນ້ຳເປີກ"),
    "Baby diapers (pack)": ("ကလေးအဝတ်အစားအိတ် (ထုပ်)", "ຜ້າອ້ອມເດັກ (ແພັກ)"),
    "Spa robe": ("စပါအင်္ကျီ", "ຊຸດຄຸມສປາ"),
    "Emergency light (spare battery)": ("အရေးပေါ်မီး (ဘက်ထရီအပို)", "ໄຟສຸກເສີນ (ແບັດສຳຮອງ)"),
    "Cleaning sheet pack": ("သန့်ရှင်းရေးပလက် (ထုပ်)", "ແຜ່ນທຳຄວາມສະອາດ (ແພັກ)"),
    "Bath towel (large)": ("ရေချိုးပဝါ (အကြီး)", "ຜ້າເຊັດຕົວ (ຂະໜາດໃຫຍ່)"),
    "EV charging station": ("EV အားသွင်းစက်", "ສະຖານີສາກລົດ EV"),
})

fragments_my = sorted(((en, my) for en, (my, _) in EN_LOCAL.items()), key=lambda x: len(x[0]), reverse=True)
fragments_lo = sorted(((en, lo) for en, (_, lo) in EN_LOCAL.items()), key=lambda x: len(x[0]), reverse=True)

out = ROOT / "backend/app/product_names_i18n_data.py"
out.write_text(
    "\n".join([
        '"""Auto-generated — run scripts/generate_product_i18n.py."""',
        "from __future__ import annotations",
        "",
        f"FRAGMENTS_MY: list[tuple[str, str]] = {fragments_my!r}",
        "",
        f"FRAGMENTS_LO: list[tuple[str, str]] = {fragments_lo!r}",
        "",
    ]),
    encoding="utf-8",
)
print(f"Wrote {out} ({len(fragments_my)} fragments)")

en_local_path = ROOT / "backend/app/product_en_local.py"
en_local_lines = [
    '"""Auto-generated — run scripts/generate_product_i18n.py."""',
    "from __future__ import annotations",
    "",
    "EN_LOCAL: dict[str, tuple[str, str]] = {",
]
for en in sorted(EN_LOCAL):
    my, lo = EN_LOCAL[en]
    en_local_lines.append(f"    {en!r}: ({my!r}, {lo!r}),")
en_local_lines.append("}")
en_local_lines.append("")
en_local_path.write_text("\n".join(en_local_lines), encoding="utf-8")
print(f"Wrote {en_local_path} ({len(EN_LOCAL)} entries)")

from app.catalog.product_en_by_sku import PRODUCT_EN_BY_SKU  # noqa: E402
from app.catalog.product_names_i18n import (  # noqa: E402
    PREFIX_FRAGMENTS_LO,
    PREFIX_FRAGMENTS_MY,
    _CATS_LO,
    _CATS_MY,
    _localize_english,
)
from app.product_names_i18n_data import FRAGMENTS_LO, FRAGMENTS_MY  # noqa: E402

from app.catalog.product_names_i18n import (  # noqa: E402
    _label_ok_for_locale,
    catalog_display_name,
)

# Exact Thai catalog labels → Burmese (covers slash / compound names).
TH_CATALOG_MY: dict[str, str] = {
    "โค้ก / น้ำอัดลม": "ကိုကာဝင် / အချိုရည်",
    "น้ำอัดลม (ไม่มีน้ำตาล)": "အချိုရည် (မပါသကြား)",
    "เบียร์ (ในประเทศ)": "ပြည်တွင်းယမကာ",
    "เบียร์ (นำเข้า)": "တင်သွင်းယမကာ",
    "ที่งัดรองเท้า": "ဖိနပ်တိုး",
    "ที่วางกระเป๋า": "အိတ်ထားခုံ",
    "กล่องทิชชู่": "တစ်ရှူးဗူး",
    "แก้วมินิบาร์ (สำรอง)": "မီနီဘားဖန်ခွက် (အပို)",
    "กาวไม้ / กาวเฟอร์นิเจอร์": "သစ်သား / ပရိဘောဂ ကပ်ရည်",
    "เครื่องทำน้ำอุ่น": "ရေနွေးစက်",
    "เหล้าจีน (มินิ)": "တရုတ်အရက်သိုက် (သေး)",
    "plug พ่วง (ห้อง)": "ပလပ်တိုး (အခန်း)",
    "ทิชชู่เปียก": "စိုထိုင်းသုတ်ပဝါ",
    "ผ้าเช็ดตัว (ขนาดใหญ่)": "ရေချိုးပဝါ (အကြီး)",
    "ชุดของใช้ส่วนตัวเด็ก": "ကလေးသုံးပစ္စည်းအစုံ",
    "ถุงใส่ชุดว่ายน้ำเปียก": "ရေကူးဝတ်အဝတ်အိတ်",
    "ชาเย็น (กระป๋อง)": "လက်ဖက်အေး (ဗူး)",
    "ผ้าอ้อมเด็ก (แพ็ก)": "ကလေးအဝတ်အစားအိတ် (ထုပ်)",
    "ชุดคลุม spa": "စပါအင်္ကျီ",
    "ไฟฉุกเฉิน (battery สำรอง)": "အရေးပေါ်မီး (ဘက်ထရီအပို)",
    "แผ่นทำความสะอาด (แพ็ก)": "သန့်ရှင်းရေးပလက် (ထုပ်)",
    "EV အားသွင်းစက်": "EV အားသွင်းစက်",
}

TH_CATALOG_LO: dict[str, str] = {
    "โค้ก / น้ำอัดลม": "ໂກ້ / ນ້ຳອັດລົມ",
    "น้ำอัดลม (ไม่มีน้ำตาล)": "ນ້ຳອັດລົມ (ບໍ່ມີນ້ຳຕານ)",
    "เบียร์ (ในประเทศ)": "ເບຍພາຍໃນ",
    "เบียร์ (นำเข้า)": "ເບຍນຳເຂົ້າ",
    "ที่งัดรองเท้า": "ບ່ອນງັດຮອງເທົ້າ",
    "ที่วางกระเป๋า": "ທີ່ວາງກະເປົາ",
    "กล่องทิชชู่": "ກ່ອງທິຊຊູ່",
    "แก้วมินิบาร์ (สำรอง)": "ແກ້ວມິນິບາ (ສຳຮອງ)",
    "กาวไม้ / กาวเฟอร์นิเจอร์": "ກາວໄມ້ / ກາວເຟີນິເຈີ",
    "เครื่องทำน้ำอุ่น": "ເຄື່ອງທຳນ້ຳອຸ່ນ",
    "เหล้าจีน (มินิ)": "ເຫຼົ້າຈີນ (ມິນິ)",
    "plug พ่วง (ห้อง)": "ປลັກຕ່ອ (ຫ້ອງ)",
    "ทิชชู่เปียก": "ທິຊຊູ່ເປີກ",
    "ผ้าเช็ดตัว (ขนาดใหญ่)": "ຜ້າເຊັດຕົວ (ຂະໜາດໃຫຍ່)",
    "ชุดของใช้ส่วนตัวเด็ก": "ຊຸດຂອງໃຊ້ສ່ວນຕົວເດັກ",
    "ถุงใส่ชุดว่ายน้ำเปียก": "ຖົງໃສ່ຊຸດວ່າຍນ້ຳເປີກ",
    "ชาเย็น (กระป๋อง)": "ຊາເຢັນ (ກະປ໋ອງ)",
    "ผ้าอ้อมเด็ก (แพ็ก)": "ຜ້າອ້ອມເດັກ (ແພັກ)",
    "ชุดคลุม spa": "ຊຸດຄຸມສປາ",
    "ไฟฉุกเฉิน (battery สำรอง)": "ໄຟສຸກເສີນ (ແບັດສຳຮອງ)",
    "แผ่นทำความสะอาด (แพ็ก)": "ແຜ່ນທຳຄວາມສະອາດ (ແພັກ)",
}

my_by_sku: dict[str, str] = {}
lo_by_sku: dict[str, str] = {}
th_my_by_th: dict[str, str] = {}
th_lo_by_th: dict[str, str] = {}
def _keep_label(text: str, locale: str) -> str | None:
    s = (text or "").strip()
    if not s or not _label_ok_for_locale(s, locale):
        return None
    return s


for row in PRODUCT_ROWS:
    sku, th_name = row[0], row[1]
    my_label = TH_CATALOG_MY.get(th_name) or catalog_display_name(sku, th_name, "my")
    lo_label = TH_CATALOG_LO.get(th_name) or catalog_display_name(sku, th_name, "lo")
    my_clean = _keep_label(my_label, "my")
    lo_clean = _keep_label(lo_label, "lo")
    if my_clean:
        my_by_sku[sku] = my_clean
    if lo_clean:
        lo_by_sku[sku] = lo_clean
    if th_name and my_clean:
        th_my_by_th[th_name] = my_clean
    if th_name and lo_clean:
        th_lo_by_th[th_name] = lo_clean
    en_label = english_product_name(sku, th_name)
    if my_clean and lo_clean:
        EN_LOCAL[en_label] = (my_clean, lo_clean)

for sku, en in PRODUCT_EN_BY_SKU.items():
    if sku in my_by_sku:
        continue
    th_guess = next((r[1] for r in PRODUCT_ROWS if r[0] == sku), en)
    my_label = catalog_display_name(sku, th_guess, "my")
    lo_label = catalog_display_name(sku, th_guess, "lo")
    if _keep_label(my_label, "my"):
        my_by_sku[sku] = my_label
    if _keep_label(lo_label, "lo"):
        lo_by_sku[sku] = lo_label

th_catalog_path = ROOT / "backend/app/product_th_catalog_i18n.py"
th_catalog_lines = [
    '"""Auto-generated — run scripts/generate_product_i18n.py."""',
    "from __future__ import annotations",
    "",
    f"TH_MY_BY_TH: dict[str, str] = {{",
]
for th in sorted(th_my_by_th):
    th_catalog_lines.append(f"    {th!r}: {th_my_by_th[th]!r},")
th_catalog_lines.append("}")
th_catalog_lines.append("")
th_catalog_lines.append(f"TH_LO_BY_TH: dict[str, str] = {{")
for th in sorted(th_lo_by_th):
    th_catalog_lines.append(f"    {th!r}: {th_lo_by_th[th]!r},")
th_catalog_lines.append("}")
th_catalog_lines.append("")
th_catalog_path.write_text("\n".join(th_catalog_lines), encoding="utf-8")
print(f"Wrote {th_catalog_path} ({len(th_my_by_th)} Thai labels)")

for fname, data in (
    ("product_my_by_sku.py", my_by_sku),
    ("product_lo_by_sku.py", lo_by_sku),
):
    sku_path = ROOT / "backend/app" / fname
    lines = [
        '"""Auto-generated — run scripts/generate_product_i18n.py."""',
        "from __future__ import annotations",
        "",
        f"PRODUCT_{fname[8:10].upper()}_BY_SKU: dict[str, str] = {{",
    ]
    for sku in sorted(data):
        lines.append(f'    {sku!r}: {data[sku]!r},')
    lines.append("}")
    lines.append("")
    sku_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {sku_path} ({len(data)} SKUs)")

# Frontend fallback maps (reports / items_text when API labels are still English).
frontend_dir = ROOT / "src/lib/generated"
frontend_dir.mkdir(parents=True, exist_ok=True)
en_my_map = {
    en: my
    for en, (my, _) in EN_LOCAL.items()
    if _keep_label(my, "my") and my != en
}
en_lo_map = {
    en: lo
    for en, (_, lo) in EN_LOCAL.items()
    if _keep_label(lo, "lo") and lo != en
}
frag_my = [
    (en, my)
    for en, my in fragments_my
    if _keep_label(my, "my") and my != en
]
frag_lo = [
    (en, lo)
    for en, lo in fragments_lo
    if _keep_label(lo, "lo") and lo != en
]
frontend_path = frontend_dir / "productLabelMaps.ts"
frontend_path.write_text(
    "\n".join(
        [
            '/** Auto-generated — run scripts/generate_product_i18n.py */',
            'import type { AppLang } from "../language";',
            "",
            f"const EN_MY: Record<string, string> = {en_my_map!r};",
            f"const EN_LO: Record<string, string> = {en_lo_map!r};",
            f"const TH_MY: Record<string, string> = {dict(th_my_by_th)!r};",
            f"const TH_LO: Record<string, string> = {dict(th_lo_by_th)!r};",
            f"const FRAGMENTS_MY: [string, string][] = {json.dumps(frag_my, ensure_ascii=False)};",
            f"const FRAGMENTS_LO: [string, string][] = {json.dumps(frag_lo, ensure_ascii=False)};",
            "",
            "const THAI_RE = /[\\u0E00-\\u0E7F]/;",
            "const MYANMAR_RE = /[\\u1000-\\u109F]/;",
            "const LAO_RE = /[\\u0E80-\\u0EFF]/;",
            "",
            "function exactMap(lang: AppLang): Record<string, string> {",
            '  if (lang === "my") return { ...EN_MY, ...TH_MY };',
            '  if (lang === "lo") return { ...EN_LO, ...TH_LO };',
            "  return {};",
            "}",
            "",
            "function fragmentList(lang: AppLang): [string, string][] {",
            '  return lang === "my" ? FRAGMENTS_MY : lang === "lo" ? FRAGMENTS_LO : [];',
            "}",
            "",
            "/** Translate a catalog / items_text product label for my or lo. */",
            "export function translateCatalogLabel(text: string, lang: AppLang): string {",
            '  const raw = text.trim();',
            '  if (!raw || lang === "th" || lang === "en") return text;',
            "  const map = exactMap(lang);",
            "  if (map[raw]) return map[raw];",
            "  const lower = raw.toLowerCase();",
            "  for (const [key, val] of Object.entries(map)) {",
            "    if (key.toLowerCase() === lower) return val;",
            "  }",
            "  let out = raw;",
            "  for (const [src, tgt] of fragmentList(lang)) {",
            "    if (out.includes(src)) out = out.split(src).join(tgt);",
            "  }",
            '  out = out.replace(/\\s+/g, " ").trim();',
            '  if (lang === "my" && (MYANMAR_RE.test(out) || LAO_RE.test(out)) && !THAI_RE.test(out)) return out;',
            '  if (lang === "lo" && LAO_RE.test(out) && !THAI_RE.test(out) && !MYANMAR_RE.test(out)) return out;',
            "  return text;",
            "}",
            "",
        ],
    ),
    encoding="utf-8",
)
print(f"Wrote {frontend_path}")
