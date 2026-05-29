import type { Department, JobTitle, User } from "./types";

/** Job title presets scoped to a single department. */
export function jobTitlesForDepartment(
  rows: JobTitle[],
  department: Department | string,
): JobTitle[] {
  return rows.filter((r) => r.department === department);
}

export function jobTitleDepartment(
  rows: JobTitle[],
  label: string,
): Department | null {
  const row = rows.find((r) => r.label === label);
  return (row?.department as Department | null) ?? null;
}

export function jobTitleDepartmentByLabel(rows: JobTitle[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of rows) {
    if (row.department) map.set(row.label, row.department);
  }
  return map;
}

/** Job-title preset department (if any) for a user row. */
export function userJobTitleDepartmentCode(
  user: Pick<User, "job_title">,
  jobTitleDepts: Map<string, string>,
): string | null {
  const label = user.job_title?.trim();
  if (!label) return null;
  return jobTitleDepts.get(label) ?? null;
}

/** Staff whose job-title preset is in `deptCode` but User.department still differs. */
export function usersWithJobTitleDeptMismatch(
  users: User[],
  deptCode: string,
  jobTitleDepts: Map<string, string>,
): User[] {
  return users.filter((u) => {
    const jtDept = userJobTitleDepartmentCode(u, jobTitleDepts);
    return jtDept === deptCode && u.department !== deptCode;
  });
}
