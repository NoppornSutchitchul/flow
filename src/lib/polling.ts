/** Slow fallback poll when WebSocket is down (not a live refresh cadence). */
export const OPS_REFETCH_INTERVAL_MS = 60_000;

/** Ops lists stay warm while connected; WS patches update rows in place. */
export const OPS_STALE_TIME_MS = 30_000;

/** Hotel locations, guest rooms, org metadata — change rarely. */
export const REF_DATA_STALE_TIME_MS = 5 * 60_000;
