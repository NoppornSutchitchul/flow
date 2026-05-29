/** Item-specific emoji icons for products (not one icon per SKU category). */

import { emojiFromProductName } from "./productEmojiRules";
import { normalizeLanguage } from "./language";

export interface ProductItemIconDef {
  id: string;
  emoji: string;
  /** Middle SKU segment — used only for auto-generated product codes. */
  group: string;
  label: { th: string; en: string };
}

export const PRODUCT_ITEM_ICONS: ProductItemIconDef[] = [
  // ── ทั่วไป ──
  { id: "general", emoji: "📦", group: "GST", label: { th: "ทั่วไป", en: "General" } },

  // ── ที่นอน / ผ้าปู ──
  { id: "pillow", emoji: "💤", group: "BED", label: { th: "หมอน", en: "Pillow" } },
  { id: "pillow_down", emoji: "🪶", group: "BED", label: { th: "หมอนขนเป็ด", en: "Down pillow" } },
  { id: "pillow_silk", emoji: "🧵", group: "BED", label: { th: "หมอนผ้าไหม", en: "Silk pillow" } },
  { id: "blanket", emoji: "🧶", group: "BED", label: { th: "ผ้นห่ม", en: "Blanket" } },
  { id: "duvet", emoji: "🛋️", group: "BED", label: { th: "ผ้านวม", en: "Duvet" } },
  { id: "bedsheet", emoji: "🛏️", group: "BED", label: { th: "ผ้าปูที่นอน", en: "Bed sheet" } },
  { id: "pillowcase", emoji: "🧵", group: "BED", label: { th: "ปลอกหมอน", en: "Pillowcase" } },
  { id: "mattress_pad", emoji: "🛏️", group: "BED", label: { th: "แผ่นรองที่นอน", en: "Mattress pad" } },
  { id: "hanger", emoji: "🪝", group: "HGR", label: { th: "ไม้แขวนเสื้อ", en: "Clothes hanger" } },
  { id: "trouser_hanger", emoji: "🪝", group: "HGR", label: { th: "ไม้แขวนกางเกง", en: "Trouser hanger" } },
  { id: "luggage_rack", emoji: "🧳", group: "BED", label: { th: "ที่รองกระเป๋า", en: "Luggage rack" } },

  // ── ห้องน้ำ / ผ้าเช็ด ──
  { id: "towel", emoji: "🛁", group: "TWL", label: { th: "ผ้าเช็ดตัว", en: "Bath towel" } },
  { id: "hand_towel", emoji: "🛁", group: "TWL", label: { th: "ผ้าเช็ดมือ", en: "Hand towel" } },
  { id: "face_towel", emoji: "🛁", group: "TWL", label: { th: "ผ้าเช็ดหน้า", en: "Face towel" } },
  { id: "bath_mat", emoji: "🛁", group: "BTH", label: { th: "พรมห้องน้ำ", en: "Bath mat" } },
  { id: "bathrobe", emoji: "🥋", group: "BTH", label: { th: "ชุดคลุมอาบน้ำ", en: "Bathrobe" } },
  { id: "shower_curtain", emoji: "🚿", group: "BTH", label: { th: "ม่านอาบน้ำ", en: "Shower curtain" } },
  { id: "slippers", emoji: "🥿", group: "SLP", label: { th: "รองเท้าแตะ", en: "Slippers" } },
  { id: "pool_slippers", emoji: "🥿", group: "SLP", label: { th: "รองเท้าแตะสระ", en: "Pool slippers" } },

  // ── ของใช้ส่วนตัว ──
  { id: "shampoo", emoji: "🧴", group: "AMN", label: { th: "แชมพู", en: "Shampoo" } },
  { id: "conditioner", emoji: "🧴", group: "AMN", label: { th: "ครีมนวดผม", en: "Conditioner" } },
  { id: "body_wash", emoji: "🧴", group: "AMN", label: { th: "สบู่เหลว / ครีมอาบ", en: "Body wash" } },
  { id: "soap", emoji: "🧼", group: "AMN", label: { th: "สบู่", en: "Soap" } },
  { id: "lotion", emoji: "🧴", group: "AMN", label: { th: "โลชั่น", en: "Lotion" } },
  { id: "toothbrush", emoji: "🪥", group: "AMN", label: { th: "แปรงสีฟัน", en: "Toothbrush" } },
  { id: "toothpaste", emoji: "🧴", group: "AMN", label: { th: "ยาสีฟัน", en: "Toothpaste" } },
  { id: "shower_cap", emoji: "🚿", group: "AMN", label: { th: "หมวกอาบน้ำ", en: "Shower cap" } },
  { id: "sanitary_bag", emoji: "🛍️", group: "AMN", label: { th: "ถุงสุขอนามัย", en: "Sanitary bag" } },
  { id: "comb", emoji: "🪮", group: "AMN", label: { th: "หวี", en: "Comb" } },
  { id: "razor", emoji: "🪒", group: "AMN", label: { th: "มีดโกน", en: "Razor" } },
  { id: "cotton_swab", emoji: "🧻", group: "AMN", label: { th: "สำลี / ไม้พันสำลี", en: "Cotton swabs" } },
  { id: "tissue", emoji: "🧻", group: "AMN", label: { th: "ทิชชู / กระดาษชำระ", en: "Tissue" } },
  { id: "sewing_kit", emoji: "🪡", group: "AMN", label: { th: "ชุดเย็บผ้า", en: "Sewing kit" } },
  { id: "vanity_kit", emoji: "💄", group: "AMN", label: { th: "ชุดของใช้ส่วนตัว", en: "Vanity kit" } },

  // ── เครื่องดื่ม / มินิบาร์ ──
  { id: "water", emoji: "💧", group: "MIN", label: { th: "น้ำดื่ม", en: "Drinking water" } },
  { id: "coffee", emoji: "☕", group: "CAF", label: { th: "กาแฟ", en: "Coffee" } },
  { id: "tea", emoji: "🍵", group: "CAF", label: { th: "ชา", en: "Tea" } },
  { id: "kettle", emoji: "🫖", group: "CAF", label: { th: "กระติกน้ำร้อน", en: "Kettle" } },
  { id: "wine", emoji: "🍷", group: "MIN", label: { th: "ไวน์", en: "Wine" } },
  { id: "beer", emoji: "🍺", group: "MIN", label: { th: "เบียร์", en: "Beer" } },
  { id: "snack", emoji: "🍫", group: "MIN", label: { th: "ขนม / ของว่าง", en: "Snack" } },
  { id: "minibar", emoji: "🍷", group: "MIN", label: { th: "มินิบาร์", en: "Minibar" } },
  { id: "ice_bucket", emoji: "🧊", group: "MIN", label: { th: "ถังน้ำแข็ง", en: "Ice bucket" } },
  { id: "cup", emoji: "🥤", group: "CAF", label: { th: "แก้ว / จาน", en: "Cup / glassware" } },

  // ── เด็ก / สัตว์เลี้ยง ──
  { id: "baby_crib", emoji: "👶", group: "KID", label: { th: "เตียงเด็ก", en: "Baby crib" } },
  { id: "baby_amenities", emoji: "🍼", group: "KID", label: { th: "ของใช้ทารก", en: "Baby amenities" } },
  { id: "pet_bed", emoji: "🐾", group: "PET", label: { th: "ของใช้สัตว์เลี้ยง", en: "Pet amenities" } },

  // ── อุปกรณ์ช่วยเหลือ ──
  { id: "wheelchair", emoji: "♿", group: "ACC", label: { th: "รถเข็น", en: "Wheelchair" } },
  { id: "shower_chair", emoji: "🪑", group: "ACC", label: { th: "เก้าอี้อาบน้ำ", en: "Shower chair" } },
  { id: "walking_aid", emoji: "🦯", group: "ACC", label: { th: "ไม้เท้า / อุปกรณ์ช่วยเดิน", en: "Walking aid" } },

  // ── แม่บ้าน / ซักรีด ──
  { id: "laundry_bag", emoji: "👔", group: "LND", label: { th: "ถุงซักรีด", en: "Laundry bag" } },
  { id: "laundry_form", emoji: "📋", group: "LND", label: { th: "ใบแจ้งซักรีด", en: "Laundry form" } },
  { id: "dnd_sign", emoji: "🚫", group: "LND", label: { th: "ป้ายห้ามรบกวน", en: "Do not disturb sign" } },
  { id: "cleaning_sign", emoji: "🧹", group: "LND", label: { th: "ป้ายขอทำความสะอาด", en: "Please clean room sign" } },
  { id: "cleaning_cart", emoji: "🧹", group: "HKP", label: { th: "อุปกรณ์แม่บ้าน", en: "Housekeeping supplies" } },
  { id: "detergent", emoji: "🧴", group: "CLN", label: { th: "น้ำยาทำความสะอาด", en: "Cleaning detergent" } },
  { id: "sponge", emoji: "🧽", group: "CLN", label: { th: "ฟองน้ำ / ผ้าเช็ด", en: "Sponge / cloth" } },
  { id: "trash_bag", emoji: "🗑️", group: "WST", label: { th: "ถุงขยะ", en: "Trash bag" } },
  { id: "vacuum", emoji: "🧹", group: "VAC", label: { th: "เครื่องดูดฝุ่น", en: "Vacuum cleaner" } },
  { id: "iron", emoji: "👔", group: "IRN", label: { th: "เตารีด", en: "Iron" } },

  // ── อาหาร / บริการ ──
  { id: "room_service", emoji: "🍽️", group: "FNB", label: { th: "รูมเซอร์วิส", en: "Room service" } },
  { id: "concierge", emoji: "🛎️", group: "CNB", label: { th: "เบลล์ / คอนเซียร์จ", en: "Concierge / bell" } },
  { id: "gift", emoji: "🎁", group: "GFT", label: { th: "ของขวัญ / ของฝาก", en: "Gift / amenity" } },
  { id: "flowers", emoji: "💐", group: "GFT", label: { th: "ดอกไม้", en: "Flowers" } },

  // ── สิ่งอำนวยความสะดวก ──
  { id: "pool", emoji: "🏊", group: "PLS", label: { th: "สระว่ายน้ำ", en: "Swimming pool" } },
  { id: "spa", emoji: "💆", group: "SPA", label: { th: "สปา", en: "Spa" } },
  { id: "gym", emoji: "🏋️", group: "FIT", label: { th: "ฟิตเนส", en: "Gym" } },
  { id: "salon", emoji: "💇", group: "SAL", label: { th: "ร้านเสริมสวย", en: "Salon" } },
  { id: "umbrella", emoji: "☂️", group: "OUT", label: { th: "ร่ม", en: "Umbrella" } },
  { id: "luggage", emoji: "🧳", group: "LUG", label: { th: "กระเป๋า / สัมภาระ", en: "Luggage" } },

  // ── อุปกรณ์ในห้อง / IT ──
  { id: "tv", emoji: "📺", group: "TVR", label: { th: "ทีวี / รีโมท", en: "TV / remote" } },
  { id: "wifi", emoji: "📶", group: "NET", label: { th: "Wi‑Fi / อินเทอร์เน็ต", en: "Wi‑Fi" } },
  { id: "phone", emoji: "☎️", group: "PHN", label: { th: "โทรศัพท์", en: "Telephone" } },
  { id: "alarm_clock", emoji: "⏰", group: "CLK", label: { th: "โทรปลุก / นาฬิกา", en: "Alarm clock" } },
  { id: "safe", emoji: "🔐", group: "SEC", label: { th: "ตู้เซฟ", en: "In-room safe" } },
  { id: "key_card", emoji: "🔑", group: "KEY", label: { th: "คีย์การ์ด / กุญแจ", en: "Key card" } },
  { id: "curtain", emoji: "🪟", group: "CUR", label: { th: "ม่าน / หน้าต่าง", en: "Curtain / blinds" } },
  { id: "door", emoji: "🚪", group: "RML", label: { th: "ประตู / ลูกบิด", en: "Door / lock" } },
  { id: "minibar_fridge", emoji: "🧊", group: "MIN", label: { th: "ตู้เย็นมินิบาร์", en: "Minibar fridge" } },

  // ── ช่างซ่อม / วิศวกรรม ──
  { id: "light_bulb", emoji: "💡", group: "BLB", label: { th: "หลอดไฟ", en: "Light bulb" } },
  { id: "aircon", emoji: "❄️", group: "HVAC", label: { th: "แอร์ / ระบบอากาศ", en: "Air conditioning" } },
  { id: "plumbing", emoji: "🚰", group: "PLM", label: { th: "ประปา / ท่อน้ำ", en: "Plumbing" } },
  { id: "electrical", emoji: "⚡", group: "ELC", label: { th: "ไฟฟ้า / ปลั๊ก", en: "Electrical" } },
  { id: "repair", emoji: "🔧", group: "EQP", label: { th: "ซ่อม / เครื่องมือ", en: "Repair / tools" } },
  { id: "elevator", emoji: "🛗", group: "ELP", label: { th: "ลิฟต์", en: "Elevator" } },
  { id: "painting", emoji: "🎨", group: "EQP", label: { th: "ทาสี / ตกแต่ง", en: "Painting" } },

  // ── ความปลอดภัย / สำนักงาน ──
  { id: "first_aid", emoji: "🩹", group: "MED", label: { th: "ปฐมพยาบาล", en: "First aid" } },
  { id: "fire_safety", emoji: "🚨", group: "FIR", label: { th: "อัคคีภัย", en: "Fire safety" } },
  { id: "stationery", emoji: "✏️", group: "STN", label: { th: "เครื่องเขียน", en: "Stationery" } },
  { id: "printer", emoji: "🖨️", group: "PRT", label: { th: "เครื่องพิมพ์", en: "Printer" } },
  { id: "meeting", emoji: "📊", group: "MTG", label: { th: "ห้องประชุม", en: "Meeting room" } },
  { id: "banquet", emoji: "🎉", group: "BNQ", label: { th: "จัดเลี้ยง / งานเลี้ยง", en: "Banquet" } },
  { id: "parking", emoji: "🅿️", group: "PRK", label: { th: "ที่จอดรถ", en: "Parking" } },
  { id: "shuttle", emoji: "🚗", group: "TRN", label: { th: "รถรับส่ง", en: "Shuttle / transport" } },
];

export type ProductItemIconId = (typeof PRODUCT_ITEM_ICONS)[number]["id"];

const BY_ID = new Map(PRODUCT_ITEM_ICONS.map((item) => [item.id, item]));

export function itemIconById(id: string): ProductItemIconDef | undefined {
  return BY_ID.get(id);
}

/** One entry per emoji — used by the emoji picker carousel/grid. */
export function uniqueProductItemIcons(): ProductItemIconDef[] {
  const seen = new Set<string>();
  const out: ProductItemIconDef[] = [];
  for (const item of PRODUCT_ITEM_ICONS) {
    if (seen.has(item.emoji)) continue;
    seen.add(item.emoji);
    out.push(item);
  }
  return out;
}

export function itemIconLabel(item: ProductItemIconDef, lang: string): string {
  const ui = normalizeLanguage(lang);
  if (ui === "th") return item.label.th;
  return item.label.en;
}

export function inferItemIconIdFromName(name: string): ProductItemIconId | undefined {
  const emoji = emojiFromProductName(name);
  if (!emoji) return undefined;
  const matches = PRODUCT_ITEM_ICONS.filter((item) => item.emoji === emoji);
  if (matches.length === 1) return matches[0].id;
  if (matches.length > 1) {
    const n = name.trim().toLowerCase();
    for (const item of matches) {
      const parts = [item.label.th, item.label.en].flatMap((label) =>
        label.split(/[/\s]+/).filter((part) => part.length > 2),
      );
      if (parts.some((part) => n.includes(part.toLowerCase()))) return item.id;
    }
    return matches[0].id;
  }
  return undefined;
}
