"use client";

import * as React from "react";

function subscribe(callback: () => void) {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
}

/** Aktueller URL-Anker (z. B. «#anfrage»), z. B. um nach dem Login einen Dialog wieder zu öffnen. */
export function useLocationHash(): string {
  return React.useSyncExternalStore(
    subscribe,
    () => window.location.hash,
    () => "",
  );
}

/** Entfernt den Anker aus der Adresse, ohne die Seite neu zu laden. */
export function clearLocationHash() {
  if (!window.location.hash) return;
  const { pathname, search } = window.location;
  // Zustand null statt history.state: Nur so übernimmt der Next.js-Router die neue Adresse. Sonst
  // schreibt er bei der nächsten Aktualisierung (z. B. nach einer Server Action) den alten Anker zurück.
  window.history.replaceState(null, "", `${pathname}${search}`);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}

/** Login-Link mit Rücksprung auf die aktuelle Seite und optionalem Anker. */
export function loginHref(returnTo: string, anchor?: string, target: "/login" | "/registrieren" = "/login"): string {
  const next = anchor ? `${returnTo.split("#")[0]}#${anchor}` : returnTo;
  return `${target}?weiter=${encodeURIComponent(next)}`;
}
