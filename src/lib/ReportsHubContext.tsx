import { createContext, useContext, type ReactNode } from "react";

type ReportsHubContextValue = {
  returnTo: string;
  reportPage: number;
  setReportPage: (page: number) => void;
};

const ReportsHubContext = createContext<ReportsHubContextValue | null>(null);

export function ReportsHubProvider({
  value,
  children,
}: {
  value: ReportsHubContextValue;
  children: ReactNode;
}) {
  return (
    <ReportsHubContext.Provider value={value}>{children}</ReportsHubContext.Provider>
  );
}

export function useReportsHubContext(): ReportsHubContextValue {
  const ctx = useContext(ReportsHubContext);
  if (!ctx) {
    return {
      returnTo: "/reports",
      reportPage: 1,
      setReportPage: () => {},
    };
  }
  return ctx;
}
