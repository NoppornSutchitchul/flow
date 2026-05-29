import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";

import { BackNavLink } from "../layout/BackNavButton";
import { AdminPageHeader } from "./AdminPageHeader";

interface Props {
  title?: string;
  intro?: string;
  actions?: ReactNode;
  /** Child supplies AdminPageHeader (e.g. inventory, users). */
  backOnly?: boolean;
  children: ReactNode;
}

export function AdminManagerLayout({
  title,
  intro,
  actions,
  backOnly = false,
  children,
}: Props) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-3 flex-1 min-h-0">
      <BackNavLink to="/admin">{t("admin.back_to_hub")}</BackNavLink>
      {!backOnly && title ? (
        <AdminPageHeader title={title} intro={intro} actions={actions} />
      ) : null}
      {children}
    </div>
  );
}

export const adminPanelClass =
  "flex min-h-[min(32rem,calc(100vh-14rem))] flex-col overflow-hidden rounded-xl border border-[color:var(--color-line)] bg-white shadow-sm";
