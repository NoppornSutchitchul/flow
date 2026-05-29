import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Layers, Plus } from "lucide-react";

import { GuestRoomsManager } from "../../components/modals/GuestRoomsManagerModal";
import { RoomOptionsManagerModal } from "../../components/modals/RoomOptionsManagerModal";
import {
  AdminHeaderButton,
  AdminPageHeader,
} from "../../components/admin/AdminPageHeader";
import { AdminManagerLayout } from "../../components/admin/AdminManagerLayout";
import { RequireAdmin } from "../../components/admin/RequireAdmin";

export function AdminRoomsPage() {
  const { t } = useTranslation();
  const [addOpen, setAddOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);

  return (
    <RequireAdmin>
      <AdminManagerLayout backOnly>
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <AdminPageHeader
            title={t("settings.guest_rooms_modal_title")}
            actions={
              <>
                <AdminHeaderButton
                  onClick={() => setOptionsOpen(true)}
                  className="min-w-[9.5rem] justify-center"
                >
                  <Layers className="h-4 w-4 shrink-0" aria-hidden />
                  {t("settings.guest_rooms_options_btn")}
                </AdminHeaderButton>
                <AdminHeaderButton
                  variant="primary"
                  onClick={() => setAddOpen(true)}
                  className="min-w-[9.5rem] justify-center"
                >
                  <Plus className="h-4 w-4 shrink-0" aria-hidden />
                  {t("settings.guest_rooms_add")}
                </AdminHeaderButton>
              </>
            }
          />
          <GuestRoomsManager addOpen={addOpen} onAddOpenChange={setAddOpen} />
          <RoomOptionsManagerModal
            open={optionsOpen}
            onClose={() => setOptionsOpen(false)}
          />
        </div>
      </AdminManagerLayout>
    </RequireAdmin>
  );
}
