"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { ImageOff, LocateFixed, X } from "lucide-react";
import { SwissMap } from "@/components/map/swiss-map";
import type { MapBounds, SwissMapMarker } from "@/components/map/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OFFER_TYPES } from "@/lib/constants";
import { useSearch } from "@/components/search/search-context";
import { clampBbox, withoutLocation } from "@/components/search/url-state";
import type { MapListing } from "@/components/search/search-data";
import { cn } from "@/lib/utils";

function MapPreviewCard({ listing, onClose }: { listing: MapListing; onClose: () => void }) {
  return (
    <div className="absolute inset-x-3 bottom-3 z-10 sm:inset-x-auto sm:left-3 sm:w-[22rem]">
      <article className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-float animate-fade-up">
        <Link href={`/immobilien/${listing.slug}`} className="flex min-h-28 gap-3 pr-10 focus-visible:outline-2 focus-visible:outline-ring">
          <div className="relative w-28 shrink-0 bg-muted">
            {listing.imageUrl ? (
              <Image src={listing.imageUrl} alt="" fill sizes="112px" className="object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <ImageOff className="size-6" aria-hidden />
              </div>
            )}
          </div>
          <div className="min-w-0 py-3">
            <div className="flex flex-wrap gap-1">
              <Badge tone="green">{OFFER_TYPES[listing.offerType].label}</Badge>
              {listing.approximate ? <Badge tone="outline">Ungefährer Standort</Badge> : null}
              {listing.isDemo ? <Badge tone="dark">Demo</Badge> : null}
            </div>
            <h3 className="mt-1.5 line-clamp-2 font-display text-[0.9375rem] font-bold leading-snug">{listing.title}</h3>
            <p className="truncate text-xs text-muted-foreground">{listing.locationLabel}</p>
            <p className="mt-1 flex items-baseline gap-1.5">
              <span className="font-display text-base font-extrabold text-brand tabular">{listing.priceValue}</span>
              <span className="text-[11px] text-muted-foreground">{listing.priceLabel}</span>
            </p>
            {listing.facts ? <p className="text-xs text-foreground/80">{listing.facts}</p> : null}
          </div>
        </Link>
        <button
          type="button"
          onClick={onClose}
          aria-label="Vorschau schliessen"
          className="absolute right-1.5 top-1.5 flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          <X className="size-4" aria-hidden />
        </button>
      </article>
    </div>
  );
}

/** Karte mit Preis-Markern der Suchtreffer, Vorschau beim Antippen und Suche im Kartenausschnitt. */
export function SearchResultsMap({
  listings,
  total,
  className,
}: {
  listings: MapListing[];
  total: number;
  className?: string;
}) {
  const { snapshot, navigate } = useSearch();
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [movedBounds, setMovedBounds] = React.useState<MapBounds | null>(null);
  const criteria = snapshot.criteria;

  const markers = React.useMemo<SwissMapMarker[]>(
    () =>
      listings.map((l) => ({
        id: l.id,
        lat: l.lat,
        lng: l.lng,
        label: l.markerLabel,
        ariaLabel: `${l.title}, ${l.locationLabel}, ${l.priceValue}`,
        approximate: l.approximate,
        radiusMeters: l.radiusMeters ?? undefined,
      })),
    [listings],
  );
  const selected = listings.find((l) => l.id === selectedId) ?? null;
  const center =
    criteria.lat !== undefined && criteria.lng !== undefined
      ? { lat: criteria.lat, lng: criteria.lng, zoom: criteria.radius && criteria.radius > 15 ? 9 : 11 }
      : null;

  function searchHere() {
    if (!movedBounds) return;
    const bbox = clampBbox(movedBounds);
    setMovedBounds(null);
    setSelectedId(null);
    if (bbox) navigate({ bbox, criteria: withoutLocation(criteria) });
  }

  const hidden = total - listings.length;

  return (
    <SwissMap
      className={cn("h-[60vh] min-h-[22rem]", className)}
      lazy={false}
      markers={markers}
      ariaLabel="Karte der Suchergebnisse"
      bounds={snapshot.bbox}
      center={center}
      selectedId={selectedId}
      onMarkerClick={setSelectedId}
      onMapClick={() => setSelectedId(null)}
      onUserMove={setMovedBounds}
      maxFitZoom={14}
    >
      <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex flex-col items-center gap-2">
        {movedBounds ? (
          <Button type="button" size="sm" className="pointer-events-auto shadow-float" onClick={searchHere}>
            <LocateFixed aria-hidden /> In diesem Kartenausschnitt suchen
          </Button>
        ) : null}
        {hidden > 0 ? (
          <p className="pointer-events-auto rounded-full bg-white/95 px-3 py-1.5 text-center text-xs font-medium shadow-card">
            Die Karte zeigt {listings.length} von {total} Treffern
            {total > 100 ? ". Verfeinern Sie die Suche oder zoomen Sie hinein." : " (ohne Standortangabe nicht auf der Karte)."}
          </p>
        ) : null}
        {listings.length === 0 ? (
          <p className="pointer-events-auto rounded-full bg-white/95 px-3 py-1.5 text-xs font-medium shadow-card">
            Keine Treffer mit Standort in dieser Suche.
          </p>
        ) : null}
      </div>
      {selected ? <MapPreviewCard listing={selected} onClose={() => setSelectedId(null)} /> : null}
    </SwissMap>
  );
}
