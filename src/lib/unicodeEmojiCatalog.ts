import emojiGroupsJson from "unicode-emoji-json/data-by-group.json";
import orderedEmojisJson from "unicode-emoji-json/data-ordered-emoji.json";

export interface UnicodeEmojiEntry {
  emoji: string;
  name: string;
}

export interface UnicodeEmojiGroup {
  id: string;
  label: string;
  emojis: UnicodeEmojiEntry[];
}

type RawGroup = {
  name: string;
  slug: string;
  emojis: { emoji: string; name: string }[];
};

const rawGroups = emojiGroupsJson as RawGroup[];
const orderedEmojis = orderedEmojisJson as string[];

let nameByEmoji: Map<string, string> | null = null;
let groups: UnicodeEmojiGroup[] | null = null;

function buildNameMap(): Map<string, string> {
  if (nameByEmoji) return nameByEmoji;
  const map = new Map<string, string>();
  for (const group of rawGroups) {
    for (const entry of group.emojis) {
      map.set(entry.emoji, entry.name);
    }
  }
  nameByEmoji = map;
  return map;
}

/** Unicode emoji groups (Smileys, People, Food, …). */
export function unicodeEmojiGroups(): UnicodeEmojiGroup[] {
  if (groups) return groups;
  groups = rawGroups.map((group) => ({
    id: group.slug,
    label: group.name,
    emojis: group.emojis.map((entry) => ({
      emoji: entry.emoji,
      name: entry.name,
    })),
  }));
  return groups;
}

/** All standard Unicode emojis in platform order (~1,900). */
export function allUnicodeEmojis(): string[] {
  return orderedEmojis;
}

export function emojiDisplayName(emoji: string): string {
  return buildNameMap().get(emoji) ?? emoji;
}

export function searchUnicodeEmojis(query: string): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const names = buildNameMap();
  const out: string[] = [];
  for (const emoji of orderedEmojis) {
    const name = names.get(emoji);
    if (name?.includes(q) || emoji.includes(q)) {
      out.push(emoji);
    }
  }
  return out;
}
