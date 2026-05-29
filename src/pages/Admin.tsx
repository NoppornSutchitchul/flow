import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BedDouble, MapPin, Repeat, Users } from "lucide-react";

import { BackNavLink } from "../components/layout/BackNavButton";
import { RequireAdmin } from "../components/admin/RequireAdmin";

export function AdminPage() {
  const { t } = useTranslation();

  return (
    <RequireAdmin>
    <div className="flex flex-col gap-4">
      <BackNavLink to="/settings">{t("admin.back_to_settings")}</BackNavLink>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("admin.title")}
        </h1>
      </header>

      <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        <AdminCard
          to="/admin/users"
          icon={Users}
          title={t("users.title")}
          description={t("users.intro")}
          actionLabel={t("users.table.features")}
        />
        <AdminCard
          to="/admin/stock"
          icon={Repeat}
          title={t("admin.inventory_card_title")}
          description={t("admin.inventory_card_desc")}
          actionLabel={t("admin.inventory_manage")}
        />
        <AdminCard
          to="/admin/locations"
          icon={MapPin}
          title={t("admin.locations_card_title")}
          description={t("admin.locations_card_desc")}
          actionLabel={t("settings.hotel_locations_manage")}
        />
        <AdminCard
          to="/admin/rooms"
          icon={BedDouble}
          title={t("admin.rooms_card_title")}
          description={t("admin.rooms_card_desc")}
          actionLabel={t("settings.guest_rooms_manage")}
        />
      </div>
    </div>
    </RequireAdmin>
  );
}

function AdminCard({
  to,
  icon: Icon,
  title,
  description,
  actionLabel,
}: {
  to: string;
  icon: typeof Users;
  title: string;
  description: string;
  actionLabel: string;
}) {
  return (
    <section className="rounded-xl border border-[color:var(--color-line)] bg-white p-4 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[color:var(--color-paper-2)]">
          <Icon className="w-5 h-5 text-[color:var(--color-delivered-fg)]" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="font-semibold text-base">{title}</h2>
          <p className="text-xs text-[color:var(--color-ink-soft)] mt-1 leading-relaxed">
            {description}
          </p>
        </div>
      </div>
      <Link
        to={to}
        className="mt-auto block w-full rounded-lg bg-[color:var(--color-ink)] px-3 py-2.5 text-center text-sm font-medium text-white hover:opacity-90"
      >
        {actionLabel}
      </Link>
    </section>
  );
}
