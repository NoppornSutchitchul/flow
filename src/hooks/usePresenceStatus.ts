import { useEffect, useMemo, useState } from "react";

import { resolvePresenceStatus, type PresenceStatus } from "../lib/presence";

/** Local presence from tab visibility + window focus (no server heartbeat). */
export function usePresenceStatus(isLoggedIn: boolean): PresenceStatus {
  const [documentVisible, setDocumentVisible] = useState(
    () =>
      typeof document === "undefined" ||
      document.visibilityState === "visible",
  );
  const [windowFocused, setWindowFocused] = useState(
    () => typeof document === "undefined" || document.hasFocus(),
  );

  useEffect(() => {
    const syncVisible = () => {
      setDocumentVisible(document.visibilityState === "visible");
    };
    const syncFocus = () => {
      setWindowFocused(document.hasFocus());
    };

    document.addEventListener("visibilitychange", syncVisible);
    window.addEventListener("focus", syncFocus);
    window.addEventListener("blur", syncFocus);
    return () => {
      document.removeEventListener("visibilitychange", syncVisible);
      window.removeEventListener("focus", syncFocus);
      window.removeEventListener("blur", syncFocus);
    };
  }, []);

  return useMemo(
    () =>
      resolvePresenceStatus(isLoggedIn, documentVisible, windowFocused),
    [isLoggedIn, documentVisible, windowFocused],
  );
}
