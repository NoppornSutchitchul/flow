import { Navigate } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import { canAccessAdminHub } from "../../lib/appFeatures";
import type { ReactNode } from "react";

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { current, loading } = useAuth();
  if (loading) return null;
  if (!current || !canAccessAdminHub(current)) {
    return <Navigate to="/" replace />;
  }
  return children;
}
