import { useQuery } from "@tanstack/react-query";

import { roomOptionsApi } from "./api";
import { normalizeLanguage } from "./language";
import type { RoomAttributeOption, RoomOptionKind } from "./types";

export const ROOM_OPTION_KINDS: RoomOptionKind[] = [
  "building",
  "floor",
  "type",
  "view",
  "size",
  "bed",
];

export const BILINGUAL_ROOM_OPTION_KINDS: RoomOptionKind[] = [
  "building",
  "floor",
  "view",
  "bed",
];

export function useRoomOptions(enabled = true) {
  return useQuery({
    queryKey: ["room-options"],
    queryFn: () => roomOptionsApi.list(),
    enabled,
  });
}

export function roomOptionLabel(
  opt: RoomAttributeOption,
  language: string,
): string {
  const ui = normalizeLanguage(language);
  const label = ui === "en" ? opt.label_en : opt.label_th;
  return (label || opt.label_en || opt.label_th || opt.code).trim();
}

/** Admin list: Thai and English on one line, e.g. ตึก 1 | Building 1 */
export function roomOptionBilingualListLabel(opt: RoomAttributeOption): string {
  const th = (opt.label_th || "").trim();
  const en = (opt.label_en || "").trim();
  if (th && en) return th === en ? th : `${th} | ${en}`;
  return th || en || opt.code;
}

export function optionsForKind(
  options: RoomAttributeOption[],
  kind: RoomOptionKind,
): RoomAttributeOption[] {
  return options
    .filter((o) => o.kind === kind)
    .sort((a, b) => a.sort_order - b.sort_order || a.code.localeCompare(b.code));
}

export function findRoomOption(
  options: RoomAttributeOption[],
  kind: RoomOptionKind,
  code: string,
): RoomAttributeOption | undefined {
  return options.find((o) => o.kind === kind && o.code === String(code));
}

export function displayLabelForRoomField(
  options: RoomAttributeOption[],
  kind: RoomOptionKind,
  code: string,
  language: string,
  fallback?: (code: string) => string,
): string {
  const opt = findRoomOption(options, kind, code);
  if (opt) return roomOptionLabel(opt, language);
  return fallback ? fallback(code) : code;
}
