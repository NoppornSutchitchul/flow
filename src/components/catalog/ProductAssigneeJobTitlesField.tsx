import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";

import { jobTitlesApi } from "../../lib/api";
import { jobTitleDisplayLabel } from "../../lib/jobTitleDisplay";

interface Props {
  department: string;
  /** null = all positions in department */
  value: string[] | null;
  onChange: (next: string[] | null) => void;
  className?: string;
}

export function ProductAssigneeJobTitlesField({
  department,
  value,
  onChange,
  className,
}: Props) {
  const { t } = useTranslation();
  const [allPositions, setAllPositions] = useState(value == null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["job-titles", "catalog", department],
    queryFn: () => jobTitlesApi.list(department),
    enabled: Boolean(department),
  });

  const labels = useMemo(() => rows.map((r) => r.label), [rows]);

  useEffect(() => {
    setAllPositions(value == null);
  }, [department, value]);

  useEffect(() => {
    if (!labels.length) return;
    if (value == null) return;
    const valid = value.filter((l) => labels.includes(l));
    if (valid.length !== value.length) {
      onChange(valid.length > 0 ? valid : null);
    }
  }, [labels, value, onChange]);

  const selected = useMemo(() => {
    if (value == null) return new Set(labels);
    return new Set(value);
  }, [value, labels]);

  const toggleAll = (checked: boolean) => {
    setAllPositions(checked);
    onChange(checked ? null : [...labels]);
  };

  const toggleOne = (label: string) => {
    const next = new Set(selected);
    if (next.has(label)) next.delete(label);
    else next.add(label);
    if (next.size === 0 || next.size === labels.length) {
      setAllPositions(next.size === labels.length);
      onChange(next.size === labels.length ? null : [...next]);
      return;
    }
    setAllPositions(false);
    onChange([...next]);
  };

  const fieldLabel =
    "text-[11px] font-semibold uppercase tracking-wide text-[color:var(--color-ink-muted)]";

  return (
    <div className={clsx("space-y-2.5", className)}>
      <p className={fieldLabel}>{t("stock.assignee_job_titles_label")}</p>
      <p className="text-[11px] leading-snug text-[color:var(--color-ink-muted)]">
        {t("stock.assignee_job_titles_hint")}
      </p>

      {isLoading ? (
        <p className="text-xs text-[color:var(--color-ink-muted)]">{t("common.loading")}</p>
      ) : labels.length === 0 ? (
        <p className="text-xs text-[color:var(--color-ink-muted)]">
          {t("stock.assignee_job_titles_empty")}
        </p>
      ) : (
        <>
          <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-[color:var(--color-line)]/80 bg-white px-3 py-2.5 shadow-sm">
            <input
              type="checkbox"
              checked={allPositions}
              onChange={(e) => toggleAll(e.target.checked)}
              className="h-4 w-4 shrink-0 accent-[color:var(--color-ink)]"
            />
            <span className="text-sm font-medium text-[color:var(--color-ink)]">
              {t("stock.assignee_job_titles_all")}
            </span>
          </label>

          {!allPositions && (
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {rows.map((jt) => {
                const on = selected.has(jt.label);
                return (
                  <li key={jt.id}>
                    <label
                      className={clsx(
                        "flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm transition",
                        on
                          ? "border-[color:var(--color-ink)]/25 bg-[color:var(--color-paper-2)]/80 ring-1 ring-[color:var(--color-ink)]/10"
                          : "border-[color:var(--color-line)]/80 bg-white hover:bg-[color:var(--color-paper-2)]/40",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => toggleOne(jt.label)}
                        className="h-4 w-4 shrink-0 accent-[color:var(--color-ink)]"
                      />
                      <span className="min-w-0 truncate font-medium">
                        {jobTitleDisplayLabel(jt.label)}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
