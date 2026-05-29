import { useTranslation } from "react-i18next";

import { CatalogItemsManager } from "../../components/modals/CatalogItemsManagerModal";
import { AdminManagerLayout } from "../../components/admin/AdminManagerLayout";
import { AdminPageHeader } from "../../components/admin/AdminPageHeader";
import { RequireAdmin } from "../../components/admin/RequireAdmin";

export function AdminCatalogPage() {
  const { t } = useTranslation();

  return (
    <RequireAdmin>
      <AdminManagerLayout backOnly>
        <div className="flex flex-1 flex-col gap-3 min-h-0">
          <AdminPageHeader
            title={t("admin.catalog_modal_title")}
            intro={t("admin.catalog_modal_intro")}
          />
          <CatalogItemsManager />
        </div>
      </AdminManagerLayout>
    </RequireAdmin>
  );
}
