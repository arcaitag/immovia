"use client";

import * as React from "react";
import { X } from "lucide-react";
import { CONDITIONS, PROPERTY_TYPES, cantonName } from "@/lib/constants";
import { formatArea, formatChf, formatNumber } from "@/lib/format";
import type { SearchCriteria } from "@/lib/search/criteria";
import { useSearch } from "@/components/search/search-context";
import { AMENITY_FILTERS } from "@/components/search/filter-panel";
import { patchCriteria, withoutLocation, type SearchSnapshot } from "@/components/search/url-state";

interface Chip {
  key: string;
  label: string;
  remove: Partial<SearchSnapshot>;
}

function range(min: number | undefined, max: number | undefined, format: (n: number) => string): string | null {
  if (min !== undefined && max !== undefined) return `${format(min)} – ${format(max)}`;
  if (min !== undefined) return `ab ${format(min)}`;
  if (max !== undefined) return `bis ${format(max)}`;
  return null;
}

const roomText = (n: number) => formatNumber(n, 1);

export function buildChips(snapshot: SearchSnapshot): Chip[] {
  const c = snapshot.criteria;
  const chips: Chip[] = [];
  const without = (patch: Partial<SearchCriteria>): Partial<SearchSnapshot> => ({ criteria: patchCriteria(c, patch) });

  const place = c.label || c.municipality || c.postal_code || c.q;
  if (place) {
    chips.push({ key: "ort", label: `${place}${c.radius ? ` (+${c.radius} km)` : ""}`, remove: { criteria: withoutLocation(c) } });
  } else if (c.canton) {
    chips.push({ key: "kanton", label: `Kanton ${cantonName(c.canton)}`, remove: without({ canton: undefined }) });
  }
  if (snapshot.bbox) chips.push({ key: "ausschnitt", label: "Kartenausschnitt", remove: { bbox: null } });
  for (const type of c.types ?? []) {
    chips.push({
      key: `typ-${type}`,
      label: PROPERTY_TYPES[type].label,
      remove: without({ types: c.types?.filter((t) => t !== type) }),
    });
  }
  const price = range(c.price_min, c.price_max, (n) => formatChf(n));
  if (price) chips.push({ key: "preis", label: price, remove: without({ price_min: undefined, price_max: undefined }) });
  const rooms = range(c.rooms_min, c.rooms_max, roomText);
  if (rooms) chips.push({ key: "zimmer", label: `${rooms} Zimmer`, remove: without({ rooms_min: undefined, rooms_max: undefined }) });
  const area = range(c.area_min, c.area_max, (n) => formatArea(n));
  if (area) chips.push({ key: "flaeche", label: `Wohnfläche ${area}`, remove: without({ area_min: undefined, area_max: undefined }) });
  if (c.plot_min !== undefined) chips.push({ key: "grundstueck", label: `Grundstück ab ${formatArea(c.plot_min)}`, remove: without({ plot_min: undefined }) });
  if (c.year_min !== undefined) chips.push({ key: "baujahr", label: `Baujahr ab ${c.year_min}`, remove: without({ year_min: undefined }) });
  for (const condition of c.conditions ?? []) {
    chips.push({
      key: `zustand-${condition}`,
      label: CONDITIONS[condition],
      remove: without({ conditions: c.conditions?.filter((x) => x !== condition) }),
    });
  }
  for (const amenity of AMENITY_FILTERS) {
    if (c[amenity.key] === true) {
      const patch: Partial<SearchCriteria> = {};
      patch[amenity.key] = undefined;
      chips.push({ key: amenity.key, label: amenity.label, remove: without(patch) });
    }
  }
  return chips;
}

/** Aktive Filter als entfernbare Chips. */
export function ActiveFilters() {
  const { snapshot, navigate } = useSearch();
  const chips = buildChips(snapshot);
  if (!chips.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Aktive Filter" role="group">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={() => navigate(chip.remove)}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-mint-300 bg-mint-50 pl-3.5 pr-2.5 text-sm font-medium text-forest transition-colors hover:bg-mint-100 focus-visible:outline-2 focus-visible:outline-ring"
          aria-label={`Filter entfernen: ${chip.label}`}
        >
          {chip.label}
          <X className="size-4" aria-hidden />
        </button>
      ))}
      {chips.length > 1 ? (
        <button
          type="button"
          onClick={() => navigate({ criteria: { offer: snapshot.criteria.offer }, bbox: null })}
          className="h-9 rounded-full px-3 text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
        >
          Alle entfernen
        </button>
      ) : null}
    </div>
  );
}
