import type { Department, Role } from "./types";

export const DEPT_GROUPS: { labelKey: string; departments: Department[] }[] = [
  {
    labelKey: "users.dept_group_org",
    departments: ["executive_management", "front_office", "bell_boy"],
  },
  {
    labelKey: "users.dept_group_ops",
    departments: ["housekeeping", "maintenance"],
  },
];

export const DEPT_ROW_ACCENTS: Record<string, string> = {
  executive_management: "bg-amber-600/90",
  front_office: "bg-indigo-600/88",
  bell_boy: "bg-amber-700/88",
  housekeeping: "bg-emerald-600/90",
  maintenance: "bg-slate-600/90",
};

export function deptRowAccent(code: string): string {
  return DEPT_ROW_ACCENTS[code] ?? "bg-violet-600/88";
}

export function defaultRoleForDepartment(d: Department): Role {
  switch (d) {
    case "housekeeping":
      return "housekeeper";
    case "maintenance":
      return "maintenance";
    case "front_office":
      return "frontdesk";
    case "bell_boy":
      return "bellboy";
    case "executive_management":
      return "manager";
    default:
      return "housekeeper";
  }
}

export function splitDisplayName(name: string): { first: string; last: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "", last: "" };
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

export function joinDisplayName(first: string, last: string): string {
  return [first.trim(), last.trim()].filter(Boolean).join(" ");
}
