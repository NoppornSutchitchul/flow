import clsx from "clsx";
import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import type { useRequestItemChecklist } from "../../hooks/useRequestItemChecklist";
import { itemQtySuffix } from "./RequestItemsChips";
import { ProductItemIcon } from "../../lib/productIcons";

type ChecklistState = ReturnType<typeof useRequestItemChecklist>;

interface Props {
  checklist: ChecklistState;
  className?: string;
  /** When true, items cannot be checked until the job is started. */
  locked?: boolean;
}

export function RequestItemsChecklist({ checklist, className, locked = false }: Props) {
  const { t } = useTranslation();
  const { rows, rowKeys, checked, checkedQty, totalQty, allChecked, toggle } =
    checklist;
  const [showStartWarning, setShowStartWarning] = useState(false);

  useEffect(() => {
    if (!locked) setShowStartWarning(false);
  }, [locked]);

  useEffect(() => {
    if (!showStartWarning) return;
    const id = window.setTimeout(() => setShowStartWarning(false), 4000);
    return () => window.clearTimeout(id);
  }, [showStartWarning]);

  const handleLockedAttempt = () => {
    setShowStartWarning(true);
  };

  if (rows.length === 0) return null;

  const progressPct =
    totalQty > 0 ? Math.round((checkedQty / totalQty) * 100) : 0;

  return (
    <div className={clsx("checklist-panel p-3", className)}>
      {showStartWarning && (
        <p
          role="alert"
          className="mb-2 rounded-lg border border-[color:var(--color-stock-low-fg)]/25 bg-[color:var(--color-stock-low-bg)] px-3 py-2 text-sm font-medium leading-snug text-[color:var(--color-stock-low-fg)]"
        >
          {t("queue.checklist_start_required")}
        </p>
      )}
      <ul className="checklist-items-grid m-0 grid list-none gap-2 p-0">
        {rows.map((row, i) => {
          const key = rowKeys[i]!;
          const isChecked = checked.has(key);
          const qtyLabel = itemQtySuffix(row);
          const note = row.note?.trim();
          return (
            <li key={key}>
              <label
                className={clsx(
                  "checklist-item flex min-h-[3.75rem] gap-3 px-4 py-3",
                  note ? "items-start" : "items-center",
                  locked
                    ? "cursor-not-allowed opacity-65"
                    : "cursor-pointer",
                  isChecked && "checklist-item-checked",
                )}
                onClick={(e) => {
                  if (!locked) return;
                  e.preventDefault();
                  handleLockedAttempt();
                }}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  disabled={locked}
                  onChange={() => {
                    if (!locked) toggle(key);
                  }}
                  className="peer sr-only"
                  aria-label={t("queue.checklist_mark", {
                    name: row.name,
                    qty: row.qty,
                  })}
                />
                <span
                  className={clsx(
                    "grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 transition-colors",
                    note && "mt-0.5",
                    isChecked
                      ? "border-[color:var(--color-delivered-fg)] bg-[color:var(--color-delivered-fg)]"
                      : "border-[color:var(--color-line)] bg-white peer-focus-visible:ring-2 peer-focus-visible:ring-[color:var(--color-delivered-fg)]/25",
                  )}
                  aria-hidden
                >
                  {isChecked && <Check className="h-4 w-4 stroke-[3] text-white" />}
                </span>
                <ProductItemIcon
                  sku={row.sku}
                  name={row.name}
                  iconEmoji={row.icon_emoji}
                  size="md"
                  className={note ? "mt-0.5" : undefined}
                />
                <span className="min-w-0 flex-1">
                  <span
                    className={clsx(
                      "block text-base font-semibold leading-snug",
                      note ? "whitespace-normal" : "truncate",
                      isChecked
                        ? "text-[color:var(--color-ink-muted)] line-through decoration-[color:var(--color-ink-soft)]"
                        : "text-[color:var(--color-ink)]",
                    )}
                    title={row.name}
                  >
                    {row.name}
                  </span>
                  {note ? (
                    <span
                      className={clsx(
                        "mt-1 block whitespace-normal text-sm font-semibold leading-snug",
                        isChecked
                          ? "text-[color:var(--color-ink-muted)] line-through decoration-[color:var(--color-ink-soft)]"
                          : "text-[color:var(--color-ink)]",
                      )}
                    >
                      {t("requests.item_note_prefix")} {note}
                    </span>
                  ) : null}
                </span>
                {qtyLabel && (
                  <span
                    className={clsx(
                      "shrink-0 min-w-[3rem] rounded-lg px-3 py-2 text-center text-base font-bold tabular-nums leading-none",
                      note && "mt-0.5",
                      isChecked
                        ? "bg-[color:var(--color-paper-2)] text-[color:var(--color-ink-muted)]"
                        : "bg-[color:var(--color-ink)] text-white shadow-sm",
                    )}
                    aria-hidden
                  >
                    {qtyLabel}
                  </span>
                )}
              </label>
            </li>
          );
        })}
      </ul>

      <div
        className={clsx(
          "mt-3 rounded-xl border px-4 py-3.5",
          allChecked
            ? "border-[color:var(--color-delivered-fg)]/30 bg-[color:var(--color-delivered-bg)]/35"
            : "border-[color:var(--color-line)] bg-[color:var(--color-paper)]/80",
        )}
      >
        <div className="mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
          <p className="text-sm leading-snug text-[color:var(--color-ink-soft)]">
            {t("queue.items_heading", {
              count: rows.length,
              total: totalQty,
            })}
          </p>
          <p
            className={clsx(
              "text-2xl font-bold tabular-nums leading-none tracking-tight",
              allChecked
                ? "text-[color:var(--color-delivered-fg)]"
                : "text-[color:var(--color-ink)]",
            )}
          >
            {t("queue.checklist_progress", {
              checked: checkedQty,
              total: totalQty,
            })}
          </p>
        </div>
        <div
          className="checklist-progress-track"
          role="progressbar"
          aria-valuenow={checkedQty}
          aria-valuemin={0}
          aria-valuemax={totalQty}
          aria-label={t("queue.checklist_progress", {
            checked: checkedQty,
            total: totalQty,
          })}
        >
          <div
            className={clsx(
              "checklist-progress-fill",
              allChecked
                ? "bg-[color:var(--color-delivered-fg)]"
                : "bg-[color:var(--color-stock-ok-bg)]",
            )}
            style={{ width: `${progressPct}%` }}
          />
        </div>
        {allChecked && (
          <p className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--color-delivered-fg)]">
            <Check className="h-4 w-4 shrink-0" aria-hidden />
            {t("queue.checklist_complete")}
          </p>
        )}
      </div>
    </div>
  );
}
