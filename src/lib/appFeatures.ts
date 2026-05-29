import type { ComponentType } from "react";
import {
  BarChart3,
  ClipboardList,
  Home,
  ListChecks,
  Package,
  Plus,
  Settings as SettingsIcon,
  Shield,
} from "lucide-react";

import type { Role, User, UserPermissions } from "./types";

export const APP_FEATURE_KEYS = [
  "overview",
  "queue",
  "requests",
  "quick_request",
  "stock",
  "reports",
  "admin_hub",
  "settings",
] as const;

export type AppFeatureKey = (typeof APP_FEATURE_KEYS)[number];

export type AppFeatureDef = {
  key: AppFeatureKey;
  path: string;
  icon: ComponentType<{ className?: string }>;
  labelKey: string;
};

/** Left of dock (+) — front-of-house / daily ops. */
export const FRONTEND_APP_FEATURES: AppFeatureDef[] = [
  { key: "overview", path: "/", icon: Home, labelKey: "users.feature.overview" },
  { key: "queue", path: "/queue", icon: ListChecks, labelKey: "users.feature.queue" },
  { key: "requests", path: "/requests", icon: ClipboardList, labelKey: "users.feature.requests" },
  {
    key: "quick_request",
    path: "/",
    icon: Plus,
    labelKey: "users.feature.quick_request",
  },
];

/** Right of dock (+) — back-office / admin. */
export const BACKEND_APP_FEATURES: AppFeatureDef[] = [
  { key: "stock", path: "/products", icon: Package, labelKey: "users.feature.stock" },
  { key: "reports", path: "/reports", icon: BarChart3, labelKey: "users.feature.reports" },
  { key: "admin_hub", path: "/admin", icon: Shield, labelKey: "users.feature.admin_hub" },
  { key: "settings", path: "/settings", icon: SettingsIcon, labelKey: "users.feature.settings" },
];

/** Dock back row — admin hub opens from Settings, not the bottom bar. */
const DOCK_BACKEND_APP_FEATURES = BACKEND_APP_FEATURES.filter((f) => f.key !== "admin_hub");

/** Dock left rail — quick_request is only the center (+) button, not a tab. */
const DOCK_FRONTEND_APP_FEATURES = FRONTEND_APP_FEATURES.filter(
  (f) => f.key !== "quick_request",
);

/** Dock order + users table icons (front, then back). */
export const APP_FEATURES: AppFeatureDef[] = [
  ...FRONTEND_APP_FEATURES,
  ...BACKEND_APP_FEATURES,
];

/** Shown on Users admin — admin hub & settings are not per-user toggles. */
export const USER_MANAGED_APP_FEATURES = APP_FEATURES.filter(
  (f) => f.key !== "admin_hub" && f.key !== "settings",
);

export function emptyPermissions(): UserPermissions {
  return {
    overview: false,
    queue: false,
    requests: false,
    quick_request: false,
    stock: false,
    reports: false,
    admin_hub: false,
    settings: false,
  };
}

export function fullPermissions(): UserPermissions {
  return {
    overview: true,
    queue: true,
    requests: true,
    quick_request: true,
    stock: true,
    reports: true,
    admin_hub: true,
    settings: true,
  };
}

/** Dock (+) quick request — separate from opening the requests list. */
export function canUseQuickRequest(user: Pick<User, "role" | "permissions">): boolean {
  if (user.role === "admin") return true;
  return Boolean(user.permissions.quick_request);
}

/** Admin role always has every feature (server enforces too). */
export function hasAppFeature(
  user: Pick<User, "role" | "permissions">,
  key: AppFeatureKey,
): boolean {
  if (user.role === "admin") return true;
  return Boolean(user.permissions[key]);
}

export function dockNavForUser(
  user: Pick<User, "role" | "permissions">,
): { front: AppFeatureDef[]; back: AppFeatureDef[] } {
  if (roleUsesQueueLayout(user.role)) {
    return {
      front: DOCK_FRONTEND_APP_FEATURES.filter((f) =>
        ["overview", "queue", "requests"].includes(f.key),
      ).filter((f) => hasAppFeature(user, f.key)),
      back: DOCK_BACKEND_APP_FEATURES.filter((f) =>
        ["stock", "reports", "settings"].includes(f.key),
      ).filter((f) => hasAppFeature(user, f.key)),
    };
  }
  return {
    front: DOCK_FRONTEND_APP_FEATURES.filter((f) => hasAppFeature(user, f.key)),
    back: DOCK_BACKEND_APP_FEATURES.filter((f) => hasAppFeature(user, f.key)),
  };
}

/** System administrator account (`role === "admin"`). */
export function isSystemAdmin(user: Pick<User, "role"> | null | undefined): boolean {
  return user?.role === "admin";
}

/** Data management hub routes (`/admin/*`) — requires `admin_hub` feature. */
export function canAccessAdminHub(user: Pick<User, "role" | "permissions">): boolean {
  return hasAppFeature(user, "admin_hub");
}

/** Settings page shortcut to the management hub — system administrators only. */
export function canShowAdminHubInSettings(
  user: Pick<User, "role"> | null | undefined,
): boolean {
  return isSystemAdmin(user);
}

/** Full inventory / catalog edits (admin stock page). */
export function canEditCatalog(user: Pick<User, "role" | "permissions">): boolean {
  return hasAppFeature(user, "stock") || hasAppFeature(user, "admin_hub");
}

export function canAccessPath(
  user: Pick<User, "role" | "permissions">,
  path: string,
): boolean {
  if (path === "/") return hasAppFeature(user, "overview");
  if (path === "/queue") return hasAppFeature(user, "queue");
  if (path === "/requests" || path.startsWith("/requests/")) {
    return hasAppFeature(user, "requests");
  }
  if (path === "/products" || path === "/stock") return hasAppFeature(user, "stock");
  if (path.startsWith("/admin")) return hasAppFeature(user, "admin_hub");
  if (path === "/reports") return hasAppFeature(user, "reports");
  if (path === "/settings") return hasAppFeature(user, "settings");
  return true;
}

export function roleUsesQueueLayout(role: Role): boolean {
  return (
    role === "housekeeper" ||
    role === "maintenance" ||
    role === "bellboy" ||
    role === "frontdesk"
  );
}
