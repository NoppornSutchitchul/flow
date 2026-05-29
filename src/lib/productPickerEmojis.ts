import { PRODUCT_EMOJI_RULES } from "./productEmojiRules";
import { PRODUCT_ITEM_ICONS } from "./productItemIcons";

/** Category emojis — mirrors GROUP_EMOJI in productIcons.tsx */
const CATEGORY_EMOJIS: readonly string[] = [
  "📦", "💤", "🪶", "🧶", "🛋️", "🧵", "🛏️", "🚿", "🛁", "🥿", "🧺", "🪑", "✨", "🍷", "☕", "👶", "♿",
  "🧹", "🧽", "👔", "🏛️", "🗑️", "🍽️", "🍳", "🍸", "🏊", "💆", "🏋️", "💇",
  "🎮", "🌳", "☂️", "🛎️", "🧳", "🔔", "🎁", "🔑", "📊", "🎉", "⚡", "🚰",
  "❄️", "💡", "🔌", "🛡️", "🦺", "🚨", "🩹", "📶", "🖨️", "✏️", "🅿️", "🚗",
  "🐾", "🧊", "🛗", "📺", "🪟", "🪝", "🧴", "⏰", "📷", "🎵", "📚", "☎️", "🚪",
];

export const PICKER_RECOMMENDED_ID = "recommended";

let recommendedCache: string[] | null = null;

function buildRecommendedEmojis(): string[] {
  if (recommendedCache) return recommendedCache;
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (emoji: string) => {
    if (seen.has(emoji)) return;
    seen.add(emoji);
    out.push(emoji);
  };
  for (const item of PRODUCT_ITEM_ICONS) add(item.emoji);
  for (const rule of PRODUCT_EMOJI_RULES) add(rule.emoji);
  for (const emoji of CATEGORY_EMOJIS) add(emoji);
  recommendedCache = out;
  return out;
}

/** Hotel picks for the carousel (full Unicode set loads in browse-all modal). */
export function allProductPickerEmojis(): string[] {
  return buildRecommendedEmojis();
}

export interface EmojiPickerSection {
  id: string;
  label: string;
  emojis: string[];
}

/** Sections for the browse-all modal (recommended + Unicode groups). */
const CATEGORY_LABEL_TH: Record<string, string> = {
  smileys_emotion: "อารมณ์ & หน้า",
  people_body: "คน & ร่างกาย",
  animals_nature: "สัตว์ & ธรรมชาติ",
  food_drink: "อาหาร & เครื่องดื่ม",
  travel_places: "ท่องเที่ยว & สถานที่",
  activities: "กิจกรรม",
  objects: "สิ่งของ",
  symbols: "สัญลักษณ์",
  flags: "ธง",
};

export async function emojiPickerSections(
  recommendedLabel: string,
  lang = "en",
): Promise<EmojiPickerSection[]> {
  const { unicodeEmojiGroups } = await import("./unicodeEmojiCatalog");
  const recommended = buildRecommendedEmojis();
  const ui = (lang || "en").split("-")[0]?.toLowerCase();
  const useTh = ui === "th";
  return [
    { id: PICKER_RECOMMENDED_ID, label: recommendedLabel, emojis: recommended },
    ...unicodeEmojiGroups().map((group) => ({
      id: group.id,
      label: useTh ? (CATEGORY_LABEL_TH[group.id] ?? group.label) : group.label,
      emojis: group.emojis.map((entry) => entry.emoji),
    })),
  ];
}

export async function pickerEmojiLabel(emoji: string): Promise<string> {
  const { emojiDisplayName } = await import("./unicodeEmojiCatalog");
  return emojiDisplayName(emoji);
}

export function resolvePickerEmoji(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return allProductPickerEmojis()[0] ?? "📦";
  if (allProductPickerEmojis().includes(trimmed)) return trimmed;
  if (/\p{Extended_Pictographic}/u.test(trimmed)) return trimmed;
  return allProductPickerEmojis()[0] ?? "📦";
}
