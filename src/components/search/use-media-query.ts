"use client";

import * as React from "react";

/** Reagiert auf eine CSS-Media-Query. Auf dem Server und vor der Hydrierung gilt `fallback`. */
export function useMediaQuery(query: string, fallback = false): boolean {
  const subscribe = React.useCallback(
    (callback: () => void) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", callback);
      return () => media.removeEventListener("change", callback);
    },
    [query],
  );
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => fallback,
  );
}
