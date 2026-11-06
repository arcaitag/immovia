"use client";

import * as React from "react";

/**
 * Meldet einen Seitenaufruf an /api/listings/[id]/view (einmal pro Aufruf der Seite).
 * Die Route zählt pro Besucher und Tag höchstens einmal und ignoriert Bots sowie Inserenten.
 */
export function ListingViewTracker({ listingId }: { listingId: string }) {
  const sent = React.useRef<string | null>(null);
  React.useEffect(() => {
    // Schutz gegen doppelte Effekte (React Strict Mode) für denselben Seitenaufruf
    if (sent.current === listingId) return;
    sent.current = listingId;
    void fetch(`/api/listings/${encodeURIComponent(listingId)}/view`, {
      method: "POST",
      keepalive: true,
      credentials: "same-origin",
    }).catch(() => {
      // Die Statistik ist nicht kritisch für die Seite.
    });
  }, [listingId]);
  return null;
}
