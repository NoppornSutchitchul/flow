import clsx from "clsx";
import type { LucideIcon } from "lucide-react";

import { normalizeLanguage } from "./language";

import {
  Accessibility,
  AirVent,
  Baby,
  Bath,
  BedDouble,
  BellRing,
  BrushCleaning,
  Car,
  ChefHat,
  CircleParking,
  ClipboardList,
  Coffee,
  ConciergeBell,
  CupSoda,
  DoorOpen,
  Droplets,
  Dumbbell,
  Flame,
  Flower2,
  Footprints,
  Gamepad2,
  Gift,
  GlassWater,
  HeartPulse,
  KeyRound,
  Layers,
  Lightbulb,
  Luggage,
  Martini,
  Moon,
  Package,
  PartyPopper,
  PenLine,
  PlugZap,
  Presentation,
  Printer,
  ScrollText,
  Scissors,
  ShieldAlert,
  Shirt,
  ShowerHead,
  Sparkles,
  SprayCan,
  Trash2,
  TreePine,
  Tv,
  Umbrella,
  UtensilsCrossed,
  Waves,
  Wifi,
  Wind,
  Wine,
  Wrench,
  Zap,
} from "lucide-react";
import type { ComponentType } from "react";

import type { Department } from "./types";
import { emojiFromProductName } from "./productEmojiRules";

export {
  PRODUCT_ITEM_ICONS,
  inferItemIconIdFromName,
  itemIconById,
  itemIconLabel,
  uniqueProductItemIcons,
  type ProductItemIconDef,
  type ProductItemIconId,
} from "./productItemIcons";

export {
  allProductPickerEmojis,
  emojiPickerSections,
  pickerEmojiLabel,
  PICKER_RECOMMENDED_ID,
  resolvePickerEmoji,
  type EmojiPickerSection,
} from "./productPickerEmojis";

type IconStyle = { icon: LucideIcon; bg: string; fg: string };

const DEFAULT: IconStyle = {
  icon: Package,
  bg: "bg-[color:var(--color-paper-2)]",
  fg: "text-[color:var(--color-ink-soft)]",
};

const SKU_GROUPS: Record<string, IconStyle> = {
  // ── ห้องพัก / ผ้า / ของใช้ในอุ suites ──
  GST: { icon: Package, bg: "bg-stone-200", fg: "text-stone-700" },
  BED: { icon: BedDouble, bg: "bg-violet-100", fg: "text-violet-700" },
  BTH: { icon: ShowerHead, bg: "bg-cyan-100", fg: "text-cyan-700" },
  TWL: { icon: Bath, bg: "bg-sky-100", fg: "text-sky-700" },
  SLP: { icon: Footprints, bg: "bg-sky-100", fg: "text-sky-700" },
  LIN: { icon: Layers, bg: "bg-indigo-100", fg: "text-indigo-700" },
  FUR: { icon: BedDouble, bg: "bg-violet-100", fg: "text-violet-700" },
  AMN: { icon: Sparkles, bg: "bg-teal-100", fg: "text-teal-700" },
  MIN: { icon: Wine, bg: "bg-rose-100", fg: "text-rose-700" },
  CAF: { icon: CupSoda, bg: "bg-amber-100", fg: "text-amber-800" },
  KID: { icon: Baby, bg: "bg-pink-100", fg: "text-pink-700" },
  ACC: { icon: Accessibility, bg: "bg-blue-100", fg: "text-blue-700" },
  // ── แม่บ้าน / ทำความสะอาด ──
  HKP: { icon: BrushCleaning, bg: "bg-emerald-100", fg: "text-emerald-700" },
  CLN: { icon: SprayCan, bg: "bg-lime-100", fg: "text-lime-800" },
  LND: { icon: Shirt, bg: "bg-indigo-100", fg: "text-indigo-700" },
  PUB: { icon: Sparkles, bg: "bg-emerald-100", fg: "text-emerald-700" },
  WST: { icon: Trash2, bg: "bg-stone-200", fg: "text-stone-700" },
  // ── อาหารและเครื่องดื่ม ──
  FNB: { icon: UtensilsCrossed, bg: "bg-orange-100", fg: "text-orange-700" },
  KIT: { icon: ChefHat, bg: "bg-orange-100", fg: "text-orange-700" },
  BAR: { icon: Martini, bg: "bg-rose-100", fg: "text-rose-700" },
  // ── สิ่งอำนวยความสะดวก / สันทนาการ ──
  PLS: { icon: Waves, bg: "bg-sky-100", fg: "text-sky-700" },
  SPA: { icon: Flower2, bg: "bg-fuchsia-100", fg: "text-fuchsia-700" },
  FIT: { icon: Dumbbell, bg: "bg-slate-200", fg: "text-slate-700" },
  SAL: { icon: Scissors, bg: "bg-pink-100", fg: "text-pink-700" },
  REC: { icon: Gamepad2, bg: "bg-violet-100", fg: "text-violet-700" },
  GDN: { icon: TreePine, bg: "bg-green-100", fg: "text-green-800" },
  OUT: { icon: Umbrella, bg: "bg-sky-100", fg: "text-sky-700" },
  // ── ฟร้อนท์ / บริการแขก ──
  FDQ: { icon: ClipboardList, bg: "bg-slate-200", fg: "text-slate-700" },
  LUG: { icon: Luggage, bg: "bg-stone-200", fg: "text-stone-700" },
  CNB: { icon: ConciergeBell, bg: "bg-amber-100", fg: "text-amber-800" },
  GFT: { icon: Gift, bg: "bg-fuchsia-100", fg: "text-fuchsia-700" },
  KEY: { icon: KeyRound, bg: "bg-yellow-100", fg: "text-yellow-800" },
  // ── จัดเลี้ยง / ประชุม ──
  MTG: { icon: Presentation, bg: "bg-blue-100", fg: "text-blue-700" },
  BNQ: { icon: PartyPopper, bg: "bg-purple-100", fg: "text-purple-700" },
  // ── วิศวกรรม / ซ่อมบำรุง ──
  ELC: { icon: Zap, bg: "bg-amber-100", fg: "text-amber-800" },
  PLM: { icon: Droplets, bg: "bg-blue-100", fg: "text-blue-700" },
  HVAC: { icon: AirVent, bg: "bg-sky-100", fg: "text-sky-700" },
  BLB: { icon: Lightbulb, bg: "bg-yellow-100", fg: "text-yellow-800" },
  EQP: { icon: PlugZap, bg: "bg-slate-200", fg: "text-slate-700" },
  // ── ความปลอดภัย / ฉุกเฉิน ──
  SEC: { icon: ShieldAlert, bg: "bg-orange-100", fg: "text-orange-700" },
  SFT: { icon: ShieldAlert, bg: "bg-red-100", fg: "text-red-700" },
  FIR: { icon: Flame, bg: "bg-red-100", fg: "text-red-700" },
  MED: { icon: HeartPulse, bg: "bg-rose-100", fg: "text-rose-700" },
  // ── IT / สำนักงาน ──
  NET: { icon: Wifi, bg: "bg-blue-100", fg: "text-blue-700" },
  PRT: { icon: Printer, bg: "bg-slate-200", fg: "text-slate-700" },
  STN: { icon: PenLine, bg: "bg-stone-200", fg: "text-stone-700" },
  // ── ขนส่ง / ที่จอดรถ ──
  PRK: { icon: CircleParking, bg: "bg-slate-200", fg: "text-slate-700" },
  TRN: { icon: Car, bg: "bg-slate-200", fg: "text-slate-700" },
  // ── เพิ่มเติม ──
  PET: { icon: Footprints, bg: "bg-amber-100", fg: "text-amber-800" },
  IRN: { icon: Shirt, bg: "bg-indigo-100", fg: "text-indigo-700" },
  ICE: { icon: GlassWater, bg: "bg-sky-100", fg: "text-sky-700" },
  ELP: { icon: DoorOpen, bg: "bg-stone-200", fg: "text-stone-700" },
  TVR: { icon: Tv, bg: "bg-violet-100", fg: "text-violet-700" },
  CUR: { icon: DoorOpen, bg: "bg-violet-100", fg: "text-violet-700" },
  HGR: { icon: Package, bg: "bg-stone-200", fg: "text-stone-700" },
  VLT: { icon: Sparkles, bg: "bg-teal-100", fg: "text-teal-700" },
  CLK: { icon: BellRing, bg: "bg-amber-100", fg: "text-amber-800" },
  CAM: { icon: Package, bg: "bg-slate-200", fg: "text-slate-700" },
  MUS: { icon: Package, bg: "bg-purple-100", fg: "text-purple-700" },
  LIB: { icon: ScrollText, bg: "bg-stone-200", fg: "text-stone-700" },
  VAC: { icon: BrushCleaning, bg: "bg-emerald-100", fg: "text-emerald-700" },
  PHN: { icon: BellRing, bg: "bg-blue-100", fg: "text-blue-700" },
  RML: { icon: DoorOpen, bg: "bg-stone-200", fg: "text-stone-700" },
};

/** Emoji shown in UI — mapped from SKU group code. */
const GROUP_EMOJI: Record<string, string> = {
  GST: "📦",
  BED: "🛏️",
  BTH: "🚿",
  TWL: "🛁",
  SLP: "🥿",
  LIN: "🧺",
  FUR: "🪑",
  AMN: "✨",
  MIN: "🍷",
  CAF: "☕",
  KID: "👶",
  ACC: "♿",
  HKP: "🧹",
  CLN: "🧽",
  LND: "👔",
  PUB: "🏛️",
  WST: "🗑️",
  FNB: "🍽️",
  KIT: "🍳",
  BAR: "🍸",
  PLS: "🏊",
  SPA: "💆",
  FIT: "🏋️",
  SAL: "💇",
  REC: "🎮",
  GDN: "🌳",
  OUT: "☂️",
  FDQ: "🛎️",
  LUG: "🧳",
  CNB: "🔔",
  GFT: "🎁",
  KEY: "🔑",
  MTG: "📊",
  BNQ: "🎉",
  ELC: "⚡",
  PLM: "🚰",
  HVAC: "❄️",
  BLB: "💡",
  EQP: "🔌",
  SEC: "🛡️",
  SFT: "🦺",
  FIR: "🚨",
  MED: "🩹",
  NET: "📶",
  PRT: "🖨️",
  STN: "✏️",
  PRK: "🅿️",
  TRN: "🚗",
  PET: "🐾",
  IRN: "👔",
  ICE: "🧊",
  ELP: "🛗",
  TVR: "📺",
  CUR: "🪟",
  HGR: "🪝",
  VLT: "🧴",
  CLK: "⏰",
  CAM: "📷",
  MUS: "🎵",
  LIB: "📚",
  VAC: "🧹",
  PHN: "☎️",
  RML: "🚪",
};

/** Middle segment of SKU codes — also drives the product icon. */
export type ProductIconGroup = keyof typeof SKU_GROUPS;

/** Display order in the new-product icon picker (grouped by hotel function). */
const ICON_GROUP_ORDER: ProductIconGroup[] = [
  "GST", "BED", "BTH", "TWL", "SLP", "LIN", "FUR", "AMN", "MIN", "CAF", "KID", "ACC",
  "HKP", "CLN", "LND", "PUB", "WST",
  "FNB", "KIT", "BAR",
  "PLS", "SPA", "FIT", "SAL", "REC", "GDN", "OUT",
  "FDQ", "LUG", "CNB", "GFT", "KEY",
  "MTG", "BNQ",
  "ELC", "PLM", "HVAC", "BLB", "EQP",
  "SEC", "SFT", "FIR", "MED",
  "NET", "PRT", "STN",
  "PRK", "TRN",
  "PET", "IRN", "ICE", "ELP", "TVR", "CUR", "HGR", "VLT", "CLK", "CAM", "MUS", "LIB", "VAC", "PHN", "RML",
];

export const PRODUCT_ICON_GROUPS: ProductIconGroup[] = ICON_GROUP_ORDER;

const SERVICE_ICON: IconStyle = {
  icon: Sparkles,
  bg: "bg-emerald-100",
  fg: "text-emerald-700",
};

const DEPT_SKU_PREFIX: Record<string, string> = {
  housekeeping: "HK",
  maintenance: "MT",
  front_office: "FO",
  bell_boy: "BB",
  executive_management: "EM",
};

/** Two-letter SKU segment for `{prefix}-{group}-{seq}` (custom depts get initials). */
export function deptSkuPrefix(department: Department): string {
  const known = DEPT_SKU_PREFIX[department];
  if (known) return known;
  const parts = department.split("_").filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  const compact = department.replace(/_/g, "").toUpperCase();
  return compact.slice(0, 2).padEnd(2, "X");
}

/** Next sequential code for `{prefix}-{group}-{nnn}`. */
export function nextProductSku(
  skus: Iterable<string>,
  department: Department,
  group: ProductIconGroup | "SVC" | string,
): string {
  const prefix = deptSkuPrefix(department);
  const pattern = new RegExp(`^${prefix}-${group}-(\\d+)$`, "i");
  let max = 0;
  for (const sku of skus) {
    const m = sku.match(pattern);
    if (m) max = Math.max(max, Number.parseInt(m[1] ?? "0", 10));
  }
  return `${prefix}-${group}-${String(max + 1).padStart(3, "0")}`;
}

export function previewSku(
  department: Department,
  group: ProductIconGroup | "SVC" | string,
): string {
  return `${deptSkuPrefix(department)}-${group}-000`;
}

/**
 * Localized display name for a product category, falling back to the Thai
 * `name` field when an English (or other) translation is missing.
 */
export function categoryDisplayName(
  cat: {
    name: string;
    name_en?: string | null;
  },
  lang: string,
): string {
  return normalizeLanguage(lang) === "en"
    ? (cat.name_en?.trim() || cat.name)
    : cat.name;
}

/** Active categories scoped to a catalog department (HK → BED, SLP, …). */
export function activeCategoriesForDepartment<
  T extends { active: boolean; department: string },
>(categories: T[], department: string): T[] {
  return categories.filter((c) => c.active && c.department === department);
}

/**
 * Categories for SKU middle-segment picker: department list plus the product's
 * current code when it is legacy (e.g. SVC on a Bell service).
 */
export function categoryPickerCategories<
  T extends {
    active: boolean;
    department: string;
    code: string;
    name: string;
    name_en?: string | null;
    icon_emoji?: string | null;
    sort_order?: number;
    builtin?: boolean;
    id?: number;
    product_count?: number;
  },
>(categories: T[], department: string, currentCode?: string): T[] {
  const active = activeCategoriesForDepartment(categories, department);
  const code = (currentCode ?? "").trim().toUpperCase();
  if (!code || active.some((c) => c.code === code)) return active;
  const extra = categories.find((c) => c.active && c.code === code);
  if (extra) return [...active, extra];
  return active;
}

export function iconStyleForGroup(
  group: ProductIconGroup | "SVC",
  department: Department,
): IconStyle {
  if (group === "SVC") {
    if (department === "maintenance") {
      return { icon: Wrench, bg: "bg-orange-100", fg: "text-orange-700" };
    }
    if (department === "bell_boy") {
      return { icon: Luggage, bg: "bg-amber-100", fg: "text-amber-800" };
    }
    if (department === "front_office") {
      return { icon: Sparkles, bg: "bg-sky-100", fg: "text-sky-800" };
    }
    return SERVICE_ICON;
  }
  return SKU_GROUPS[group] ?? DEFAULT;
}

export function groupBgClass(
  group: ProductIconGroup | "SVC" | string,
  department: Department,
): string {
  if (group === "SVC") {
    return iconStyleForGroup("SVC", department).bg;
  }
  return (SKU_GROUPS[group as ProductIconGroup] ?? DEFAULT).bg;
}

/** Accent bar for GroupedChoicePicker rows (derived from group icon color). */
export function skuGroupAccentBar(group: ProductIconGroup | string): string {
  const fg = (SKU_GROUPS[group] ?? DEFAULT).fg;
  const m = /^text-(\w+)-(\d+)$/.exec(fg);
  if (m) return `bg-${m[1]}-600/88`;
  return "bg-stone-600/88";
}

export function emojiForGroup(
  group: ProductIconGroup | "SVC",
  department: Department,
): string {
  if (group === "SVC") {
    return department === "maintenance" ? "🔧" : "✨";
  }
  return GROUP_EMOJI[group] ?? "📦";
}

export function resolveProductEmoji(
  sku?: string,
  name?: string,
  iconEmoji?: string | null,
): string {
  const stored = iconEmoji?.trim();
  if (stored) return stored;

  const fromName = emojiFromProductName(name ?? "");
  if (fromName) return fromName;

  const group = skuGroup(sku);
  if (group === "SVC") {
    return sku?.startsWith("MT-") ? "🔧" : "✨";
  }
  if (group && GROUP_EMOJI[group]) {
    return GROUP_EMOJI[group]!;
  }
  return "📦";
}

const NAME_RULES: { test: RegExp; style: IconStyle }[] = [
  { test: /กระดาษชำระ|ทิชชู/i, style: { icon: ScrollText, bg: "bg-stone-200", fg: "text-stone-700" } },
  { test: /กระติกน้ำร้อน|น้ำร้อน/i, style: { icon: Coffee, bg: "bg-amber-100", fg: "text-amber-800" } },
  { test: /แก้ว|น้ำดื่ม/i, style: { icon: GlassWater, bg: "bg-sky-100", fg: "text-sky-700" } },
  { test: /ขยะ|รีไซ/i, style: { icon: Trash2, bg: "bg-lime-100", fg: "text-lime-800" } },
  { test: /กลิ่น|สเปรย์|น้ำหอม/i, style: { icon: Wind, bg: "bg-teal-100", fg: "text-teal-700" } },
  { test: /เกลืออาบ|อาบน้ำ|ฝักบัว|ชักโครก|อ่าง/i, style: { icon: Bath, bg: "bg-cyan-100", fg: "text-cyan-700" } },
  { test: /ผ้าเช็ด|ผ้าห่ม|ผ้าปู|ปลอก/i, style: { icon: Bath, bg: "bg-sky-100", fg: "text-sky-700" } },
  { test: /หมอน|ที่นอน|ผ้านวม/i, style: { icon: BedDouble, bg: "bg-violet-100", fg: "text-violet-700" } },
  { test: /รองเท้า/i, style: { icon: Footprints, bg: "bg-sky-100", fg: "text-sky-700" } },
  { test: /แชมพู|สบู่|ครีม|โลชั่น|ยาสีฟัน|แปรง/i, style: { icon: Sparkles, bg: "bg-teal-100", fg: "text-teal-700" } },
  { test: /ซัก|รีด|ผ้า/i, style: { icon: Shirt, bg: "bg-indigo-100", fg: "text-indigo-700" } },
  { test: /กาแฟ|ชา|มินิบาร์|เบียร์|ไวน์|เหล้า/i, style: { icon: Wine, bg: "bg-rose-100", fg: "text-rose-700" } },
  { test: /ทำความสะอาด|เช็ด/i, style: { icon: Sparkles, bg: "bg-emerald-100", fg: "text-emerald-700" } },
  { test: /กระเป๋า/i, style: { icon: Luggage, bg: "bg-stone-200", fg: "text-stone-700" } },
  { test: /ที่นอนตอนเย็น|turndown/i, style: { icon: Moon, bg: "bg-indigo-100", fg: "text-indigo-700" } },
  { test: /ดอกไม้|ของขวัญ|วันเกิด/i, style: { icon: Flower2, bg: "bg-fuchsia-100", fg: "text-fuchsia-700" } },
  { test: /โทรปลุก|กริ่ง/i, style: { icon: BellRing, bg: "bg-amber-100", fg: "text-amber-800" } },
  { test: /แอร์|เครื่องปรับอากาศ/i, style: { icon: AirVent, bg: "bg-sky-100", fg: "text-sky-700" } },
  { test: /ทีวี|รีโมท/i, style: { icon: Tv, bg: "bg-violet-100", fg: "text-violet-700" } },
  { test: /ไฟ|หลอด|สวิตช์|ปลั๊ก/i, style: { icon: Lightbulb, bg: "bg-yellow-100", fg: "text-yellow-800" } },
  { test: /น้ำรั่ว|ท่อ|ประปา/i, style: { icon: Droplets, bg: "bg-blue-100", fg: "text-blue-700" } },
  { test: /ประตู|หน้าต่าง|ม่าน|มู่ลี่/i, style: { icon: DoorOpen, bg: "bg-stone-200", fg: "text-stone-700" } },
  { test: /ไวไฟ|อินเทอร์เน็ต|สาย/i, style: { icon: Zap, bg: "bg-amber-100", fg: "text-amber-800" } },
  { test: /ทาสี|สีผนัง/i, style: { icon: SprayCan, bg: "bg-orange-100", fg: "text-orange-700" } },
  { test: /ซ่อม|เสีย|ใช้ไม่/i, style: { icon: Wrench, bg: "bg-orange-100", fg: "text-orange-700" } },
];

function skuGroup(sku?: string): string | null {
  if (!sku) return null;
  const match = sku.match(/^[A-Z]{2}-([A-Z]{3})-/);
  return match?.[1] ?? null;
}

export function resolveProductIcon(sku?: string, name?: string): IconStyle {
  const group = skuGroup(sku);
  if (group === "SVC") {
    const dept = sku?.startsWith("MT-") ? "maintenance" : "housekeeping";
    if (dept === "maintenance") {
      for (const rule of NAME_RULES) {
        if (rule.test.test(name ?? "")) return rule.style;
      }
      return { icon: Wrench, bg: "bg-orange-100", fg: "text-orange-700" };
    }
    for (const rule of NAME_RULES) {
      if (rule.test.test(name ?? "")) return rule.style;
    }
    return { icon: Sparkles, bg: "bg-emerald-100", fg: "text-emerald-700" };
  }

  if (group && SKU_GROUPS[group]) {
    return SKU_GROUPS[group]!;
  }

  for (const rule of NAME_RULES) {
    if (rule.test.test(name ?? "")) return rule.style;
  }

  return DEFAULT;
}

interface ProductItemIconProps {
  sku?: string;
  name: string;
  iconEmoji?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

const SIZE: Record<
  NonNullable<ProductItemIconProps["size"]>,
  { box: string; icon: string; emoji: string }
> = {
  xs: { box: "h-7 w-7 rounded-md", icon: "h-3.5 w-3.5", emoji: "text-sm leading-none" },
  sm: { box: "h-8 w-8 rounded-lg", icon: "h-4 w-4", emoji: "text-base leading-none" },
  md: { box: "h-10 w-10 rounded-xl", icon: "h-5 w-5", emoji: "text-xl leading-none" },
  lg: { box: "h-11 w-11 rounded-xl", icon: "h-5 w-5", emoji: "text-2xl leading-none" },
};

export function ProductItemIcon({
  sku,
  name,
  iconEmoji,
  size = "md",
  className,
}: ProductItemIconProps) {
  const { icon: Icon, bg, fg } = resolveProductIcon(sku, name);
  const emoji = resolveProductEmoji(sku, name, iconEmoji);
  const dim = SIZE[size];

  return (
    <span
      className={clsx(
        "inline-grid shrink-0 place-items-center",
        dim.box,
        bg,
        !emoji && fg,
        className,
      )}
      aria-hidden
    >
      {emoji ? (
        <span className={clsx(dim.emoji, "leading-none select-none")}>{emoji}</span>
      ) : (
        <Icon className={dim.icon} strokeWidth={2.25} />
      )}
    </span>
  );
}

export function productIconComponent(
  sku?: string,
  name?: string,
): ComponentType<{ className?: string }> {
  const { icon } = resolveProductIcon(sku, name);
  return icon;
}
