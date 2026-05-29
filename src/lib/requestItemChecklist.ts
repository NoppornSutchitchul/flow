import type { DisplayItem } from "../components/requests/RequestItemsChips";

const STORAGE_PREFIX = "flow:request-checklist:";

export function checklistItemKey(row: DisplayItem, index: number): string {
  return row.sku ?? `i:${index}:${row.name}`;
}

export function loadRequestItemChecklist(requestId: number): Set<string> {
  try {
    const raw = sessionStorage.getItem(`${STORAGE_PREFIX}${requestId}`);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((k): k is string => typeof k === "string"));
  } catch {
    return new Set();
  }
}

export function saveRequestItemChecklist(
  requestId: number,
  checked: Set<string>,
): void {
  sessionStorage.setItem(
    `${STORAGE_PREFIX}${requestId}`,
    JSON.stringify([...checked]),
  );
}

export function clearRequestItemChecklist(requestId: number): void {
  sessionStorage.removeItem(`${STORAGE_PREFIX}${requestId}`);
}
