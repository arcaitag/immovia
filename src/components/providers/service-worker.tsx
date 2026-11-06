"use client";

import * as React from "react";

/** Registriert den Service Worker (nur Produktion), damit Immovia als App installiert werden kann. */
export function ServiceWorkerRegistration() {
  React.useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // Ohne Service Worker funktioniert die Website normal weiter.
    });
  }, []);
  return null;
}
