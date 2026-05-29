import type { ReactNode } from "react";

/** Consistent max-width container for all BRS preset reports. */
export function BrsReportLayout({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-7xl space-y-6">{children}</div>;
}
