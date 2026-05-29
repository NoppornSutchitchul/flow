import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import { authApi, getAuthToken, setAuthToken } from "./api";
import {
  SESSION_REVOKED_KEY,
  broadcastSessionRevoked,
} from "./sessionSync";
import type { User } from "./types";

function clearSessionQueries(qc: QueryClient) {
  void qc.cancelQueries({ queryKey: ["auth", "me"] });
  qc.setQueryData(["auth", "me"], null);
  qc.removeQueries({ queryKey: ["auth", "me"] });
  qc.removeQueries({ queryKey: ["users"] });
  qc.removeQueries({ queryKey: ["requests"] });
  qc.removeQueries({ queryKey: ["request"] });
  qc.removeQueries({ queryKey: ["dashboard"] });
}

interface AuthCtx {
  current: User | null;
  setCurrentId: (id: number) => void;
  login: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  loading: boolean;
  authError: string | null;
  clearAuthError: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [authError, setAuthError] = useState<string | null>(null);
  const hasToken = Boolean(getAuthToken());

  const meQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => authApi.me(),
    enabled: hasToken,
    retry: false,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (meQuery.isError) {
      setAuthToken(null);
      void qc.removeQueries({ queryKey: ["auth", "me"] });
    }
  }, [meQuery.isError, qc]);

  const login = useCallback(
    async (username: string, password: string) => {
      setAuthError(null);
      const res = await authApi.login(username.trim(), password);
      setAuthToken(res.token);
      qc.setQueryData(["auth", "me"], res.user);
    },
    [qc],
  );

  const signOut = useCallback(async () => {
    const token = getAuthToken();
    if (token) {
      try {
        await authApi.logout();
      } catch {
        // still clear local session
      }
    }
    broadcastSessionRevoked();
    setAuthToken(null);
    clearSessionQueries(qc);
  }, [qc]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== SESSION_REVOKED_KEY || !e.newValue) return;
      if (!getAuthToken()) return;
      setAuthToken(null);
      clearSessionQueries(qc);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [qc]);

  const value = useMemo<AuthCtx>(() => {
    const current = meQuery.data ?? null;
    const loading = hasToken && meQuery.isLoading;

    return {
      current,
      setCurrentId: () => {
        /* legacy no-op — login is credential-based */
      },
      login,
      signOut,
      loading,
      authError,
      clearAuthError: () => setAuthError(null),
    };
  }, [
    meQuery.data,
    meQuery.isLoading,
    hasToken,
    login,
    signOut,
    authError,
  ]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("AuthProvider missing");
  return v;
}

export function useIsAuthenticated() {
  const { current, loading } = useAuth();
  return { authenticated: Boolean(current) && Boolean(getAuthToken()), loading };
}
