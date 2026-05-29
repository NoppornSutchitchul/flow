import { keepPreviousData } from "@tanstack/react-query";

import {
  OPS_REFETCH_INTERVAL_MS,
  OPS_STALE_TIME_MS,
  REF_DATA_STALE_TIME_MS,
} from "./polling";
import { isRealtimeConnected } from "./realtimeConnection";

/** Live ops lists (requests, dashboard KPIs, queue). */
export function opsQueryOptions() {
  return {
    staleTime: OPS_STALE_TIME_MS,
    gcTime: 1000 * 60 * 5,
    refetchInterval: () =>
      isRealtimeConnected() ? false : OPS_REFETCH_INTERVAL_MS,
    refetchIntervalInBackground: false,
    placeholderData: keepPreviousData,
  } as const;
}

/** Reference data that changes infrequently (rooms, locations). */
export function refDataQueryOptions() {
  return {
    staleTime: REF_DATA_STALE_TIME_MS,
    gcTime: REF_DATA_STALE_TIME_MS * 2,
  } as const;
}
