import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  normalizeRequestItems,
  useProductNameLookup,
} from "../components/requests/RequestItemsChips";
import {
  checklistItemKey,
  loadRequestItemChecklist,
  saveRequestItemChecklist,
} from "../lib/requestItemChecklist";
import type { RequestItem } from "../lib/types";

export function useRequestItemChecklist(
  requestId: number | null,
  items?: RequestItem[],
  text = "",
) {
  const { i18n } = useTranslation();
  const productLookup = useProductNameLookup();
  const rows = useMemo(
    () =>
      requestId == null
        ? []
        : normalizeRequestItems(items, text, i18n.language, productLookup),
    [requestId, items, text, i18n.language, productLookup],
  );
  const rowKeys = useMemo(
    () => rows.map((row, i) => checklistItemKey(row, i)),
    [rows],
  );

  const [checked, setChecked] = useState<Set<string>>(() =>
    requestId == null ? new Set() : loadRequestItemChecklist(requestId),
  );

  useEffect(() => {
    if (requestId == null) {
      setChecked(new Set());
      return;
    }
    setChecked(loadRequestItemChecklist(requestId));
  }, [requestId]);

  useEffect(() => {
    if (requestId == null) return;
    saveRequestItemChecklist(requestId, checked);
  }, [requestId, checked]);

  const checkedCount = rowKeys.filter((key) => checked.has(key)).length;
  const totalQty = rows.reduce((sum, row) => sum + row.qty, 0);
  const checkedQty = rows.reduce(
    (sum, row, i) => (checked.has(rowKeys[i]!) ? sum + row.qty : sum),
    0,
  );
  const allChecked = rows.length === 0 || checkedCount === rows.length;

  const toggle = (key: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return {
    rows,
    rowKeys,
    checked,
    checkedCount,
    checkedQty,
    totalQty,
    allChecked,
    toggle,
  };
}
