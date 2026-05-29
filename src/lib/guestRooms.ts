import { useQuery } from "@tanstack/react-query";

import { guestRoomsApi } from "./api";
import { refDataQueryOptions } from "./queryOptions";
import { guestRoomToRoom, type Room } from "./rooms";
import type { GuestRoom } from "./types";

export function useGuestRooms(activeOnly = false) {
  return useQuery({
    queryKey: ["guest-rooms", { activeOnly }],
    queryFn: () => guestRoomsApi.list(activeOnly),
    select: (rows): Room[] => rows.map(guestRoomToRoom),
    ...refDataQueryOptions(),
  });
}

export function useGuestRoomRows(activeOnly = false) {
  return useQuery({
    queryKey: ["guest-rooms", { activeOnly }],
    queryFn: () => guestRoomsApi.list(activeOnly),
    ...refDataQueryOptions(),
  });
}

export function isKnownGuestRoom(number: string, rows: GuestRoom[]): boolean {
  const c = number.trim();
  return rows.some((r) => r.number === c && r.active);
}
