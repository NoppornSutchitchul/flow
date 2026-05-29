import { AdminManagerLayout } from "../../components/admin/AdminManagerLayout";
import { RequireAdmin } from "../../components/admin/RequireAdmin";
import { StockPage } from "../Stock";

export function AdminStockPage() {
  return (
    <RequireAdmin>
      <AdminManagerLayout backOnly>
        <StockPage embedded />
      </AdminManagerLayout>
    </RequireAdmin>
  );
}
