import { useLayoutEffect, useState, useEffect } from "react";
import { Outlet, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { BottomNav } from "./BottomNav";
import { Header } from "./Header";
import { QuickRequestModal } from "../modals/QuickRequestModal";
import { useAuth } from "../../lib/auth";
import { guestRoomsApi, hotelLocationsApi, settingsApi } from "../../lib/api";
import { applyTimeAlertSettings, canUseQuickRequest } from "../../lib/format";
import { refDataQueryOptions } from "../../lib/queryOptions";

export function Layout() {
  const [quickOpen, setQuickOpen] = useState(false);
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { current } = useAuth();
  const qc = useQueryClient();

  useLayoutEffect(() => {
    const resetScroll = () => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };
    resetScroll();
    const raf = requestAnimationFrame(resetScroll);
    return () => cancelAnimationFrame(raf);
  }, [location.pathname]);

  useEffect(() => {
    if (params.get("quick") === "1" && current && canUseQuickRequest(current)) {
      setQuickOpen(true);
      params.delete("quick");
      setParams(params, { replace: true });
    }
  }, [params, setParams, current]);

  const { data: timeAlerts } = useQuery({
    queryKey: ["settings", "time-alerts"],
    queryFn: () => settingsApi.getTimeAlerts(),
    ...refDataQueryOptions(),
  });

  useEffect(() => {
    if (timeAlerts) applyTimeAlertSettings(timeAlerts);
  }, [timeAlerts]);

  useEffect(() => {
    if (!current) return;
    void qc.prefetchQuery({
      queryKey: ["hotel-locations", { activeOnly: false }],
      queryFn: () => hotelLocationsApi.list(false),
      ...refDataQueryOptions(),
    });
    void qc.prefetchQuery({
      queryKey: ["guest-rooms", { activeOnly: false }],
      queryFn: () => guestRoomsApi.list(false),
      ...refDataQueryOptions(),
    });
  }, [current, qc]);

  return (
    <div className="mx-auto flex min-h-dvh w-full min-w-0 max-w-[1100px] flex-col overflow-x-hidden px-3 py-3 pb-[calc(5.75rem+env(safe-area-inset-bottom,0px))] sm:px-5 sm:pb-28">
      <Header />

      <main className="mt-3 flex-1 flex flex-col min-h-0">
        <Outlet />
      </main>

      <BottomNav onQuickRequest={() => setQuickOpen(true)} />

      <QuickRequestModal
        open={quickOpen}
        onClose={() => setQuickOpen(false)}
        creatorId={current?.id}
        onCreated={(req) => {
          setQuickOpen(false);
          navigate(`/requests/${req.id}`);
        }}
      />
    </div>
  );
}
