import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";

import { HoverTooltip } from "../ui/HoverTooltip";
import {
  USER_MANAGED_APP_FEATURES,
  hasAppFeature,
  type AppFeatureKey,
} from "../../lib/appFeatures";
import { usersApi } from "../../lib/api";
import type { User, UserPermissions } from "../../lib/types";

type Props = {
  user: User;
  editable: boolean;
};

export function UserFeatureAccess({ user, editable }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const update = useMutation({
    mutationFn: (next: UserPermissions) =>
      usersApi.update(user.id, { permissions: next }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["users", "admin"] }),
  });

  const locked = user.role === "admin";
  const suspended = !user.active;

  if (locked) {
    return (
      <div className="flex w-full justify-center">
        <span className="text-center text-sm font-medium leading-snug text-emerald-700">
          {t("users.all_permissions_granted")}
        </span>
      </div>
    );
  }

  const toggle = (key: AppFeatureKey) => {
    if (!editable || locked || update.isPending) return;
    const next = { ...user.permissions, [key]: !user.permissions[key] };
    update.mutate(next);
  };

  return (
    <div
      className={clsx(
        "flex flex-nowrap items-center justify-start gap-0.5",
        suspended && "opacity-45",
      )}
      role={editable && !locked ? "group" : undefined}
    >
      {USER_MANAGED_APP_FEATURES.map(({ key, icon: Icon, labelKey }) => {
        const on = !suspended && hasAppFeature(user, key);
        const label = t(labelKey);
        const hint = label;

        const iconBox = clsx(
          "grid h-8 w-8 shrink-0 place-items-center rounded-md border",
          on
            ? "border-emerald-500/40 bg-emerald-50 text-emerald-800"
            : "border-red-300/60 bg-red-50 text-red-600",
        );

        if (editable && !locked) {
          return (
            <HoverTooltip key={key} label={hint}>
              <button
                type="button"
                disabled={update.isPending}
                onClick={() => toggle(key)}
                aria-label={hint}
                aria-pressed={on}
                className={clsx(
                  "grid h-8 w-8 shrink-0 place-items-center rounded-md border transition-colors",
                  on
                    ? "border-emerald-500/40 bg-emerald-50 text-emerald-800 hover:bg-emerald-100/80"
                    : "border-red-300/60 bg-red-50 text-red-600 hover:bg-red-100/80",
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
              </button>
            </HoverTooltip>
          );
        }

        return (
          <HoverTooltip key={key} label={hint}>
            <span className={iconBox} aria-label={hint}>
              <Icon className="h-4 w-4" aria-hidden />
            </span>
          </HoverTooltip>
        );
      })}
    </div>
  );
}
