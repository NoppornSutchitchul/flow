import { AdminManagerLayout } from "../../components/admin/AdminManagerLayout";
import { RequireAdmin } from "../../components/admin/RequireAdmin";
import { UsersPage } from "../Users";

export function AdminUsersPage() {
  return (
    <RequireAdmin>
      <AdminManagerLayout backOnly>
        <UsersPage embedded />
      </AdminManagerLayout>
    </RequireAdmin>
  );
}
