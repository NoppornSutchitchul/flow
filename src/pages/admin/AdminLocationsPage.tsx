import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";

import { HotelLocationsManager } from "../../components/modals/HotelLocationsManagerModal";
import {
  AdminHeaderButton,
  AdminPageHeader,
} from "../../components/admin/AdminPageHeader";
import { AdminManagerLayout } from "../../components/admin/AdminManagerLayout";
import { RequireAdmin } from "../../components/admin/RequireAdmin";

export function AdminLocationsPage() {
  const { t } = useTranslation();
  const [addOpen, setAddOpen] = useState(false);

  return (
    <RequireAdmin>
      <AdminManagerLayout backOnly>
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <AdminPageHeader
            title={t("settings.hotel_locations_modal_title")}
            actions={
              <AdminHeaderButton
                variant="primary"
                onClick={() => setAddOpen(true)}
                className="min-w-[9.5rem] justify-center"
              >
                <Plus className="h-4 w-4 shrink-0" aria-hidden />
                {t("settings.hotel_locations_add")}
              </AdminHeaderButton>
            }
          />
          <HotelLocationsManager addOpen={addOpen} onAddOpenChange={setAddOpen} />
        </div>
      </AdminManagerLayout>
    </RequireAdmin>
  );
}
