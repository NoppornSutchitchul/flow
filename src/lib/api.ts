import type {
  DashboardStats,
  GuestRoom,
  HotelLocation,
  JobTitle,
  Note,
  Product,
  ProductCategory,
  ReportSummary,
  ReportPresetMeta,
  ReportPresetData,
  CustomReportRead,
  CustomReportSharesRead,
  RequestDetail,
  RequestRead,
  RoomAttributeOption,
  TimeAlertSettings,
  User,
  UserPermissions,
} from "./types";

export class ApiError extends Error {
  readonly payload: unknown;

  constructor(message: string, payload: unknown) {
    super(message);
    this.name = "ApiError";
    this.payload = payload;
  }
}

/** API unreachable (server restarting, offline, or proxy down). */
export class NetworkError extends Error {
  constructor() {
    super("network_unreachable");
    this.name = "NetworkError";
  }
}

function isFetchNetworkFailure(err: unknown): boolean {
  if (!(err instanceof TypeError)) return false;
  const m = err.message.toLowerCase();
  return (
    m === "failed to fetch" ||
    m.includes("networkerror") ||
    m.includes("load failed")
  );
}

function throwApiError(detail: unknown, fallback: string): never {
  if (typeof detail === "string") {
    throw new Error(detail || fallback);
  }
  if (Array.isArray(detail)) {
    const msg = detail
      .map((item) =>
        typeof item === "object" && item && "msg" in item
          ? String((item as { msg: string }).msg)
          : String(item),
      )
      .join(", ");
    throw new Error(msg || fallback);
  }
  if (detail && typeof detail === "object" && "code" in detail) {
    throw new ApiError(String((detail as { code: string }).code), detail);
  }
  throw new Error(fallback);
}

const AUTH_TOKEN_KEY = "flow_auth_token";

export function getAuthToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token: string | null) {
  if (token) localStorage.setItem(AUTH_TOKEN_KEY, token);
  else localStorage.removeItem(AUTH_TOKEN_KEY);
}

const REQUEST_TIMEOUT_MS = 20_000;

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = getAuthToken();
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      signal: init.signal ?? controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers || {}),
      },
    });
  } catch (err) {
    if (err instanceof NetworkError) throw err;
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new NetworkError();
    }
    if (isFetchNetworkFailure(err)) {
      throw new NetworkError();
    }
    throw err;
  } finally {
    window.clearTimeout(timeoutId);
  }
  if (!res.ok) {
    let detail: unknown = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? detail;
    } catch {
      // ignore
    }
    throwApiError(detail, res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

const J = (body: unknown): RequestInit => ({
  method: "POST",
  body: JSON.stringify(body),
});

export const authApi = {
  login: (username: string, password: string) =>
    request<{ token: string; user: User }>("/api/auth/login", J({ username, password })),
  me: () => request<User>("/api/auth/me"),
  logout: () => request<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),
  changePassword: (current_password: string, new_password: string) =>
    request<{ ok: boolean }>("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ current_password, new_password }),
    }),
};

// Users
export const usersApi = {
  list: (opts?: { role?: string; includeInactive?: boolean }) => {
    const params = new URLSearchParams();
    if (opts?.role) params.set("role", opts.role);
    if (opts?.includeInactive) params.set("include_inactive", "true");
    const q = params.toString();
    return request<User[]>(`/api/users${q ? `?${q}` : ""}`);
  },
  create: (
    data: Partial<Omit<User, "id" | "permissions">> & {
      name: string;
      username: string;
      password: string;
      role: string;
      permissions?: UserPermissions;
    },
  ) => request<User>("/api/users", J(data)),
  update: (
    id: number,
    data: Partial<Omit<User, "id">> & { permissions?: UserPermissions },
  ) =>
    request<User>(`/api/users/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  /** Suspend account (active=false). */
  suspend: (id: number) =>
    request<User>(`/api/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ active: false }),
    }),
  /** Re-enable a suspended account. */
  restore: (id: number) =>
    request<User>(`/api/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ active: true }),
    }),
  /** Permanently delete account. */
  purge: (id: number) =>
    request<{ ok: boolean }>(`/api/users/${id}/purge`, { method: "POST" }),
  syncDepartmentsFromJobTitles: (jobTitleDepartment?: string) => {
    const params = new URLSearchParams();
    if (jobTitleDepartment) params.set("job_title_department", jobTitleDepartment);
    const q = params.toString();
    return request<{ ok: boolean; moved: number }>(
      `/api/users/sync-departments-from-job-titles${q ? `?${q}` : ""}`,
      { method: "POST" },
    );
  },
  resetPassword: (id: number, newPassword: string) =>
    request<{ ok: boolean }>(`/api/users/${id}/reset-password`, {
      method: "POST",
      body: JSON.stringify({ new_password: newPassword }),
    }),
};

export type AssignableStaffSnapshot = {
  departments: Record<
    string,
    {
      available: boolean;
      user_ids: number[];
    }
  >;
};

export const assignableStaffApi = {
  check: (room: string, departments: string[], productIds?: number[]) => {
    const params = new URLSearchParams({
      room,
      departments: departments.join(","),
    });
    if (productIds?.length) {
      params.set("product_ids", productIds.join(","));
    }
    return request<AssignableStaffSnapshot>(`/api/assignable-staff?${params}`);
  },
};

export const departmentsApi = {
  list: () => request<import("./types").OrgDepartment[]>("/api/departments"),
  create: (data: { name: string; sort_order?: number }) =>
    request<import("./types").OrgDepartment>("/api/departments", J(data)),
  update: (
    id: number,
    data: Partial<Pick<import("./types").OrgDepartment, "name" | "sort_order">>,
  ) =>
    request<import("./types").OrgDepartment>(`/api/departments/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  remove: (id: number) =>
    request<{ ok: boolean }>(`/api/departments/${id}`, { method: "DELETE" }),
  deleteCheck: (id: number) =>
    request<import("./types").OrgDeleteCheck>(`/api/departments/${id}/delete-check`),
  moveJobTitles: (id: number, targetDepartment: string) =>
    request<{ ok: boolean; moved: number; moved_users?: number }>(
      `/api/departments/${id}/move-job-titles`,
      {
        method: "POST",
        body: JSON.stringify({ target_department: targetDepartment }),
      },
    ),
  syncUsersFromJobTitles: (id: number) =>
    request<{ ok: boolean; moved: number }>(
      `/api/departments/${id}/sync-users-from-job-titles`,
      { method: "POST" },
    ),
};

export const jobTitlesApi = {
  list: (department?: string) =>
    request<JobTitle[]>(
      `/api/job-titles${department != null && department !== "" ? `?department=${encodeURIComponent(department)}` : ""}`,
    ),
  create: (data: { label: string; department: string; sort_order?: number }) =>
    request<JobTitle>("/api/job-titles", J(data)),
  update: (
    id: number,
    data: Partial<Pick<JobTitle, "label" | "department" | "sort_order">>,
  ) =>
    request<JobTitle>(`/api/job-titles/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  remove: (id: number) =>
    request<{ ok: boolean }>(`/api/job-titles/${id}`, { method: "DELETE" }),
  deleteCheck: (id: number) =>
    request<import("./types").OrgDeleteCheck>(`/api/job-titles/${id}/delete-check`),
};

export const hotelLocationsApi = {
  list: (activeOnly = false) =>
    request<HotelLocation[]>(
      `/api/hotel-locations${activeOnly ? "?active_only=true" : ""}`,
    ),
  create: (data: {
    label: string;
    label_en: string;
    icon_emoji?: string | null;
    actor_id?: number;
  }) => request<HotelLocation>("/api/hotel-locations", J(data)),
  update: (
    id: number,
    data: Partial<Pick<HotelLocation, "label" | "label_en" | "icon_emoji">> & {
      actor_id?: number;
    },
  ) =>
    request<HotelLocation>(`/api/hotel-locations/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  remove: (id: number, actor_id?: number) => {
    const qs =
      actor_id != null ? `?actor_id=${encodeURIComponent(String(actor_id))}` : "";
    return request<{ ok: boolean }>(`/api/hotel-locations/${id}${qs}`, {
      method: "DELETE",
    });
  },
};

export const roomOptionsApi = {
  list: () => request<RoomAttributeOption[]>("/api/room-options"),
  create: (data: {
    kind: RoomAttributeOption["kind"];
    code: string;
    label_th?: string;
    label_en?: string;
    value_num?: number | null;
    actor_id?: number;
  }) => request<RoomAttributeOption>("/api/room-options", J(data)),
  update: (
    id: number,
    data: {
      code?: string;
      label_th?: string;
      label_en?: string;
      value_num?: number | null;
      actor_id?: number;
    },
  ) =>
    request<RoomAttributeOption>(`/api/room-options/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  remove: (id: number, actor_id?: number) => {
    const qs =
      actor_id != null ? `?actor_id=${encodeURIComponent(String(actor_id))}` : "";
    return request<{ ok: boolean }>(`/api/room-options/${id}${qs}`, {
      method: "DELETE",
    });
  },
};

export const guestRoomsApi = {
  list: (activeOnly = false) =>
    request<GuestRoom[]>(
      `/api/guest-rooms${activeOnly ? "?active_only=true" : ""}`,
    ),
  create: (data: {
    number: string;
    building: number;
    floor: number;
    type?: GuestRoom["type"];
    view?: GuestRoom["view"];
    area_sqm?: number | null;
    bed?: GuestRoom["bed"];
    connecting_peer?: string | null;
    active?: boolean;
    actor_id?: number;
  }) => request<GuestRoom>("/api/guest-rooms", J(data)),
  update: (
    id: number,
    data: Partial<
      Pick<
        GuestRoom,
        | "number"
        | "building"
        | "floor"
        | "type"
        | "view"
        | "area_sqm"
        | "bed"
        | "connecting_peer"
        | "active"
      >
    > & { actor_id?: number },
  ) =>
    request<GuestRoom>(`/api/guest-rooms/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  remove: (id: number, actor_id?: number) => {
    const qs =
      actor_id != null ? `?actor_id=${encodeURIComponent(String(actor_id))}` : "";
    return request<{ ok: boolean }>(`/api/guest-rooms/${id}${qs}`, {
      method: "DELETE",
    });
  },
};

export const productCategoriesApi = {
  list: (department?: string) => {
    const qs =
      department != null && department !== ""
        ? `?department=${encodeURIComponent(department)}`
        : "";
    return request<ProductCategory[]>(`/api/product-categories${qs}`);
  },
  create: (data: {
    code: string;
    department: string;
    name: string;
    name_en?: string | null;
    icon_emoji?: string | null;
    sort_order?: number;
    actor_id?: number;
  }) => request<ProductCategory>("/api/product-categories", J(data)),
  update: (
    id: number,
    data: Partial<
      Pick<ProductCategory, "name" | "name_en" | "icon_emoji" | "sort_order" | "active">
    > & { actor_id?: number },
  ) =>
    request<ProductCategory>(`/api/product-categories/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  remove: (id: number, actor_id?: number) => {
    const qs =
      actor_id != null ? `?actor_id=${encodeURIComponent(String(actor_id))}` : "";
    return request<{ ok: boolean }>(`/api/product-categories/${id}${qs}`, {
      method: "DELETE",
    });
  },
};

// Products
export const productsApi = {
  list: () => request<Product[]>("/api/products"),
  stockAlerts: (department?: string | null, limit = 32) => {
    const params = new URLSearchParams();
    if (department) params.set("department", department);
    if (limit !== 32) params.set("limit", String(limit));
    const qs = params.toString();
    return request<Product[]>(`/api/products/stock-alerts${qs ? `?${qs}` : ""}`);
  },
  create: (
    data: Partial<Product> & {
      sku: string;
      name: string;
      department: string;
      actor_id?: number;
    },
  ) => request<Product>("/api/products", J(data)),
  update: (id: number, data: Partial<Product> & { actor_id?: number }) =>
    request<Product>(`/api/products/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  remove: (id: number, actor_id?: number) => {
    const qs =
      actor_id != null ? `?actor_id=${encodeURIComponent(String(actor_id))}` : "";
    return request<{ ok: boolean }>(`/api/products/${id}${qs}`, {
      method: "DELETE",
    });
  },
  adjust: (
    id: number,
    delta: number,
    actorId?: number,
    reason?: string,
  ) =>
    request<Product>(
      `/api/products/${id}/adjust`,
      J({
        delta,
        ...(reason ? { reason } : {}),
        ...(actorId != null ? { actor_id: actorId } : {}),
      }),
    ),
};

export const stockApi = {
  check: (
    items: { product_id: number; qty: number }[],
    excludeRequestId?: number,
  ) =>
    request<{ ok: boolean }>(
      "/api/stock/check",
      J({
        items,
        ...(excludeRequestId != null
          ? { exclude_request_id: excludeRequestId }
          : {}),
      }),
    ),
};

// Requests
export interface RequestFilters {
  status?: string;
  scope?: "today" | "delivered_today" | "cancelled_today" | "overdue";
  /** YYYY-MM-DD — requests created on this day (server UTC). */
  on_date?: string;
  department?: string;
  assignee_id?: number;
  q?: string;
}

export const requestsApi = {
  list: (filters: RequestFilters = {}) => {
    const qs = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") qs.append(k, String(v));
    });
    const s = qs.toString();
    return request<RequestRead[]>(`/api/requests${s ? `?${s}` : ""}`);
  },
  get: (id: number) => request<RequestDetail>(`/api/requests/${id}`),
  create: (data: {
    room: string;
    items?: { product_id: number; qty: number; note?: string }[];
    product_ids?: number[];
    custom_items?: string;
    priority?: string;
    delivery_method?: string;
    preferred_assignee_id?: number;
    created_by_id?: number;
    auto_assign?: boolean;
    schedule_mode?: "immediate" | "delay" | "at_time" | "daily";
    scheduled_at?: string;
    schedule_daily_time?: string;
  }) => request<RequestDetail>("/api/requests", J(data)),
  accept: (id: number, actor_id?: number) =>
    request<RequestDetail>(`/api/requests/${id}/accept`, J({ actor_id })),
  start: (id: number, actor_id?: number) =>
    request<RequestDetail>(`/api/requests/${id}/start`, J({ actor_id })),
  pause: (id: number, actor_id?: number, reason?: string) =>
    request<RequestDetail>(`/api/requests/${id}/pause`, J({ actor_id, reason })),
  deliver: (id: number, actor_id?: number) =>
    request<RequestDetail>(`/api/requests/${id}/deliver`, J({ actor_id })),
  reportDnd: (id: number, actor_id?: number, reason?: string) =>
    request<RequestDetail>(`/api/requests/${id}/report-dnd`, J({ actor_id, reason })),
  clearDnd: (id: number, actor_id?: number) =>
    request<RequestDetail>(`/api/requests/${id}/dnd-clear`, J({ actor_id })),
  deferDnd: (id: number, actor_id?: number) =>
    request<RequestDetail>(`/api/requests/${id}/dnd-defer`, J({ actor_id })),
  rush: (id: number, actor_id?: number) =>
    request<RequestDetail>(`/api/requests/${id}/rush`, J({ actor_id })),
  unrush: (id: number, actor_id?: number) =>
    request<RequestDetail>(`/api/requests/${id}/unrush`, J({ actor_id })),
  cancel: (id: number, actor_id?: number, reason?: string) =>
    request<RequestDetail>(`/api/requests/${id}/cancel`, J({ actor_id, reason })),
  updateSchedule: (
    id: number,
    data: {
      schedule_mode: "immediate" | "delay" | "at_time" | "daily";
      scheduled_at?: string;
      schedule_daily_time?: string;
      actor_id?: number;
    },
  ) =>
    request<RequestDetail>(`/api/requests/${id}/schedule`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  updateHold: (
    id: number,
    data: {
      room?: string;
      delivery_method?: string;
      items?: { product_id: number; qty: number; note?: string | null }[];
      schedule_mode?: "immediate" | "delay" | "at_time" | "daily";
      scheduled_at?: string;
      schedule_daily_time?: string;
      actor_id?: number;
    },
  ) =>
    request<RequestDetail>(`/api/requests/${id}/hold`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  reassign: (id: number, assignee_id: number, actor_id?: number) =>
    request<RequestDetail>(`/api/requests/${id}/reassign`, J({ assignee_id, actor_id })),
  addNote: (id: number, body: string, author_id?: number) =>
    request<Note>(`/api/requests/${id}/notes`, J({ body, author_id })),
};

// Dashboard / Reports
export const dashboardApi = {
  stats: (department?: import("./opsDepartment").OpsRoutedDept) => {
    const qs = department
      ? `?department=${encodeURIComponent(department)}`
      : "";
    return request<DashboardStats>(`/api/dashboard/stats${qs}`);
  },
};

export const reportsApi = {
  summary: (days = 7) => request<ReportSummary>(`/api/reports/summary?days=${days}`),
  presets: () => request<ReportPresetMeta[]>("/api/reports/presets"),
  presetData: (
    slug: string,
    days = 7,
    filters?: {
      department?: string;
      status?: string;
      priority?: string;
      assigneeId?: string | number;
      action?: string;
      dateFrom?: string;
      dateTo?: string;
      compareDateFrom?: string;
      compareDateTo?: string;
      limit?: number;
      shift?: string;
      stockStatus?: string;
    },
  ) => {
    const params = new URLSearchParams({ days: String(days) });
    if (filters?.department && filters.department !== "all") {
      params.set("department", filters.department);
    }
    if (filters?.status && filters.status !== "all") {
      params.set("status", filters.status);
    }
    if (filters?.priority && filters.priority !== "all") {
      params.set("priority", filters.priority);
    }
    if (filters?.assigneeId && filters.assigneeId !== "all") {
      params.set("assignee_id", String(filters.assigneeId));
    }
    if (filters?.action && filters.action !== "all") {
      params.set("action", filters.action);
    }
    if (filters?.dateFrom) {
      params.set("date_from", filters.dateFrom);
    }
    if (filters?.dateTo) {
      params.set("date_to", filters.dateTo);
    }
    if (filters?.compareDateFrom) {
      params.set("compare_date_from", filters.compareDateFrom);
    }
    if (filters?.compareDateTo) {
      params.set("compare_date_to", filters.compareDateTo);
    }
    if (filters?.limit !== undefined) {
      params.set("limit", String(filters.limit));
    }
    if (filters?.shift && filters.shift !== "all") {
      params.set("shift", filters.shift);
    }
    if (filters?.stockStatus && filters.stockStatus !== "all") {
      params.set("stock_status", filters.stockStatus);
    }
    return request<ReportPresetData>(
      `/api/reports/presets/${encodeURIComponent(slug)}/data?${params}`,
    );
  },
  customList: () => request<CustomReportRead[]>("/api/reports/custom"),
  customGet: (id: number) =>
    request<CustomReportRead>(`/api/reports/custom/${id}`),
  customShared: () => request<CustomReportRead[]>("/api/reports/custom/shared"),
  customCreate: (body: { title: string; description?: string; layout_json?: string }) =>
    request<CustomReportRead>("/api/reports/custom", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  customUpdate: (
    id: number,
    body: {
      title?: string;
      description?: string;
      layout_json?: string;
    },
  ) =>
    request<CustomReportRead>(`/api/reports/custom/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  customDelete: (id: number) =>
    request<{ ok: boolean }>(`/api/reports/custom/${id}`, { method: "DELETE" }),
  customDuplicate: (id: number) =>
    request<CustomReportRead>(`/api/reports/custom/${id}/duplicate`, {
      method: "POST",
    }),
  customGetShares: (id: number) =>
    request<CustomReportSharesRead>(`/api/reports/custom/${id}/shares`),
  customSetSharing: (id: number, body: { shared_with_all?: boolean }) =>
    request<CustomReportRead>(`/api/reports/custom/${id}/sharing`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  customShareWith: (id: number, body: { user_id: number; permission?: string }) =>
    request<{ ok: boolean }>(`/api/reports/custom/${id}/share`, {
      method: "POST",
      body: JSON.stringify({ permission: "view", ...body }),
    }),
  customUnshareUser: (id: number, userId: number) =>
    request<{ ok: boolean }>(`/api/reports/custom/${id}/share/${userId}`, {
      method: "DELETE",
    }),
};

export const settingsApi = {
  getTimeAlerts: () => request<TimeAlertSettings>("/api/settings/time-alerts"),
  updateTimeAlerts: (data: TimeAlertSettings & { actor_id?: number }) =>
    request<TimeAlertSettings>("/api/settings/time-alerts", {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  health: () => request<{ ok: boolean; time: string }>("/api/health"),
};
