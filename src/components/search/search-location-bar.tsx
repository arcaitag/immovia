"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/select";
import { LocationAutocomplete, locationToCriteria } from "@/components/search/location-autocomplete";
import type { SearchCriteria } from "@/lib/search/criteria";
import { useSearch } from "@/components/search/search-context";
import { patchCriteria, withoutLocation } from "@/components/search/url-state";
import { searchPlaceLabel } from "@/lib/seo/search-metadata";
import { cn } from "@/lib/utils";

const RADIUS_STEPS = [2, 5, 10, 15, 20, 30, 50];
const DEFAULT_RADIUS = 10;

/** Ortssuche (swisstopo) mit Umkreis. Freitext ist erlaubt und durchsucht Ort, PLZ und Titel. */
export function SearchLocationBar({ className }: { className?: string }) {
  const { snapshot, navigate } = useSearch();
  const criteria = snapshot.criteria;
  const currentLabel = searchPlaceLabel(criteria) ?? "";

  const [text, setText] = React.useState(currentLabel);
  const [syncedLabel, setSyncedLabel] = React.useState(currentLabel);
  if (currentLabel !== syncedLabel) {
    setSyncedLabel(currentLabel);
    setText(currentLabel);
  }

  const hasCoordinates = criteria.lat !== undefined && criteria.lng !== undefined;
  // Ohne Gemeinde oder PLZ (z. B. Bezirk) filtert nur der Umkreis.
  const canSearchPlaceOnly = Boolean(criteria.municipality || criteria.postal_code);

  function applyLocation(location: Partial<SearchCriteria> | null) {
    const base = withoutLocation(criteria);
    if (!location) {
      navigate({ criteria: base, bbox: null });
      return;
    }
    const placeOnly = Boolean(location.municipality || location.postal_code);
    let radius: number | undefined;
    if (location.lat !== undefined && location.lng !== undefined) {
      radius = criteria.radius ?? (placeOnly ? undefined : DEFAULT_RADIUS);
    }
    navigate({ criteria: patchCriteria(base, { ...location, radius }), bbox: null });
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const value = text.trim();
    if (value === currentLabel) return;
    if (!value) {
      applyLocation(null);
      return;
    }
    const q = value.slice(0, 80);
    applyLocation({ q, label: q });
  }

  return (
    <form
      role="search"
      aria-label="Ort suchen"
      onSubmit={onSubmit}
      className={cn("flex flex-col gap-2 sm:flex-row sm:items-center", className)}
    >
      <LocationAutocomplete
        id="suche-ort"
        aria-label="Ort, PLZ, Gemeinde oder Kanton"
        className="min-w-0 flex-1"
        value={text}
        onValueChange={setText}
        onSelect={(result) => {
          const location = locationToCriteria(result);
          setText(location.label);
          applyLocation(location);
        }}
      />
      <div className="flex gap-2">
        {hasCoordinates ? (
          <NativeSelect
            aria-label="Umkreis"
            className="h-12 min-w-36"
            value={criteria.radius ?? ""}
            onChange={(event) =>
              navigate({ criteria: patchCriteria(criteria, { radius: event.target.value ? Number(event.target.value) : undefined }) })
            }
          >
            {canSearchPlaceOnly ? <option value="">Nur dieser Ort</option> : null}
            {RADIUS_STEPS.map((km) => (
              <option key={km} value={km}>
                + {km} km
              </option>
            ))}
          </NativeSelect>
        ) : null}
        <Button type="submit" size="lg" className="h-12 flex-1 px-5 sm:flex-none">
          <Search className="size-5" aria-hidden />
          Suchen
        </Button>
      </div>
    </form>
  );
}
