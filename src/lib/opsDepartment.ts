/** Ops departments that use My Queue + department-scoped request pools. */
export type OpsRoutedDept =
  | "housekeeping"
  | "maintenance"
  | "front_office"
  | "bell_boy";

/** Field ops departments whose overview KPIs are narrowed to one pool. */
export type FieldOpsDept = "housekeeping" | "maintenance";

export function opsDeptForRequestScope(
  dept: string | null | undefined,
): OpsRoutedDept | undefined {
  if (
    dept === "housekeeping" ||
    dept === "maintenance" ||
    dept === "front_office" ||
    dept === "bell_boy"
  ) {
    return dept;
  }
  return undefined;
}

/** Overview dashboard — only HK / maintenance floor staff see a filtered slice. */
export function dashboardDeptScope(
  dept: string | null | undefined,
): FieldOpsDept | undefined {
  if (dept === "housekeeping" || dept === "maintenance") {
    return dept;
  }
  return undefined;
}
