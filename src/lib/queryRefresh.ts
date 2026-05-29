import type { QueryClient, QueryKey } from "@tanstack/react-query";

/**
 * Refresh only queries that are on screen, using prefetch (keeps previous data visible).
 * Prefer this over `invalidateQueries` for WebSocket-driven updates.
 */
export async function prefetchObservedQueries(
  qc: QueryClient,
  queryKey: QueryKey,
): Promise<void> {
  const targets = qc
    .getQueryCache()
    .findAll({ queryKey })
    .filter((q) => q.getObserversCount() > 0);

  await Promise.all(
    targets.map((q) => {
      const queryFn = q.options.queryFn;
      if (!queryFn) return Promise.resolve();
      return qc.prefetchQuery({
        queryKey: q.queryKey,
        queryFn,
      });
    }),
  );
}
