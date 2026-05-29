import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Plus, Search, Trash2, UserCheck, X } from "lucide-react";
import clsx from "clsx";

import { Avatar } from "../ui/Avatar";
import { hasAppFeature } from "../../lib/appFeatures";
import { useAuth } from "../../lib/auth";
import { dedupeUsersByDisplayName } from "../../lib/dedupeUsers";
import { useDepartments } from "../../lib/departments";
import { useStaffUsers } from "../../lib/staffUsers";

export type SharedRecipientRow = {
  user_id: number;
  name: string;
};

type UserProfile = {
  initials: string;
  color: string;
  name: string;
  department: string | null;
};

type Props = {
  excludeUserIds: number[];
  sharedRecipients?: SharedRecipientRow[];
  onUnshare?: (userId: number) => void;
  saving: boolean;
  autoFocusSearch?: boolean;
  onPendingChange?: (ids: number[]) => void;
  className?: string;
};

function profileFromShareRow(
  row: SharedRecipientRow,
  usersById: Map<number, UserProfile>,
): UserProfile {
  const full = usersById.get(row.user_id);
  if (full) return full;
  const parts = row.name.trim().split(/\s+/);
  const initials =
    parts.length >= 2
      ? `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase()
      : row.name.slice(0, 2).toUpperCase();
  return { initials, color: "#94a3b8", name: row.name, department: null };
}

function RecipientRow({
  profile,
  departmentLabel,
  disabled,
  onRemove,
  removeLabel,
}: {
  profile: UserProfile;
  departmentLabel: (code: string) => string;
  disabled: boolean;
  onRemove: () => void;
  removeLabel: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-[color:var(--color-paper-2)]/40">
      <Avatar user={{ initials: profile.initials, color: profile.color, name: profile.name }} size="md" />
      <span className="min-w-0 flex-1 truncate leading-tight">
        <span className="block truncate text-sm font-medium">{profile.name}</span>
        {profile.department && (
          <span className="block truncate text-xs text-[color:var(--color-ink-muted)]">
            {departmentLabel(profile.department)}
          </span>
        )}
      </span>
      <button
        type="button"
        disabled={disabled}
        onClick={onRemove}
        aria-label={removeLabel}
        title={removeLabel}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}

export function ReportShareUserPickerPanel({
  excludeUserIds,
  sharedRecipients = [],
  onUnshare,
  saving,
  autoFocusSearch = true,
  onPendingChange,
  className,
}: Props) {
  const { t } = useTranslation();
  const { current } = useAuth();
  const { data: users = [] } = useStaffUsers();
  const { departmentLabel } = useDepartments(true);
  const [search, setSearch] = useState("");
  const [pendingIds, setPendingIds] = useState<number[]>([]);
  const [asideExpanded, setAsideExpanded] = useState(false);

  const sharedKey = sharedRecipients.map((u) => u.user_id).join(",");

  useEffect(() => {
    setSearch("");
    setPendingIds([]);
    const wide =
      typeof window !== "undefined" &&
      window.matchMedia("(min-width: 1024px)").matches;
    setAsideExpanded(wide);
  }, [excludeUserIds.join(","), sharedKey]);

  useEffect(() => {
    onPendingChange?.(pendingIds);
  }, [pendingIds, onPendingChange]);

  const usersById = useMemo(() => {
    const map = new Map<number, (typeof users)[0]>();
    for (const u of dedupeUsersByDisplayName(users)) {
      map.set(u.id, u);
    }
    return map;
  }, [users]);

  const authUsersById = useMemo(() => {
    const map = new Map<number, UserProfile>();
    for (const u of users) {
      map.set(u.id, {
        initials: u.initials,
        color: u.color,
        name: u.name,
        department: u.department,
      });
    }
    return map;
  }, [users]);

  const excluded = useMemo(
    () => new Set([...excludeUserIds, ...pendingIds]),
    [excludeUserIds, pendingIds],
  );

  const reportEligibleUsers = useMemo(() => {
    const list = dedupeUsersByDisplayName(users).filter(
      (u) => u.active && u.id !== current?.id && hasAppFeature(u, "reports"),
    );
    return list.sort((a, b) => a.name.localeCompare(b.name, "th"));
  }, [users, current?.id]);

  const pickableUsers = useMemo(
    () => reportEligibleUsers.filter((u) => !excluded.has(u.id)),
    [reportEligibleUsers, excluded],
  );

  const noReportEligibleUsers = reportEligibleUsers.length === 0;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return pickableUsers;
    return pickableUsers.filter((u) => {
      const dept = u.department ? departmentLabel(u.department) : "";
      return `${u.name} ${u.username} ${dept} ${u.department ?? ""}`
        .toLowerCase()
        .includes(q);
    });
  }, [pickableUsers, search, departmentLabel]);

  const pendingUsers = useMemo(
    () =>
      pendingIds
        .map((id) => usersById.get(id))
        .filter((u): u is NonNullable<typeof u> => Boolean(u)),
    [pendingIds, usersById],
  );

  const sharedCount = sharedRecipients.length;
  const pendingCount = pendingUsers.length;
  const asideEmpty = sharedCount === 0 && pendingCount === 0;

  const addPending = (id: number) => {
    setPendingIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    if (window.matchMedia("(min-width: 1024px)").matches) {
      setAsideExpanded(true);
    }
  };

  const removePending = (id: number) => {
    setPendingIds((prev) => prev.filter((x) => x !== id));
  };

  const clearPending = () => setPendingIds([]);

  const addAllFiltered = () => {
    setPendingIds((prev) => {
      const next = new Set(prev);
      for (const u of filtered) next.add(u.id);
      return [...next];
    });
    if (window.matchMedia("(min-width: 1024px)").matches) {
      setAsideExpanded(true);
    }
  };

  return (
    <div className={clsx("flex min-h-0 min-w-0 flex-1 flex-col", className)}>
      <p className="mb-2 shrink-0 text-xs text-[color:var(--color-ink-muted)]">
        {t("reports.share_pick_user_intro_staged")}
      </p>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:border-r lg:border-[color:var(--color-line)]/80">
          <div className="mb-2 flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--color-ink-muted)]"
                aria-hidden
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus={autoFocusSearch}
                disabled={saving || pickableUsers.length === 0}
                placeholder={
                  pickableUsers.length === 0
                    ? noReportEligibleUsers
                      ? t("reports.share_no_reports_users")
                      : t("reports.share_no_users_left")
                    : t("reports.share_search_user")
                }
                className="w-full rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-paper-2)]/30 py-2.5 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--color-ink)]/12 disabled:opacity-50"
              />
            </div>
            {pickableUsers.length > 0 && (
              <button
                type="button"
                disabled={saving || filtered.length === 0}
                onClick={addAllFiltered}
                className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-paper-2)]/50 px-3.5 text-sm font-semibold hover:bg-[color:var(--color-paper-2)] disabled:opacity-50"
              >
                <UserCheck className="h-4 w-4 shrink-0" aria-hidden />
                {search.trim()
                  ? t("reports.share_select_filtered", { count: filtered.length })
                  : t("reports.share_select_all", { count: pickableUsers.length })}
              </button>
            )}
          </div>

          <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-paper-2)]/15 p-1 [-webkit-overflow-scrolling:touch]">
            {pickableUsers.length === 0 ? (
              <li className="px-2 py-8 text-center text-sm text-[color:var(--color-ink-muted)]">
                {noReportEligibleUsers
                  ? t("reports.share_no_reports_users")
                  : pendingCount > 0 || sharedCount > 0
                    ? t("reports.share_all_added_to_pending")
                    : t("reports.share_no_users_left")}
              </li>
            ) : filtered.length === 0 ? (
              <li className="px-2 py-8 text-center text-sm text-[color:var(--color-ink-muted)]">
                {t("reports.share_user_no_match")}
              </li>
            ) : (
              filtered.map((u) => (
                <li key={u.id}>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => addPending(u.id)}
                    className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition hover:bg-white disabled:opacity-50"
                  >
                    <span
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-semibold text-white"
                      style={{ backgroundColor: u.color }}
                    >
                      {u.initials}
                    </span>
                    <span className="min-w-0 flex-1 truncate leading-tight text-left">
                      <span className="block truncate text-sm font-medium">{u.name}</span>
                      {u.department && (
                        <span className="block truncate text-xs text-[color:var(--color-ink-muted)]">
                          {departmentLabel(u.department)}
                        </span>
                      )}
                    </span>
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-[color:var(--color-line)] bg-white text-[color:var(--color-ink-soft)]">
                      <Plus className="h-4 w-4" aria-hidden />
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>

        <aside
          className={clsx(
            "flex min-h-0 shrink-0 flex-col border-t border-[color:var(--color-line)]/80 lg:w-56 lg:max-h-none lg:border-t-0 lg:border-l xl:w-60",
            asideExpanded && "max-lg:max-h-[min(36vh,11.5rem)]",
          )}
        >
          <div className="flex shrink-0 items-stretch gap-2 border-b border-[color:var(--color-line)]/60 px-2 py-2 lg:px-3">
            <button
              type="button"
              aria-expanded={asideExpanded}
              onClick={() => setAsideExpanded((v) => !v)}
              className={clsx(
                "flex min-w-0 flex-1 items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition",
                "border-[color:var(--color-line)] bg-[color:var(--color-paper-2)]/50 shadow-sm",
                "hover:border-[color:var(--color-ink)]/20 hover:bg-[color:var(--color-paper-2)] active:scale-[0.99]",
                "lg:pointer-events-none lg:rounded-none lg:border-0 lg:bg-transparent lg:px-0 lg:py-2 lg:shadow-none lg:hover:bg-transparent",
              )}
            >
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-[color:var(--color-ink)]">
                  {sharedCount > 0
                    ? t("reports.share_recipients_label", { count: sharedCount })
                    : t("reports.share_pending_label", { count: pendingCount })}
                </span>
                {sharedCount > 0 && pendingCount > 0 && (
                  <span className="mt-0.5 block text-xs font-normal text-[color:var(--color-ink-muted)]">
                    {t("reports.share_pending_label", { count: pendingCount })}
                  </span>
                )}
                {!asideExpanded && (sharedCount > 0 || pendingCount > 0) && (
                  <span className="mt-1 block text-xs font-medium text-[color:var(--color-delivered-fg)] lg:hidden">
                    {sharedCount > 0
                      ? t("reports.share_recipients_view_hint")
                      : t("reports.share_pending_view_hint")}
                  </span>
                )}
              </span>
              <span
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[color:var(--color-line)] bg-white text-[color:var(--color-ink-soft)] lg:hidden"
                aria-hidden
              >
                <ChevronDown
                  className={clsx("h-4 w-4 transition-transform", asideExpanded && "rotate-180")}
                />
              </span>
            </button>
            {pendingCount > 0 && (
              <button
                type="button"
                onClick={clearPending}
                disabled={saving}
                aria-label={t("reports.share_clear_pending")}
                title={t("reports.share_clear_pending")}
                className="hidden h-8 w-8 shrink-0 place-items-center rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-50 lg:grid"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            )}
          </div>

          <div
            className={clsx(
              "min-h-0 flex-1 overflow-y-auto px-2 py-1.5",
              !asideExpanded && "hidden lg:block",
              asideExpanded && "block",
            )}
          >
            {asideEmpty ? (
              <p className="px-2 py-6 text-center text-sm text-[color:var(--color-ink-muted)]">
                {t("reports.share_pending_empty")}
              </p>
            ) : (
              <>
                {sharedCount > 0 && (
                  <ul className="mb-2 space-y-0.5">
                    {sharedRecipients.map((row) => {
                      const profile = profileFromShareRow(row, authUsersById);
                      return (
                        <li key={row.user_id}>
                          <RecipientRow
                            profile={profile}
                            departmentLabel={departmentLabel}
                            disabled={saving || !onUnshare}
                            onRemove={() => onUnshare?.(row.user_id)}
                            removeLabel={t("reports.share_remove_user")}
                          />
                        </li>
                      );
                    })}
                  </ul>
                )}
                {sharedCount > 0 && pendingCount > 0 && (
                  <div
                    className="mb-2 border-t border-[color:var(--color-line)]/70"
                    role="separator"
                  />
                )}
                {pendingCount > 0 ? (
                  <ul className="space-y-0.5">
                    {pendingUsers.map((u) => (
                      <li key={u.id}>
                        <RecipientRow
                          profile={{
                            initials: u.initials,
                            color: u.color,
                            name: u.name,
                            department: u.department,
                          }}
                          departmentLabel={departmentLabel}
                          disabled={saving}
                          onRemove={() => removePending(u.id)}
                          removeLabel={t("reports.share_remove_pending")}
                        />
                      </li>
                    ))}
                  </ul>
                ) : sharedCount > 0 ? (
                  <p className="px-2 py-2 text-center text-xs text-[color:var(--color-ink-muted)]">
                    {t("reports.share_pending_empty")}
                  </p>
                ) : null}
              </>
            )}
          </div>

          {pendingCount > 0 && (
            <div className="flex shrink-0 justify-end border-t border-[color:var(--color-line)]/60 px-2 py-1 lg:hidden">
              <button
                type="button"
                onClick={clearPending}
                disabled={saving}
                aria-label={t("reports.share_clear_pending")}
                title={t("reports.share_clear_pending")}
                className="grid h-8 w-8 place-items-center rounded-md text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
