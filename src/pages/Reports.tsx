import { Navigate } from "react-router-dom";

import { ReportsHub } from "../components/reports/ReportsHub";
import { canViewReports } from "../lib/format";
import { useAuth } from "../lib/auth";

export function ReportsPage() {
  const { current, loading } = useAuth();

  if (!loading && current && !canViewReports(current)) {
    return <Navigate to="/" replace />;
  }

  if (loading || !current) {
    return null;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ReportsHub />
    </div>
  );
}
