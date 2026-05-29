import { useQuery } from "@tanstack/react-query";

import { usersApi } from "./api";

/** Staff directory — fetch on demand (not on every login). */
export function useStaffUsers(enabled = true) {
  return useQuery({
    queryKey: ["users"],
    queryFn: () => usersApi.list(),
    enabled,
    staleTime: 60_000,
  });
}
