import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import { Layout } from "./components/layout/Layout";
import { RequireAuth } from "./components/layout/RequireAuth";
import { useAuth } from "./lib/auth";
import { getAuthToken } from "./lib/api";
import { useRealtime } from "./lib/realtime";
import { usePresenceSync } from "./lib/presenceSync";
import { queueIsPrimaryHome } from "./lib/format";
import { LoginPage } from "./pages/LoginPage";

const Dashboard = lazy(() =>
  import("./pages/Dashboard").then((m) => ({ default: m.Dashboard })),
);
const MyQueue = lazy(() =>
  import("./pages/MyQueue").then((m) => ({ default: m.MyQueue })),
);
const RequestsPage = lazy(() =>
  import("./pages/Requests").then((m) => ({ default: m.RequestsPage })),
);
const RequestDetailPage = lazy(() =>
  import("./pages/RequestDetail").then((m) => ({ default: m.RequestDetailPage })),
);
const ProductsPage = lazy(() =>
  import("./pages/Products").then((m) => ({ default: m.ProductsPage })),
);
const StockPage = lazy(() =>
  import("./pages/Stock").then((m) => ({ default: m.StockPage })),
);
const ReportsPage = lazy(() =>
  import("./pages/Reports").then((m) => ({ default: m.ReportsPage })),
);
const UsersPage = lazy(() =>
  import("./pages/Users").then((m) => ({ default: m.UsersPage })),
);
const AdminPage = lazy(() =>
  import("./pages/Admin").then((m) => ({ default: m.AdminPage })),
);
const AdminCatalogPage = lazy(() =>
  import("./pages/admin/AdminCatalogPage").then((m) => ({
    default: m.AdminCatalogPage,
  })),
);
const AdminLocationsPage = lazy(() =>
  import("./pages/admin/AdminLocationsPage").then((m) => ({
    default: m.AdminLocationsPage,
  })),
);
const AdminRoomsPage = lazy(() =>
  import("./pages/admin/AdminRoomsPage").then((m) => ({
    default: m.AdminRoomsPage,
  })),
);
const AdminStockPage = lazy(() =>
  import("./pages/admin/AdminStockPage").then((m) => ({
    default: m.AdminStockPage,
  })),
);
const AdminUsersPage = lazy(() =>
  import("./pages/admin/AdminUsersPage").then((m) => ({
    default: m.AdminUsersPage,
  })),
);
const SettingsPage = lazy(() =>
  import("./pages/Settings").then((m) => ({ default: m.SettingsPage })),
);

function RouteLoading() {
  return (
    <div
      className="flex flex-1 items-center justify-center py-16 text-sm text-[color:var(--color-ink-muted)]"
      aria-busy
    >
      …
    </div>
  );
}

function HomeLoading() {
  return (
    <div className="flex flex-col gap-4 animate-pulse" aria-busy>
      <div className="h-8 w-48 rounded-lg bg-[color:var(--color-paper-2)]" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={`home-sk-${i}`}
            className="rounded-xl border border-[color:var(--color-line)] bg-white px-4 py-3 h-[4.25rem]"
          />
        ))}
      </div>
    </div>
  );
}

function Home() {
  const { current, loading } = useAuth();
  if (loading) {
    return <HomeLoading />;
  }
  return (
    <Lazy>
      {current && queueIsPrimaryHome(current) ? <MyQueue /> : <Dashboard />}
    </Lazy>
  );
}

function Lazy({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<RouteLoading />}>{children}</Suspense>;
}

export default function App() {
  const qc = useQueryClient();
  const { current, loading } = useAuth();
  const sessionActive = Boolean(getAuthToken()) && Boolean(current) && !loading;
  useRealtime(qc, sessionActive);
  usePresenceSync(sessionActive);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<Home />} />
        <Route
          path="/queue"
          element={
            <Lazy>
              <MyQueue />
            </Lazy>
          }
        />
        <Route
          path="/requests"
          element={
            <Lazy>
              <RequestsPage />
            </Lazy>
          }
        />
        <Route
          path="/requests/:id"
          element={
            <Lazy>
              <RequestDetailPage />
            </Lazy>
          }
        />
        <Route
          path="/products"
          element={
            <Lazy>
              <ProductsPage />
            </Lazy>
          }
        />
        <Route
          path="/stock"
          element={
            <Lazy>
              <StockPage />
            </Lazy>
          }
        />
        <Route
          path="/reports"
          element={
            <Lazy>
              <ReportsPage />
            </Lazy>
          }
        />
        <Route
          path="/users"
          element={
            <Lazy>
              <UsersPage />
            </Lazy>
          }
        />
        <Route
          path="/admin"
          element={
            <Lazy>
              <AdminPage />
            </Lazy>
          }
        />
        <Route
          path="/admin/catalog"
          element={
            <Lazy>
              <AdminCatalogPage />
            </Lazy>
          }
        />
        <Route
          path="/admin/locations"
          element={
            <Lazy>
              <AdminLocationsPage />
            </Lazy>
          }
        />
        <Route
          path="/admin/rooms"
          element={
            <Lazy>
              <AdminRoomsPage />
            </Lazy>
          }
        />
        <Route
          path="/admin/stock"
          element={
            <Lazy>
              <AdminStockPage />
            </Lazy>
          }
        />
        <Route
          path="/admin/users"
          element={
            <Lazy>
              <AdminUsersPage />
            </Lazy>
          }
        />
        <Route
          path="/settings"
          element={
            <Lazy>
              <SettingsPage />
            </Lazy>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
