import type { OfferType, PropertyType } from "@/lib/constants";
import { toSearchParams, type SearchCriteria } from "@/lib/search/criteria";

/**
 * Schnellsuche der Startseite. Baut aus wenigen Feldern dieselben Suchkriterien und URLs wie die
 * Suchseite (toSearchParams) – keine eigene Suchlogik.
 */

/** Preisgrenzen je Angebotsart: Kaufpreis bzw. Monatsmiete in CHF */
export const HERO_PRICE_OPTIONS: Record<OfferType, readonly number[]> = {
  sale: [300_000, 500_000, 750_000, 1_000_000, 1_250_000, 1_500_000, 2_000_000, 3_000_000, 5_000_000],
  rent: [1_000, 1_500, 2_000, 2_500, 3_000, 3_500, 4_000, 5_000, 7_500],
};

export const HERO_ROOM_OPTIONS: readonly number[] = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6];

/** Vereinfachte Objektarten; jede Gruppe sucht nach allen passenden Objekttypen. */
export const HERO_TYPE_GROUPS: ReadonlyArray<{ value: string; label: string; types: PropertyType[] }> = [
  { value: "wohnung", label: "Wohnung", types: ["apartment"] },
  { value: "haus", label: "Haus", types: ["single_family_house", "semi_detached_house", "terraced_house", "multi_family_house"] },
  { value: "grundstueck", label: "Grundstück", types: ["plot"] },
  { value: "gewerbe", label: "Gewerbe und Büro", types: ["commercial", "office"] },
  { value: "neubau", label: "Neubauprojekt", types: ["new_build_project"] },
];

export interface HeroSearchInput {
  offer: OfferType;
  /** Text im Ortsfeld */
  place: string;
  /** Strukturierter Treffer aus der Ortssuche (gilt nur, solange der Text unverändert ist) */
  location: Partial<SearchCriteria>;
  typeGroup: string;
  priceMax: string;
  roomsMin: string;
}

export function heroSearchCriteria(input: HeroSearchInput): SearchCriteria {
  const place = input.place.trim();
  const location = input.location.label && input.location.label === input.place ? input.location : place ? { q: place, label: place } : {};
  const group = HERO_TYPE_GROUPS.find((g) => g.value === input.typeGroup);
  const criteria: SearchCriteria = {
    offer: input.offer,
    ...location,
    types: group ? [...group.types] : undefined,
    price_max: input.priceMax ? Number(input.priceMax) : undefined,
    rooms_min: input.roomsMin ? Number(input.roomsMin) : undefined,
  };
  // Ort mit Koordinaten (Gemeinde, PLZ): standardmässig 10 km Umkreis wie auf der Suchseite
  if (criteria.lat && criteria.lng && !criteria.radius && !criteria.canton) criteria.radius = 10;
  return criteria;
}

/**
 * Ziel-URL der Suche (/kaufen bzw. /mieten). Mit openFilters öffnet die Suchseite das Filter-Panel
 * (Anker #filter, siehe search-toolbar.tsx).
 */
export function heroSearchHref(input: HeroSearchInput, options: { openFilters?: boolean } = {}): string {
  const params = toSearchParams({ criteria: heroSearchCriteria(input) }, { omitOffer: true });
  const path = input.offer === "sale" ? "/kaufen" : "/mieten";
  return `${path}${params.size ? `?${params.toString()}` : ""}${options.openFilters ? "#filter" : ""}`;
}
