import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { LogOut, MoreHorizontal, Settings as SettingsIcon } from "lucide-react";
import clsx from "clsx";

import { Avatar } from "../ui/Avatar";
import { FlowLogo } from "./FlowLogo";
import { HeaderDateTime } from "./HeaderDateTime";
import { usePresenceStatus } from "../../hooks/usePresenceStatus";
import { userPositionSubtitle } from "../../lib/format";
import { useAuth } from "../../lib/auth";
import { useNavigate } from "react-router-dom";
import { PresenceIndicator } from "../ui/PresenceIndicator";

export function Header() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { current, signOut, loading } = useAuth();
  const presence = usePresenceStatus(Boolean(current) && !loading);
  const [openMenu, setOpenMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setOpenMenu(false);
    }
    if (openMenu) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [openMenu]);

  return (
    <header className="relative z-30 flex min-w-0 items-center gap-2">
      <Link
        to="/"
        className="flex w-fit shrink-0 items-center gap-2 rounded-2xl border border-[color:var(--color-line)] bg-white px-2 py-1.5 text-[color:var(--color-ink)] shadow-sm transition-[box-shadow,border-color,background-color] hover:border-[color:var(--color-ink)]/12 hover:shadow sm:gap-2.5 sm:px-3 sm:py-2"
        aria-label={t("nav.dashboard")}
      >
        <FlowLogo className="h-8 w-8 shrink-0 sm:h-9 sm:w-9" />
        <span className="hidden font-semibold tracking-tight text-xl sm:inline">
          {t("brand")}
        </span>
      </Link>

      <div className="flex min-w-0 flex-1 justify-center px-0.5">
        <HeaderDateTime lang={i18n.language} />
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <div ref={menuRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setOpenMenu((v) => !v)}
            aria-label={current?.name ?? t("nav.settings")}
            className={clsx(
              "flex items-center gap-2 rounded-xl border border-[color:var(--color-line)] bg-white py-1.5 text-sm shadow-sm transition-[box-shadow,border-color,background-color]",
              "pl-1.5 pr-2 sm:gap-2.5 sm:px-3",
              "hover:border-[color:var(--color-ink)]/12 hover:shadow",
              openMenu && "border-[color:var(--color-ink)]/18 shadow-md",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-ink)]/10",
            )}
          >
            <Avatar user={current} className="shrink-0" presence={presence} />
            <span className="hidden min-w-0 flex-col justify-center gap-0.5 text-left leading-tight min-[420px]:flex">
              <span className="block max-w-[6.5rem] truncate font-medium sm:max-w-[9.5rem] md:max-w-[12rem]">
                {current?.name ?? "—"}
              </span>
              <span className="block max-w-[6.5rem] truncate text-xs text-[color:var(--color-ink-muted)] sm:max-w-[9.5rem] md:max-w-[12rem]">
                {current ? userPositionSubtitle(current, (k) => t(k)) : ""}
              </span>
            </span>
            <MoreHorizontal
              aria-hidden
              className="h-4 w-4 shrink-0 text-[color:var(--color-ink-muted)]"
            />
          </button>

          {openMenu && (
            <div className="absolute right-0 mt-2 w-64 rounded-xl border border-[color:var(--color-line)] bg-white shadow-lg z-50 overflow-hidden">
              <div className="px-3 py-3 border-b border-[color:var(--color-line)] flex items-center gap-3">
                <Avatar user={current} size="md" presence={presence} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{current?.name ?? "—"}</p>
                  <p className="text-xs text-[color:var(--color-ink-muted)] truncate">
                    {current ? userPositionSubtitle(current, (k) => t(k)) : ""}
                  </p>
                  <PresenceIndicator
                    status={presence}
                    showLabel
                    className="mt-1"
                  />
                </div>
              </div>
              <ul>
                <li>
                  <Link
                    to="/settings"
                    onClick={() => setOpenMenu(false)}
                    className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-[color:var(--color-paper-2)]"
                  >
                    <SettingsIcon className="w-4 h-4 text-[color:var(--color-ink-muted)]" />
                    {t("nav.settings")}
                  </Link>
                </li>
                {current && (
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        setOpenMenu(false);
                        void signOut().finally(() => {
                          navigate("/login", { replace: true, state: null });
                        });
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-700 hover:bg-red-50"
                    >
                      <LogOut className="w-4 h-4 shrink-0" aria-hidden />
                      {t("common.logout")}
                    </button>
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      </div>

    </header>
  );
}
