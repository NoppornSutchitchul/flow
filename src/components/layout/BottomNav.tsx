import { NavLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import clsx from "clsx";
import type { ComponentType } from "react";

import { useAuth } from "../../lib/auth";
import { dockNavForUser } from "../../lib/appFeatures";
import { canUseQuickRequest } from "../../lib/format";
import type { User } from "../../lib/types";

interface Item {
  to: string;
  icon: ComponentType<{ className?: string }>;
  labelKey: string;
}

function toNavItems(
  defs: { path: string; icon: ComponentType<{ className?: string }>; labelKey: string }[],
): Item[] {
  return defs.map((f) => ({ to: f.path, icon: f.icon, labelKey: f.labelKey }));
}

function buildNav(user: User): { left: Item[]; right: Item[]; hasQuick: boolean } {
  const { front, back } = dockNavForUser(user);
  return {
    left: toNavItems(front),
    right: toNavItems(back),
    hasQuick: canUseQuickRequest(user),
  };
}

interface Props {
  onQuickRequest?: () => void;
}

export function BottomNav({ onQuickRequest }: Props) {
  const { t } = useTranslation();
  const { current, loading } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <nav
        aria-hidden
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-2 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] pt-2"
      >
        <div className="h-14 w-[min(100%,20rem)] animate-pulse rounded-2xl border border-[color:var(--color-line)] bg-white/80 shadow-lg" />
      </nav>
    );
  }

  if (!current) return null;

  const { left, right, hasQuick } = buildNav(current);

  const renderItem = (item: Item) => (
    <div key={item.to}>
      <NavLink
        to={item.to}
        end={item.to === "/"}
        aria-label={t(item.labelKey)}
        className={({ isActive }) =>
          clsx(
            "w-11 h-11 grid place-items-center rounded-xl relative text-[color:var(--color-ink-soft)] hover:bg-[color:var(--color-paper-2)]",
            isActive && "bg-[color:var(--color-paper-2)] text-[color:var(--color-ink)]",
          )
        }
      >
        {({ isActive }) => (
          <>
            <item.icon className="w-5 h-5" />
            {isActive && (
              <span className="absolute -bottom-1 w-1 h-1 rounded-full bg-[color:var(--color-ink)]" />
            )}
          </>
        )}
      </NavLink>
    </div>
  );

  const handleQuick = () => {
    if (onQuickRequest) {
      onQuickRequest();
    } else {
      navigate("/?quick=1");
    }
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-2 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] pt-2">
      <nav
        className="pointer-events-auto flex max-w-full items-center gap-0.5 rounded-2xl border border-[color:var(--color-line)] bg-white/95 px-2 py-1.5 shadow-lg backdrop-blur sm:gap-1 sm:px-3 sm:py-2"
        aria-label="Primary"
      >
        {left.map(renderItem)}
        {hasQuick && (
          <>
            <span className="mx-1 h-7 w-px bg-[color:var(--color-line)]" aria-hidden />
            <div>
              <button
                type="button"
                onClick={handleQuick}
                aria-label={t("nav.quick_request")}
                className="grid h-11 w-11 place-items-center rounded-full bg-[color:var(--color-ink)] text-white hover:opacity-90"
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>
            <span className="mx-1 h-7 w-px bg-[color:var(--color-line)]" aria-hidden />
          </>
        )}
        {right.map(renderItem)}
      </nav>
    </div>
  );
}
