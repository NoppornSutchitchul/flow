import { isValidElement, type ReactNode } from "react";

export type ReportTableSortMeta = Record<string, string | number | null | undefined>;

/** Table row: cell values plus optional `_sort` (use `reportTableRow` to build). */
export type ReportTableRow = Record<string, ReactNode> & { _sort?: ReportTableSortMeta };

export function reportTableRow(
  cells: Record<string, ReactNode>,
  sort?: ReportTableSortMeta,
): ReportTableRow {
  return { ...cells, _sort: sort } as ReportTableRow;
}

export function reportTableCell(row: ReportTableRow, key: string): ReactNode {
  return row[key] as ReactNode;
}

export type ReportTableSortDir = "asc" | "desc";

export type ReportTableColumn = {
  key: string;
  label: string;
  align?: "left" | "right";
  sortable?: boolean;
  sortValue?: (row: ReportTableRow) => string | number;
};

function reactNodeToText(node: ReactNode): string {
  if (node == null || node === false) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(reactNodeToText).join(" ").trim();
  if (isValidElement(node)) {
    const props = node.props as {
      children?: ReactNode;
      title?: string;
      iso?: string;
    };
    if (typeof props.iso === "string") return props.iso;
    if (props.title) return String(props.title);
    return reactNodeToText(props.children);
  }
  return "";
}

function parseNumericSort(text: string): number | null {
  const cleaned = text.replace(/,/g, "").trim();
  if (!cleaned || cleaned === "—" || cleaned === "-") return null;
  const match = cleaned.match(/^-?[\d]+(?:\.[\d]+)?/);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : null;
}

export function getReportCellSortValue(
  row: ReportTableRow,
  column: ReportTableColumn,
): string | number {
  if (column.sortValue) return column.sortValue(row);
  const raw = row._sort?.[column.key];
  if (raw !== undefined && raw !== null) return raw;

  const text = reactNodeToText(reportTableCell(row, column.key)).trim();
  const num = parseNumericSort(text);
  if (num !== null) return num;
  return text.toLowerCase();
}

export function compareReportSortValues(
  a: string | number,
  b: string | number,
  dir: ReportTableSortDir,
): number {
  let cmp: number;
  if (typeof a === "number" && typeof b === "number") {
    cmp = a - b;
  } else {
    const sa = String(a);
    const sb = String(b);
    const na = parseNumericSort(sa);
    const nb = parseNumericSort(sb);
    if (na !== null && nb !== null) cmp = na - nb;
    else cmp = sa.localeCompare(sb, undefined, { numeric: true, sensitivity: "base" });
  }
  if (cmp === 0) return 0;
  return dir === "asc" ? cmp : -cmp;
}

export function sortReportTableRows(
  rows: ReportTableRow[],
  column: ReportTableColumn,
  dir: ReportTableSortDir,
): ReportTableRow[] {
  return [...rows].sort((ra, rb) =>
    compareReportSortValues(
      getReportCellSortValue(ra, column),
      getReportCellSortValue(rb, column),
      dir,
    ),
  );
}
